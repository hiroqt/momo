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
  const userName = input.userName;

  if (input.mode === 'streak') {
    const streak = input.streak || 1;
    const dayLabel = streak === 1 ? 'Day' : 'Days';
    const dayLower = streak === 1 ? 'day' : 'days';
    return {
      headline: 'DISCIPLINE ON LOCK',
      subtitle: `${streak} ${dayLabel} & Still Undefeated`,
      challengeText: `${streak === 1 ? 'Day 1' : `Day ${streak}`} study streak. Can you even compete?`,
      subject: 'Daily Consistency',
      streak,
      momoMood: 'cheer',
      paletteAccent: '#EF4444', // Crimson Flame
      userName,
      alternativeChallenges: [
        `${streak === 1 ? 'Day 1' : `Day ${streak}`} study streak. Can you even compete?`,
        `${streak} ${dayLower} straight with Momo. Who's challenging this?`,
        'Never breaking the chain. Academic weapon mindset.',
      ],
    };
  }

  if (input.mode === 'flashcard') {
    const cards = input.cardsCount || 10;
    return {
      headline: 'LECTURE DESTROYER',
      subtitle: `${cards} Concepts Memorized`,
      challengeText: `Already memorized the entire deck in ${subjectName}. Your move.`,
      subject: subjectName,
      cardsCount: cards,
      xpEarned: input.xpEarned,
      momoMood: 'xp',
      paletteAccent: '#10B981', // Cyber Emerald
      userName,
      alternativeChallenges: [
        `Already memorized the entire deck in ${subjectName}. Your move.`,
        `Crushed ${cards} flashcards with zero hesitation.`,
        `Momo cooked the flashcards, I ate. Who's topping this in ${subjectName}?`,
      ],
    };
  }

  // Default: Quiz Mode
  const accuracy = input.accuracy ?? (input.totalQuestions && input.totalQuestions > 0 && input.correctCount !== undefined
    ? Math.round((input.correctCount / input.totalQuestions) * 100)
    : 100);

  const scoreFraction = input.totalQuestions !== undefined && input.correctCount !== undefined
    ? `${input.correctCount}/${input.totalQuestions}`
    : undefined;

  if (isLateNight) {
    return {
      headline: 'MIDNIGHT SCHOLAR',
      subtitle: `Locked in late night on ${subjectName}`,
      challengeText: `Who needs sleep when you're acing ${subjectName}?`,
      subject: subjectName,
      accuracy,
      scoreFraction,
      xpEarned: input.xpEarned,
      momoMood: 'focus',
      paletteAccent: '#6366F1', // Deep Indigo
      userName,
      alternativeChallenges: [
        `Who needs sleep when you're acing ${subjectName}?`,
        `Late night grind hit different. Scored ${accuracy}% in ${subjectName}!`,
        `Can you beat my ${accuracy}% in ${subjectName}?`,
      ],
    };
  }

  if (accuracy >= 85) {
    return {
      headline: 'CERTIFIED ACADEMIC WEAPON',
      subtitle: `Unmatched recall in ${subjectName}`,
      challengeText: `Can you beat my ${accuracy}% in ${subjectName}?`,
      subject: subjectName,
      accuracy,
      scoreFraction,
      xpEarned: input.xpEarned,
      momoMood: 'cool',
      paletteAccent: '#8B5CF6', // Neon Violet
      userName,
      alternativeChallenges: [
        `Can you beat my ${accuracy}% in ${subjectName}?`,
        `Momo cooked, I ate. Top this score in ${subjectName}!`,
        `Exam ready before the prof even finishes the slides.`,
      ],
    };
  }

  return {
    headline: 'MIDTERM SURVIVOR',
    subtitle: `Battled through ${subjectName}`,
    challengeText: `Surviving ${subjectName} one quiz at a time. Beat my score?`,
    subject: subjectName,
    accuracy,
    scoreFraction,
    xpEarned: input.xpEarned,
    momoMood: 'cheer',
    paletteAccent: '#F59E0B', // Electric Amber
    userName,
    alternativeChallenges: [
      `Surviving ${subjectName} one quiz at a time. Beat my score?`,
      `Progress > Perfection in ${subjectName}. Can you beat my score?`,
      `Finished strong on Momo. Let's see your score in ${subjectName}!`,
    ],
  };
}
