import { correctQuizAnswer, normalizeQuizAnswer } from '../lib/study/quizSession';
import type { StudyItem } from '../types';

export type StudyMode = 'reviewer' | 'flashcard' | 'quiz';
export const REVIEWER_TYPES = new Set(['summary', 'qa', 'topic_explanation', 'glossary', 'concept_outline', 'cheat_sheet', 'compare_contrast', 'qa_study_sheet', 'timeline_process']);
const QUIZ_TYPES = new Set(['multiple_choice', 'true_false', 'identification', 'fill_in_the_blank']);

/** Available modes come from usable persisted content, never generation requests. */
export function selectStudyContent(items: StudyItem[]) {
  const usable = items.filter(item => typeof item.question === 'string' && !!item.question.trim()
    && typeof item.answer === 'string' && !!item.answer.trim());
  const reviewer = usable.filter(item => REVIEWER_TYPES.has(item.type));
  const flashcard = usable.filter(item => item.type === 'flashcard');
  const quiz = usable.filter(item => {
    if (!QUIZ_TYPES.has(item.type)) return false;
    if (item.type === 'true_false') return ['true', 'false'].includes(normalizeQuizAnswer(item.answer));
    if (item.type !== 'multiple_choice') return true;
    if (!Array.isArray(item.options) || item.options.length < 2
      || item.options.some(option => typeof option !== 'string' || !option.trim())) return false;
    const answer = normalizeQuizAnswer(withoutChoiceLabel(correctQuizAnswer(item)));
    return item.options.some(option => normalizeQuizAnswer(withoutChoiceLabel(option)) === answer);
  });
  const modes = (['reviewer', 'flashcard', 'quiz'] as const).filter(mode => ({ reviewer, flashcard, quiz })[mode].length > 0);
  return { reviewer, flashcard, quiz, modes };
}

export function initialStudyMode(items: StudyItem[], requested?: string): StudyMode {
  const modes = selectStudyContent(items).modes;
  return modes.includes(requested as StudyMode) ? requested as StudyMode : modes[0] ?? 'reviewer';
}

export function sessionResult(score: { correct: number; total: number; xp: number }) {
  const total = Number.isFinite(score.total) ? Math.max(0, Math.floor(score.total)) : 0;
  const correct = Number.isFinite(score.correct) ? Math.max(0, Math.min(total, Math.floor(score.correct))) : 0;
  return { correct, total, percent: total ? Math.round(correct / total * 100) : 0,
    reviewAgain: total - correct, xp: Number.isFinite(score.xp) ? Math.max(0, score.xp) : 0 };
}

export function restartStudySession(sessionKey: number) {
  return { sessionKey: sessionKey + 1, finishedScore: null, quizScore: null, isQuizCompleted: false, showStoryModal: false };
}

export function filterReviewerNotes(items: StudyItem[], category: string, query: string) {
  const normalized = query.trim().toLocaleLowerCase();
  return items.filter(item => (category === 'all' || category === item.type) && (!normalized
    || [item.question, item.answer, item.explanation ?? ''].some(text => text.toLocaleLowerCase().includes(normalized))));
}


function shuffled<T>(values: T[], random: () => number): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index--) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

function withoutChoiceLabel(value: string): string {
  return value.replace(/^\s*[A-Z][.)]\s+/i, '').trim();
}

/** Resolve positional answer keys before any option moves. Canonical text survives resets. */
export function randomizeStudyItems(items: StudyItem[], random: () => number = Math.random): StudyItem[] {
  return shuffled(items, random).map(item => {
    if (item.type !== 'multiple_choice' || !Array.isArray(item.options) || item.options.length < 2
      || typeof item.answer !== 'string' || !item.answer.trim()
      || item.options.some(option => typeof option !== 'string' || !option.trim())) return item;
    const answer = withoutChoiceLabel(correctQuizAnswer(item));
    const options = item.options.map(withoutChoiceLabel);
    return { ...item, answer, options: shuffled(options, random) };
  });
}
