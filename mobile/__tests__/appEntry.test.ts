import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveEntryRedirect } from '../lib/auth/appEntry';

const base = {
  authStatus: 'signed_out' as const,
  onboardingLoaded: true,
  hasCompletedWelcome: false,
  hasSeenMomoIntro: false,
  isGuestMode: false,
  guestPreviewSelected: false,
};

test('first launch offers Google sign-in before onboarding', () => {
  assert.equal(resolveEntryRedirect({ ...base, currentRoute: '(tabs)/index' }), '/(auth)/sign-in');
});

test('opening the onboarding route directly does not skip the optional sign-in choice', () => {
  assert.equal(resolveEntryRedirect({ ...base, currentRoute: '(auth)/welcome' }), '/(auth)/sign-in');
});

test('guest choice proceeds to onboarding without requiring an account', () => {
  assert.equal(resolveEntryRedirect({ ...base, guestPreviewSelected: true, currentRoute: '(auth)/sign-in' }), '/(auth)/welcome');
});

test('completed guest onboarding restores the study space on later launches', () => {
  assert.equal(resolveEntryRedirect({ ...base, hasCompletedWelcome: true, hasSeenMomoIntro: true, isGuestMode: true, currentRoute: '(auth)/sign-in' }), '/(tabs)');
});

test('returning signed-in users continue onboarding where needed', () => {
  assert.equal(resolveEntryRedirect({ ...base, authStatus: 'signed_in', currentRoute: '(auth)/sign-in' }), '/(auth)/welcome');
  assert.equal(resolveEntryRedirect({ ...base, authStatus: 'signed_in', hasCompletedWelcome: true, currentRoute: '(tabs)/index' }), '/(auth)/momo-intro');
});

test('route gate waits for session and onboarding restoration', () => {
  assert.equal(resolveEntryRedirect({ ...base, authStatus: 'restoring', currentRoute: '(tabs)/index' }), null);
  assert.equal(resolveEntryRedirect({ ...base, onboardingLoaded: false, currentRoute: '(tabs)/index' }), null);
});
