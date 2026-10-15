import assert from 'node:assert/strict';
import test from 'node:test';
import { onboardingOwner, onboardingStorageKey } from '../lib/storage/onboardingKeys';
import { enqueueOnboardingWrite } from '../lib/storage/onboardingWriteQueue';

test('onboarding storage isolates guest data and verified accounts from legacy and each other', () => {
  const key = '@momo_first_name';
  assert.equal(onboardingStorageKey(key, null), '@momo_guest:first_name');
  assert.notEqual(onboardingStorageKey(key, null), key);
  assert.equal(onboardingStorageKey(key, 'account-a'), '@momo_account:account-a:first_name');
  assert.notEqual(onboardingStorageKey(key, 'account-a'), onboardingStorageKey(key, 'account-b'));
});

test('onboarding stays hidden while the verified identity is restoring or being replaced', () => {
  assert.equal(onboardingOwner('restoring', false, null), null);
  assert.equal(onboardingOwner('signed_in', true, 'account-a'), null);
  assert.equal(onboardingOwner('signed_in', false, 'account-a'), 'account-a');
  assert.equal(onboardingOwner('signed_out', false, null), 'guest');
});

test('onboarding storage writes serialize per owner without blocking another account', async () => {
  let releaseFirst!: () => void;
  const firstWrite = new Promise<void>((resolve) => { releaseFirst = resolve; });
  const order: string[] = [];
  const first = enqueueOnboardingWrite('queue-test-a', async () => {
    order.push('a1-start');
    await firstWrite;
    order.push('a1-end');
  });
  const second = enqueueOnboardingWrite('queue-test-a', async () => { order.push('a2'); });
  await enqueueOnboardingWrite('queue-test-b', async () => { order.push('b1'); });

  assert.deepEqual(order, ['a1-start', 'b1']);
  releaseFirst();
  await Promise.all([first, second]);
  assert.deepEqual(order, ['a1-start', 'b1', 'a1-end', 'a2']);
});

test('a failed onboarding write does not block later writes for that owner', async () => {
  const owner = 'queue-test-recovery';
  await assert.rejects(enqueueOnboardingWrite(owner, async () => { throw new Error('storage unavailable'); }));
  await assert.doesNotReject(enqueueOnboardingWrite(owner, async () => undefined));
});
