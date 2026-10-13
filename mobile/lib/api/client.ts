import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { localDb } from '../storage/localDb';
import { VerifiedSession } from '../auth/verifiedSession';
import { validateApiDestination } from './environment';
import { classifyFailure } from './errors';
import { requestTransport, type RequestContext } from './requestTransport';

function resolveBaseUrl(): string {
  // 1. Explicit environment variable if provided
  if (process.env.EXPO_PUBLIC_API_URL) {
    let envUrl = process.env.EXPO_PUBLIC_API_URL;
    if (Platform.OS === 'android' && (envUrl.includes('localhost') || envUrl.includes('127.0.0.1'))) {
      return envUrl.replace('localhost', '10.0.2.2').replace('127.0.0.1', '10.0.2.2');
    }
    return envUrl;
  }

  // 2. Dynamic host resolution from Metro bundler host when available
  const hostUri =
    Constants.expoConfig?.hostUri ||
    (Constants as any).manifest?.debuggerHost ||
    (Constants as any).manifest2?.extra?.expoGo?.debuggerHost;
  const ip = hostUri?.split(':')?.[0];
  if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
    // Current backend is running on port 800 (with port 8000 as standard fallback)
    return `http://${ip}:800`;
  }

  // 3. Android emulator localhost alias to host machine
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:800';
  }
  return 'http://localhost:800';
}

const appEnvironment = process.env.EXPO_PUBLIC_APP_ENV || 'development';
if (['staging', 'production'].includes(appEnvironment) && !process.env.EXPO_PUBLIC_API_URL) {
  throw new Error('Hosted apps require an explicit API URL.');
}
export let BASE_URL = validateApiDestination(resolveBaseUrl(), appEnvironment);

export function getBaseUrl(): string {
  return BASE_URL;
}

let authToken: string | null = null;
let tokenRefresher: (() => Promise<void>) | null = null;
let unauthorizedHandler: (() => Promise<boolean>) | null = null;

const verifiedSession = new VerifiedSession({
  setToken(token) { authToken = token; },
  bindAccount(accountId) { localDb.bindVerifiedAccount(accountId); },
  verify: () => apiFetch<{ id: string }>('/api/me', {}, 15000, { skipSessionHooks: true }),
  isRetryable: error => classifyFailure(error) === 'transient',
});

/** Binds local storage only after the backend verifies the token and returns its user id. */
export async function setAuthenticatedSession(token: string): Promise<string> {
  return verifiedSession.establish(token);
}

/** Replaces the bearer token after a refresh without changing the verified account. */
export function replaceAccessToken(token: string): void {
  authToken = token;
}

/** Clears token and account binding (sign-out, expiry, revocation). */
export function clearAuthenticatedSession(): void {
  verifiedSession.clear();
}

export function setAuthToken(token: string | null) {
  verifiedSession.invalidate();
  authToken = token;
}

export function getAuthToken(): string | null {
  return authToken;
}

/**
 * Session hooks are installed by the auth runtime: `refresh` keeps the access token
 * fresh before a request and `unauthorized` gets one chance to recover from a 401.
 */
export function installSessionHooks(hooks: { refresh: () => Promise<void>; unauthorized: () => Promise<boolean> } | null): void {
  tokenRefresher = hooks?.refresh ?? null;
  unauthorizedHandler = hooks?.unauthorized ?? null;
}

export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {},
  timeoutMs = 15000,
  internal: RequestContext = {}
): Promise<T> {
  return requestTransport<T>(endpoint, options, timeoutMs, internal, {
    environment: appEnvironment,
    baseUrl: () => BASE_URL,
    acceptBaseUrl: value => { BASE_URL = value; },
    token: () => authToken,
    binding: () => ({ owner: localDb.getActiveAccountId(), epoch: localDb.getAccountEpoch() }),
    refresh: async () => { if (tokenRefresher) await tokenRefresher(); },
    recoverUnauthorized: async () => unauthorizedHandler ? unauthorizedHandler() : false,
    fetch: (url, init) => fetch(url, init),
  });
}
