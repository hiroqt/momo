import { apiFetch } from './client';
import { SyncEvent } from '../../types';

export interface SyncResponse {
  accepted_count: number;
  ignored_duplicates_count: number;
  processed_at: string;
}

export async function sendSyncBatch(events: SyncEvent[]): Promise<SyncResponse> {
  return apiFetch<SyncResponse>('/api/sync', {
    method: 'POST',
    body: JSON.stringify({ events }),
  });
}
