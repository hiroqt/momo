import type { UserProfile } from '../../types';

export function getQuotaSummary(profile: UserProfile | null) {
  if (!profile || !Number.isFinite(profile.documents_used_this_month) ||
      !Number.isFinite(profile.monthly_limit) || profile.monthly_limit <= 0) return null;
  const used = Math.max(0, profile.documents_used_this_month);
  const limit = profile.monthly_limit;
  return { used, limit, percent: Math.min(100, Math.round(used / limit * 100)), remaining: Math.max(0, limit - used) };
}

const FORMAT_LABELS: Record<string, string> = {
  flashcard: 'Flashcards', flashcards: 'Flashcards', multiple_choice: 'Multiple choice',
  quiz: 'Quizzes', summary: 'Summaries', summaries: 'Summaries', true_false: 'True / false',
  identification: 'Identification', fill_in_the_blank: 'Fill in the blank', qa: 'Q&A',
};

export function formatStudyFormats(formats: string[], fallback: string): string {
  const selected = formats.length ? formats : fallback ? [fallback] : ['all'];
  if (selected.includes('all')) return 'All formats';
  return selected.map(format => FORMAT_LABELS[format] ?? format.replace(/_/g, ' ')).join(', ');
}

export function formatStudyTrack(track: string, grade: string, year: string, course: string): string {
  const labels: Record<string, string> = { high_school: 'High school', college: 'College', med_nursing: 'Health sciences', stem: 'STEM', general: 'General studies' };
  const detail = track === 'high_school' ? grade : [year, course].filter(Boolean).join(' · ');
  return [labels[track] ?? (track.replace(/_/g, ' ') || 'Not selected'), detail].filter(Boolean).join(' · ');
}
