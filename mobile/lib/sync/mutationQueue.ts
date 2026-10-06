import { localDb } from '../storage/localDb';
import type { RecordChange } from '../storage/accountStore.types';
import { classifyFailure, failureCode } from '../api/errors';
import { backoffMs } from './syncEngine';
import { createLocalMutationStore, type MutationStore, type MutationType, type QueuedMutation } from './mutationStore';

export type { MutationType, QueuedMutation } from './mutationStore';

export interface MutationQueueState {
  isSyncing: boolean;
  pendingCount: number;
  /** Changes the server refused; kept until the learner retries or dismisses them. */
  blockedCount: number;
  lastSuccessTime: number | null;
  lastError: string | null;
}

type Listener = (state: MutationQueueState) => void;
export interface MutationResult { createdId?: string }
export type MutationExecutor = (mutation: QueuedMutation, resolveId: (id: string) => string) => Promise<MutationResult | void>;
export interface MutationQueueOptions {
  store?: MutationStore;
  uuid?: () => Promise<string>;
  now?: () => number;
}

/** Entity ids a mutation depends on; dependents of a blocked change wait behind it. */
function entityRefs(mutation: QueuedMutation): string[] {
  const p = mutation.payload ?? {};
  return [p.id, p.folderId, p.clientId].filter((value): value is string => typeof value === 'string' && !!value);
}

const MESSAGES = {
  retry: 'A pending change could not sync. It remains queued and will retry.',
  auth: 'Sign in again to sync your library changes.',
  blocked: 'Some library changes need your attention before they can sync.',
};

/**
 * Durable, account-partitioned library mutation ledger. Changes are removed only after
 * the server accepts them. Transient failures back off; rejected changes are held as
 * `blocked` and never silently discarded. Execution is FIFO per account.
 */
export class MutationQueue {
  private listeners: Set<Listener> = new Set();
  private isProcessing = false;
  private lastSuccessTime: number | null = null;
  private lastError: string | null = null;
  private executor?: MutationExecutor;
  private readonly store: MutationStore;
  private readonly uuid: () => Promise<string>;
  private readonly now: () => number;
  private cache: { owner: string | null; mutations: QueuedMutation[] } = { owner: null, mutations: [] };

  constructor(executor?: MutationExecutor,
    private readonly activeAccount: () => string | null = () => localDb.getActiveAccountId(),
    private readonly schedule: (task: () => void) => void = task => { setTimeout(task, 50); },
    options: MutationQueueOptions = {}) {
    this.executor = executor;
    this.store = options.store ?? createLocalMutationStore(localDb);
    this.uuid = options.uuid ?? (async () => (await import('expo-crypto')).randomUUID());
    this.now = options.now ?? Date.now;
  }

  getState(): MutationQueueState {
    const owner = this.activeAccount();
    const mine = this.cache.owner === owner ? this.cache.mutations : [];
    return {
      isSyncing: this.isProcessing,
      pendingCount: mine.filter(m => m.status === 'pending').length,
      blockedCount: mine.filter(m => m.status === 'blocked').length,
      lastSuccessTime: this.lastSuccessTime,
      lastError: this.lastError,
    };
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const state = this.getState();
    this.listeners.forEach((l) => l(state));
  }

  /** Reloads the active account's durable queue (after restart or account switch). */
  async refresh(): Promise<void> {
    const owner = this.activeAccount();
    this.cache = { owner, mutations: owner ? await this.store.list(owner) : [] };
    this.notify();
  }

  /**
   * Durably records a library change, optionally with the optimistic local records it
   * implies (same transaction), then schedules a background flush.
   */
  async enqueue(type: MutationType, payload: any, localChanges: RecordChange[] = [], revert: RecordChange[] = []): Promise<QueuedMutation> {
    const ownerId = this.activeAccount();
    if (!ownerId) throw new Error('Sign in before changing your study library.');
    const id = await this.uuid();
    if (this.activeAccount() !== ownerId) throw new Error('Account changed during library change.');
    const mutation: QueuedMutation = {
      id, type, payload, createdAt: this.now(), retryCount: 0, ownerId,
      status: 'pending', nextAttemptAt: 0, lastErrorCode: null,
      ...(revert.length ? { revert } : {}),
    };
    await this.store.save(ownerId, [mutation], localChanges);
    void import('expo-haptics').then(haptics => haptics.impactAsync(haptics.ImpactFeedbackStyle.Light)).catch(() => {});
    await this.refresh().catch(() => {});
    this.schedule(() => { void this.processQueue(); });
    return mutation;
  }

  /** Explicit learner action: move blocked changes (or one, by id) back to pending. */
  async retryBlocked(id?: string): Promise<void> {
    const owner = this.activeAccount();
    if (!owner) return;
    const blocked = (await this.store.list(owner)).filter(m => m.status === 'blocked' && (id === undefined || m.id === id));
    await this.store.save(owner, blocked.map(m => ({ ...m, status: 'pending' as const, nextAttemptAt: 0 })));
    await this.refresh();
    this.schedule(() => { void this.processQueue({ force: true }); });
  }

  /** Blocked changes, oldest first, for an explicit retry/dismiss surface. */
  async listBlocked(): Promise<QueuedMutation[]> {
    const owner = this.activeAccount();
    return owner ? (await this.store.list(owner)).filter(m => m.status === 'blocked') : [];
  }

  /**
   * Explicit learner action: discard one blocked change they no longer want. A blocked
   * folder create also discards the later changes that reference its client id (they
   * can never succeed without it). The optimistic local records of every discarded
   * change are restored atomically with removal, except records a remaining queued
   * change still owns.
   */
  async dismissBlocked(id: string): Promise<void> {
    const owner = this.activeAccount();
    if (!owner) return;
    const queue = await this.store.list(owner);
    const position = queue.findIndex(m => m.id === id);
    const target = queue[position];
    if (target?.status !== 'blocked') return;
    const dismissed = [target];
    if (target.type === 'CREATE_FOLDER' && typeof target.payload?.clientId === 'string') {
      const clientId = target.payload.clientId as string;
      dismissed.push(...queue.slice(position + 1).filter(m => entityRefs(m).includes(clientId)));
    }
    const dismissedIds = new Set(dismissed.map(m => m.id));
    const key = (c: RecordChange) => `${c.kind}:${c.id}`;
    const stillOwned = new Set(queue.filter(m => !dismissedIds.has(m.id)).flatMap(m => (m.revert ?? []).map(key)));
    // Newest first so the oldest snapshot (the pre-change state) is written last and wins.
    const restore = [...dismissed].reverse().flatMap(m => m.revert ?? []).filter(c => !stillOwned.has(key(c)));
    await this.store.remove(owner, [...dismissedIds], restore);
    await this.refresh();
  }

  async processQueue(options: { force?: boolean } = {}): Promise<void> {
    const ownerId = this.activeAccount();
    if (this.isProcessing || !ownerId) return;
    this.isProcessing = true;
    this.notify();
    try {
      const queue = await this.store.list(ownerId);
      const map = await this.store.idMap(ownerId);
      const resolveId = (value: string) => map[value] ?? value;
      const blockedRefs = new Set<string>();
      for (const current of queue) {
        if (this.activeAccount() !== ownerId) break;
        const refs = entityRefs(current);
        if (current.status === 'blocked') { refs.forEach(ref => blockedRefs.add(ref)); continue; }
        if (refs.some(ref => blockedRefs.has(ref))) continue;
        // FIFO: a change waiting on backoff holds the changes behind it.
        if (!options.force && current.nextAttemptAt > this.now()) break;
        try {
          const result = await this.executeMutation(current, resolveId);
          if (this.activeAccount() !== ownerId) break;
          if (current.type === 'CREATE_FOLDER' && result?.createdId && current.payload.clientId) {
            await this.store.completeCreate(ownerId, current.id, current.payload.clientId, result.createdId);
            map[current.payload.clientId] = result.createdId;
          } else {
            await this.store.remove(ownerId, [current.id]);
          }
          this.lastSuccessTime = this.now();
          this.lastError = null;
        } catch (err) {
          if (this.activeAccount() !== ownerId) break;
          const kind = classifyFailure(err);
          if (kind === 'rejected') {
            await this.store.save(ownerId, [{ ...current, status: 'blocked', lastErrorCode: failureCode(err) }]);
            refs.forEach(ref => blockedRefs.add(ref));
            this.lastError = MESSAGES.blocked;
            continue;
          }
          if (kind === 'auth') { this.lastError = MESSAGES.auth; break; }
          const retryCount = Math.min(current.retryCount + 1, 1000);
          await this.store.save(ownerId, [{ ...current, retryCount, nextAttemptAt: this.now() + backoffMs(retryCount), lastErrorCode: failureCode(err) }]);
          this.lastError = MESSAGES.retry;
          break;
        }
      }
    } finally {
      this.isProcessing = false;
      if (this.activeAccount() === ownerId) await this.refresh().catch(() => {});
      this.notify();
    }
  }

  private async executeMutation(mutation: QueuedMutation, resolveId: (id: string) => string): Promise<MutationResult | void> {
    if (mutation.ownerId !== this.activeAccount()) throw new Error('Account changed during sync.');
    if (this.executor) return this.executor(mutation, resolveId);
    const { executeLibraryMutation } = await import('./libraryMutationExecutor');
    if (mutation.ownerId !== this.activeAccount()) throw new Error('Account changed during sync.');
    return executeLibraryMutation(mutation, resolveId);
  }
}

export const mutationQueue = new MutationQueue();
localDb.onAccountChange(() => { void mutationQueue.refresh().then(() => mutationQueue.processQueue()).catch(() => {}); });
