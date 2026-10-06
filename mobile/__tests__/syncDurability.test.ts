import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { SyncEngine, backoffMs } from '../lib/sync/syncEngine';
import { ApiError } from '../lib/api/errors';
import { createSqliteAccountStore, SQLITE_SCHEMA_VERSION, type SqlConnection } from '../lib/storage/sqliteAccountStore';
import type { SyncEvent } from '../types';
import type { SyncResponse } from '../lib/api/sync';
import { connection, sqliteFixture } from './helpers/sqliteFixture';

function event(itemId = randomUUID()): SyncEvent {
  return { event_id: randomUUID(), study_item_id: itemId, result: 'correct', occurred_at: new Date().toISOString() };
}
function ack(events: SyncEvent[]): SyncResponse {
  return { synced_ids: events.map(e => e.event_id), accepted_count: events.length, ignored_duplicates_count: 0, ignored_duplicates: 0, processed_at: new Date().toISOString() };
}

test('a server-rejected reference is isolated and held while every valid event in 101+ syncs', async () => {
  const f = sqliteFixture();
  try {
    const { db } = f.restart(), owner = randomUUID(); db.bindVerifiedAccount(owner);
    const foreignItem = randomUUID();
    const events = Array.from({ length: 120 }, (_, i) => event(i === 37 || i === 110 ? foreignItem : undefined));
    for (const e of events) await db.enqueueSyncEvent(e);
    const sizes: number[] = [];
    const engine = new SyncEngine(db, async batch => {
      sizes.push(batch.length);
      assert.ok(batch.length <= 100);
      if (batch.some(e => e.study_item_id === foreignItem)) throw new ApiError(404, 'STUDY_ITEM_NOT_FOUND', 'Study item not found.');
      return ack(batch);
    });
    await engine.flushSyncQueue();
    assert.ok(sizes.every(size => size <= 100));
    assert.deepEqual(await db.getPendingSyncEvents(), []);
    const summary = await engine.getSummary();
    assert.deepEqual([summary.pending, summary.held], [0, 2]);
    // Held events are kept for explicit retry, never silently dropped.
    assert.equal(await engine.retryHeldEvents(), 2);
    assert.equal((await db.getPendingSyncEvents()).length, 2);
  } finally { f.close(); }
});

for (const [status, code] of [[403, 'FORBIDDEN'], [404, 'NOT_FOUND'], [404, 'HTTP_404'], [413, 'PAYLOAD_TOO_LARGE'], [400, 'BAD_REQUEST']] as const) {
  test(`an endpoint-level ${status} ${code} keeps the whole queue pending with backoff instead of bisecting`, async () => {
    const f = sqliteFixture();
    try {
      const { db } = f.restart(), owner = randomUUID(); db.bindVerifiedAccount(owner);
      const events = Array.from({ length: 150 }, () => event());
      for (const e of events) await db.enqueueSyncEvent(e);
      let sends = 0;
      const clock = 5_000_000;
      const engine = new SyncEngine(db, async () => { sends++; throw new ApiError(status, code, 'refused'); }, undefined, () => clock);
      await assert.rejects(engine.flushSyncQueue(), /refused/);
      assert.equal(sends, 1, 'no bisection on an endpoint-level refusal');
      const summary = await engine.getSummary();
      assert.deepEqual([summary.pending, summary.held], [150, 0]);
      assert.equal(summary.retry.failures, 1);
      assert.equal(summary.retry.lastErrorCode, code);
      assert.equal(summary.retry.nextAttemptAt, clock + backoffMs(1));
    } finally { f.close(); }
  });
}

test('only a per-event code with its matching status is isolated', async () => {
  const f = sqliteFixture();
  try {
    const { db } = f.restart(), owner = randomUUID(); db.bindVerifiedAccount(owner);
    for (let i = 0; i < 4; i++) await db.enqueueSyncEvent(event());
    // A per-event code on an unexpected status (e.g. a proxy rewriting it) is not trusted.
    const engine = new SyncEngine(db, async () => { throw new ApiError(403, 'STUDY_ITEM_NOT_FOUND', 'odd'); });
    await assert.rejects(engine.flushSyncQueue());
    assert.deepEqual([(await engine.getSummary()).pending, (await engine.getSummary()).held], [4, 0]);
  } finally { f.close(); }
});

test('transient failure backoff persists across restart; reconnect can force a retry', async () => {
  const f = sqliteFixture();
  try {
    let { db } = f.restart(); const owner = randomUUID(); db.bindVerifiedAccount(owner);
    let clock = 1_000_000;
    await db.enqueueSyncEvent(event());
    let sends = 0;
    const offline = async () => { sends++; throw new ApiError(0, 'TIMEOUT', 'offline'); };
    await assert.rejects(new SyncEngine(db, offline, undefined, () => clock).flushSyncQueue());
    ({ db } = f.restart()); db.bindVerifiedAccount(owner);
    await new SyncEngine(db, offline, undefined, () => clock).flushSyncQueue();
    assert.equal(sends, 1, 'backoff survived the restart');
    const summary = await new SyncEngine(db, offline, undefined, () => clock).getSummary();
    assert.equal(summary.retry.failures, 1);
    assert.equal(summary.retry.nextAttemptAt, clock + backoffMs(1));
    clock += backoffMs(1);
    await new SyncEngine(db, async batch => ack(batch), undefined, () => clock).flushSyncQueue();
    assert.deepEqual(await db.getPendingSyncEvents(), []);
    assert.equal((await new SyncEngine(db, offline).getSummary()).retry.failures, 0);
  } finally { f.close(); }
});

test('an expired session keeps events pending without holding them', async () => {
  const f = sqliteFixture();
  try {
    const { db } = f.restart(), owner = randomUUID(); db.bindVerifiedAccount(owner);
    const e = event(); await db.enqueueSyncEvent(e);
    await assert.rejects(new SyncEngine(db, async () => { throw new ApiError(401, 'UNAUTHORIZED', 'expired'); }).flushSyncQueue());
    assert.deepEqual(await db.getPendingSyncEvents(), [e]);
    assert.equal((await new SyncEngine(db).getSummary()).held, 0);
  } finally { f.close(); }
});

test('two accounts on one device keep separate queues, holds and retry state', async () => {
  const f = sqliteFixture();
  try {
    const { db } = f.restart(), a = randomUUID(), b = randomUUID();
    db.bindVerifiedAccount(a); const ea = event(); await db.enqueueSyncEvent(ea);
    db.bindVerifiedAccount(b); const eb = event(); await db.enqueueSyncEvent(eb);
    const seen: string[] = [];
    await new SyncEngine(db, async batch => { seen.push(...batch.map(e => e.event_id)); return ack(batch); }).flushSyncQueue();
    assert.deepEqual(seen, [eb.event_id]);
    db.bindVerifiedAccount(a);
    assert.deepEqual(await db.getPendingSyncEvents(), [ea]);
  } finally { f.close(); }
});

test('v1 databases migrate forward in order and keep their records', async () => {
  const sqlite = new DatabaseSync(':memory:');
  try {
    sqlite.exec(`CREATE TABLE account_records (owner TEXT NOT NULL, kind TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, PRIMARY KEY(owner, kind, id)); PRAGMA user_version = 1;`);
    sqlite.prepare('INSERT INTO account_records VALUES (?,?,?,?)').run('owner', 'set', 'set-1', '{"id":"set-1"}');
    const store = createSqliteAccountStore(async () => connection(sqlite));
    assert.deepEqual((await store.list('owner', 'set')).map(r => r.id), ['set-1']);
    assert.equal((sqlite.prepare('PRAGMA user_version').get() as { user_version: number }).user_version, SQLITE_SCHEMA_VERSION);
    const index = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='account_records_owner_kind'").get();
    assert.ok(index);
  } finally { sqlite.close(); }
});

test('a failing migration rolls back and leaves the previous schema version', async () => {
  const sqlite = new DatabaseSync(':memory:');
  try {
    sqlite.exec(`CREATE TABLE account_records (owner TEXT, kind TEXT, id TEXT, data TEXT); PRAGMA user_version = 1;`);
    // An index name collision with a table makes migration v2 fail.
    sqlite.exec('CREATE TABLE account_records_owner_kind (x)');
    const store = createSqliteAccountStore(async () => connection(sqlite));
    await assert.rejects(store.list('owner', 'set'));
    assert.equal((sqlite.prepare('PRAGMA user_version').get() as { user_version: number }).user_version, 1);
  } finally { sqlite.close(); }
});

test('low storage surfaces a learner-facing message and writes nothing', async () => {
  const full: SqlConnection = {
    async execAsync() {}, async runAsync() { throw new Error('SQLITE_FULL: database or disk is full'); },
    async getAllAsync<T>() { return [{ user_version: SQLITE_SCHEMA_VERSION }] as T[]; },
    async withExclusiveTransactionAsync(task) { await task(full); },
  };
  const store = createSqliteAccountStore(async () => full);
  await assert.rejects(store.write('owner', [{ kind: 'set', id: 'x', data: {} }]), /low on storage/);
});
