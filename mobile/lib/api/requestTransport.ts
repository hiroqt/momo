/** Injectable transport with account-epoch guards and one-destination mutations. */
import { ApiError } from './errors';
import { validateApiDestination } from './environment';

export interface RequestBinding { owner: string; epoch: number }
export interface RequestContext {
  skipSessionHooks?: boolean;
  retried?: boolean;
  expectedBinding?: RequestBinding;
}
export interface TransportDependencies {
  environment: string;
  baseUrl(): string;
  acceptBaseUrl(value: string): void;
  token(): string | null;
  binding(): { owner: string | null; epoch: number };
  refresh(): Promise<void>;
  recoverUnauthorized(): Promise<boolean>;
  fetch: typeof fetch;
}

export async function requestTransport<T>(endpoint: string, options: RequestInit, timeoutMs: number,
  context: RequestContext, deps: TransportDependencies, deadlineAt = Date.now() + timeoutMs): Promise<T> {
  let activeController: AbortController | undefined;
  const active = deps.binding();
  const expected = context.expectedBinding ?? (!context.skipSessionHooks && active.owner ? { owner: active.owner, epoch: active.epoch } : undefined);
  const assertAccount = () => {
    const current = deps.binding();
    if (expected && (current.owner !== expected.owner || current.epoch !== expected.epoch))
      throw new ApiError(0, 'ACCOUNT_CHANGED', 'Your account changed. Please try again.');
  };
  async function checked<R>(task: () => Promise<R>): Promise<R> {
    assertAccount();
    const remaining = deadlineAt - Date.now();
    if (remaining <= 0) throw new ApiError(0, 'TIMEOUT', 'Unable to connect. Check your connection and try again.');
    let cancelDeadline: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        task(),
        new Promise<never>((_, reject) => {
          cancelDeadline = setTimeout(() => {
            activeController?.abort();
            reject(new ApiError(0, 'TIMEOUT', 'Unable to connect. Check your connection and try again.'));
          }, remaining);
        }),
      ]);
    } finally { if (cancelDeadline) clearTimeout(cancelDeadline); assertAccount(); }
  }
  assertAccount();
  if (!context.skipSessionHooks && deps.token()) await checked(() => deps.refresh().catch(() => {}));
  const base = validateApiDestination(deps.baseUrl(), deps.environment);
  const headers = new Headers(options.headers);
  if (!headers.has('content-type')) headers.set('content-type', 'application/json');
  const token = deps.token();
  if (token) headers.set('authorization', `Bearer ${token}`);
  const controller = new AbortController();
  activeController = controller;
  const abortExternal = () => controller.abort();
  options.signal?.addEventListener('abort', abortExternal, { once: true });
  if (options.signal?.aborted) controller.abort();
  const timer = setTimeout(() => controller.abort(), Math.max(0, deadlineAt - Date.now()));
  try {
    if (options.signal?.aborted) throw new ApiError(0, 'REQUEST_CANCELLED', 'Request cancelled.');
    const response = await checked(() => deps.fetch(`${base}${endpoint}`, { ...options, headers, signal: controller.signal }));
    if (response.status === 401 && !context.skipSessionHooks && !context.retried) {
      if (await checked(() => deps.recoverUnauthorized().catch(() => false))) {
        clearTimeout(timer);
        return await checked(() => requestTransport<T>(endpoint, options, timeoutMs,
          { ...context, expectedBinding: expected, retried: true }, deps, deadlineAt));
      }
    }
    if (!response.ok) {
      const body = await checked(() => response.json().catch(() => null));
      const error = body?.error || body?.detail;
      throw new ApiError(response.status, String(error?.code ?? `HTTP_${response.status}`), String(error?.message ?? 'Request failed.'));
    }
    return await checked(() => response.json() as Promise<T>);
  } catch (error) {
    assertAccount();
    if (options.signal?.aborted) throw new ApiError(0, 'REQUEST_CANCELLED', 'Request cancelled.');
    const message = error instanceof Error ? error.message : '';
    const network = error instanceof Error && (error.name === 'AbortError' || /fetch failed|Network request failed|The request timed out|FetchRequestCanceledException/.test(message));
    if (!network) throw error;
    // Never replay a mutation at another destination after uncertain delivery.
    const method = (options.method ?? 'GET').toUpperCase();
    if (['development', 'test'].includes(deps.environment) && ['GET', 'HEAD'].includes(method)) {
      const origin = new URL(base);
      if (origin.port === '800' || origin.port === '8000') {
        origin.port = origin.port === '800' ? '8000' : '800';
        const alternate = validateApiDestination(origin.origin, deps.environment);
        const fallback = new AbortController();
        activeController = fallback;
        const abortFallback = () => fallback.abort();
        options.signal?.addEventListener('abort', abortFallback, { once: true });
        const fallbackTimer = setTimeout(() => fallback.abort(), 6000);
        try {
          const result = await checked(() => deps.fetch(`${alternate}${endpoint}`, { ...options, headers, signal: fallback.signal }));
          if (result.ok) {
            const data = await checked(() => result.json() as Promise<T>);
            assertAccount();
            deps.acceptBaseUrl(alternate);
            return data;
          }
        } catch {
          assertAccount();
          if (options.signal?.aborted) throw new ApiError(0, 'REQUEST_CANCELLED', 'Request cancelled.');
        }
        finally { clearTimeout(fallbackTimer); options.signal?.removeEventListener('abort', abortFallback); }
      }
    }
    throw new ApiError(0, 'TIMEOUT', 'Unable to connect. Check your connection and try again.');
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', abortExternal);
  }
}
