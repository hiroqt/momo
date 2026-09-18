import { localDb } from '../storage/localDb';
import { sendSyncBatch } from '../api/sync';
import { SyncEvent } from '../../types';

export class SyncEngine {
  private isSyncing = false;

  async recordStudyAnswer(
    studyItemId: string,
    result: 'correct' | 'incorrect' | 'review_again',
    userAnswer?: string
  ): Promise<void> {
    const event: SyncEvent = {
      event_id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      study_item_id: studyItemId,
      result,
      user_answer: userAnswer,
      occurred_at: new Date().toISOString(),
    };

    await localDb.enqueueSyncEvent(event);
    // Attempt opportunistic online sync
    this.flushSyncQueue().catch(() => {
      // Safely silent if offline
    });
  }

  async flushSyncQueue(): Promise<void> {
    if (this.isSyncing) return;
    this.isSyncing = true;

    try {
      const pending = await localDb.getPendingSyncEvents();
      if (pending.length === 0) return;

      const resp = await sendSyncBatch(pending);
      if (resp && resp.accepted_count + resp.ignored_duplicates_count > 0) {
        const syncedIds = pending.map((e) => e.event_id);
        await localDb.removeSyncEvents(syncedIds);
      }
    } catch (err) {
      // Remains in localDb for next retry when internet returns
    } finally {
      this.isSyncing = false;
    }
  }
}

export const syncEngine = new SyncEngine();
