export interface SessionBoundary {
  setToken(token: string | null): void;
  bindAccount(accountId: string | null): void;
  verify(): Promise<{ id: string }>;
  /** True when verification failed for a transient reason (offline, timeout, server error). */
  isRetryable?(error: unknown): boolean;
}

export class SessionVerificationError extends Error {
  constructor(readonly retryable: boolean) {
    super('Could not verify your session. Please sign in again.');
    this.name = 'SessionVerificationError';
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Cache identity is established by a verified backend response, never a decoded JWT. */
export class VerifiedSession {
  private revision = 0;

  constructor(private readonly boundary: SessionBoundary) {}

  invalidate(): void {
    this.revision += 1;
    this.boundary.bindAccount(null);
  }

  clear(): void {
    this.invalidate();
    this.boundary.setToken(null);
  }

  async establish(token: string): Promise<string> {
    this.invalidate();
    const revision = this.revision;
    this.boundary.setToken(token);
    let retryable = false;
    try {
      let profile: { id: string };
      try {
        profile = await this.boundary.verify();
      } catch (error) {
        retryable = this.boundary.isRetryable?.(error) ?? false;
        throw error;
      }
      if (revision !== this.revision) throw new Error('Session changed while signing in.');
      if (!UUID.test(profile.id)) {
        throw new Error('Invalid verified account.');
      }
      const accountId = profile.id.toLowerCase();
      this.boundary.bindAccount(accountId);
      return accountId;
    } catch {
      if (revision === this.revision) this.clear();
      throw new SessionVerificationError(retryable);
    }
  }
}
