export type QuoteCategory =
  | 'lock_in'
  | 'real_talk'
  | 'manifesting'
  | 'scholar_era'
  | 'brain_gains'
  | 'boss_energy'
  | 'dopamine_check';

export interface StudyQuote {
  id: string;
  quote: string;
  author: string;
  category: QuoteCategory;
  categoryLabel: string;
  emoji: string;
  vibe: 'funny' | 'serious';
}

export const STUDY_QUOTES: StudyQuote[] = [
  // --- FUNNY & RELATABLE GEN Z QUOTES ---
  {
    id: 'quote-1',
    quote: 'Lock in right now. The doomscrolling can wait, your academic comeback cannot.',
    author: "Momo's Real Talk",
    category: 'lock_in',
    categoryLabel: 'Lock In',
    emoji: '🔒',
    vibe: 'funny',
  },
  {
    id: 'quote-2',
    quote: 'Delulu is the solulu until the exam paper lands on your desk. Open the flashcards, bestie.',
    author: 'Unfiltered Momo',
    category: 'real_talk',
    categoryLabel: 'Real Talk',
    emoji: '💅',
    vibe: 'funny',
  },
  {
    id: 'quote-3',
    quote: 'It is giving 4.0 GPA energy. Let’s manifest this grade with actual active recall, no cap.',
    author: 'Academic Manifestation',
    category: 'manifesting',
    categoryLabel: 'Manifesting',
    emoji: '✨',
    vibe: 'funny',
  },
  {
    id: 'quote-4',
    quote: 'Study 25 mins without checking your phone challenge: Level IMPOSSIBLE (you got this fr).',
    author: 'Dopamine Detox',
    category: 'dopamine_check',
    categoryLabel: 'Focus Mode',
    emoji: '📱',
    vibe: 'funny',
  },
  {
    id: 'quote-5',
    quote: 'Sleeping with the textbook under your pillow does NOT count as neural absorption, unfortunately.',
    author: 'Science Momo',
    category: 'real_talk',
    categoryLabel: 'Real Talk',
    emoji: '😴',
    vibe: 'funny',
  },
  {
    id: 'quote-6',
    quote: 'One does not simply “cram 8 chapters at 3 AM” and expect main character energy on exam day.',
    author: 'Academic Survival Guide',
    category: 'real_talk',
    categoryLabel: '3 AM Realness',
    emoji: '💀',
    vibe: 'funny',
  },
  {
    id: 'quote-7',
    quote: 'Your phone battery at 2%: panic. Your exam tomorrow with zero review: chill? Make it make sense.',
    author: 'Momo’s Callout',
    category: 'dopamine_check',
    categoryLabel: 'Priority Check',
    emoji: '🔋',
    vibe: 'funny',
  },
  {
    id: 'quote-8',
    quote: 'Be so good at this topic that the exam questions start second-guessing themselves.',
    author: 'Unhinged Motivation',
    category: 'boss_energy',
    categoryLabel: 'Boss Energy',
    emoji: '⚡',
    vibe: 'funny',
  },
  {
    id: 'quote-9',
    quote: 'Romanticize the grind: lofi beats on, iced matcha in hand, 30 active recall cards. We are in our scholar era.',
    author: 'Study Aesthetic',
    category: 'scholar_era',
    categoryLabel: 'Scholar Era',
    emoji: '🎧',
    vibe: 'funny',
  },
  {
    id: 'quote-10',
    quote: 'Me pretending I understand the slide: 👁️👄👁️ (Please review the flashcards before it is too late).',
    author: 'Relatable Moments',
    category: 'real_talk',
    categoryLabel: 'Honest Hour',
    emoji: '😭',
    vibe: 'funny',
  },

  // --- SERIOUS & HARD-HITTING GEN Z MOTIVATION ---
  {
    id: 'quote-11',
    quote: 'The dopamine from seeing an “A” hits 1000x harder than any 15-second video ever will. Lock in.',
    author: 'Dopamine Economics',
    category: 'lock_in',
    categoryLabel: 'High Dopamine',
    emoji: '🎯',
    vibe: 'serious',
  },
  {
    id: 'quote-12',
    quote: 'Don’t just study until you get it right. Study until you literally cannot get it wrong.',
    author: 'Mastery Standard',
    category: 'boss_energy',
    categoryLabel: 'Pure Mastery',
    emoji: '💎',
    vibe: 'serious',
  },
  {
    id: 'quote-13',
    quote: 'Future you is either going to thank you or cringe at you for what you do in the next 45 minutes.',
    author: 'Time Travel Logic',
    category: 'lock_in',
    categoryLabel: 'Future You',
    emoji: '⏳',
    vibe: 'serious',
  },
  {
    id: 'quote-14',
    quote: 'Active recall feels hard because your brain is physically paving new neural highways. Trust the friction.',
    author: 'Neuroplasticity Science',
    category: 'brain_gains',
    categoryLabel: 'Brain Gains',
    emoji: '🧠',
    vibe: 'serious',
  },
  {
    id: 'quote-15',
    quote: 'Consistency is an underrated cheat code. 20 focused minutes every day destroys 8 hours of Sunday night crying.',
    author: 'Spaced Repetition Protocol',
    category: 'brain_gains',
    categoryLabel: 'Cheat Code',
    emoji: '📈',
    vibe: 'serious',
  },
  {
    id: 'quote-16',
    quote: 'Fail in practice now so you look untouchable on exam day. Mistakes in flashcards are 100% free lessons.',
    author: 'Tactical Learning',
    category: 'boss_energy',
    categoryLabel: 'Untouchable',
    emoji: '🛡️',
    vibe: 'serious',
  },
  {
    id: 'quote-17',
    quote: 'You are not “bad at studying”—your system was just mid. Test yourself with active recall and level up.',
    author: 'System Upgrade',
    category: 'scholar_era',
    categoryLabel: 'Level Up',
    emoji: '🚀',
    vibe: 'serious',
  },
  {
    id: 'quote-18',
    quote: 'Stop negotiating with your study schedule. Consistency isn’t luck, it’s self-respect.',
    author: 'Daily Standards',
    category: 'lock_in',
    categoryLabel: 'Self Respect',
    emoji: '🔥',
    vibe: 'serious',
  },
  {
    id: 'quote-19',
    quote: 'Procrastination is just borrowing happiness from tomorrow with a 500% interest rate.',
    author: 'Academic Economics',
    category: 'real_talk',
    categoryLabel: 'Real Talk',
    emoji: '📉',
    vibe: 'funny',
  },
  {
    id: 'quote-20',
    quote: 'Be so prepared that exam day feels like a victory lap, not an ambush.',
    author: 'Exam Day Energy',
    category: 'boss_energy',
    categoryLabel: 'Victory Lap',
    emoji: '🏆',
    vibe: 'serious',
  },
];

/**
 * Returns a deterministic quote for the current calendar day,
 * ensuring students see an inspiring theme throughout their daily sessions.
 */
export function getDailyStudyQuote(): StudyQuote {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - startOfYear.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  const dayOfYear = Math.floor(diff / oneDay);
  const index = Math.abs(dayOfYear) % STUDY_QUOTES.length;
  return STUDY_QUOTES[index];
}

/**
 * Returns a random study quote, optionally excluding the current quote ID
 * to guarantee a fresh quote on user tap/refresh.
 */
export function getRandomStudyQuote(excludeId?: string): StudyQuote {
  const candidates = excludeId
    ? STUDY_QUOTES.filter((q) => q.id !== excludeId)
    : STUDY_QUOTES;

  if (candidates.length === 0) {
    return STUDY_QUOTES[0];
  }

  const randomIndex = Math.floor(Math.random() * candidates.length);
  return candidates[randomIndex];
}
