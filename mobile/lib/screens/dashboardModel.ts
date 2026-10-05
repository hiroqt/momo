import type { StudySet } from '../../types';

/** Streak records use UTC study days, including when local midnight differs. */
export function getWeekDate(index: number, today = new Date()): { date: string; isToday: boolean } {
  if (!Number.isInteger(index) || index < 0 || index > 6) throw new RangeError('Week day must be between 0 and 6.');
  const currentDayIndex = (today.getUTCDay() + 6) % 7;
  const date = new Date(today);
  date.setUTCDate(today.getUTCDate() - currentDayIndex + index);
  return { date: date.toISOString().slice(0, 10), isToday: index === currentDayIndex };
}

/** Lead to an available study set, or the notes upload flow. */
export function dashboardStudyAction(sets: StudySet[]): {
  route: '/documents/upload' | `/study/${string}`; label: string; description: string;
} {
  const studySet = sets.find(set => set.item_count > 0);
  return studySet ? {
    route: `/study/${studySet.id}`, label: 'Start a study session',
    description: `${studySet.title} · ${studySet.item_count} ${studySet.item_count === 1 ? 'item' : 'items'} to explore`,
  } : {
    route: '/documents/upload', label: 'Create your first study set',
    description: 'Turn your notes into cards, quizzes, and a clearer understanding.',
  };
}
