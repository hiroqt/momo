/**
 * Minimal Supabase Auth (GoTrue) REST client for the native PKCE OAuth flow.
 * Only public endpoints and the public key are used; no elevated key exists here.
 */
export interface AuthSession {
  access_token: string;
  refresh_token: string;
  /** Epoch seconds. */
  expires_at: number;
  user_id: string;
}

export type AuthErrorCode = 'cancelled' | 'oauth_error' | 'invalid_grant' | 'network' | 'invalid_response' | 'not_configured';
export class AuthError extends Error {
  constructor(readonly code: AuthErrorCode, message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

type Fetch = (url: string, init: RequestInit) => Promise<Pick<Response, 'ok' | 'status' | 'json'>>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseSessionResponse(value: unknown, nowSeconds: number): AuthSession {
  const body = value as Record<string, unknown> | null;
  const user = body?.user as Record<string, unknown> | undefined;
  const expiresIn = Number(body?.expires_in);
  const expiresAt = Number(body?.expires_at ?? (Number.isFinite(expiresIn) ? nowSeconds + expiresIn : NaN));
  if (!body || typeof body.access_token !== 'string' || !body.access_token ||
      typeof body.refresh_token !== 'string' || !body.refresh_token ||
      !Number.isFinite(expiresAt) || expiresAt <= 0 ||
      typeof user?.id !== 'string' || !UUID.test(user.id)) {
    throw new AuthError('invalid_response', 'Sign-in returned an unexpected response.');
  }
  return { access_token: body.access_token, refresh_token: body.refresh_token, expires_at: Math.floor(expiresAt), user_id: user.id.toLowerCase() };
}

export class SupabaseAuthClient {
  constructor(
    private readonly supabaseUrl: string,
    private readonly publishableKey: string,
    private readonly fetcher: Fetch,
    private readonly nowSeconds: () => number = () => Math.floor(Date.now() / 1000),
    private readonly timeoutMs = 15000,
  ) {}

  authorizeUrl(challenge: string, redirectUrl: string): string {
    const query = [
      ['provider', 'google'], ['redirect_to', redirectUrl],
      ['code_challenge', challenge], ['code_challenge_method', 's256'],
    ].map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join('&');
    return `${this.supabaseUrl}/auth/v1/authorize?${query}`;
  }

  exchangeCode(code: string, verifier: string): Promise<AuthSession> {
    return this.tokenRequest('pkce', { auth_code: code, code_verifier: verifier });
  }

  refresh(refreshToken: string): Promise<AuthSession> {
    return this.tokenRequest('refresh_token', { refresh_token: refreshToken });
  }

  /** Best-effort server-side revocation of this device's refresh token. */
  async signOut(accessToken: string): Promise<void> {
    await this.request(`${this.supabaseUrl}/auth/v1/logout?scope=local`, { Authorization: `Bearer ${accessToken}` }, undefined);
  }

  private async tokenRequest(grant: 'pkce' | 'refresh_token', body: Record<string, string>): Promise<AuthSession> {
    const response = await this.request(`${this.supabaseUrl}/auth/v1/token?grant_type=${grant}`, {}, body);
    if (response.status >= 400 && response.status < 500 && response.status !== 408 && response.status !== 429) {
      throw new AuthError('invalid_grant', 'Your session has ended. Please sign in again.');
    }
    if (!response.ok) throw new AuthError('network', 'Sign-in is temporarily unavailable.');
    let parsed: unknown;
    try { parsed = await response.json(); } catch { throw new AuthError('invalid_response', 'Sign-in returned an unexpected response.'); }
    return parseSessionResponse(parsed, this.nowSeconds());
  }

  private async request(url: string, headers: Record<string, string>, body: Record<string, string> | undefined) {
    const controller = typeof AbortController === 'function' ? new AbortController() : undefined;
    const timer = setTimeout(() => controller?.abort(), this.timeoutMs);
    try {
      return await this.fetcher(url, {
        method: 'POST',
        headers: { apikey: this.publishableKey, 'Content-Type': 'application/json', ...headers },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller?.signal,
      });
    } catch {
      throw new AuthError('network', 'Sign-in is temporarily unavailable. Check your connection.');
    } finally {
      clearTimeout(timer);
    }
  }
}

/** Extracts the PKCE code from an OAuth redirect, or the provider's error category. */
export function parseAuthRedirect(url: string, expectedRedirect: string): { code: string } {
  const [base] = url.split(/[?#]/);
  const expectedBase = expectedRedirect.split(/[?#]/)[0];
  if (base !== expectedBase) throw new AuthError('oauth_error', 'Sign-in returned to an unexpected address.');
  const params = new Map<string, string>();
  for (const part of url.slice(base.length + 1).split(/[?#&]/)) {
    if (!part) continue;
    const [key, ...rest] = part.split('=');
    try { params.set(decodeURIComponent(key), decodeURIComponent(rest.join('=').replace(/\+/g, ' '))); }
    catch { throw new AuthError('oauth_error', 'Sign-in returned an unexpected response.'); }
  }
  if (params.get('error') === 'access_denied') throw new AuthError('cancelled', 'Sign-in was cancelled.');
  if (params.has('error')) throw new AuthError('oauth_error', 'Google sign-in did not complete. Please try again.');
  const code = params.get('code');
  if (!code || code.length > 2048) throw new AuthError('oauth_error', 'Google sign-in did not complete. Please try again.');
  return { code };
}
