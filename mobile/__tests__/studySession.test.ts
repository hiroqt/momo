import test from 'node:test';
import assert from 'node:assert/strict';
import type { StudyItem } from '../types';
import { selectStudyContent, initialStudyMode, sessionResult, restartStudySession, filterReviewerNotes, randomizeStudyItems } from '../utils/studySession';
const item = (type: StudyItem['type'], extra: Partial<StudyItem> = {}): StudyItem => ({ id: type, study_set_id: 'set', type,
  question: 'Cell membrane', answer: 'Selective boundary', difficulty: 'easy', source_metadata: { page: 1 }, order_index: 0, created_at: '', ...extra });

test('requested generation formats cannot turn flashcards into quiz questions or notes', () => {
  const content = selectStudyContent([item('flashcard')]);
  assert.deepEqual(content.modes, ['flashcard']);
  assert.equal(content.quiz.length, 0);
  assert.equal(content.reviewer.length, 0);
  assert.equal(initialStudyMode([item('flashcard')], 'quiz'), 'flashcard');
});

test('all persisted review formats are readable and mixed modes honor a valid entry point', () => {
  const items = [item('summary'), item('topic_explanation'), item('qa'), item('multiple_choice', { answer: 'B', options: ['A', 'B', 'C', 'D'] }), item('flashcard')];
  assert.deepEqual(selectStudyContent(items).modes, ['reviewer', 'flashcard', 'quiz']);
  assert.equal(selectStudyContent(items).reviewer.length, 3);
  assert.equal(initialStudyMode(items, 'quiz'), 'quiz');
  assert.equal(initialStudyMode(items, 'invalid'), 'reviewer');
});

test('unusable questions and empty multiple choice options never open a broken quiz', () => {
  assert.deepEqual(selectStudyContent([item('multiple_choice', { options: [] }), item('flashcard', { answer: ' ' })]).modes, []);
});

test('restart clears old completion/share state and advances the component session key', () => {
  assert.deepEqual(restartStudySession(4), { sessionKey: 5, finishedScore: null, quizScore: null, isQuizCompleted: false, showStoryModal: false });
});

test('result summary uses actual correct, review-again and zero XP values', () => {
  assert.deepEqual(sessionResult({ correct: 2, total: 3, xp: 30 }), { correct: 2, total: 3, reviewAgain: 1, percent: 67, xp: 30 });
  assert.equal(sessionResult({ correct: 0, total: 0, xp: 0 }).percent, 0);
  assert.equal(sessionResult({ correct: 0, total: 4, xp: 0 }).xp, 0);
});

test('reviewer search finds source explanations, ignores casing and respects category', () => {
  const items = [item('summary', { explanation: 'Controls transport' }), item('qa', { question: 'Membrane proteins' })];
  assert.equal(filterReviewerNotes(items, 'all', ' TRANSPORT ').length, 1);
  assert.equal(filterReviewerNotes(items, 'qa', 'membrane').length, 1);
  assert.equal(filterReviewerNotes(items, 'summary', 'proteins').length, 0);
});


test('option shuffle resolves letter keys and removes stale labels before moving options', async () => {
  const { correctQuizAnswer, isQuizAnswerCorrect } = await import('../lib/study/quizSession');
  const original = item('multiple_choice', { answer: 'B', options: ['A. Passive reading', 'B. Active recall', 'C. Cramming', 'D. Highlighting'] });
  const [shuffled] = randomizeStudyItems([original], () => 0);
  assert.equal(shuffled.answer, 'Active recall');
  assert.deepEqual(shuffled.options, ['Active recall', 'Cramming', 'Highlighting', 'Passive reading']);
  assert.equal(correctQuizAnswer(shuffled), 'Active recall');
  assert.equal(isQuizAnswerCorrect('Active recall', shuffled), true);
  assert.equal(isQuizAnswerCorrect('Cramming', shuffled), false);
  assert.equal(original.answer, 'B');
  assert.equal(original.options?.[0], 'A. Passive reading');
});

test('labeled answers and full text preserve correctness across repeated session resets', async () => {
  const { isQuizAnswerCorrect } = await import('../lib/study/quizSession');
  for (const answer of ['B. Active recall', 'Active recall']) {
    let question = item('multiple_choice', { answer, options: ['A. Passive reading', 'B. Active recall', 'C. Cramming', 'D. Highlighting'] });
    for (let reset = 0; reset < 4; reset++) {
      [question] = randomizeStudyItems([question], () => 0);
      assert.equal(question.answer, 'Active recall');
      assert.equal(isQuizAnswerCorrect('Active recall', question), true);
      assert.equal(isQuizAnswerCorrect('Passive reading', question), false);
    }
  }
});


test('malformed extra choices and answers outside the choices cannot open an ungradable quiz', () => {
  const invalid = [
    item('multiple_choice', { answer: 'A', options: ['A', 'B', ''] }),
    item('multiple_choice', { answer: 'A', options: ['A', 'B', null as unknown as string] }),
    item('multiple_choice', { answer: 'missing', options: ['Alpha', 'Beta'] }),
    item('multiple_choice', { answer: 'Z', options: ['Alpha', 'Beta'] }),
    item('true_false', { answer: 'Maybe' }),
  ];
  for (const question of invalid) assert.equal(selectStudyContent([question]).quiz.length, 0);
  assert.equal(selectStudyContent(randomizeStudyItems(invalid, () => 0)).quiz.length, 0);
});

test('choice validation preserves valid letter keys, labeled text, one-letter option text and boolean answers', () => {
  const valid = [
    item('multiple_choice', { answer: 'B', options: ['Alpha', 'Beta'] }),
    item('multiple_choice', { answer: 'B. Beta', options: ['A. Alpha', 'B. Beta'] }),
    item('multiple_choice', { answer: 'A', options: ['G', 'A', 'T', 'C'] }),
    item('true_false', { answer: ' TRUE ' }),
    item('true_false', { answer: 'False' }),
  ];
  assert.equal(selectStudyContent(valid).quiz.length, valid.length);
});
