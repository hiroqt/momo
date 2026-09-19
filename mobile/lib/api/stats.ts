import { apiFetch } from './client';

export interface StreakResponse {
  active_dates: string[];
  current_streak: number;
}

export async function getStreak(): Promise<StreakResponse> {
  return apiFetch<StreakResponse>('/api/stats/streak');
}
