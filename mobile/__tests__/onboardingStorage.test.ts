import assert from 'node:assert/strict';
import test from 'node:test';
import { onboardingOwner, onboardingStorageKey } from '../lib/storage/onboardingKeys';

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
