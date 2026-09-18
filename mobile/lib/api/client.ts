import Constants from 'expo-constants';
import { Platform } from 'react-native';

function resolveBaseUrl(): string {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  // When running on a physical mobile device via Expo Go, infer IP from Metro hostUri
  const hostUri = Constants.expoConfig?.hostUri || (Constants as any).manifest?.debuggerHost;
  const ip = hostUri?.split(':')?.[0];
  if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
    return `http://${ip}:8000`;
  }
  // Android emulator localhost alias to development machine
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:8000';
  }
  return 'http://localhost:8000';
}

export const BASE_URL = resolveBaseUrl();

let authToken: string | null = 'test-token-dev-user-001';

export function setAuthToken(token: string | null) {
  authToken = token;
}

export function getAuthToken(): string | null {
  return authToken;
}

export async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${BASE_URL}${endpoint}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
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
}
