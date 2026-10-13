import assert from 'node:assert/strict';
import test from 'node:test';
import { requestTransport, type TransportDependencies } from '../lib/api/requestTransport';
import { ApiError } from '../lib/api/errors';

function fixture() {
  const state = { owner: 'alice' as string | null, epoch: 1, token: 'token-a', base: 'http://127.0.0.1:800' };
  const requests: { url: string; options?: RequestInit }[] = [];
  const deps: TransportDependencies = {
    environment: 'test', baseUrl: () => state.base, acceptBaseUrl: value => { state.base = value; },
    token: () => state.token, binding: () => state, refresh: async () => {}, recoverUnauthorized: async () => false,
    fetch: async (url, options) => { requests.push({ url: String(url), options }); return Response.json({ ok: true }); },
  };
  return { state, requests, deps };
}
const changed = (error: unknown) => error instanceof ApiError && error.code === 'ACCOUNT_CHANGED';

test('switch during refresh denies transmission, including same-user logout/login epochs', async () => {
  for (const owner of ['bob', 'alice']) {
    const f = fixture(); f.deps.refresh = async () => { f.state.owner = owner; f.state.epoch++; };
    await assert.rejects(requestTransport('/api/generations', { method: 'POST' }, 100, {}, f.deps), changed);
    assert.equal(f.requests.length, 0);
  }
});

test('same-account refresh uses refreshed token and preserves original request key', async () => {
  const f = fixture(); f.deps.refresh = async () => { f.state.token = 'refreshed'; };
  await requestTransport('/api/generations', { method: 'POST', headers: { Authorization: 'old', 'Idempotency-Key': 'request-key' }, body: '{"count":2}' }, 100, {}, f.deps);
  assert.equal(f.requests.length, 1);
  const headers = new Headers(f.requests[0].options?.headers);
  assert.equal(headers.get('authorization'), 'Bearer refreshed');
  assert.equal(headers.get('idempotency-key'), 'request-key');
});

test('switch during fetch or JSON receipt rejects late data', async () => {
  for (const phase of ['fetch', 'json']) {
    const f = fixture();
    f.deps.fetch = async () => {
      if (phase === 'fetch') f.state.epoch++;
      const response = Response.json({ private: 'alice' });
      response.json = async () => { f.state.epoch++; return { private: 'alice' }; };
      return response;
    };
    await assert.rejects(requestTransport('/api/me', {}, 100, {}, f.deps), changed);
  }
});

test('401 recovery cannot replay an Alice action as Bob', async () => {
  const f = fixture(); let sent = 0;
  f.deps.fetch = async () => { sent++; return new Response(null, { status: 401 }); };
  f.deps.recoverUnauthorized = async () => { f.state.owner = 'bob'; f.state.epoch++; return true; };
  await assert.rejects(requestTransport('/api/generations', { method: 'POST' }, 100, {}, f.deps), changed);
  assert.equal(sent, 1);
});

test('same-account 401 refresh retries exactly once with same key and payload', async () => {
  const f = fixture(); let sent = 0;
  f.deps.fetch = async (url, options) => { f.requests.push({ url: String(url), options }); return ++sent === 1 ? new Response(null, { status: 401 }) : Response.json({ ok: true }); };
  f.deps.recoverUnauthorized = async () => { f.state.token = 'renewed'; return true; };
  await requestTransport('/api/generations', { method: 'POST', body: '{"count":2}', headers: { 'Idempotency-Key': 'one-key' } }, 100, {}, f.deps);
  assert.equal(sent, 2);
  assert.equal(f.requests[1].options?.body, f.requests[0].options?.body);
  assert.equal(new Headers(f.requests[1].options?.headers).get('idempotency-key'), 'one-key');
  assert.equal(new Headers(f.requests[1].options?.headers).get('authorization'), 'Bearer renewed');
});

test('uncertain POST never switches backend ports or repeats mutation', async () => {
  const f = fixture(); let sent = 0;
  f.deps.fetch = async () => { sent++; throw new TypeError('fetch failed'); };
  await assert.rejects(requestTransport('/api/generations', { method: 'POST' }, 100, {}, f.deps), error => error instanceof ApiError && error.code === 'TIMEOUT');
  assert.equal(sent, 1); assert.equal(f.state.base, 'http://127.0.0.1:800');
});

test('local GET fallback still works but rejects account changes before accepting data', async () => {
  for (const change of [false, true]) {
    const f = fixture(); let sent = 0;
    f.deps.fetch = async () => { if (++sent === 1) throw new TypeError('fetch failed'); if (change) f.state.epoch++; return Response.json({ ok: true }); };
    if (change) await assert.rejects(requestTransport('/health', {}, 100, {}, f.deps), changed);
    else assert.deepEqual(await requestTransport('/health', {}, 100, {}, f.deps), { ok: true });
    assert.equal(f.state.base, change ? 'http://127.0.0.1:800' : 'http://127.0.0.1:8000');
  }
});

test('hosted reads cannot guess another port and explicit cancellation cannot send', async () => {
  const f = fixture(); f.deps.environment = 'staging'; f.state.base = 'https://staging.example:800'; let sent = 0;
  f.deps.fetch = async () => { sent++; throw new TypeError('fetch failed'); };
  await assert.rejects(requestTransport('/health', {}, 100, {}, f.deps)); assert.equal(sent, 1);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(requestTransport('/api/generations', { method: 'POST', signal: controller.signal }, 100, {}, f.deps), error => error instanceof ApiError && error.code === 'REQUEST_CANCELLED');
  assert.equal(sent, 1);
});

test('custom content types and Headers values override JSON default without duplicates', async () => {
  const f = fixture();
  await requestTransport('/api/example', { method: 'POST', headers: new Headers({ 'Content-Type': 'application/custom+json' }) }, 100, {}, f.deps);
  assert.equal(new Headers(f.requests[0].options?.headers).get('content-type'), 'application/custom+json');
});

test('deadline bounds stalled refresh and response decoding without mutation replay', async () => {
  for (const phase of ['refresh', 'json']) {
    const f = fixture(); let sent = 0;
    if (phase === 'refresh') f.deps.refresh = () => new Promise<void>(() => {});
    f.deps.fetch = async () => { sent++; const response = Response.json({ ok: true }); response.json = () => new Promise(() => {}); return response; };
    await assert.rejects(requestTransport('/api/generations', { method: 'POST' }, 15, {}, f.deps), error => error instanceof ApiError && error.code === 'TIMEOUT');
    assert.equal(sent, phase === 'refresh' ? 0 : 1);
  }
});

test('external abort during local alternate read cancels rather than resending', async () => {
  const f = fixture(); const controller = new AbortController(); let sent = 0;
  f.deps.fetch = async () => {
    if (++sent === 1) throw new TypeError('fetch failed');
    controller.abort();
    throw new DOMException('Aborted', 'AbortError');
  };
  await assert.rejects(requestTransport('/health', { signal: controller.signal }, 100, {}, f.deps), error => error instanceof ApiError && error.code === 'REQUEST_CANCELLED');
  assert.equal(sent, 2); assert.equal(f.state.base, 'http://127.0.0.1:800');
});
