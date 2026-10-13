import type { GenerationJob } from '../../types';

/** Serial polling. A stopped/account-changed poll cannot publish late results. */
export function startGenerationPolling(options: {
  fetchJob(): Promise<GenerationJob>;
  isCurrent(): boolean;
  onJob(job: GenerationJob): void;
  onCompleted(job: GenerationJob): void;
  onFailed(job: GenerationJob): void;
  onError(error: unknown): void;
  isRetryable?: (error: unknown) => boolean;
  delayMs?: number;
  schedule?: (task: () => void, delay: number) => () => void;
}): () => void {
  let stopped = false;
  let cancelTimer: (() => void) | undefined;
  const schedule = options.schedule ?? ((task, delay) => {
    const timer = setTimeout(task, delay);
    return () => clearTimeout(timer);
  });
  const current = () => !stopped && options.isCurrent();
  async function poll() {
    if (!current()) return;
    try {
      const job = await options.fetchJob();
      if (!current()) return;
      options.onJob(job);
      if (job.status === 'COMPLETED') { stopped = true; options.onCompleted(job); return; }
      if (job.status === 'FAILED') { stopped = true; options.onFailed(job); return; }
    } catch (error) {
      if (!current()) return;
      options.onError(error);
      if (options.isRetryable && !options.isRetryable(error)) { stopped = true; return; }
    }
    if (current()) cancelTimer = schedule(() => { void poll(); }, options.delayMs ?? 1400);
  }
  void poll();
  return () => { stopped = true; cancelTimer?.(); };
}
