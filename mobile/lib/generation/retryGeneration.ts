import type { GenerationJob } from '../../types';
import { ApiError, classifyFailure } from '../api/errors';

/** Resolve uncertain retry delivery by reading the existing job, never another POST. */
export async function retryAndReconcile(options: {
  retry(): Promise<GenerationJob>;
  isCurrent(): boolean;
  onError(error: unknown): void;
  resumePolling(job?: GenerationJob): void;
}): Promise<void> {
  if (!options.isCurrent()) return;
  try {
    const job = await options.retry();
    if (options.isCurrent()) options.resumePolling(job);
  } catch (error) {
    if (!options.isCurrent()) return;
    options.onError(error);
    if (classifyFailure(error) === 'transient' ||
        (error instanceof ApiError && error.status === 409 && error.code === 'GENERATION_NOT_RETRYABLE'))
      options.resumePolling();
  }
}
