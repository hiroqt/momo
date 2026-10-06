import { localDb } from '../storage/localDb';
import { mutationQueue } from './mutationQueue';
import { syncEngine } from './syncEngine';
import { SyncAttentionService } from './syncAttention';

/** App-wide composition of the learner-facing "needs your attention" view. */
export const syncAttention = new SyncAttentionService({
  heldAnswerCount: async () => (await syncEngine.getSummary()).held,
  listBlocked: () => mutationQueue.listBlocked(),
  folders: () => (localDb.getActiveAccountId() ? localDb.readRecords('folder') : Promise.resolve([])),
  sets: () => (localDb.getActiveAccountId() ? localDb.readRecords('set') : Promise.resolve([])),
  retryAnswers: async () => {
    await syncEngine.retryHeldEvents();
    await syncEngine.flushSyncQueue({ force: true }).catch(() => {});
  },
  retryChange: id => mutationQueue.retryBlocked(id),
  discardChange: id => mutationQueue.dismissBlocked(id),
});

/** Fires whenever held answers, blocked changes or the active account may have changed. */
export function subscribeSyncAttention(listener: () => void): () => void {
  const offs = [syncEngine.subscribe(listener), mutationQueue.subscribe(() => listener()), localDb.onAccountChange(() => listener())];
  return () => { offs.forEach(off => off()); };
}
