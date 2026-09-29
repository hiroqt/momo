import Constants from 'expo-constants';
import { Platform } from 'react-native';

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

export let BASE_URL = resolveBaseUrl();

export function getBaseUrl(): string {
  return BASE_URL;
}

let authToken: string | null = 'test-token-dev-user-001';

export function setAuthToken(token: string | null) {
  authToken = token;
}

export function getAuthToken(): string | null {
  return authToken;
}

export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {},
  timeoutMs = 15000
): Promise<T> {
  const currentBase = BASE_URL;
  const url = `${currentBase}${endpoint}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const controller = new AbortController();
  // Responsive timeout: 15 seconds for general requests
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      signal: options.signal || controller.signal,
    });

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        errorData = { error: { code: `HTTP_${response.status}`, message: response.statusText } };
      }
      const err = errorData?.error || { code: 'UNKNOWN_ERROR', message: 'An unknown error occurred.' };
      throw new Error(`[${err.code}] ${err.message}`);
    }

    return response.json();
  } catch (error: any) {
    // If connection failed or timed out on port 800 or 8000, attempt alternative port automatically
    const isTimeoutOrNetwork =
      error?.name === 'AbortError' ||
      error?.message?.includes('fetch failed') ||
      error?.message?.includes('The request timed out') ||
      error?.message?.includes('Network request failed') ||
      error?.message?.includes('FetchRequestCanceledException');

    if (isTimeoutOrNetwork) {
      const altBase = currentBase.includes(':8000')
        ? currentBase.replace(':8000', ':800')
        : currentBase.includes(':800')
        ? currentBase.replace(':800', ':8000')
        : null;

      if (altBase && altBase !== currentBase) {
        try {
          const altController = new AbortController();
          const altTimeout = setTimeout(() => altController.abort(), 6000);
          const altUrl = `${altBase}${endpoint}`;
          const altResponse = await fetch(altUrl, {
            ...options,
            headers,
            signal: altController.signal,
          });
          clearTimeout(altTimeout);

          if (altResponse.ok) {
            BASE_URL = altBase; // Cache the verified responsive port
            return altResponse.json();
          }
        } catch {
          // Fall through to original error
        }
      }

      throw new Error(`[TIMEOUT] Unable to connect to backend at ${url}. Ensure the backend server is running and accessible.`);
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
