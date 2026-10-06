/**
 * Typed API failure. `status` is 0 for network failures/timeouts. The message keeps
 * the historical `[CODE] message` format used by existing screens.
 */
export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(`[${code}] ${message}`);
    this.name = 'ApiError';
  }
}

export type FailureKind = 'transient' | 'auth' | 'rejected';

/**
 * transient: retry later with backoff (network, timeout, rate limit, server error).
 * auth: the session must be refreshed or re-established; keep work pending.
 * rejected: the server refused this payload; retrying unchanged will not help.
 */
export function classifyFailure(error: unknown): FailureKind {
  if (!(error instanceof ApiError)) return 'transient';
  const { status } = error;
  if (status === 0 || status === 408 || status === 425 || status === 429 || status >= 500) return 'transient';
  if (status === 401) return 'auth';
  return 'rejected';
}

/**
 * Sync rejections caused by the contents of one event (an unknown/foreign study item
 * or session, or an invalid event payload). Only these justify splitting a batch to
 * isolate the offending event. Endpoint-level refusals (missing route, account-level
 * 403, proxy 413, ...) say nothing about individual events and must keep the whole
 * queue pending with backoff.
 */
const PER_EVENT_REJECTIONS: ReadonlyMap<string, number> = new Map([
  ['STUDY_ITEM_NOT_FOUND', 404],
  ['STUDY_SESSION_NOT_FOUND', 404],
  ['VALIDATION_ERROR', 422],
]);

export function isPerEventSyncRejection(error: unknown): boolean {
  return error instanceof ApiError && PER_EVENT_REJECTIONS.get(error.code) === error.status;
}

export function failureCode(error: unknown): string {
  return error instanceof ApiError ? error.code : 'NETWORK';
}
