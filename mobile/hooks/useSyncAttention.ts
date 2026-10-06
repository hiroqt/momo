import { useCallback, useEffect, useRef, useState } from 'react';
import { EMPTY_ATTENTION, type SyncAttention } from '@/lib/sync/syncAttention';
import { subscribeSyncAttention, syncAttention } from '@/lib/sync/syncAttentionRuntime';

const ACTION_FAILED = 'That did not work. Your change is still saved on this device. Try again in a moment.';

/** Learner-facing view of server-refused answers and library changes, with explicit actions. */
export function useSyncAttention() {
  const [attention, setAttention] = useState<SyncAttention>(EMPTY_ATTENTION);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loadToken = useRef(0);

  const reload = useCallback(() => {
    const token = ++loadToken.current;
    syncAttention.load()
      .then(next => { if (token === loadToken.current) setAttention(next); })
      .catch(() => { if (token === loadToken.current) setAttention(EMPTY_ATTENTION); });
  }, []);

  useEffect(() => {
    reload();
    return subscribeSyncAttention(reload);
  }, [reload]);

  const run = useCallback(async (id: string, action: () => Promise<void>) => {
    if (busyId) return;
    setBusyId(id); setError(null);
    try { await action(); } catch { setError(ACTION_FAILED); } finally { setBusyId(null); reload(); }
  }, [busyId, reload]);

  return {
    attention, busyId, error,
    retryAnswers: () => run('answers', () => syncAttention.retryAnswers()),
    retryChange: (id: string) => run(id, () => syncAttention.retryChange(id)),
    discardChange: (id: string) => run(id, () => syncAttention.discardChange(id)),
  };
}
