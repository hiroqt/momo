import type { SyncEvent } from '../../types';
import type { AccountBinding, LocalDatabase } from '../storage/localDb';
import type { RecordChange } from '../storage/accountStore.types';
import type { QuizAnswerStatus } from './quizSession';
import type { WalletService } from './walletService';

export type StudySessionMode = 'quiz' | 'exam' | 'flashcards';
export type SessionAnswerStatus = QuizAnswerStatus | 'review_again';
export interface SessionAnswer {
  answer: string;
  status: SessionAnswerStatus;
  xp: number;
  streak: number;
  heartCost: number;
  event_id: string | null;
  committed_at: string;
}
export interface StudySessionRecord {
  version: 1;
  id: string;
  study_set_id: string;
  mode: StudySessionMode;
  item_ids: string[];
  /** Keyed by question index as a string. */
  answers: Record<string, SessionAnswer>;
  current_index: number;
  /** Remaining timer milliseconds per question index. */
  remaining_ms: Record<string, number>;
  started_at: string;
  updated_at: string;
  completed_at: string | null;
  abandoned_at: string | null;
}
export interface AnswerSync { studyItemId: string; result: SyncEvent['result']; userAnswer?: string }
export type CommitOutcome =
  | { committed: true; session: StudySessionRecord; answer: SessionAnswer }
  | { committed: false; session: StudySessionRecord; reason: 'already_answered' | 'no_hearts' };

const MAX_SESSIONS_PER_ACCOUNT = 50;
const MAX_ITEMS = 1000;
const STATUSES = new Set(['correct', 'incorrect', 'timeout', 'revealed', 'skipped', 'review_again']);

function nonNegativeInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}
function isoOrNull(value: unknown): boolean {
  return value === null || (typeof value === 'string' && Number.isFinite(Date.parse(value)));
}

/** Validates a stored session; malformed rows are never resumed. */
export function parseSession(value: unknown): StudySessionRecord | null {
  const v = value as Record<string, unknown> | null;
  if (!v || v.version !== 1 || typeof v.id !== 'string' || !v.id || typeof v.study_set_id !== 'string' ||
      !['quiz', 'exam', 'flashcards'].includes(String(v.mode)) || !Array.isArray(v.item_ids) ||
      v.item_ids.length > MAX_ITEMS || v.item_ids.some(id => typeof id !== 'string') ||
      !nonNegativeInt(v.current_index) || !v.answers || typeof v.answers !== 'object' ||
      !v.remaining_ms || typeof v.remaining_ms !== 'object' ||
      !isoOrNull(v.started_at) || !isoOrNull(v.updated_at) || !isoOrNull(v.completed_at) || !isoOrNull(v.abandoned_at)) return null;
  for (const [key, raw] of Object.entries(v.answers as Record<string, unknown>)) {
    const a = raw as Record<string, unknown> | null;
    if (!/^\d+$/.test(key) || Number(key) >= v.item_ids.length || !a || typeof a.answer !== 'string' ||
        !STATUSES.has(String(a.status)) || !nonNegativeInt(a.xp) || !nonNegativeInt(a.streak) || !nonNegativeInt(a.heartCost) ||
        !(a.event_id === null || typeof a.event_id === 'string')) return null;
  }
  for (const [key, ms] of Object.entries(v.remaining_ms as Record<string, unknown>)) {
    if (!/^\d+$/.test(key) || !nonNegativeInt(ms)) return null;
  }
  return v as unknown as StudySessionRecord;
}

function sameItems(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sorted = [...b].sort();
  return [...a].sort().every((id, index) => id === sorted[index]);
}

export interface StudySessionDependencies {
  db: LocalDatabase;
  wallet: WalletService;
  uuid: () => string;
  now?: () => Date;
  /** Called after an answer event is durably queued (opportunistic sync). */
  onEventQueued?: () => void;
}

/**
 * Durable study sessions. For a verified account, an answer, its sync event and its
 * reward commit in one SQLite transaction keyed by `session:index`, so a restart
 * can neither lose the answer nor grant the reward twice. Guest previews keep
 * sessions in memory and their wallet on the guest partition.
 */
export class StudySessionService {
  private guestSessions = new Map<string, StudySessionRecord>();
  private chain: Promise<unknown> = Promise.resolve();
  private readonly now: () => Date;

  constructor(private readonly deps: StudySessionDependencies) {
    this.now = deps.now ?? (() => new Date());
    deps.db.onAccountChange(() => { this.guestSessions.clear(); });
  }

  private serial<T>(task: () => Promise<T>): Promise<T> {
    const run = this.chain.catch(() => {}).then(task);
    this.chain = run;
    return run;
  }
  private binding(): AccountBinding | null {
    return this.deps.db.getActiveAccountId() ? this.deps.db.currentBinding() : null;
  }
  private async list(binding: AccountBinding | null): Promise<StudySessionRecord[]> {
    if (!binding) return [...this.guestSessions.values()];
    const rows = await this.deps.db.readRecords('session', binding);
    return rows.map(row => parseSession(row.data)).filter((s): s is StudySessionRecord => !!s);
  }
  private async find(id: string, binding: AccountBinding | null): Promise<StudySessionRecord> {
    const session = (await this.list(binding)).find(s => s.id === id);
    if (!session) throw new Error('This study session is no longer available.');
    return session;
  }
  private async save(sessions: StudySessionRecord[], binding: AccountBinding | null, extra: RecordChange[] = []): Promise<void> {
    if (!binding) { for (const s of sessions) this.guestSessions.set(s.id, s); return; }
    await this.deps.db.writeRecords([...sessions.map(s => ({ kind: 'session' as const, id: s.id, data: s })), ...extra], binding);
  }

  /** Resumes the latest unfinished session for the same set, mode and items, or starts fresh. */
  begin(input: { studySetId: string; mode: StudySessionMode; itemIds: string[]; resume: boolean }): Promise<{ session: StudySessionRecord; resumed: boolean }> {
    return this.serial(async () => {
      const binding = this.binding();
      const all = await this.list(binding);
      const open = all.filter(s => s.study_set_id === input.studySetId && s.mode === input.mode && !s.completed_at && !s.abandoned_at)
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
      const candidate = open[0];
      if (input.resume && candidate && sameItems(candidate.item_ids, input.itemIds)) return { session: candidate, resumed: true };
      const stamp = this.now().toISOString();
      const abandoned = open.map(s => ({ ...s, abandoned_at: stamp, updated_at: stamp }));
      const session: StudySessionRecord = {
        version: 1, id: this.deps.uuid(), study_set_id: input.studySetId, mode: input.mode,
        item_ids: input.itemIds.slice(0, MAX_ITEMS), answers: {}, current_index: 0, remaining_ms: {},
        started_at: stamp, updated_at: stamp, completed_at: null, abandoned_at: null,
      };
      // Bound storage: drop the oldest finished sessions beyond the retention cap.
      const finished = all.filter(s => s.completed_at || s.abandoned_at).sort((a, b) => a.updated_at.localeCompare(b.updated_at));
      const overflow = Math.max(0, all.length + 1 - MAX_SESSIONS_PER_ACCOUNT);
      const pruned = finished.slice(0, overflow).map(s => s.id);
      if (!binding) for (const id of pruned) this.guestSessions.delete(id);
      await this.save([...abandoned.filter(s => !pruned.includes(s.id)), session], binding,
        binding ? pruned.map(id => ({ kind: 'session' as const, id })) : []);
      return { session, resumed: false };
    });
  }

  /**
   * Commits one answer exactly once. The reward key is `session:<id>:<index>`; the
   * session row, optional sync event and wallet snapshot are written atomically.
   */
  commitAnswer(sessionId: string, index: number, answer: Omit<SessionAnswer, 'event_id' | 'committed_at'>, sync: AnswerSync | null): Promise<CommitOutcome> {
    return this.serial(async () => {
      const binding = this.binding();
      const session = await this.find(sessionId, binding);
      if (!Number.isSafeInteger(index) || index < 0 || index >= session.item_ids.length) throw new Error('Invalid study question.');
      if (session.answers[String(index)]) return { committed: false, session, reason: 'already_answered' };
      const stamp = this.now().toISOString();
      const event: SyncEvent | null = sync && binding ? {
        event_id: this.deps.uuid(), study_item_id: sync.studyItemId, result: sync.result,
        user_answer: sync.userAnswer?.slice(0, 10000), occurred_at: stamp,
      } : null;
      const stored: SessionAnswer = { ...answer, event_id: event?.event_id ?? null, committed_at: stamp };
      const next: StudySessionRecord = { ...session, answers: { ...session.answers, [String(index)]: stored }, updated_at: stamp };
      const extra: RecordChange[] = binding
        ? [{ kind: 'session', id: next.id, data: next }, ...(event ? [{ kind: 'event' as const, id: event.event_id, data: event }] : [])]
        : [];
      const result = this.deps.wallet.apply({ key: `session:${session.id}:${index}`, xp: answer.xp, hearts: -answer.heartCost }, extra);
      if (result.outcome === 'insufficient') return { committed: false, session, reason: 'no_hearts' };
      if (result.outcome === 'unavailable' || result.outcome === 'invalid' || result.outcome === 'capacity') {
        throw new Error('Your progress could not be saved right now. Please try again.');
      }
      if (result.outcome === 'duplicate') await this.save([next], binding, extra.slice(1));
      else if (binding) await result.persisted;
      else { await result.persisted; this.guestSessions.set(next.id, next); }
      if (event) this.deps.onEventQueued?.();
      return { committed: true, session: next, answer: stored };
    });
  }

  /** Persists position and timer state; answers are never changed here. */
  saveProgress(sessionId: string, progress: { currentIndex: number; remainingMs: Record<number, number> }): Promise<void> {
    return this.serial(async () => {
      const binding = this.binding();
      const session = await this.find(sessionId, binding);
      if (session.completed_at || session.abandoned_at) return;
      const remaining: Record<string, number> = {};
      for (const [key, value] of Object.entries(progress.remainingMs)) {
        if (Number(key) < session.item_ids.length && Number.isFinite(value)) remaining[key] = Math.max(0, Math.round(value));
      }
      const currentIndex = Math.min(Math.max(0, Math.floor(progress.currentIndex)), Math.max(0, session.item_ids.length - 1));
      await this.save([{ ...session, current_index: currentIndex, remaining_ms: remaining, updated_at: this.now().toISOString() }], binding);
    });
  }

  complete(sessionId: string): Promise<void> { return this.close(sessionId, 'completed_at'); }
  abandon(sessionId: string): Promise<void> { return this.close(sessionId, 'abandoned_at'); }
  private close(sessionId: string, field: 'completed_at' | 'abandoned_at'): Promise<void> {
    return this.serial(async () => {
      const binding = this.binding();
      const session = await this.find(sessionId, binding);
      if (session.completed_at || session.abandoned_at) return;
      const stamp = this.now().toISOString();
      await this.save([{ ...session, [field]: stamp, updated_at: stamp }], binding);
    });
  }

  /**
   * Answer reveal charge: one paid reveal per question per session, idempotent across
   * restarts. Resolves `revealed` only once the charge is durably stored, so a failed
   * write never yields a free reveal.
   */
  async chargeReveal(sessionId: string, index: number, cost: number): Promise<'revealed' | 'insufficient' | 'failed'> {
    const result = this.deps.wallet.apply({ key: `session:${sessionId}:${index}:reveal`, credits: -cost });
    if (result.outcome === 'duplicate') return 'revealed';
    if (result.outcome !== 'applied') return result.outcome === 'insufficient' ? 'insufficient' : 'failed';
    try { await result.persisted; return 'revealed'; } catch { return 'failed'; }
  }
}
