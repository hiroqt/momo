import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { MutationQueue } from '../lib/sync/mutationQueue';
import { createMemoryMutationStore } from '../lib/sync/mutationStore';
import { ApiError } from '../lib/api/errors';

function queueFor(executor: ConstructorParameters<typeof MutationQueue>[0], account: () => string | null, clock = { now: 0 }) {
  const store = createMemoryMutationStore();
  const queue = new MutationQueue(executor, account, () => {}, { store, uuid: async () => randomUUID(), now: () => clock.now });
  return { queue, store, clock };
}

test('transient or conflict failures never discard a pending library change', async () => {
  let attempts = 0;
  const { queue, clock } = queueFor(async () => { attempts++; throw new Error('private failure'); }, () => 'a');
  await queue.enqueue('CREATE_FOLDER', { clientId: randomUUID(), name: 'Biology' });
  for (let index = 0; index < 5; index++) {
    await queue.processQueue();
    clock.now += 10 * 60 * 1000; // past any backoff
  }
  assert.equal(attempts, 5);
  assert.equal(queue.getState().pendingCount, 1);
  assert.ok(!queue.getState().lastError?.includes('private failure'));
});

test('transient failures persist exponential backoff instead of hammering the server', async () => {
  let attempts = 0;
  const { queue, store, clock } = queueFor(async () => { attempts++; throw new ApiError(503, 'UNAVAILABLE', 'down'); }, () => 'a');
  await queue.enqueue('RENAME_FOLDER', { id: randomUUID(), name: 'Bio' });
  await queue.processQueue();
  await queue.processQueue();
  assert.equal(attempts, 1);
  const [stored] = store.snapshot('a');
  assert.equal(stored.retryCount, 1);
  assert.ok(stored.nextAttemptAt > clock.now);
  await queue.processQueue({ force: true });
  assert.equal(attempts, 2);
});

test('account B cannot execute account A pending mutations', async () => {
  let account: string | null = 'a';
  const owners: string[] = [];
  const { queue } = queueFor(async mutation => { owners.push(mutation.ownerId); }, () => account);
  await queue.enqueue('CREATE_FOLDER', { clientId: randomUUID(), name: 'Private A folder' });
  account = 'b';
  await queue.processQueue();
  assert.equal(queue.getState().pendingCount, 0);
  assert.deepEqual(owners, []);
  account = 'a';
  await queue.processQueue();
  assert.deepEqual(owners, ['a']);
  assert.equal(queue.getState().pendingCount, 0);
});

test('guest changes cannot enter an account mutation queue', async () => {
  const { queue } = queueFor(async () => {}, () => null);
  await assert.rejects(queue.enqueue('CREATE_FOLDER', { name: 'Guest' }), /Sign in/);
});

test('rejected changes are held, not discarded, and dependents wait while unrelated changes continue', async () => {
  const blockedFolder = randomUUID(), otherSet = randomUUID();
  const executed: string[] = [];
  const { queue, store } = queueFor(async mutation => {
    executed.push(mutation.type);
    if (mutation.type === 'CREATE_FOLDER') throw new ApiError(402, 'INSUFFICIENT_CREDITS', 'Not enough credits');
  }, () => 'a');
  await queue.enqueue('CREATE_FOLDER', { clientId: blockedFolder, name: 'Fourth' });
  await queue.enqueue('MOVE_STUDY_SET', { id: randomUUID(), folderId: blockedFolder });
  await queue.enqueue('RENAME_STUDY_SET', { id: otherSet, title: 'Renamed' });
  await queue.processQueue();
  assert.deepEqual(executed, ['CREATE_FOLDER', 'RENAME_STUDY_SET']);
  const state = queue.getState();
  assert.equal(state.blockedCount, 1);
  assert.equal(state.pendingCount, 1);
  assert.deepEqual(store.snapshot('a').map(m => [m.type, m.status, m.lastErrorCode]), [
    ['CREATE_FOLDER', 'blocked', 'INSUFFICIENT_CREDITS'], ['MOVE_STUDY_SET', 'pending', null],
  ]);
  // Only an explicit learner action removes a blocked change.
  await queue.dismissBlocked(store.snapshot('a')[0].id);
  assert.equal(queue.getState().blockedCount, 0);
});

test('auth failures keep the change pending without consuming retries', async () => {
  const { queue, store } = queueFor(async () => { throw new ApiError(401, 'UNAUTHORIZED', 'expired'); }, () => 'a');
  await queue.enqueue('DELETE_FOLDER', { id: randomUUID() });
  await queue.processQueue();
  const [stored] = store.snapshot('a');
  assert.equal(stored.status, 'pending');
  assert.equal(stored.retryCount, 0);
  assert.match(queue.getState().lastError ?? '', /Sign in again/);
});

test('client folder ids map to server ids for later offline mutations', async () => {
  const clientId = randomUUID(), serverId = randomUUID();
  const calls: unknown[] = [];
  const { queue } = queueFor(async (mutation, resolveId) => {
    if (mutation.type === 'CREATE_FOLDER') return { createdId: serverId };
    calls.push([mutation.type, resolveId(mutation.payload.folderId ?? mutation.payload.id)]);
  }, () => 'a');
  await queue.enqueue('CREATE_FOLDER', { clientId, name: 'Biology' });
  await queue.enqueue('MOVE_STUDY_SET', { id: randomUUID(), folderId: clientId });
  await queue.enqueue('RENAME_FOLDER', { id: clientId, name: 'Bio' });
  await queue.processQueue();
  assert.deepEqual(calls, [['MOVE_STUDY_SET', serverId], ['RENAME_FOLDER', serverId]]);
  assert.equal(queue.getState().pendingCount, 0);
});
