import assert from 'node:assert/strict';
import test from 'node:test';
import { claimQuizReveal, commitQuizAnswer, correctQuizAnswer, feedbackScrollOffset, getQuestionXP, isQuizAnswerCorrect, nextPendingQuestion, quizOptions, summarizeQuiz } from '../lib/study/quizSession';
import type { StudyItem } from '../types';
const question = (type: StudyItem['type'], answer: string, options?: string[]): StudyItem => ({ id: 'question', study_set_id: 'deck', type, answer, options, question: 'What supports learning?', difficulty: 'medium', source_metadata: { page: 3 }, order_index: 0, created_at: '2026-10-05' });

test('typed answers use normalized exact matching and reject misleading substrings', () => {
  const item = question('identification', 'Active recall');
  assert.equal(isQuizAnswerCorrect(' ACTIVE   RECALL ', item), true);
  for (const answer of ['a', 'recall', 'not active recall', 'active recall is wrong', '']) assert.equal(isQuizAnswerCorrect(answer, item), false);
  assert.equal(isQuizAnswerCorrect('ＡＣＴＩＶＥ ＲＥＣＡＬＬ', item), true);
});

test('MCQ keys resolve to actual options and true/false always has real choices', () => {
  const item = question('multiple_choice', 'B', ['A. Passive reading', 'B. Active recall']);
  assert.equal(correctQuizAnswer(item), 'B. Active recall');
  assert.equal(isQuizAnswerCorrect('B. Active recall', item), true);
  assert.equal(isQuizAnswerCorrect('A. Passive reading', item), false);
  assert.deepEqual(quizOptions(question('true_false', 'True', ['broken'])), ['True', 'False']);
  assert.equal(isQuizAnswerCorrect('true', question('true_false', 'True')), true);
});

test('one committed answer can award XP and record a heart change only once', () => {
  const item = question('identification', 'Spacing');
  const first = commitQuizAnswer({}, 0, item, 'Spacing', 4);
  assert.equal(first.committed, true);
  assert.equal(first.record.xp, 25);
  assert.equal(first.record.heartCost, 0);
  const duplicate = commitQuizAnswer(first.answers, 0, item, 'wrong', 0);
  assert.equal(duplicate.committed, false);
  assert.equal(duplicate.answers, first.answers);
  assert.deepEqual(summarizeQuiz(duplicate.answers, 1), { correct: 1, total: 1, xp: 25 });
});

test('incorrect answers and timeouts cost one heart; skips and paid reveals award no XP', () => {
  const item = question('fill_in_the_blank', 'Recall');
  const wrong = commitQuizAnswer({}, 0, item, 'Read', 2);
  const timeout = commitQuizAnswer({}, 0, item, '', 2, 'timeout');
  const reveal = commitQuizAnswer({}, 0, item, 'Recall', 2, 'revealed');
  const skip = commitQuizAnswer({}, 0, item, '', 2, 'skipped');
  assert.equal(wrong.record.heartCost, 1);
  assert.equal(timeout.record.heartCost, 1);
  assert.equal(timeout.record.status, 'timeout');
  for (const result of [reveal, skip]) { assert.equal(result.record.heartCost, 0); assert.equal(result.record.xp, 0); }
  assert.equal(summarizeQuiz(reveal.answers, 1).correct, 0);
});

test('navigation finds every unanswered question before completion and summary includes final XP', () => {
  const first = commitQuizAnswer({}, 0, question('true_false', 'True'), 'True', 0);
  const last = commitQuizAnswer(first.answers, 2, question('identification', 'Spacing'), 'Spacing', 1);
  assert.equal(nextPendingQuestion(last.answers, 2, 3), 1);
  const middle = commitQuizAnswer(last.answers, 1, question('multiple_choice', 'A', ['Recall', 'Read']), 'Recall', 2);
  assert.equal(nextPendingQuestion(middle.answers, 1, 3), null);
  assert.deepEqual(summarizeQuiz(middle.answers, 3), { correct: 3, total: 3, xp: 50 });
  assert.equal(getQuestionXP('true_false'), 10);
  assert.equal(getQuestionXP('multiple_choice'), 15);
});

test('timeout and check racing cannot overwrite an accepted answer or double-charge hearts', () => {
  const item = question('multiple_choice', 'Recall', ['Recall', 'Read']);
  const checked = commitQuizAnswer({}, 0, item, 'Recall', 0);
  const lateTimeout = commitQuizAnswer(checked.answers, 0, item, '', 0, 'timeout');
  assert.equal(lateTimeout.committed, false);
  assert.equal(lateTimeout.record.status, 'correct');
  assert.equal(lateTimeout.record.heartCost, 0);
  const timedOut = commitQuizAnswer({}, 0, item, '', 0, 'timeout');
  const lateCheck = commitQuizAnswer(timedOut.answers, 0, item, 'Recall', 0);
  assert.equal(lateCheck.committed, false);
  assert.equal(lateCheck.record.status, 'timeout');
  assert.equal(lateCheck.record.xp, 0);
});


test('answer explanation scrolls into view below long questions without moving already visible feedback', () => {
  assert.equal(feedbackScrollOffset(800, 240, 0, 600), 784);
  assert.equal(feedbackScrollOffset(200, 240, 0, 600), null);
  assert.equal(feedbackScrollOffset(800, 900, 0, 600), 784);
  assert.equal(feedbackScrollOffset(0, 240, 400, 600), 0);
});


test('single-letter option text is preserved after canonical answer and options are shuffled', () => {
  const item = question('multiple_choice', 'A', ['D', 'B', 'A', 'C']);
  assert.equal(correctQuizAnswer(item), 'A');
  assert.equal(isQuizAnswerCorrect('A', item), true);
  assert.equal(isQuizAnswerCorrect('D', item), false);
});


test('repeated paid reveal taps charge once before rendering and failed payment can retry', () => {
  const lock = { current: false };
  let charges = 0;
  const charge = () => { charges++; return true; };
  assert.equal(claimQuizReveal(lock, charge), 'revealed');
  assert.equal(claimQuizReveal(lock, charge), 'locked');
  assert.equal(charges, 1);
  lock.current = false;
  assert.equal(claimQuizReveal(lock, () => false), 'insufficient');
  assert.equal(lock.current, false);
  assert.equal(claimQuizReveal(lock, charge), 'revealed');
  assert.equal(charges, 2);
});
