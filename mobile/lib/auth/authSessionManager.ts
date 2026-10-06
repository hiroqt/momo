import type { PublicAuthConfig } from './authConfig';
import type { PkcePair } from './pkce';
import type { SessionStorage, StoredAuthSession } from './sessionStorage';
import { AuthError, parseAuthRedirect, type AuthSession, type SupabaseAuthClient } from './supabaseAuthClient';
import { SessionVerificationError } from './verifiedSession';

export type AuthStatus = 'restoring' | 'signed_out' | 'signed_in';
export type AuthNotice = 'cancelled' | 'expired' | 'failed' | 'not_configured' | null;
export interface AuthState {
  status: AuthStatus;
  accountId: string | null;
  /** Signed in from the device's previously verified session while the backend is unreachable. */
  offline: boolean;
  /** Whether Google sign-in can be offered in this build. */
  configured: boolean;
  busy: boolean;
  notice: AuthNotice;
}

export interface BrowserResult { type: string; url?: string }
export interface IdentityBoundary {
  /** Verifies the token with the backend and binds local storage to the returned account. */
  establish(token: string): Promise<string>;
  /** Confirms the backend still maps this token to the same account without rebinding storage. */
  reverify(token: string): Promise<string>;
  replaceToken(token: string): void;
  /** Uses a previously verified account while offline; the token is re-verified later. */
  bindOffline(token: string, accountId: string): void;
  clear(): void;
}
export interface AuthDependencies {
  config: PublicAuthConfig | null;
  client: SupabaseAuthClient | null;
  storage: SessionStorage;
  identity: IdentityBoundary;
  openAuthSession(url: string, redirectUrl: string): Promise<BrowserResult>;
  createPkce(): Promise<PkcePair>;
  nowSeconds?: () => number;
}

/** Refresh slightly early so a request never leaves with a token about to expire. */
const REFRESH_MARGIN_SECONDS = 60;
const REVERIFY_INTERVAL_SECONDS = 30;

export const AUTH_NOTICE_MESSAGES: Record<Exclude<AuthNotice, null>, string> = {
  cancelled: 'Sign-in was cancelled. You can keep exploring the preview.',
  expired: 'Your session ended. Sign in again to sync your study progress.',
  failed: 'We could not sign you in. Please try again.',
  not_configured: 'Google sign-in is not available in this build yet.',
};

export class AuthSessionManager {
  private state: AuthState;
  private session: StoredAuthSession | null = null;
  private listeners = new Set<(state: AuthState) => void>();
  private refreshing: Promise<boolean> | null = null;
  private lastReverify = 0;
  private generation = 0;
  private readonly now: () => number;

  constructor(private readonly deps: AuthDependencies) {
    this.now = deps.nowSeconds ?? (() => Math.floor(Date.now() / 1000));
    this.state = { status: 'restoring', accountId: null, offline: false, configured: !!deps.client, busy: false, notice: null };
  }

  getState(): AuthState { return this.state; }
  subscribe(listener: (state: AuthState) => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }
  private set(patch: Partial<AuthState>) {
    this.state = { ...this.state, ...patch };
    for (const listener of [...this.listeners]) listener(this.state);
  }
  private signedOut(notice: AuthNotice) {
    this.session = null;
    this.set({ status: 'signed_out', accountId: null, offline: false, busy: false, notice });
  }

  /** Cold start: restore the secure session, refreshing or falling back to offline use. */
  async restore(): Promise<AuthState> {
    const generation = ++this.generation;
    const devToken = this.deps.config?.developmentToken;
    if (devToken) {
      try {
        const accountId = await this.deps.identity.establish(devToken);
        if (generation === this.generation) this.set({ status: 'signed_in', accountId, offline: false, notice: null });
      } catch {
        if (generation === this.generation) this.signedOut('failed');
      }
      return this.state;
    }
    const stored = await this.deps.storage.load().catch(() => null);
    if (generation !== this.generation) return this.state;
    if (!stored) { this.signedOut(null); return this.state; }
    let current: StoredAuthSession = stored;
    if (this.expiring(stored)) {
      try {
        const refreshed = await this.deps.client!.refresh(stored.refresh_token);
        if (refreshed.user_id !== stored.user_id) throw new AuthError('invalid_grant', 'Session account changed.');
        current = { ...refreshed, verified_account_id: stored.verified_account_id };
      } catch (error) {
        if (generation !== this.generation) return this.state;
        if (error instanceof AuthError && error.code === 'network') return this.offline(stored);
        await this.endSession('expired');
        return this.state;
      }
    }
    try {
      const accountId = await this.deps.identity.establish(current.access_token);
      if (generation !== this.generation) return this.state;
      if (accountId !== current.user_id || accountId !== stored.verified_account_id) throw new SessionVerificationError(false);
      this.session = { ...current, verified_account_id: accountId };
      await this.deps.storage.save(this.session);
      this.lastReverify = this.now();
      this.set({ status: 'signed_in', accountId, offline: false, notice: null });
    } catch (error) {
      if (generation !== this.generation) return this.state;
      if (error instanceof SessionVerificationError && error.retryable) return this.offline(current);
      await this.endSession('expired');
    }
    return this.state;
  }

  private offline(session: StoredAuthSession): AuthState {
    this.session = session;
    this.deps.identity.bindOffline(session.access_token, session.verified_account_id);
    this.set({ status: 'signed_in', accountId: session.verified_account_id, offline: true, notice: null });
    return this.state;
  }

  private expiring(session: AuthSession): boolean {
    return session.expires_at - REFRESH_MARGIN_SECONDS <= this.now();
  }

  async signInWithGoogle(): Promise<AuthState> {
    const client = this.deps.client, config = this.deps.config;
    if (!client || !config) { this.set({ notice: 'not_configured' }); return this.state; }
    if (this.state.busy) return this.state;
    const generation = ++this.generation;
    const previous = this.session;
    let identityReplaced = false;
    this.set({ busy: true, notice: null });
    try {
      const pair = await this.deps.createPkce();
      const result = await this.deps.openAuthSession(client.authorizeUrl(pair.challenge, config.redirectUrl), config.redirectUrl);
      if (result.type !== 'success' || !result.url) throw new AuthError('cancelled', 'Sign-in was cancelled.');
      const { code } = parseAuthRedirect(result.url, config.redirectUrl);
      const session = await client.exchangeCode(code, pair.verifier);
      if (generation !== this.generation) return this.state;
      identityReplaced = true;
      const accountId = await this.deps.identity.establish(session.access_token);
      if (accountId !== session.user_id) { this.deps.identity.clear(); throw new AuthError('invalid_response', 'Account mismatch.'); }
      this.session = { ...session, verified_account_id: accountId };
      await this.deps.storage.save(this.session);
      this.lastReverify = this.now();
      if (previous && previous.refresh_token !== session.refresh_token) void client.signOut(previous.access_token).catch(() => {});
      this.set({ status: 'signed_in', accountId, offline: false, busy: false, notice: null });
    } catch (error) {
      if (generation !== this.generation) return this.state;
      const cancelled = error instanceof AuthError && error.code === 'cancelled';
      if (!identityReplaced && previous && this.state.status === 'signed_in') {
        // A cancelled or failed browser step leaves the existing account untouched.
        this.set({ busy: false, notice: cancelled ? 'cancelled' : 'failed' });
      } else if (identityReplaced) {
        // Verification replaced the old identity; fail closed rather than mixing accounts.
        this.deps.identity.clear();
        await this.deps.storage.clear().catch(() => {});
        this.signedOut('failed');
      } else {
        this.set({ busy: false, notice: cancelled ? 'cancelled' : 'failed' });
      }
    }
    return this.state;
  }

  /** Called before API requests: refresh near expiry and re-verify an offline-bound session. */
  async ensureFresh(): Promise<void> {
    const session = this.session;
    if (!session || this.state.status !== 'signed_in') return;
    if (this.expiring(session)) { await this.refresh(); return; }
    if (this.state.offline && this.now() - this.lastReverify >= REVERIFY_INTERVAL_SECONDS) await this.reverify(session);
  }

  private async reverify(session: StoredAuthSession): Promise<void> {
    this.lastReverify = this.now();
    try {
      const accountId = await this.deps.identity.reverify(session.access_token);
      if (this.session !== session) return;
      if (accountId !== session.verified_account_id) { await this.endSession('expired'); return; }
      this.set({ offline: false });
    } catch (error) {
      if (this.session === session && error instanceof SessionVerificationError && !error.retryable) await this.endSession('expired');
    }
  }

  /** One recovery attempt for a 401: refresh the token; end the session if refresh is rejected. */
  async handleUnauthorized(): Promise<boolean> {
    if (!this.session || !this.deps.client) return false;
    return this.refresh();
  }

  private refresh(): Promise<boolean> {
    this.refreshing ??= (async () => {
      const session = this.session;
      if (!session || !this.deps.client) return false;
      try {
        const refreshed = await this.deps.client.refresh(session.refresh_token);
        if (this.session !== session) return false;
        if (refreshed.user_id !== session.verified_account_id) { await this.endSession('expired'); return false; }
        this.session = { ...refreshed, verified_account_id: session.verified_account_id };
        this.deps.identity.replaceToken(refreshed.access_token);
        await this.deps.storage.save(this.session);
        return true;
      } catch (error) {
        if (this.session === session && error instanceof AuthError && error.code === 'invalid_grant') await this.endSession('expired');
        return false;
      }
    })().finally(() => { this.refreshing = null; });
    return this.refreshing;
  }

  private async endSession(notice: AuthNotice): Promise<void> {
    this.deps.identity.clear();
    this.signedOut(notice);
    await this.deps.storage.clear().catch(() => {});
  }

  async signOut(): Promise<void> {
    this.generation++;
    const session = this.session;
    await this.endSession(null);
    if (session && this.deps.client) void this.deps.client.signOut(session.access_token).catch(() => {});
  }

  clearNotice(): void { if (this.state.notice) this.set({ notice: null }); }
}
