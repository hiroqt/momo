/** Real mobile storage/service/transport -> loopback FastAPI/JWT replay smoke. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { sqliteFixture } from '../../mobile/__tests__/helpers/sqliteFixture';
import { GenerationIntentService } from '../../mobile/lib/generation/generationIntents';
import { requestTransport, type TransportDependencies } from '../../mobile/lib/api/requestTransport';
import { ApiError } from '../../mobile/lib/api/errors';
import type { GenerationJob } from '../../mobile/types';

async function main() {
  const configPath = process.argv[2];
  if (!configPath) throw new Error('Provide the fixture configuration file path.');
  const config = JSON.parse(readFileSync(configPath, 'utf8')) as {
    baseUrl: string; owner: string; other: string; documentId: string; tokenA: string; tokenB: string;
  };
  const destination = new URL(config.baseUrl);
  assert.equal(destination.hostname, '127.0.0.1');
  assert.equal(destination.protocol, 'http:');
  const fixture = sqliteFixture();
  let db = fixture.restart().db;
  let token = config.tokenA;
  let discard = true;
  let originalJobId = '';
  let postCount = 0;
  const keys: string[] = [];
  const deps: TransportDependencies = {
    environment: 'test', baseUrl: () => config.baseUrl,
    acceptBaseUrl: () => { throw new Error('Destination changes are forbidden.'); },
    token: () => token,
    binding: () => ({ owner: db.getActiveAccountId(), epoch: db.getAccountEpoch() }),
    refresh: async () => {}, recoverUnauthorized: async () => false,
    fetch: async (url, init) => {
      const target = new URL(String(url));
      assert.equal(target.origin, destination.origin, 'Hosted/provider HTTP is forbidden.');
      if (init?.method === 'POST') {
        postCount++;
        keys.push(new Headers(init.headers).get('idempotency-key') ?? '');
      }
      const response = await fetch(url, init);
      if (discard && init?.method === 'POST' && response.ok) {
        discard = false;
        originalJobId = (await response.json() as GenerationJob).generation_id;
        throw new TypeError('Network request failed: deliberately discarded successful response');
      }
      return response;
    },
  };
  const api = <T>(path: string, options: RequestInit = {}) =>
    requestTransport<T>(path, options, 5000, {}, deps);
  const service = () => new GenerationIntentService({ db, uuid: async () => randomUUID(),
    online: async binding => { await requestTransport('/health', {}, 5000, { expectedBinding: binding }, deps); return true; },
    send: (payload, key, binding) => requestTransport<GenerationJob>('/api/generations', {
      method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify(payload),
    }, 5000, { expectedBinding: binding }, deps),
  });
  const payload = { document_id: config.documentId, generation_mode: 'quiz' as const,
    topic: 'Synthetic biology', count: 3, difficulty: 'medium' as const,
    question_types: ['flashcard'], source_only: true as const };
  try {
    // Bind identity only after the actual JWT verifier returns its owner.
    const profile = await api<{ id: string }>('/api/me');
    assert.equal(profile.id, config.owner);
    db.bindVerifiedAccount(profile.id);
    await assert.rejects(service().submit(payload), (error: unknown) =>
      error instanceof ApiError && error.code === 'TIMEOUT');
    assert.ok(originalJobId);
    assert.equal(postCount, 1);
    const savedBefore = await service().unfinished(config.documentId, 'quiz');
    assert.ok(savedBefore && !savedBefore.job);

    db = fixture.restart().db;
    db.bindVerifiedAccount((await api<{ id: string }>('/api/me')).id);
    const replay = await service().submit(payload);
    assert.equal(replay.job.generation_id, originalJobId);
    assert.equal(postCount, 2);
    assert.equal(keys[0], keys[1]);
    assert.equal(replay.intentId, savedBefore.id);

    db = fixture.restart().db;
    db.bindVerifiedAccount((await api<{ id: string }>('/api/me')).id);
    const received = await service().submit(payload);
    assert.equal(received.job.generation_id, originalJobId);
    assert.equal(postCount, 2, 'Durable received job must avoid another POST.');
    const ownedJob = await api<GenerationJob>(`/api/generations/${originalJobId}`);
    assert.equal(ownedJob.generation_id, originalJobId);
    await service().acknowledge(received.intentId, ownedJob.generation_id, received.binding);
    assert.equal(await service().unfinished(config.documentId, 'quiz'), null);

    const fresh = await service().submit(payload);
    assert.notEqual(fresh.intentId, received.intentId);
    assert.notEqual(fresh.job.generation_id, originalJobId);
    assert.equal(postCount, 3);
    assert.notEqual(keys[2], keys[1]);

    db.bindVerifiedAccount(null);
    token = config.tokenB;
    const other = await api<{ id: string }>('/api/me');
    assert.equal(other.id, config.other);
    db.bindVerifiedAccount(other.id);
    assert.equal(await service().unfinished(config.documentId, 'quiz'), null);
    await assert.rejects(service().submit(payload), (error: unknown) =>
      error instanceof ApiError && error.status === 404 && error.code === 'DOCUMENT_NOT_FOUND');
    await assert.rejects(api(`/api/generations/${originalJobId}`), (error: unknown) =>
      error instanceof ApiError && error.status === 404 && error.code === 'GENERATION_NOT_FOUND');
    assert.equal(postCount, 4);
    console.log(JSON.stringify({ result: 'PASS', checks: 8, generationPosts: postCount,
      replaySameJob: true, receivedJobSurvivesRestart: true, newIntentDistinctJob: true,
      verifiedOtherAccountDenied: true, database: 'file-backed SQLite + isolated backend memory',
      scope: 'loopback HTTP; signed JWT verification; no workers/providers/hosted services' }));
  } finally { fixture.close(); }
}
main().catch(() => { console.error('Mobile generation replay smoke failed; inspect the local fixture and assertions.'); process.exitCode = 1; });
