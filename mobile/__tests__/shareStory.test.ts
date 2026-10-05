import assert from 'node:assert/strict';
import test from 'node:test';
import { handoffStory } from '../utils/shareStoryFlow';
import { generateAcademicWeaponReport } from '../utils/academicWeapon';

test('Instagram receives the captured image and fallback does not run after direct handoff', async () => {
  const seen: string[] = [];
  const result = await handoffStory({
    capture: async () => 'file://study.png',
    openInstagram: async uri => { seen.push(uri); return true; },
    shareImage: async () => { throw new Error('Should not fall back'); },
  });
  assert.deepEqual(seen, ['file://study.png']);
  assert.deepEqual(result, { success: true, autoOpened: true, fallbackUsed: false });
});

test('missing Instagram falls back with the PNG attached, without claiming direct Instagram opening', async () => {
  let attached: string | undefined;
  const result = await handoffStory({
    capture: async () => 'file://study.png',
    openInstagram: async () => { throw new Error('App missing'); },
    shareImage: async uri => { attached = uri; return 'opened'; },
  });
  assert.equal(attached, 'file://study.png');
  assert.equal(result.fallbackUsed, true);
  assert.equal(result.autoOpened, false);
  assert.equal(result.success, true);
});

test('share cancellation keeps the preview usable without a failure message', async () => {
  const result = await handoffStory({ capture: async () => 'file://study.png', shareImage: async () => 'cancelled' });
  assert.equal(result.success, false);
  assert.equal(result.cancelled, true);
  assert.equal(result.error, undefined);
});

test('capture failure and unavailable sharing return controlled errors without native exception details', async () => {
  let handoff = false;
  const result = await handoffStory({
    capture: async () => { throw new Error('secret native stack'); },
    shareImage: async () => { handoff = true; return 'opened'; },
  });
  assert.equal(handoff, false);
  assert.equal(result.success, false);
  assert.ok(!result.error?.includes('secret'));
  const unavailable = await handoffStory({ capture: async () => 'file://study.png', shareImage: async () => 'unavailable' });
  assert.equal(unavailable.success, false);
  assert.match(unavailable.error!, /saving/);
});

test('study story preserves zero results rather than inventing progress', () => {
  const streak = generateAcademicWeaponReport({ mode: 'streak', streak: 0 });
  const cards = generateAcademicWeaponReport({ mode: 'flashcard', cardsCount: 0 });
  const quiz = generateAcademicWeaponReport({ mode: 'quiz', correctCount: 0, totalQuestions: 10, studyHour: 12 });
  assert.equal(streak.streak, 0);
  assert.equal(cards.cardsCount, 0);
  assert.equal(quiz.accuracy, 0);
  assert.equal(quiz.scoreFraction, '0/10');
  assert.ok(!cards.subtitle.includes('Memorized'));
});

test('unknown quiz scores stay unknown and long reviewer titles are preserved', () => {
  const subject = 'Advanced cellular respiration and mitochondrial transport';
  const report = generateAcademicWeaponReport({ mode: 'quiz', subject, studyHour: 12 });
  assert.equal(report.accuracy, undefined);
  assert.equal(report.subject, subject);
  assert.ok(!report.challengeText.includes('100%'));
});

test('public study metrics reject non-finite values and stay in their valid ranges', () => {
  assert.equal(generateAcademicWeaponReport({ mode: 'quiz', accuracy: 132, studyHour: 12 }).accuracy, 100);
  assert.equal(generateAcademicWeaponReport({ mode: 'quiz', accuracy: NaN, studyHour: 12 }).accuracy, undefined);
  assert.equal(generateAcademicWeaponReport({ mode: 'flashcard', cardsCount: -3 }).cardsCount, 0);
  assert.equal(generateAcademicWeaponReport({ mode: 'streak', streak: Infinity }).streak, 0);
});

test('Photos save and chooser export are reported distinctly so the UI never claims a false save', async () => {
  const { exportStoryImage } = await import('../utils/shareStoryFlow');
  let exported = false;
  const direct = await exportStoryImage({ capture: async () => 'file://card.png', saveToPhotos: async () => true,
    exportImage: async () => { exported = true; return true; } });
  assert.equal(direct.savedDirectly, true);
  assert.equal(exported, false);
  const fallback = await exportStoryImage({ capture: async () => 'file://card.png', saveToPhotos: async () => false,
    exportImage: async uri => { assert.equal(uri, 'file://card.png'); return true; } });
  assert.equal(fallback.success, true);
  assert.equal(fallback.savedDirectly, false);
  const denied = await exportStoryImage({ capture: async () => 'file://card.png', saveToPhotos: async () => false, exportImage: async () => false });
  assert.equal(denied.success, false);
});
