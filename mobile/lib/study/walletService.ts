import type { LocalDatabase, AccountBinding } from '../storage/localDb';
import type { RecordChange } from '../storage/accountStore.types';
import { normalizeHearts } from './heartCapacity';
import {
  applyWalletOperation, defaultWallet, parseWallet, regenerateHearts,
  type WalletOperation, type WalletOutcome, type WalletState,
} from './wallet';

export interface KeyValue {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  multiGet?(keys: readonly string[]): Promise<readonly (readonly [string, string | null])[]>;
}
export interface WalletResult {
  outcome: WalletOutcome | 'unavailable';
  state: WalletState | null;
  /** Resolves once the change (and any extra records) is durably stored. */
  persisted: Promise<void>;
}

export const WALLET_RECORD_ID = 'local';
const GUEST_KEY = '@momo/guest_wallet';
const LEGACY_KEYS = ['@user_credits', '@user_xp', '@user_hearts', '@user_hearts_reset_time'] as const;

/**
 * Owns the in-memory wallet for the active partition (verified account or guest
 * preview) and persists ordered snapshots. Account wallets live in that account's
 * SQLite partition so rewards can commit atomically with study answers.
 */
export class WalletService {
  private state: WalletState | null = null;
  private binding: AccountBinding | null = null;
  private loadToken = 0;
  private chain: Promise<void> = Promise.resolve();
  private listeners = new Set<(state: WalletState | null) => void>();

  constructor(private readonly db: LocalDatabase, private readonly kv: KeyValue, private readonly now: () => number = Date.now) {
    db.onAccountChange(() => { void this.load().catch(() => {}); });
  }

  getState(): WalletState | null { return this.state; }
  subscribe(listener: (state: WalletState | null) => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }
  private publish(state: WalletState | null) {
    this.state = state;
    for (const listener of [...this.listeners]) listener(state);
  }

  /** Loads the active partition's wallet. Corrupt data fails closed to an unavailable wallet. */
  async load(): Promise<WalletState | null> {
    const token = ++this.loadToken;
    const owner = this.db.getActiveAccountId();
    const binding = owner ? this.db.currentBinding() : null;
    this.binding = binding;
    this.publish(null);
    await this.chain.catch(() => {});
    let loaded: WalletState;
    if (binding) {
      const rows = await this.db.readRecords('wallet', binding);
      const row = rows.find(r => r.id === WALLET_RECORD_ID);
      const parsed = row ? parseWallet(row.data) : defaultWallet(this.now());
      if (!parsed) throw new Error('Stored wallet data is corrupt.');
      loaded = parsed;
    } else {
      loaded = await this.loadGuest();
    }
    if (token !== this.loadToken) return this.state;
    const regenerated = regenerateHearts(loaded, this.now());
    this.publish(regenerated);
    if (regenerated !== loaded) this.persist(regenerated, [], binding).catch(() => {});
    return regenerated;
  }

  private async loadGuest(): Promise<WalletState> {
    const raw = await this.kv.getItem(GUEST_KEY);
    if (raw) {
      try {
        const parsed = parseWallet(JSON.parse(raw));
        if (parsed) return parsed;
      } catch { /* corrupt guest preview data resets below */ }
      return defaultWallet(this.now());
    }
    // One-time migration of pre-partition global preview balances into the guest wallet.
    const legacy = this.kv.multiGet ? await this.kv.multiGet(LEGACY_KEYS) : [];
    const values = new Map(legacy.map(([key, value]) => [key, value]));
    const wallet = defaultWallet(this.now());
    const credits = Number(values.get('@user_credits')), xp = Number(values.get('@user_xp'));
    const resetAt = Number(values.get('@user_hearts_reset_time'));
    if (Number.isSafeInteger(credits) && credits >= 0) wallet.credits = credits;
    if (Number.isSafeInteger(xp) && xp >= 0) wallet.xp = xp;
    if (values.get('@user_hearts') != null) wallet.hearts = normalizeHearts(values.get('@user_hearts'));
    if (Number.isSafeInteger(resetAt) && resetAt > 0) wallet.heartsResetAt = resetAt;
    return wallet;
  }

  /**
   * Validates against the in-memory balance synchronously so rapid taps cannot
   * overdraw, then persists in order. `extra` records commit in the same transaction.
   */
  apply(op: WalletOperation, extra: RecordChange[] = []): WalletResult {
    const current = this.state, binding = this.binding;
    if (!current) return { outcome: 'unavailable', state: null, persisted: Promise.reject(new Error('Wallet is still loading.')) };
    if (extra.length && !binding) return { outcome: 'invalid', state: current, persisted: Promise.reject(new Error('A verified account is required.')) };
    const result = applyWalletOperation(current, op, this.now());
    if (result.outcome !== 'applied') {
      return { outcome: result.outcome, state: current, persisted: Promise.resolve() };
    }
    this.publish(result.state);
    return { outcome: 'applied', state: result.state, persisted: this.persist(result.state, extra, binding) };
  }

  private persist(state: WalletState, extra: RecordChange[], binding: AccountBinding | null): Promise<void> {
    const task = this.chain.catch(() => {}).then(async () => {
      if (binding) await this.db.writeRecords([...extra, { kind: 'wallet', id: WALLET_RECORD_ID, data: state }], binding);
      else await this.kv.setItem(GUEST_KEY, JSON.stringify(state));
    });
    // Storage is the source of truth after a failed write. Reload before reporting the
    // failure so callers never observe (or reuse) the unsaved charge and its key.
    const settled = task.catch(async error => {
      if (this.binding === binding) await this.load().catch(() => {});
      throw error;
    });
    // The chain tracks the write only: load() awaits the chain, so it must not wait on load().
    this.chain = task.catch(() => {});
    return settled;
  }
}
