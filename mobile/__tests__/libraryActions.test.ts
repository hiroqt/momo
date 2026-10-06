import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { LibraryActions } from '../lib/sync/libraryActions';
import { MutationQueue } from '../lib/sync/mutationQueue';
import { createLocalMutationStore } from '../lib/sync/mutationStore';
import { createFolderIdempotently } from '../lib/sync/folderIdempotency';
import { ApiError } from '../lib/api/errors';
import type { LocalDatabase } from '../lib/storage/localDb';
import type { Folder, StudySet } from '../types';
import { sqliteFixture } from './helpers/sqliteFixture';

function setup(db: LocalDatabase, executor: ConstructorParameters<typeof MutationQueue>[0]) {
  const queue = new MutationQueue(executor, () => db.getActiveAccountId(), () => {}, { store: createLocalMutationStore(db), uuid: async () => randomUUID() });
  return { queue, actions: new LibraryActions(db, queue, async () => randomUUID()) };
}
function set(owner: string, folderId: string | null = null): StudySet {
  const stamp = new Date().toISOString();
  return { id: randomUUID(), user_id: owner, title: 'Cardio', item_count: 0, folder_id: folderId, created_at: stamp, updated_at: stamp, generation_config: {} } as StudySet;
}

test('offline folder create persists the folder and its mutation atomically across restart, then re-keys to the server id', async () => {
  const f = sqliteFixture();
  try {
    const owner = randomUUID(), serverId = randomUUID();
    let { db } = f.restart(); db.bindVerifiedAccount(owner);
    let { actions } = setup(db, async () => { throw new ApiError(0, 'TIMEOUT', 'offline'); });
    const folder = await actions.createFolder('Biology');
    const deck = set(owner); await db.saveStudySet(deck, []);
    await actions.moveStudySet(deck.id, folder.id);

    ({ db } = f.restart()); db.bindVerifiedAccount(owner);
    assert.equal((await db.getFolder(folder.id))?.name, 'Biology');
    assert.equal((await db.getStudySet(deck.id))?.folder_id, folder.id);
    const calls: unknown[] = [];
    const online = setup(db, async (mutation, resolveId) => {
      if (mutation.type === 'CREATE_FOLDER') { calls.push(['create', mutation.id]); return { createdId: serverId }; }
      calls.push([mutation.type, resolveId(mutation.payload.folderId)]);
    });
    await online.queue.refresh();
    assert.equal(online.queue.getState().pendingCount, 2);
    await online.queue.processQueue();
    assert.equal(online.queue.getState().pendingCount, 0);
    assert.deepEqual(calls.at(-1), ['MOVE_STUDY_SET', serverId]);
    assert.equal(await db.getFolder(folder.id), null);
    assert.equal((await db.getFolder(serverId))?.name, 'Biology');
    assert.equal((await db.getStudySet(deck.id))?.folder_id, serverId);
  } finally { f.close(); }
});

test('a replayed folder create after a lost response resolves to the existing server folder', async () => {
  const existing: Folder = { id: randomUUID(), user_id: 'u', name: 'Biology', reviewer_count: 0, created_at: '', updated_at: '' };
  let creates = 0;
  const api = {
    async create(_name: string, _color: string | null, key: string): Promise<Folder> {
      creates++;
      assert.ok(key);
      if (creates === 1) throw new ApiError(0, 'TIMEOUT', 'lost response'); // server created it, client never heard back
      throw new ApiError(400, 'FOLDER_NAME_EXISTS', 'A folder with this name already exists.');
    },
    async list() { return [existing]; },
  };
  const mutation = { id: randomUUID(), type: 'CREATE_FOLDER' as const, payload: { clientId: randomUUID(), name: ' biology ' }, createdAt: 0, retryCount: 0, ownerId: 'u', status: 'pending' as const, nextAttemptAt: 0, lastErrorCode: null };
  await assert.rejects(createFolderIdempotently(mutation, api), /TIMEOUT/);
  assert.deepEqual(await createFolderIdempotently(mutation, api), { createdId: existing.id });
  assert.equal(creates, 2);
});

test('dismissing a blocked folder create removes the phantom folder and restores sets moved into it', async () => {
  const f = sqliteFixture();
  try {
    const owner = randomUUID(), { db } = f.restart(); db.bindVerifiedAccount(owner);
    const original = await db.saveStudySet(set(owner), []).then(() => db.readRecords('set')).then(rows => rows[0].data as StudySet);
    const other = set(owner); await db.saveStudySet(other, []);
    const { queue, actions } = setup(db, async mutation => {
      if (mutation.type === 'CREATE_FOLDER') throw new ApiError(402, 'INSUFFICIENT_CREDITS', 'Not enough credits');
    });
    const folder = await actions.createFolder('Physics');
    await actions.moveStudySet(original.id, folder.id);
    await actions.renameStudySet(other.id, 'Renamed');
    await queue.processQueue();
    // Unrelated rename synced; the create is blocked and the move waits behind it.
    const blocked = await queue.listBlocked();
    assert.deepEqual(blocked.map(m => m.type), ['CREATE_FOLDER']);
    assert.equal(queue.getState().pendingCount, 1);

    await queue.dismissBlocked(blocked[0].id);
    assert.deepEqual([queue.getState().pendingCount, queue.getState().blockedCount], [0, 0]);
    assert.equal(await db.getFolder(folder.id), null);
    assert.equal((await db.getStudySet(original.id))?.folder_id, null);
    assert.equal((await db.getStudySet(other.id))?.title, 'Renamed', 'synced changes are not reverted');
  } finally { f.close(); }
});

test('dismissing a blocked set delete restores the set and its items; a still-queued change keeps its record', async () => {
  const f = sqliteFixture();
  try {
    const owner = randomUUID(), { db } = f.restart(); db.bindVerifiedAccount(owner);
    const deck = set(owner), kept = set(owner);
    const item = { id: randomUUID(), user_id: owner, study_set_id: deck.id, type: 'flashcard', question: 'Q', answer: 'A', difficulty: 'easy', source_metadata: {}, order_index: 0, created_at: new Date(0).toISOString() };
    await db.saveStudySet(deck, [item as never]); await db.saveStudySet(kept, []);
    const { queue, actions } = setup(db, async mutation => {
      if (mutation.type === 'DELETE_STUDY_SET') throw new ApiError(409, 'CONFLICT', 'refused');
      throw new ApiError(0, 'TIMEOUT', 'offline');
    });
    await actions.deleteStudySet(deck.id);
    await queue.processQueue();
    assert.equal(await db.getStudySet(deck.id), null);
    await actions.renameStudySet(kept.id, 'Pending rename');
    const [blocked] = await queue.listBlocked();
    await queue.dismissBlocked(blocked.id);
    assert.equal((await db.getStudySet(deck.id))?.title, 'Cardio');
    assert.equal((await db.getStudyItems(deck.id)).length, 1);
    assert.equal((await db.getStudySet(kept.id))?.title, 'Pending rename');
    assert.equal(queue.getState().pendingCount, 1);
  } finally { f.close(); }
});

test('deleting a folder keeps its study sets and guests cannot queue account changes', async () => {
  const f = sqliteFixture();
  try {
    const owner = randomUUID(), { db } = f.restart(); db.bindVerifiedAccount(owner);
    const { actions } = setup(db, async () => {});
    const folder = await actions.createFolder('Chem');
    const deck = set(owner, folder.id); await db.saveStudySet(deck, []);
    await actions.deleteFolder(folder.id);
    assert.equal((await db.getStudySet(deck.id))?.folder_id, null);
    db.bindVerifiedAccount(null);
    await assert.rejects(actions.createFolder('Guest'), /Sign in/);
    await assert.rejects(actions.createFolder('   '), /Sign in|1 to 50/);
  } finally { f.close(); }
});
