import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { SyncAttentionService, attentionReason, describeChange } from '../lib/sync/syncAttention';
import { MutationQueue } from '../lib/sync/mutationQueue';
import { createLocalMutationStore, type QueuedMutation } from '../lib/sync/mutationStore';
import { LibraryActions } from '../lib/sync/libraryActions';
import { SyncEngine } from '../lib/sync/syncEngine';
import { ApiError } from '../lib/api/errors';
import type { LocalDatabase } from '../lib/storage/localDb';
import type { StudySet, SyncEvent } from '../types';
import { sqliteFixture } from './helpers/sqliteFixture';

const none = { folder: () => null, set: () => null };
const mutation = (type: QueuedMutation['type'], payload: Record<string, unknown>): QueuedMutation =>
  ({ id: randomUUID(), type, payload, createdAt: 0, retryCount: 0, ownerId: 'u', status: 'blocked', nextAttemptAt: 0, lastErrorCode: null });

test('changes are described in plain words without ids or technical terms', () => {
  const folderId = randomUUID(), setId = randomUUID();
  const names = { folder: (id: unknown) => (id === folderId ? 'Biology' : null), set: (id: unknown) => (id === setId ? 'Cardio' : null) };
  assert.equal(describeChange(mutation('CREATE_FOLDER', { clientId: folderId, name: 'Physics' }), none), 'Create folder “Physics”');
  assert.equal(describeChange(mutation('MOVE_STUDY_SET', { id: setId, folderId }), names), 'Move “Cardio” to “Biology”');
  assert.equal(describeChange(mutation('MOVE_STUDY_SET', { id: setId, folderId: null }), names), 'Remove “Cardio” from its folder');
  assert.equal(describeChange(mutation('DELETE_STUDY_SET', { id: randomUUID() }), names), 'Delete a reviewer');
  assert.equal(describeChange(mutation('DELETE_FOLDER', { id: folderId }), names), 'Delete folder “Biology”');
  assert.equal(describeChange(mutation('RENAME_STUDY_SET', { id: setId, title: 'x'.repeat(80) }), names).length <= 'Rename reviewer to “”'.length + 40, true);
  for (const type of ['RENAME_FOLDER', 'DELETE_FOLDER', 'RENAME_STUDY_SET', 'DELETE_STUDY_SET', 'MOVE_STUDY_SET'] as const) {
    assert.doesNotMatch(describeChange(mutation(type, { id: randomUUID(), folderId: randomUUID() }), none), /[0-9a-f]{8}-|undefined|null|_/);
  }
  assert.equal(attentionReason('INSUFFICIENT_CREDITS'), 'You did not have enough credits for this.');
  assert.doesNotMatch(attentionReason('PGRST301'), /PGRST/);
});

function setup(db: LocalDatabase, executor: ConstructorParameters<typeof MutationQueue>[0], send: (events: SyncEvent[]) => Promise<never>) {
  const queue = new MutationQueue(executor, () => db.getActiveAccountId(), () => {}, { store: createLocalMutationStore(db), uuid: async () => randomUUID() });
  const engine = new SyncEngine(db, send);
  const service = new SyncAttentionService({
    heldAnswerCount: async () => (await engine.getSummary()).held,
    listBlocked: () => queue.listBlocked(),
    folders: () => db.readRecords('folder'), sets: () => db.readRecords('set'),
    retryAnswers: async () => { await engine.retryHeldEvents(); },
    retryChange: id => queue.retryBlocked(id),
    discardChange: id => queue.dismissBlocked(id),
  });
  return { queue, engine, service, actions: new LibraryActions(db, queue, async () => randomUUID()) };
}

test('held answers and blocked changes are listed together and each can be retried or discarded', async () => {
  const f = sqliteFixture();
  try {
    const owner = randomUUID(), { db } = f.restart(); db.bindVerifiedAccount(owner);
    const stamp = new Date().toISOString();
    const deck = { id: randomUUID(), user_id: owner, title: 'Cardio', item_count: 0, folder_id: null, created_at: stamp, updated_at: stamp, generation_config: {} } as StudySet;
    await db.saveStudySet(deck, []);
    let accept = false;
    const { queue, engine, service, actions } = setup(db, async () => {
      if (!accept) throw new ApiError(402, 'INSUFFICIENT_CREDITS', 'Not enough credits');
      return { createdId: randomUUID() };
    }, async () => { throw new ApiError(404, 'STUDY_ITEM_NOT_FOUND', 'Study item not found.'); });
    await db.enqueueSyncEvent({ event_id: randomUUID(), study_item_id: randomUUID(), result: 'correct', occurred_at: stamp });
    await engine.flushSyncQueue();
    await actions.createFolder('Physics');
    await actions.deleteStudySet(deck.id);
    await queue.processQueue();

    let view = await service.load();
    assert.equal(view.heldAnswers, 1);
    assert.deepEqual(view.changes.map(c => c.label), ['Create folder “Physics”', 'Delete reviewer “Cardio”']);
    assert.equal(view.total, 3);
    assert.equal(view.changes[0].reason, 'You did not have enough credits for this.');

    // Discard puts the deleted reviewer back; retry sends only the chosen change.
    await service.discardChange(view.changes[1].id);
    assert.equal((await db.getStudySet(deck.id))?.title, 'Cardio');
    accept = true;
    await service.retryChange(view.changes[0].id);
    await queue.processQueue();
    await service.retryAnswers();
    view = await service.load();
    assert.deepEqual([view.heldAnswers, view.changes.length, view.total], [0, 0, 0]);
    assert.equal((await db.getPendingSyncEvents()).length, 1, 'retried answer is pending again, never dropped');
  } finally { f.close(); }
});
