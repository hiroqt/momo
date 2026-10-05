export type MomoMood = 'cool' | 'cheer' | 'xp' | 'focus';

export interface AcademicWeaponInput {
  mode: 'quiz' | 'flashcard' | 'streak';
  subject?: string;
  accuracy?: number; // 0 - 100
  correctCount?: number;
  totalQuestions?: number;
  cardsCount?: number;
  streak?: number;
  xpEarned?: number;
  studyHour?: number; // 0 - 23
  userName?: string;
}

export interface AcademicWeaponData {
  headline: string;
  subtitle: string;
  challengeText: string;
  subject: string;
  accuracy?: number;
  scoreFraction?: string;
  streak?: number;
  cardsCount?: number;
  xpEarned?: number;
  momoMood: MomoMood;
  paletteAccent: string; // Hex color for glow and badges
  alternativeChallenges: string[];
  userName?: string;
}

export function generateAcademicWeaponReport(input: AcademicWeaponInput): AcademicWeaponData {
  const hour = input.studyHour ?? new Date().getHours();
  const isLateNight = hour >= 23 || hour <= 4;
  const subjectName = input.subject && input.subject.trim() ? input.subject.trim() : 'General Study';
  const userName = input.userName?.trim() || undefined;
  const count = (value: number | undefined) => Number.isFinite(value) ? Math.max(0, Math.floor(value!)) : 0;
  const xpEarned = count(input.xpEarned);

  if (input.mode === 'streak') {
    const streak = count(input.streak);
    const dayLabel = streak === 1 ? 'Day' : 'Days';
    const dayLower = streak === 1 ? 'day' : 'days';
    return {
      headline: 'ONE DAY AT A TIME',
      subtitle: `${streak} ${dayLabel} of showing up`,
      challengeText: `${streak === 1 ? 'Day 1' : `Day ${streak}`} study streak. Join me for the next one?`,
      subject: 'Daily Consistency',
      streak,
      momoMood: 'cheer',
      paletteAccent: '#B91C1C', // Crimson Flame
      userName,
      alternativeChallenges: [
        `${streak === 1 ? 'Day 1' : `Day ${streak}`} study streak. Join me for the next one?`,
        `${streak} ${dayLower} straight with Momo. Want to join me?`,
        'Small steps, steady progress. Let’s study together.',
      ],
    };
  }

  if (input.mode === 'flashcard') {
    const cards = count(input.cardsCount);
    return {
      headline: 'TODAY’S STUDY WIN',
      subtitle: `${cards} Cards Reviewed`,
      challengeText: `Practicing ${subjectName}. Study with me?`,
      subject: subjectName,
      cardsCount: cards,
      accuracy: input.totalQuestions && input.totalQuestions > 0 && input.correctCount !== undefined
        ? Math.round(Math.max(0, Math.min(input.totalQuestions, input.correctCount)) / input.totalQuestions * 100)
        : input.accuracy !== undefined && Number.isFinite(input.accuracy) ? Math.max(0, Math.min(100, Math.round(input.accuracy))) : undefined,
      xpEarned,
      momoMood: 'xp',
      paletteAccent: '#047857', // Cyber Emerald
      userName,
      alternativeChallenges: [
        `Practicing ${subjectName}. Study with me?`,
        `Reviewed ${cards} flashcards. One session at a time.`,
        `Learning ${subjectName} with Momo. Your turn?`,
      ],
    };
  }

  // Default: Quiz Mode
  const total = count(input.totalQuestions);
  const correct = Math.min(total, count(input.correctCount));
  const rawAccuracy = input.accuracy ?? (total > 0 && input.correctCount !== undefined
    ? Math.round((correct / total) * 100) : undefined);
  const accuracy = rawAccuracy !== undefined && Number.isFinite(rawAccuracy)
    ? Math.max(0, Math.min(100, Math.round(rawAccuracy))) : undefined;
  const scoreFraction = total > 0 && input.correctCount !== undefined
    ? `${correct}/${total}` : undefined;

  if (accuracy === undefined) {
    return {
      headline: 'MY STUDY SESSION', subtitle: `Making progress in ${subjectName}`,
      challengeText: `Learning ${subjectName} with Momo. Study with me?`, subject: subjectName,
      momoMood: 'focus', paletteAccent: '#7C3AED', userName, xpEarned,
      alternativeChallenges: [`Learning ${subjectName} with Momo. Study with me?`, 'A little practice today goes a long way.'],
    };
  }

  if (isLateNight) {
    return {
      headline: 'MIDNIGHT SCHOLAR',
      subtitle: `Locked in late night on ${subjectName}`,
      challengeText: `Made time to practice ${subjectName}.`,
      subject: subjectName,
      accuracy,
      scoreFraction,
      xpEarned,
      momoMood: 'focus',
      paletteAccent: '#6366F1', // Deep Indigo
      userName,
      alternativeChallenges: [
        `Made time to practice ${subjectName}.`,
        `A little evening practice. Scored ${accuracy}% in ${subjectName}!`,
        `Can you beat my ${accuracy}% in ${subjectName}?`,
      ],
    };
  }

  if (accuracy >= 85) {
    return {
      headline: 'PRACTICE IS PAYING OFF',
      subtitle: `Quiz completed in ${subjectName}`,
      challengeText: `Can you beat my ${accuracy}% in ${subjectName}?`,
      subject: subjectName,
      accuracy,
      scoreFraction,
      xpEarned,
      momoMood: 'cool',
      paletteAccent: '#6D28D9', // Neon Violet
      userName,
      alternativeChallenges: [
        `Can you beat my ${accuracy}% in ${subjectName}?`,
        `Practicing ${subjectName} with Momo. Join me!`,
        `Every study session is a step forward.`,
      ],
    };
  }

  return {
    headline: 'KEEP SHOWING UP',
    subtitle: `Making progress in ${subjectName}`,
    challengeText: `Surviving ${subjectName} one quiz at a time. Beat my score?`,
    subject: subjectName,
    accuracy,
    scoreFraction,
    xpEarned,
    momoMood: 'cheer',
    paletteAccent: '#B45309', // Electric Amber
    userName,
    alternativeChallenges: [
      `Surviving ${subjectName} one quiz at a time. Beat my score?`,
      `Progress > Perfection in ${subjectName}. Can you beat my score?`,
      `Finished strong on Momo. Let's see your score in ${subjectName}!`,
    ],
  };
}
