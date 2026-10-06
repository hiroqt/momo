import type { StudyItem } from '../../types';
import type { QuizAnswers } from './quizSession';
import type { StudySessionRecord } from './studySessionService';

/** Orders items as the session stored them; unknown ids fall back to the given order. */
export function orderItemsForSession(session: StudySessionRecord, items: StudyItem[]): StudyItem[] {
  const byId = new Map(items.map(item => [item.id, item]));
  const ordered = session.item_ids.map(id => byId.get(id)).filter((item): item is StudyItem => !!item);
  return ordered.length === items.length ? ordered : items;
}

/** Rebuilds quiz UI state from a durable session without re-committing any answer. */
export function restoreQuizSession(session: StudySessionRecord, items: StudyItem[]) {
  const ordered = orderItemsForSession(session, items);
  const answers: QuizAnswers = {};
  for (const [key, answer] of Object.entries(session.answers)) {
    const index = Number(key);
    if (index < ordered.length && answer.status !== 'review_again') {
      answers[index] = { answer: answer.answer, status: answer.status, xp: answer.xp, streak: answer.streak, heartCost: answer.heartCost };
    }
  }
  const remainingMs: Record<number, number> = {};
  for (const [key, value] of Object.entries(session.remaining_ms)) remainingMs[Number(key)] = value;
  const allAnswered = ordered.length > 0 && ordered.every((_, index) => !!answers[index]);
  let index = Math.min(session.current_index, Math.max(0, ordered.length - 1));
  if (answers[index] && !allAnswered) {
    for (let offset = 1; offset <= ordered.length; offset++) {
      const candidate = (index + offset) % ordered.length;
      if (!answers[candidate]) { index = candidate; break; }
    }
  }
  return { items: ordered, answers, remainingMs, index, allAnswered };
}

/** Flashcards commit in order; resume at the first uncommitted card. */
export function restoreFlashcardSession(session: StudySessionRecord, items: StudyItem[]) {
  const ordered = orderItemsForSession(session, items);
  let next = 0;
  while (next < ordered.length && session.answers[String(next)]) next++;
  const committed = Object.values(session.answers);
  const correct = committed.filter(answer => answer.status === 'correct').length;
  return {
    items: ordered,
    index: Math.min(next, Math.max(0, ordered.length - 1)),
    finished: ordered.length > 0 && next >= ordered.length,
    score: { correct, total: committed.length, xp: committed.reduce((sum, answer) => sum + answer.xp, 0) },
  };
}
