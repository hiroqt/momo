import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash, randomBytes } from 'node:crypto';
import { isElevatedSupabaseKey, resolvePublicAuthConfig } from '../lib/auth/authConfig';
import { AuthSessionManager, type IdentityBoundary } from '../lib/auth/authSessionManager';
import { base64ToBase64Url, bytesToBase64Url, createPkcePair } from '../lib/auth/pkce';
import { createChunkedSessionStorage, type SecureKeyValue, type StoredAuthSession } from '../lib/auth/sessionStorage';
import { AuthError, parseAuthRedirect, SupabaseAuthClient } from '../lib/auth/supabaseAuthClient';
import { SessionVerificationError } from '../lib/auth/verifiedSession';

const USER_A = '10000000-0000-4000-8000-00000000000a';
const USER_B = '10000000-0000-4000-8000-00000000000b';
const REDIRECT = 'aistudy://auth/callback';
const SUPABASE = 'http://127.0.0.1:54321';
function jwt(payload: object) {
  const part = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${part({ alg: 'HS256' })}.${part(payload)}.signature`;
}
const ANON = jwt({ role: 'anon' });

test('config accepts only public keys and forbids development identity in hosted builds', () => {
  assert.equal(isElevatedSupabaseKey(jwt({ role: 'service_role' })), true);
  assert.equal(isElevatedSupabaseKey('sb_secret_abc'), true);
  assert.equal(isElevatedSupabaseKey(ANON), false);
  assert.equal(isElevatedSupabaseKey('sb_publishable_abc'), false);
  assert.throws(() => resolvePublicAuthConfig({ appEnv: 'development', supabaseUrl: SUPABASE, supabaseKey: jwt({ role: 'service_role' }) }), /public Supabase key/);
  assert.throws(() => resolvePublicAuthConfig({ appEnv: 'production', devAuthToken: 'dev-token' }), /not allowed in hosted/);
  assert.throws(() => resolvePublicAuthConfig({ appEnv: 'staging', supabaseUrl: 'http://example.supabase.co', supabaseKey: ANON }), /HTTPS/);
  assert.throws(() => resolvePublicAuthConfig({ appEnv: 'development', supabaseUrl: 'https://abc.supabase.co', supabaseKey: ANON }), /Hosted tests are disabled/);
  assert.equal(resolvePublicAuthConfig({ appEnv: 'production' }), null);
  const config = resolvePublicAuthConfig({ appEnv: 'staging', supabaseUrl: 'https://abc.supabase.co', supabaseKey: 'sb_publishable_x' });
  assert.deepEqual([config?.supabaseUrl, config?.redirectUrl, config?.developmentToken], ['https://abc.supabase.co', REDIRECT, null]);
});

test('PKCE uses a 43 character verifier and the RFC 7636 S256 transform', async () => {
  const sha = async (value: string) => createHash('sha256').update(value).digest('base64');
  // RFC 7636 Appendix B vector.
  const octets = Uint8Array.from([116, 24, 223, 180, 151, 153, 224, 37, 79, 250, 96, 125, 216, 173, 187, 186, 22, 212, 37, 77, 105, 214, 191, 240, 91, 88, 5, 88, 83, 132, 141, 121]);
  assert.equal(bytesToBase64Url(octets), 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk');
  assert.equal(base64ToBase64Url(await sha('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')), 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  const bytes = randomBytes(32);
  assert.equal(bytesToBase64Url(bytes), bytes.toString('base64url'));
  const pair = await createPkcePair({ randomBytes: count => randomBytes(count), sha256Base64: sha });
  assert.equal(pair.verifier.length, 43);
  assert.equal(pair.challenge, createHash('sha256').update(pair.verifier).digest('base64url'));
});

test('redirect parsing distinguishes cancel, provider error, foreign redirect and success', () => {
  assert.deepEqual(parseAuthRedirect(`${REDIRECT}?code=abc%2B1`, REDIRECT), { code: 'abc+1' });
  assert.throws(() => parseAuthRedirect(`${REDIRECT}?error=access_denied`, REDIRECT), (e: AuthError) => e.code === 'cancelled');
  assert.throws(() => parseAuthRedirect(`${REDIRECT}#error=server_error&error_description=secret`, REDIRECT), (e: AuthError) => e.code === 'oauth_error' && !e.message.includes('secret'));
  assert.throws(() => parseAuthRedirect('evil://auth/callback?code=x', REDIRECT), /unexpected address/);
  assert.throws(() => parseAuthRedirect(REDIRECT, REDIRECT), (e: AuthError) => e.code === 'oauth_error');
});

test('auth client sends only the public key to documented GoTrue PKCE/refresh endpoints', async () => {
  const requests: { url: string; init: RequestInit }[] = [];
  const responses: [number, unknown][] = [
    [200, { access_token: 'access', refresh_token: 'refresh', expires_in: 3600, user: { id: USER_A.toUpperCase() } }],
    [400, { error: 'invalid_grant' }],
    [503, {}],
  ];
  const client = new SupabaseAuthClient(SUPABASE, ANON, async (url, init) => {
    requests.push({ url, init });
    const [status, body] = responses.shift()!;
    return { ok: status < 400, status, json: async () => body };
  }, () => 1000);
  assert.match(client.authorizeUrl('chal', REDIRECT), /\/auth\/v1\/authorize\?provider=google&redirect_to=aistudy%3A%2F%2Fauth%2Fcallback&code_challenge=chal&code_challenge_method=s256$/);
  assert.deepEqual(await client.exchangeCode('code', 'verifier'), { access_token: 'access', refresh_token: 'refresh', expires_at: 4600, user_id: USER_A });
  assert.equal(requests[0].url, `${SUPABASE}/auth/v1/token?grant_type=pkce`);
  assert.deepEqual(JSON.parse(String(requests[0].init.body)), { auth_code: 'code', code_verifier: 'verifier' });
  assert.equal((requests[0].init.headers as Record<string, string>).apikey, ANON);
  await assert.rejects(client.refresh('revoked'), (e: AuthError) => e.code === 'invalid_grant');
  await assert.rejects(client.refresh('later'), (e: AuthError) => e.code === 'network');
  const offline = new SupabaseAuthClient(SUPABASE, ANON, async () => { throw new TypeError('Network request failed'); });
  await assert.rejects(offline.refresh('x'), (e: AuthError) => e.code === 'network');
});

function memorySecure(): SecureKeyValue & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, async get(k) { return data.get(k) ?? null; }, async set(k, v) { data.set(k, v); }, async remove(k) { data.delete(k); } };
}
const stored = (overrides: Partial<StoredAuthSession> = {}): StoredAuthSession => ({
  access_token: 'access-a', refresh_token: 'refresh-a', expires_at: 10_000, user_id: USER_A, verified_account_id: USER_A, ...overrides,
});

test('secure session storage chunks large sessions and discards corrupt or partial data', async () => {
  const kv = memorySecure(), storage = createChunkedSessionStorage(kv);
  const large = stored({ access_token: 'x'.repeat(5000) });
  await storage.save(large);
  assert.ok(Number(kv.data.get('momo.auth.session.count')) >= 3);
  assert.ok([...kv.data.values()].every(value => value.length <= 1800));
  assert.deepEqual(await storage.load(), large);
  kv.data.delete('momo.auth.session.1');
  assert.equal(await storage.load(), null);
  assert.equal(kv.data.size, 0);
  await storage.save(stored());
  kv.data.set('momo.auth.session.0', '{"access_token":');
  assert.equal(await storage.load(), null);
  await assert.rejects(storage.save({ ...stored(), verified_account_id: 'not-a-uuid' }), /Invalid session/);
});

interface Harness {
  manager: AuthSessionManager;
  kv: ReturnType<typeof memorySecure>;
  identity: { token: string | null; account: string | null; log: string[] };
  client: { refresh: string[]; signOut: string[] };
  setNow(value: number): void;
}
function harness(options: {
  verify?: (token: string) => Promise<string>;
  refresh?: (token: string) => Promise<StoredAuthSession>;
  browser?: () => Promise<{ type: string; url?: string }>;
  exchange?: () => Promise<StoredAuthSession>;
  config?: ReturnType<typeof resolvePublicAuthConfig>;
  noClient?: boolean;
} = {}): Harness {
  let now = 1000;
  const kv = memorySecure();
  const identityState = { token: null as string | null, account: null as string | null, log: [] as string[] };
  const calls = { refresh: [] as string[], signOut: [] as string[] };
  const verify = options.verify ?? (async () => USER_A);
  const identity: IdentityBoundary = {
    async establish(token) {
      identityState.account = null; identityState.token = token; identityState.log.push(`establish:${token}`);
      try { const id = await verify(token); identityState.account = id; return id; }
      catch (error) { identityState.token = null; throw error; }
    },
    async reverify(token) { identityState.log.push(`reverify:${token}`); return verify(token); },
    replaceToken(token) { identityState.token = token; identityState.log.push(`replace:${token}`); },
    bindOffline(token, accountId) { identityState.token = token; identityState.account = accountId; identityState.log.push('offline'); },
    clear() { identityState.token = null; identityState.account = null; identityState.log.push('clear'); },
  };
  const client = options.noClient ? null : {
    authorizeUrl: (challenge: string, redirect: string) => `${SUPABASE}/auth/v1/authorize?code_challenge=${challenge}&redirect_to=${redirect}`,
    exchangeCode: options.exchange ?? (async () => stored()),
    refresh: async (token: string) => { calls.refresh.push(token); return (options.refresh ?? (async () => stored({ access_token: 'access-2', refresh_token: 'refresh-2', expires_at: now + 3600 })))(token); },
    signOut: async (token: string) => { calls.signOut.push(token); },
  } as unknown as SupabaseAuthClient;
  const manager = new AuthSessionManager({
    config: options.config === undefined ? resolvePublicAuthConfig({ appEnv: 'test', supabaseUrl: SUPABASE, supabaseKey: ANON }) : options.config,
    client,
    storage: createChunkedSessionStorage(kv),
    identity,
    openAuthSession: options.browser ?? (async () => ({ type: 'success', url: `${REDIRECT}?code=good` })),
    createPkce: async () => ({ verifier: 'v'.repeat(43), challenge: 'c' }),
    nowSeconds: () => now,
  });
  return { manager, kv, identity: identityState, client: calls, setNow: value => { now = value; } };
}

test('Google sign-in verifies the account with the backend and persists the session securely', async () => {
  const h = harness();
  await h.manager.restore();
  assert.equal(h.manager.getState().status, 'signed_out');
  const state = await h.manager.signInWithGoogle();
  assert.deepEqual([state.status, state.accountId, state.notice], ['signed_in', USER_A, null]);
  assert.equal(h.identity.account, USER_A);
  assert.ok(h.kv.data.get('momo.auth.session.count'));
});

test('cancel and provider errors keep the user signed out with a friendly notice', async () => {
  const cancelled = harness({ browser: async () => ({ type: 'cancel' }) });
  await cancelled.manager.restore();
  assert.deepEqual([(await cancelled.manager.signInWithGoogle()).status, cancelled.manager.getState().notice], ['signed_out', 'cancelled']);
  const failed = harness({ browser: async () => ({ type: 'success', url: `${REDIRECT}?error=server_error` }) });
  await failed.manager.restore();
  assert.equal((await failed.manager.signInWithGoogle()).notice, 'failed');
  assert.equal(failed.kv.data.size, 0);
  const unconfigured = harness({ noClient: true, config: null });
  await unconfigured.manager.restore();
  assert.equal((await unconfigured.manager.signInWithGoogle()).notice, 'not_configured');
});

test('backend verification failure or account mismatch fails closed', async () => {
  const rejected = harness({ verify: async () => { throw new SessionVerificationError(false); } });
  await rejected.manager.restore();
  const state = await rejected.manager.signInWithGoogle();
  assert.deepEqual([state.status, state.notice, rejected.identity.account], ['signed_out', 'failed', null]);
  const mismatch = harness({ verify: async () => USER_B });
  await mismatch.manager.restore();
  assert.equal((await mismatch.manager.signInWithGoogle()).status, 'signed_out');
  assert.equal(mismatch.kv.data.size, 0);
});

test('cold start restores, refreshes an expired token, and ends a revoked session', async () => {
  const fresh = harness();
  await createChunkedSessionStorage(fresh.kv).save(stored());
  assert.deepEqual([(await fresh.manager.restore()).status, fresh.client.refresh.length], ['signed_in', 0]);

  const expired = harness();
  expired.setNow(20_000);
  await createChunkedSessionStorage(expired.kv).save(stored());
  const state = await expired.manager.restore();
  assert.deepEqual([state.status, expired.client.refresh, expired.identity.token], ['signed_in', ['refresh-a'], 'access-2']);

  const revoked = harness({ refresh: async () => { throw new AuthError('invalid_grant', 'revoked'); } });
  revoked.setNow(20_000);
  await createChunkedSessionStorage(revoked.kv).save(stored());
  const ended = await revoked.manager.restore();
  assert.deepEqual([ended.status, ended.notice, revoked.kv.data.size, revoked.identity.account], ['signed_out', 'expired', 0, null]);
});

test('offline cold start keeps the previously verified account usable and re-verifies later', async () => {
  let online = false;
  const h = harness({ verify: async () => { if (!online) throw new SessionVerificationError(true); return USER_A; } });
  await createChunkedSessionStorage(h.kv).save(stored());
  const state = await h.manager.restore();
  assert.deepEqual([state.status, state.offline, h.identity.account], ['signed_in', true, USER_A]);
  online = true;
  h.setNow(1000 + 31);
  await h.manager.ensureFresh();
  assert.equal(h.manager.getState().offline, false);
  assert.ok(h.identity.log.includes(`reverify:access-a`));
});

test('a 401 refreshes once; a rejected refresh signs out; logout clears and revokes', async () => {
  const h = harness();
  await createChunkedSessionStorage(h.kv).save(stored());
  await h.manager.restore();
  assert.equal(await h.manager.handleUnauthorized(), true);
  assert.equal(h.identity.token, 'access-2');
  // Concurrent 401s share one refresh request.
  await Promise.all([h.manager.handleUnauthorized(), h.manager.handleUnauthorized()]);
  assert.equal(h.client.refresh.length, 2);
  await h.manager.signOut();
  assert.deepEqual([h.manager.getState().status, h.kv.data.size, h.identity.account], ['signed_out', 0, null]);
  assert.equal(h.client.signOut.length, 1);
  assert.equal(await h.manager.handleUnauthorized(), false);

  const revoked = harness({ refresh: async () => { throw new AuthError('invalid_grant', 'revoked'); } });
  await createChunkedSessionStorage(revoked.kv).save(stored());
  await revoked.manager.restore();
  assert.equal(await revoked.manager.handleUnauthorized(), false);
  assert.deepEqual([revoked.manager.getState().status, revoked.manager.getState().notice], ['signed_out', 'expired']);
});

test('switching accounts replaces the identity and revokes the previous device session', async () => {
  let next = USER_A;
  const h = harness({ verify: async () => next, exchange: async () => next === USER_A ? stored() : stored({ access_token: 'access-b', refresh_token: 'refresh-b', user_id: USER_B, verified_account_id: USER_B }) });
  await h.manager.restore();
  await h.manager.signInWithGoogle();
  next = USER_B;
  const state = await h.manager.signInWithGoogle();
  assert.deepEqual([state.accountId, h.identity.account], [USER_B, USER_B]);
  assert.deepEqual(h.client.signOut, ['access-a']);
});

test('development token is used only when explicitly configured outside hosted builds', async () => {
  const config = resolvePublicAuthConfig({ appEnv: 'development', devAuthToken: 'local-dev-token' });
  const h = harness({ config, noClient: true });
  const state = await h.manager.restore();
  assert.deepEqual([state.status, h.identity.log[0]], ['signed_in', 'establish:local-dev-token']);
  const none = harness({ config: resolvePublicAuthConfig({ appEnv: 'development' }), noClient: true });
  assert.equal((await none.manager.restore()).status, 'signed_out');
  assert.equal(none.identity.log.length, 0);
});
