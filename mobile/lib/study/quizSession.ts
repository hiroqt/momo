import type { StudyItem } from '../../types';

export type QuizAnswerStatus = 'correct' | 'incorrect' | 'timeout' | 'revealed' | 'skipped';
export interface QuizAnswer {
  answer: string;
  status: QuizAnswerStatus;
  xp: number;
  streak: number;
  heartCost: number;
}
export type QuizAnswers = Record<number, QuizAnswer>;

export function getQuestionXP(type: string): number {
  return type === 'identification' ? 25 : type === 'true_false' ? 10 : 15;
}

export function normalizeQuizAnswer(value: string): string {
  return value.normalize('NFKC').trim().toLocaleLowerCase('en-US').replace(/\s+/g, ' ');
}

function stripChoiceLabel(value: string): string {
  return value.replace(/^\s*[A-Z][.)]\s+/i, '');
}

export function quizOptions(item: StudyItem): string[] {
  return item.type === 'true_false' ? ['True', 'False'] : item.options ?? [];
}

/** Choice keys may be a letter, labeled text or full option text. Never use substring matching. */
export function correctQuizAnswer(item: StudyItem): string {
  const options = quizOptions(item);
  const answer = normalizeQuizAnswer(item.answer);
  const exactOption = options.find(option => normalizeQuizAnswer(option) === answer);
  if (exactOption) return exactOption;
  const letter = answer.match(/^([a-z])[.)]?$/);
  if (item.type === 'multiple_choice' && letter) {
    const index = letter[1].charCodeAt(0) - 97;
    if (options[index]) return options[index];
  }
  return options.find(option => normalizeQuizAnswer(stripChoiceLabel(option)) === normalizeQuizAnswer(stripChoiceLabel(item.answer))) ?? item.answer;
}

export function isQuizAnswerCorrect(answer: string, item: StudyItem): boolean {
  const normalized = normalizeQuizAnswer(answer);
  if (!normalized) return false;
  const expected = correctQuizAnswer(item);
  if (item.type === 'multiple_choice') return normalizeQuizAnswer(stripChoiceLabel(answer)) === normalizeQuizAnswer(stripChoiceLabel(expected));
  return normalized === normalizeQuizAnswer(expected);
}

/** A committed question cannot grant more XP, consume another heart or enqueue a second event. */
export function commitQuizAnswer(answers: QuizAnswers, index: number, item: StudyItem, answer: string, streak: number, status?: 'timeout' | 'revealed' | 'skipped') {
  if (answers[index]) return { answers, committed: false, record: answers[index] };
  const correct = !status && isQuizAnswerCorrect(answer, item);
  const nextStreak = correct ? streak + 1 : 0;
  const record: QuizAnswer = {
    answer,
    status: status ?? (correct ? 'correct' : 'incorrect'),
    xp: correct ? getQuestionXP(item.type) : 0,
    streak: nextStreak,
    heartCost: status === 'revealed' || status === 'skipped' || correct ? 0 : 1,
  };
  return { answers: { ...answers, [index]: record }, committed: true, record };
}

export function summarizeQuiz(answers: QuizAnswers, total: number) {
  const records = Object.values(answers);
  const correct = records.filter(answer => answer.status === 'correct').length;
  return { correct, total, xp: records.reduce((sum, answer) => sum + answer.xp, 0) };
}

export function nextPendingQuestion(answers: QuizAnswers, index: number, total: number): number | null {
  for (let offset = 1; offset <= total; offset++) {
    const candidate = (index + offset) % total;
    if (!answers[candidate]) return candidate;
  }
  return null;
}

/** Reveal explanation without moving a feedback card already fully in view. */
export function feedbackScrollOffset(feedbackY: number, feedbackHeight: number, scrollY: number, viewportHeight: number): number | null {
  const visibleHeight = Math.min(feedbackHeight, Math.max(0, viewportHeight - 32));
  if (feedbackY >= scrollY + 16 && feedbackY + visibleHeight <= scrollY + viewportHeight - 16) return null;
  return Math.max(0, feedbackY - 16);
}

export type RevealCharge = 'revealed' | 'insufficient' | 'failed';
/**
 * Lock before charging so repeated taps cannot buy the same reveal twice. The lock is
 * held until the charge settles; the answer may be shown only after `revealed`.
 */
export async function claimQuizReveal(lock: { current: boolean }, charge: () => boolean | RevealCharge | Promise<RevealCharge>): Promise<RevealCharge | 'locked'> {
  if (lock.current) return 'locked';
  lock.current = true;
  let outcome: RevealCharge;
  try {
    const value = await charge();
    outcome = value === true ? 'revealed' : value === false ? 'insufficient' : value;
  } catch { outcome = 'failed'; }
  if (outcome !== 'revealed') lock.current = false;
  return outcome;
}
