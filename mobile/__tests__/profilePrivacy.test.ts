import assert from 'node:assert/strict';
import test from 'node:test';
import { getProfileDisplayName, getVisibleProfile, type AccountProfileSnapshot } from '../lib/screens/profile';
import type { UserProfile } from '../types';

const profile = (id: string, fullName: string): UserProfile => ({
  id,
  email: `${id}@example.test`,
  full_name: fullName,
  documents_used_this_month: 0,
  monthly_limit: 10,
  quota_resets_at: '2026-11-01',
});

test('a cached profile is hidden immediately when the verified account changes', () => {
  const accountA: AccountProfileSnapshot = { accountId: 'account-a', profile: profile('account-a', 'A Student') };

  assert.equal(getVisibleProfile(accountA, 'account-a', true)?.email, 'account-a@example.test');
  assert.equal(getVisibleProfile(accountA, 'account-b', true), null);
  assert.equal(getVisibleProfile(accountA, null, true), null);
  assert.equal(getVisibleProfile(accountA, 'account-a', false), null);
  assert.equal(getVisibleProfile({ accountId: 'account-b', profile: accountA.profile }, 'account-b', true), null);
});

test('signed-in profile names come from the matching account, while guest names stay local', () => {
  assert.equal(getProfileDisplayName(null, false, 'Account A', 'Student'), 'Your study space');
  assert.equal(getProfileDisplayName(profile('account-b', 'B Student'), false, 'Account A', 'Student'), 'B Student');
  assert.equal(getProfileDisplayName(null, true, 'Guest', 'Learner'), 'Guest Learner');
});
