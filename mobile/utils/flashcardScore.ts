export interface FlashcardScore { correct: number; total: number; xp: number }
/** Includes the committed card immediately, before React schedules the next render. */
export function recordFlashcardResult(previous: FlashcardScore, mastered: boolean): FlashcardScore {
  return { correct: previous.correct + (mastered ? 1 : 0), total: previous.total + 1,
    xp: previous.xp + (mastered ? 15 : 0) };
}

/** Lock the current card before scoring; rapid presses must never earn duplicate XP. */
export function canRecordFlashcardResult(index: number, answeredIndex: number, revealed: boolean): boolean {
  return revealed && index >= 0 && answeredIndex !== index;
}

/** Progress describes committed cards, never the unanswered card currently on screen. */
export function flashcardProgress(index: number, total: number): { position: number; completedPercent: number } {
  if (total <= 0) return { position: 0, completedPercent: 0 };
  const completed = Math.min(Math.max(index, 0), total);
  return { position: Math.min(completed + 1, total), completedPercent: Math.round(completed / total * 100) };
}
