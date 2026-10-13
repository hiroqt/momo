import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { GenerationDraftScope, GenerationIntentService } from '../lib/generation/generationIntents';
import type { GenerationJob } from '../types';
import type { GenerationRequest } from '../lib/api/generations';
import { sqliteFixture } from './helpers/sqliteFixture';

const payload = { document_id: randomUUID(), generation_mode: 'reviewer' as const, title: 'Biology', count: 20, source_only: true as const };
function job(documentId: string = payload.document_id): GenerationJob {
  return { generation_id: randomUUID(), document_id: documentId, status: 'PENDING', stage: 'Reading document',
    progress: 5, message: 'Preparing', created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    generation_config: { source_only: true, retained_field: 'kept' } };
}

test('lost response and SQLite process restart reuse the original key and settings', async () => {
  const fixture = sqliteFixture(), owner = randomUUID(), calls: string[] = [], remote = new Map<string, GenerationJob>();
  try {
    let { db } = fixture.restart(); db.bindVerifiedAccount(owner);
    const send = async (request: GenerationRequest, key: string) => {
      calls.push(key); remote.set(key, remote.get(key) ?? job(request.document_id));
      if (calls.length === 1) throw new Error('response lost');
      return remote.get(key)!;
    };
    let service = new GenerationIntentService({ db, online: async () => true, uuid: async () => randomUUID(), send });
    await assert.rejects(service.submit(payload), /response lost/);
    ({ db } = fixture.restart()); db.bindVerifiedAccount(owner);
    service = new GenerationIntentService({ db, online: async () => true, uuid: async () => randomUUID(), send });
    const received = await service.submit({ ...payload });
    assert.equal(calls[0], calls[1]); assert.equal(remote.size, 1);
    assert.equal(received.job.generation_id, remote.get(calls[0])!.generation_id);
    assert.deepEqual((await service.unfinished(payload.document_id, 'reviewer'))!.payload, payload);
  } finally { fixture.close(); }
});

test('durable received result resumes without POST after restart and acknowledgment permits intentional new generation', async () => {
  const fixture = sqliteFixture(), owner = randomUUID();
  try {
    let { db } = fixture.restart(); db.bindVerifiedAccount(owner);
    let sends = 0;
    const send = async () => { sends++; return job(); };
    let service = new GenerationIntentService({ db, online: async () => true, uuid: async () => randomUUID(), send });
    const first = await service.submit(payload);
    ({ db } = fixture.restart()); db.bindVerifiedAccount(owner);
    service = new GenerationIntentService({ db, online: async () => false, uuid: async () => randomUUID(), send });
    const resumed = await service.submit(payload);
    assert.equal(resumed.intentId, first.intentId); assert.equal(sends, 1);
    assert.equal(resumed.job.generation_config?.retained_field, 'kept');
    await assert.rejects(service.acknowledge(first.intentId, randomUUID()), /does not match/);
    await service.acknowledge(first.intentId, first.job.generation_id);
    service = new GenerationIntentService({ db, online: async () => true, uuid: async () => randomUUID(), send });
    const next = await service.submit(payload);
    assert.notEqual(next.intentId, first.intentId); assert.equal(sends, 2);
  } finally { fixture.close(); }
});

test('concurrent taps and service instances share one operation, distinct payloads get separate intents', async () => {
  const fixture = sqliteFixture();
  try {
    const { db } = fixture.restart(); db.bindVerifiedAccount(randomUUID());
    let sends = 0;
    const deps = { db, online: async () => true, uuid: async () => randomUUID(), send: async () => { sends++; return job(); } };
    const a = new GenerationIntentService(deps), b = new GenerationIntentService(deps);
    const results = await Promise.all([a.submit(payload), b.submit(payload), a.submit(payload)]);
    assert.equal(sends, 1); assert.equal(new Set(results.map(result => result.intentId)).size, 1);
    const other = await a.submit({ ...payload, count: 10 });
    assert.notEqual(other.intentId, results[0].intentId); assert.equal(sends, 2);
  } finally { fixture.close(); }
});

test('offline saves original draft without an AI request', async () => {
  const fixture = sqliteFixture();
  try {
    const { db } = fixture.restart(); db.bindVerifiedAccount(randomUUID());
    const service = new GenerationIntentService({ db, online: async () => false, uuid: async () => randomUUID(), send: async () => { assert.fail('AI attempted offline'); } });
    await assert.rejects(service.submit(payload), /Connect to the internet/);
    assert.deepEqual((await service.unfinished(payload.document_id, 'reviewer'))!.payload, payload);
  } finally { fixture.close(); }
});

test('response persistence failure preserves original intent across restart', async () => {
  const fixture = sqliteFixture(), owner = randomUUID(), keys: string[] = [], result = job();
  try {
    let { db, sqlite } = fixture.restart(); db.bindVerifiedAccount(owner);
    await db.readRecords('generation_request');
    sqlite.exec("CREATE TRIGGER storage_full BEFORE UPDATE ON account_records WHEN NEW.kind='generation_request' BEGIN SELECT RAISE(ABORT,'SQLITE_FULL'); END;");
    const send = async (_request: unknown, key: string) => { keys.push(key); return result; };
    let service = new GenerationIntentService({ db, online: async () => true, uuid: async () => randomUUID(), send });
    await assert.rejects(service.submit(payload), /low on storage/);
    assert.equal((await service.unfinished(payload.document_id, 'reviewer'))!.job, undefined);
    sqlite.exec('DROP TRIGGER storage_full');
    ({ db } = fixture.restart()); db.bindVerifiedAccount(owner);
    service = new GenerationIntentService({ db, online: async () => true, uuid: async () => randomUUID(), send });
    const resumed = await service.submit(payload);
    assert.equal(keys[0], keys[1]); assert.equal(resumed.job.generation_id, result.generation_id);
  } finally { fixture.close(); }
});

test('low storage before draft persistence prevents network dispatch', async () => {
  const fixture = sqliteFixture();
  try {
    const { db, sqlite } = fixture.restart(); db.bindVerifiedAccount(randomUUID());
    await db.readRecords('generation_request');
    sqlite.exec("CREATE TRIGGER storage_full BEFORE INSERT ON account_records WHEN NEW.kind='generation_request' BEGIN SELECT RAISE(ABORT,'SQLITE_FULL'); END;");
    const service = new GenerationIntentService({ db, online: async () => { assert.fail('Connectivity ran before persistence'); }, uuid: async () => randomUUID(), send: async () => { assert.fail('Sent before persistence'); } });
    await assert.rejects(service.submit(payload), /low on storage/);
  } finally { fixture.close(); }
});

test('account switch while connectivity or send is pending fails closed and preserves account isolation', async () => {
  const fixture = sqliteFixture(), a = randomUUID(), b = randomUUID();
  try {
    const { db } = fixture.restart(); db.bindVerifiedAccount(a);
    const service = new GenerationIntentService({ db, online: async () => true, uuid: async () => randomUUID(), send: async () => { db.bindVerifiedAccount(b); return job(); } });
    await assert.rejects(service.submit(payload), /account changed/i);
    assert.equal(await service.unfinished(payload.document_id, 'reviewer'), null);
    db.bindVerifiedAccount(a);
    assert.equal((await service.unfinished(payload.document_id, 'reviewer'))!.job, undefined);
    const beforeSend = new GenerationIntentService({ db, online: async () => { db.bindVerifiedAccount(b); return true; }, uuid: async () => randomUUID(), send: async () => { assert.fail('Sent after account switch'); } });
    await assert.rejects(beforeSend.submit(payload), /account changed/i);
  } finally { fixture.close(); }
});

test('corrupt saved metadata and invalid provider response never overwrite intent or send new work', async () => {
  const fixture = sqliteFixture(), owner = randomUUID();
  try {
    const { db, sqlite } = fixture.restart(); db.bindVerifiedAccount(owner);
    let sends = 0;
    const service = new GenerationIntentService({ db, online: async () => true, uuid: async () => randomUUID(), send: async () => { sends++; return { ...job(), document_id: randomUUID() }; } });
    await assert.rejects(service.submit(payload), /could not be verified/);
    assert.equal((await service.unfinished(payload.document_id, 'reviewer'))!.job, undefined);
    sqlite.prepare("UPDATE account_records SET data=? WHERE owner=? AND kind='generation_request'").run(JSON.stringify({ version: 1, owner, payload }), owner);
    await assert.rejects(service.submit(payload), /corrupt/); assert.equal(sends, 1);
  } finally { fixture.close(); }
});

test('late completion from route A cannot navigate or update route B even for the same account', () => {
  const scope = new GenerationDraftScope(), binding = { owner: randomUUID(), epoch: 1 };
  const a = scope.activate('document-A:reviewer', binding);
  assert.equal(scope.matches(a, binding, 'document-A:reviewer'), true);
  // A new render is already enough to deny A, before its new effect hydrates.
  assert.equal(scope.matches(a, binding, 'document-B:reviewer'), false);
  const b = scope.activate('document-B:reviewer', binding);
  assert.equal(scope.matches(a, binding, 'document-B:reviewer'), false);
  assert.equal(scope.matches(b, binding, 'document-B:reviewer'), true);
  scope.invalidate();
  assert.equal(scope.matches(b, binding, 'document-B:reviewer'), false);
});

test('idle account switch invalidates the hydrated draft and reopening requires a new verified scope', () => {
  const scope = new GenerationDraftScope(), a = { owner: randomUUID(), epoch: 1 }, b = { owner: randomUUID(), epoch: 2 };
  const original = scope.activate('document:reviewer', a);
  scope.invalidate();
  assert.equal(scope.capture(), null);
  assert.equal(scope.matches(original, b, 'document:reviewer'), false);
  const reopened = scope.activate('document:reviewer', b);
  assert.equal(scope.matches(reopened, b, 'document:reviewer'), true);
  // Signing out and back into A still has a different epoch.
  assert.equal(scope.matches(original, { ...a, epoch: 3 }, 'document:reviewer'), false);
});

test('semantically malformed JSON drafts cannot hydrate or send even with matching saved fingerprints', async () => {
  const fixture = sqliteFixture(), owner = randomUUID();
  try {
    const { db, sqlite } = fixture.restart(); db.bindVerifiedAccount(owner);
    await db.readRecords('generation_request');
    const service = new GenerationIntentService({ db, online: async () => true, send: async () => { assert.fail('Corrupt settings sent'); } });
    for (const changed of [{ count: '20' }, { reviewer_types: {} }, { title: {} }, { generation_mode: 'invalid' }, { source_only: false }, { question_types: ['unknown'] }]) {
      const malformed = { ...payload, ...changed };
      const fingerprint = `{${Object.keys(malformed).sort().map(key => `${JSON.stringify(key)}:${JSON.stringify((malformed as Record<string, unknown>)[key])}`).join(',')}}`;
      const id = randomUUID();
      sqlite.prepare("DELETE FROM account_records WHERE owner=? AND kind='generation_request'").run(owner);
      sqlite.prepare('INSERT INTO account_records(owner,kind,id,data) VALUES(?,?,?,?)').run(owner, 'generation_request', id,
        JSON.stringify({ version: 1, id, owner, payload: malformed, fingerprint, createdAt: new Date().toISOString() }));
      await assert.rejects(service.unfinished(payload.document_id, 'reviewer'), /invalid/);
      await assert.rejects(service.submit(payload), /invalid/);
    }
  } finally { fixture.close(); }
});
