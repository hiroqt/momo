import test from 'node:test';
import assert from 'node:assert/strict';
import { recordFlashcardResult, type FlashcardScore } from '../utils/flashcardScore';
import { generateAcademicWeaponReport } from '../utils/academicWeapon';

test('last correct or review-again result is included immediately in completion and sharing', () => {
  for (const last of [true, false]) {
    let score: FlashcardScore = { correct: 0, total: 0, xp: 0 };
    for (const answer of [true, false, last]) score = recordFlashcardResult(score, answer);
    assert.deepEqual(score, { correct: last ? 2 : 1, total: 3, xp: last ? 30 : 15 });
    const story = generateAcademicWeaponReport({ mode: 'flashcard', cardsCount: score.total,
      correctCount: score.correct, totalQuestions: score.total, xpEarned: score.xp });
    assert.equal(story.accuracy, last ? 67 : 33);
    assert.equal(story.cardsCount, 3);
    assert.equal(story.xpEarned, score.xp);
  }
});

test('reviewing every card again earns no XP and never produces a perfect mastery score', () => {
  const score = [false, false, false].reduce(recordFlashcardResult, { correct: 0, total: 0, xp: 0 });
  assert.deepEqual(score, { correct: 0, total: 3, xp: 0 });
});

test('recall self-check gates unanswered and duplicate card taps', async () => {
  const { canRecordFlashcardResult } = await import('../utils/flashcardScore');
  assert.equal(canRecordFlashcardResult(0, -1, false), false);
  assert.equal(canRecordFlashcardResult(0, -1, true), true);
  assert.equal(canRecordFlashcardResult(0, 0, true), false);
  assert.equal(canRecordFlashcardResult(1, 0, true), true);
  assert.equal(canRecordFlashcardResult(-1, -1, true), false);
});

test('recall progress counts reviewed cards rather than claiming the first card is done', async () => {
  const { flashcardProgress } = await import('../utils/flashcardScore');
  assert.deepEqual(flashcardProgress(0, 4), { position: 1, completedPercent: 0 });
  assert.deepEqual(flashcardProgress(3, 4), { position: 4, completedPercent: 75 });
  assert.deepEqual(flashcardProgress(4, 4), { position: 4, completedPercent: 100 });
  assert.deepEqual(flashcardProgress(0, 0), { position: 0, completedPercent: 0 });
});
