import { MAX_HEARTS } from './heartCapacity';

/**
 * Local study wallet. This is a device preview of balances until the server economy
 * ledger (ECON-01, Team B) is authoritative; it never grants paid value by itself.
 */
export interface WalletState {
  version: 1;
  credits: number;
  xp: number;
  hearts: number;
  /** Epoch ms of the last full heart refill. */
  heartsResetAt: number;
  /** Recently applied idempotency keys, newest last. */
  applied: string[];
}

export interface WalletOperation {
  /** Stable idempotency key, e.g. `${sessionId}:${index}:answer`. */
  key: string;
  credits?: number;
  xp?: number;
  hearts?: number;
}
export type WalletOutcome = 'applied' | 'duplicate' | 'insufficient' | 'capacity' | 'invalid';

export const STARTING_CREDITS = 50;
export const HEART_REFILL_INTERVAL_MS = 24 * 60 * 60 * 1000;
const MAX_APPLIED_KEYS = 2000;
const MAX_BALANCE = 1_000_000_000;

export function defaultWallet(now: number): WalletState {
  return { version: 1, credits: STARTING_CREDITS, xp: 0, hearts: MAX_HEARTS, heartsResetAt: now, applied: [] };
}

function count(value: unknown, max: number): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= max ? value : null;
}

/** Validates stored data; anything malformed is rejected rather than silently trusted. */
export function parseWallet(value: unknown): WalletState | null {
  const v = value as Record<string, unknown> | null;
  if (!v || v.version !== 1) return null;
  const credits = count(v.credits, MAX_BALANCE), xp = count(v.xp, MAX_BALANCE), hearts = count(v.hearts, MAX_HEARTS);
  const resetAt = count(v.heartsResetAt, Number.MAX_SAFE_INTEGER);
  if (credits === null || xp === null || hearts === null || resetAt === null || !Array.isArray(v.applied) ||
      v.applied.some(key => typeof key !== 'string')) return null;
  return { version: 1, credits, xp, hearts, heartsResetAt: resetAt, applied: (v.applied as string[]).slice(-MAX_APPLIED_KEYS) };
}

/** Hearts fully refill once the interval elapses (existing product behavior). */
export function regenerateHearts(state: WalletState, now: number): WalletState {
  if (now - state.heartsResetAt < HEART_REFILL_INTERVAL_MS) return state;
  return { ...state, hearts: MAX_HEARTS, heartsResetAt: now };
}

export function applyWalletOperation(state: WalletState, op: WalletOperation, now: number): { state: WalletState; outcome: WalletOutcome } {
  const deltas = [op.credits ?? 0, op.xp ?? 0, op.hearts ?? 0];
  if (!op.key || op.key.length > 200 || deltas.some(delta => !Number.isSafeInteger(delta))) return { state, outcome: 'invalid' };
  if (state.applied.includes(op.key)) return { state, outcome: 'duplicate' };
  const current = regenerateHearts(state, now);
  const credits = current.credits + (op.credits ?? 0);
  const xp = current.xp + (op.xp ?? 0);
  const hearts = current.hearts + (op.hearts ?? 0);
  if (credits < 0 || xp < 0 || hearts < 0) return { state: current, outcome: 'insufficient' };
  if (hearts > MAX_HEARTS || credits > MAX_BALANCE || xp > MAX_BALANCE) return { state: current, outcome: 'capacity' };
  return {
    state: { ...current, credits, xp, hearts, applied: [...current.applied, op.key].slice(-MAX_APPLIED_KEYS) },
    outcome: 'applied',
  };
}
