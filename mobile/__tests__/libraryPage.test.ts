import assert from 'node:assert/strict';
import test from 'node:test';
import { filterLibrarySets, matchesSetTypeFilter, isSetQuiz } from '../lib/screens/libraryModel';
import type { StudySet } from '../types';
const set = (id: string, mode: string, folder_id?: string): StudySet => ({ id, folder_id, item_count: 20, title: id, generation_config: { generation_mode: mode }, user_id: 'u', created_at: '', updated_at: '' });

test('library combines case-insensitive search, folder and study format selection', () => {
  const sets = [set('Biology quiz', 'quiz', 'science'), set('Biology notes', 'reviewer', 'science'), set('Biology quiz 2', 'quiz', 'exam')];
  assert.deepEqual(filterLibrarySets(sets, '  BIOLOGY ', 'quizzes', 'science').map(s => s.id), ['Biology quiz']);
  assert.deepEqual(filterLibrarySets(sets, '', 'all', null), sets);
  assert.deepEqual(filterLibrarySets(sets, 'missing', 'all', null), []);
});
test('combined decks remain available in both library format filters', () => {
  const combined = set('Combined', 'both');
  assert.equal(matchesSetTypeFilter(combined, 'reviewers'), true);
  assert.equal(matchesSetTypeFilter(combined, 'quizzes'), true);
});
test('library unorganized filter preserves orphaned decks and legacy quiz classification', () => {
  const orphan = set('History', 'reviewer');
  const legacy = { ...set('Exam', ''), generation_config: { question_types: ['multiple_choice'] } };
  assert.equal(isSetQuiz(legacy), true);
  assert.deepEqual(filterLibrarySets([orphan, legacy, set('Math', 'reviewer', 'f')], '', 'all', 'unorganized').map(s => s.id), ['History', 'Exam']);
  assert.deepEqual(filterLibrarySets([], '', 'all', null), []);
});
