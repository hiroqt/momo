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
  // --- SHORT & PUNCHY STUDY MOTIVATION (NO EMOJIS) ---
  {
    id: 'quote-1',
    quote: 'Lock in right now. Your academic comeback is waiting.',
    author: "Momo's Real Talk",
    category: 'lock_in',
    categoryLabel: 'Lock In',
    emoji: '',
    vibe: 'funny',
  },
  {
    id: 'quote-2',
    quote: 'Open your flashcards and test yourself.',
    author: 'Unfiltered Momo',
    category: 'real_talk',
    categoryLabel: 'Real Talk',
    emoji: '',
    vibe: 'funny',
  },
  {
    id: 'quote-3',
    quote: 'Active recall turns effort into high grades.',
    author: 'Academic Manifestation',
    category: 'manifesting',
    categoryLabel: 'Manifesting',
    emoji: '',
    vibe: 'funny',
  },
  {
    id: 'quote-4',
    quote: 'Study 20 minutes without checking your phone.',
    author: 'Dopamine Detox',
    category: 'dopamine_check',
    categoryLabel: 'Focus Mode',
    emoji: '',
    vibe: 'funny',
  },
  {
    id: 'quote-5',
    quote: 'Reviewing small decks daily beats cramming.',
    author: 'Science Momo',
    category: 'real_talk',
    categoryLabel: 'Real Talk',
    emoji: '',
    vibe: 'funny',
  },
  {
    id: 'quote-6',
    quote: 'Consistency beats late-night panic every time.',
    author: 'Academic Survival Guide',
    category: 'real_talk',
    categoryLabel: 'Real Talk',
    emoji: '',
    vibe: 'funny',
  },
  {
    id: 'quote-7',
    quote: 'Stay focused and master one concept at a time.',
    author: 'Momo’s Callout',
    category: 'dopamine_check',
    categoryLabel: 'Priority Check',
    emoji: '',
    vibe: 'funny',
  },
  {
    id: 'quote-8',
    quote: 'Be so prepared that the questions feel easy.',
    author: 'Unhinged Motivation',
    category: 'boss_energy',
    categoryLabel: 'Boss Energy',
    emoji: '',
    vibe: 'funny',
  },
  {
    id: 'quote-9',
    quote: '10 active recall cards a day unlocks mastery.',
    author: 'Study Aesthetic',
    category: 'scholar_era',
    categoryLabel: 'Scholar Era',
    emoji: '',
    vibe: 'funny',
  },
  {
    id: 'quote-10',
    quote: 'Active recall now saves stress later.',
    author: 'Relatable Moments',
    category: 'real_talk',
    categoryLabel: 'Daily Goal',
    emoji: '',
    vibe: 'funny',
  },
  {
    id: 'quote-11',
    quote: 'The feeling of an A beats endless scrolling.',
    author: 'Dopamine Economics',
    category: 'lock_in',
    categoryLabel: 'Lock In',
    emoji: '',
    vibe: 'serious',
  },
  {
    id: 'quote-12',
    quote: 'Practice until you cannot get it wrong.',
    author: 'Mastery Standard',
    category: 'boss_energy',
    categoryLabel: 'Pure Mastery',
    emoji: '',
    vibe: 'serious',
  },
  {
    id: 'quote-13',
    quote: 'Future you will thank you for studying now.',
    author: 'Time Travel Logic',
    category: 'lock_in',
    categoryLabel: 'Future You',
    emoji: '',
    vibe: 'serious',
  },
  {
    id: 'quote-14',
    quote: 'Active recall builds stronger memory pathways.',
    author: 'Neuroplasticity Science',
    category: 'brain_gains',
    categoryLabel: 'Brain Gains',
    emoji: '',
    vibe: 'serious',
  },
  {
    id: 'quote-15',
    quote: '20 focused minutes a day beats hours of cramming.',
    author: 'Spaced Repetition Protocol',
    category: 'brain_gains',
    categoryLabel: 'Cheat Code',
    emoji: '',
    vibe: 'serious',
  },
  {
    id: 'quote-16',
    quote: 'Mistakes in practice are free learning steps.',
    author: 'Tactical Learning',
    category: 'boss_energy',
    categoryLabel: 'Mastery',
    emoji: '',
    vibe: 'serious',
  },
  {
    id: 'quote-17',
    quote: 'Test yourself often to level up retention.',
    author: 'System Upgrade',
    category: 'scholar_era',
    categoryLabel: 'Level Up',
    emoji: '',
    vibe: 'serious',
  },
  {
    id: 'quote-18',
    quote: 'Consistency is not luck, it is a daily habit.',
    author: 'Daily Standards',
    category: 'lock_in',
    categoryLabel: 'Habit',
    emoji: '',
    vibe: 'serious',
  },
  {
    id: 'quote-19',
    quote: 'Start now so tomorrow is completely stress-free.',
    author: 'Academic Economics',
    category: 'real_talk',
    categoryLabel: 'Real Talk',
    emoji: '',
    vibe: 'funny',
  },
  {
    id: 'quote-20',
    quote: 'Prepare well and make exam day a breeze.',
    author: 'Exam Day Energy',
    category: 'boss_energy',
    categoryLabel: 'Victory Lap',
    emoji: '',
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
