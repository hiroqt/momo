import { localDb, type AccountBinding, type LocalDatabase } from '../storage/localDb';
import type { SyncResponse } from '../api/sync';
import type { SyncEvent } from '../../types';
import { classifyFailure, failureCode, isPerEventSyncRejection } from '../api/errors';

type Sender = (events: SyncEvent[]) => Promise<SyncResponse>;

export const SYNC_BATCH_LIMIT = 100;
const STATE_ID = 'events';
const MAX_BACKOFF_MS = 5 * 60 * 1000;

export interface SyncRetryState { failures: number; nextAttemptAt: number; lastErrorCode: string | null }
/** Events the server rejected. Kept on device for explicit retry; never silently dropped. */
export interface HeldSyncEvent { event: SyncEvent; code: string; held_at: string }
export interface SyncSummary { pending: number; held: number; retry: SyncRetryState }

function parseRetry(value: unknown): SyncRetryState {
  const v = value as Partial<SyncRetryState> | null;
  return v && Number.isSafeInteger(v.failures) && Number.isFinite(v.nextAttemptAt)
    ? { failures: v.failures!, nextAttemptAt: v.nextAttemptAt!, lastErrorCode: typeof v.lastErrorCode === 'string' ? v.lastErrorCode : null }
    : { failures: 0, nextAttemptAt: 0, lastErrorCode: null };
}

export function backoffMs(failures: number): number {
  return Math.min(MAX_BACKOFF_MS, 1000 * 2 ** Math.min(Math.max(failures - 1, 0), 16));
}

/**
 * Durable answer-event sync. Events stay in the account's SQLite partition until the
 * server acknowledges their exact ids. Batches never exceed 100 events. A batch the
 * server rejects is split to isolate the offending events, which move to a held
 * queue; transient failures persist an exponential backoff.
 */
export class SyncEngine {
  private running: Promise<void> | undefined;
  private listeners = new Set<() => void>();
  constructor(private readonly database: LocalDatabase = localDb,
    private readonly send: Sender = async events => (await import('../api/sync')).sendSyncBatch(events),
    private readonly uuid: () => Promise<string> = async () => (await import('expo-crypto')).randomUUID(),
    private readonly now: () => number = Date.now) {}

  async recordStudyAnswer(studyItemId: string, result: 'correct' | 'incorrect' | 'review_again', userAnswer?: string): Promise<void> {
    const owner = this.database.getActiveAccountId(), epoch = this.database.getAccountEpoch();
    if (!owner) throw new Error('A verified account is required to sync study progress.');
    const event_id = await this.uuid();
    if (owner!==this.database.getActiveAccountId() || epoch!==this.database.getAccountEpoch()) throw new Error('Account changed during study action.');
    await this.database.enqueueSyncEvent({event_id,study_item_id:studyItemId,result,user_answer:userAnswer,occurred_at:new Date(this.now()).toISOString()});
    void this.flushSyncQueue().catch(()=>{});
  }

  /** Single-flight flush. `force` ignores the persisted backoff (e.g. reconnect, user retry). */
  flushSyncQueue(options: { force?: boolean } = {}): Promise<void> {
    if (this.running) return this.running;
    this.running = this.flush(!!options.force).finally(()=>{this.running=undefined;this.notify();});
    return this.running;
  }

  /** Notified after every flush or hold change so summaries can be re-read. */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }
  private notify() { for (const listener of [...this.listeners]) { try { listener(); } catch { /* listener errors stay local */ } } }

  async getSummary(): Promise<SyncSummary> {
    if (!this.database.getActiveAccountId()) return { pending: 0, held: 0, retry: parseRetry(null) };
    const binding = this.database.currentBinding();
    const [pending, held, retry] = await Promise.all([
      this.database.getPendingSyncEvents(), this.database.readRecords('event_hold', binding), this.readRetry(binding),
    ]);
    return { pending: pending.length, held: held.length, retry };
  }

  /** Explicit user action: return held events to the queue for another attempt. */
  async retryHeldEvents(): Promise<number> {
    const binding = this.database.currentBinding();
    const held = await this.database.readRecords('event_hold', binding);
    const changes = held.flatMap(row => {
      const event = (row.data as HeldSyncEvent | null)?.event;
      return event && event.event_id === row.id
        ? [{ kind: 'event_hold' as const, id: row.id }, { kind: 'event' as const, id: row.id, data: event }]
        : [];
    });
    await this.database.writeRecords(changes, binding);
    this.notify();
    return changes.length / 2;
  }

  private async readRetry(binding: AccountBinding): Promise<SyncRetryState> {
    const row = (await this.database.readRecords('sync_state', binding)).find(r => r.id === STATE_ID);
    return parseRetry(row?.data ?? null);
  }
  private writeRetry(state: SyncRetryState, binding: AccountBinding): Promise<void> {
    return this.database.writeRecords([{ kind: 'sync_state', id: STATE_ID, data: state }], binding);
  }

  private async flush(force: boolean): Promise<void> {
    const owner = this.database.getActiveAccountId(), epoch = this.database.getAccountEpoch();
    if (!owner) return;
    const binding = { owner, epoch };
    const retry = await this.readRetry(binding);
    if (!force && retry.nextAttemptAt > this.now()) return;
    // Snapshot prevents a continuous study stream from making this flush unbounded.
    const pending = await this.database.getPendingSyncEvents();
    try {
      for (let start=0;start<pending.length;start+=SYNC_BATCH_LIMIT) {
        await this.sendBatch(pending.slice(start,start+SYNC_BATCH_LIMIT), binding);
      }
    } catch (error) {
      // Endpoint-level rejections back off like transient failures; events stay pending.
      if (this.database.getActiveAccountId()===owner && this.database.getAccountEpoch()===epoch && classifyFailure(error)!=='auth') {
        const failures = Math.min(retry.failures + 1, 1000);
        await this.writeRetry({ failures, nextAttemptAt: this.now() + backoffMs(failures), lastErrorCode: failureCode(error) }, binding).catch(() => {});
      }
      throw error;
    }
    if (retry.failures || retry.nextAttemptAt) await this.writeRetry(parseRetry(null), binding);
  }

  private async sendBatch(batch: SyncEvent[], binding: AccountBinding): Promise<void> {
    if (!batch.length) return;
    this.assertBinding(binding);
    let response: SyncResponse;
    try {
      response = await this.send(batch);
    } catch (error) {
      this.assertBinding(binding);
      // Only a rejection caused by an event's contents is isolated; anything else
      // (transient, auth, or an endpoint-level 403/404/413) keeps every event pending.
      if (!isPerEventSyncRejection(error)) throw error;
      if (batch.length === 1) { await this.hold(batch[0], failureCode(error), binding); return; }
      // One invalid reference rejects the whole server batch; split to isolate it.
      const middle = Math.ceil(batch.length / 2);
      await this.sendBatch(batch.slice(0, middle), binding);
      await this.sendBatch(batch.slice(middle), binding);
      return;
    }
    if (!Array.isArray(response?.synced_ids)) throw new Error('Sync response is missing acknowledgments.');
    const sent = new Set(batch.map(event=>event.event_id));
    if (response.synced_ids.some(id=>!sent.has(id))) throw new Error('Sync response acknowledged an unknown event.');
    await this.database.removeSyncEvents([...new Set(response.synced_ids)],binding.owner,binding.epoch);
  }

  private hold(event: SyncEvent, code: string, binding: AccountBinding): Promise<void> {
    const held: HeldSyncEvent = { event, code: code.slice(0, 64), held_at: new Date(this.now()).toISOString() };
    return this.database.writeRecords([{ kind: 'event', id: event.event_id }, { kind: 'event_hold', id: event.event_id, data: held }], binding);
  }

  private assertBinding(binding: AccountBinding) {
    if (binding.owner!==this.database.getActiveAccountId() || binding.epoch!==this.database.getAccountEpoch()) throw new Error('Account changed during sync.');
  }
}
export const syncEngine = new SyncEngine();
