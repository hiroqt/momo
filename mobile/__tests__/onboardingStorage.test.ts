import assert from 'node:assert/strict';
import test from 'node:test';
import { onboardingStorageKey } from '../lib/storage/onboardingKeys';

test('onboarding storage isolates guest data and verified accounts from legacy and each other', () => {
  const key = '@momo_first_name';
  assert.equal(onboardingStorageKey(key, null), '@momo_guest:first_name');
  assert.notEqual(onboardingStorageKey(key, null), key);
  assert.equal(onboardingStorageKey(key, 'account-a'), '@momo_account:account-a:first_name');
  assert.notEqual(onboardingStorageKey(key, 'account-a'), onboardingStorageKey(key, 'account-b'));
});
