import assert from 'node:assert/strict';
import test from 'node:test';
import { formatStudyFormats, formatStudyTrack, getQuotaSummary } from '../lib/screens/settings';
import type { UserProfile } from '../types';

const account = (used: number, limit: number): UserProfile => ({ id: 'student', email: 'student@test.invalid', documents_used_this_month: used, monthly_limit: limit, quota_resets_at: '2026-11-01' });

test('settings never invents account quota on network failure or invalid data', () => {
  assert.equal(getQuotaSummary(null), null);
  assert.equal(getQuotaSummary(account(2, 0)), null);
  assert.equal(getQuotaSummary(account(NaN, 10)), null);
});

test('settings quota reflects the account and remains bounded at the limit', () => {
  assert.deepEqual(getQuotaSummary(account(2, 10)), { used: 2, limit: 10, remaining: 8, percent: 20 });
  assert.deepEqual(getQuotaSummary(account(12, 10)), { used: 12, limit: 10, remaining: 0, percent: 100 });
});

test('study preferences display readable labels and preserve selected education detail', () => {
  assert.equal(formatStudyFormats(['all', 'flashcard'], ''), 'All formats');
  assert.equal(formatStudyFormats(['flashcard', 'multiple_choice'], ''), 'Flashcards, Multiple choice');
  assert.equal(formatStudyFormats([], 'summary'), 'Summaries');
  assert.equal(formatStudyTrack('high_school', 'Grade 12', '', ''), 'High school · Grade 12');
  assert.equal(formatStudyTrack('college', '', '4th Year', 'BS Nursing'), 'College · 4th Year · BS Nursing');
});
