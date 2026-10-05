import type { StudySet } from '../../types';

export type SetFilterType = 'all' | 'reviewers' | 'quizzes';

export const isSetQuiz = (set: StudySet): boolean => {
  const genMode = set.generation_config?.generation_mode;
  if (genMode === 'quiz') return true;
  if (genMode === 'reviewer') return false;

  const qTypes = set.generation_config?.question_types;
  if (Array.isArray(qTypes) && qTypes.some((t: string) => ['multiple_choice', 'true_false', 'identification', 'fill_in_the_blank'].includes(t))) {
    return true;
  }

  const revTypes = set.generation_config?.reviewer_types;
  if (Array.isArray(revTypes) && revTypes.length > 0) return false;

  const lowerTitle = set.title.toLowerCase();
  if (lowerTitle.includes('quiz')) return true;
  return false;
};

export const isSetReviewer = (set: StudySet): boolean => {
  const genMode = set.generation_config?.generation_mode;
  if (genMode === 'reviewer') return true;
  if (genMode === 'quiz') return false;

  const revTypes = set.generation_config?.reviewer_types;
  if (Array.isArray(revTypes) && revTypes.length > 0) return true;

  const qTypes = set.generation_config?.question_types;
  if (Array.isArray(qTypes) && qTypes.some((t: string) => ['multiple_choice', 'true_false', 'identification', 'fill_in_the_blank'].includes(t))) {
    return false;
  }

  const lowerTitle = set.title.toLowerCase();
  if (lowerTitle.includes('reviewer')) return true;
  if (lowerTitle.includes('quiz')) return false;

  return true; // Default
};

export const matchesSetTypeFilter = (set: StudySet, filter: SetFilterType): boolean => {
  if (filter === 'all') return true;
  const genMode = set.generation_config?.generation_mode;
  if (genMode === 'both') return true;

  if (filter === 'reviewers') return isSetReviewer(set);
  if (filter === 'quizzes') return isSetQuiz(set);
  return true;
};

export function filterLibrarySets(sets: StudySet[], search: string, filter: SetFilterType, folderId: string | null): StudySet[] {
  const query = search.trim().toLocaleLowerCase();
  return sets.filter(set => (!folderId || (folderId === 'unorganized' ? !set.folder_id : set.folder_id === folderId))
    && matchesSetTypeFilter(set, filter) && (!query || set.title.toLocaleLowerCase().includes(query)));
}
