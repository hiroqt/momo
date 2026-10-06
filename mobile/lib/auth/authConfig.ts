import { validateApiDestination, type AppEnvironment } from '../api/environment';

export interface PublicAuthConfig {
  environment: AppEnvironment;
  supabaseUrl: string;
  /** Supabase anon/publishable key. Elevated keys are rejected. */
  publishableKey: string;
  redirectUrl: string;
  /** Development-only explicit token for local backends with dummy auth enabled. */
  developmentToken: string | null;
}

export interface PublicEnv {
  appEnv?: string;
  supabaseUrl?: string;
  supabaseKey?: string;
  redirectUrl?: string;
  devAuthToken?: string;
}

const HOSTED: ReadonlySet<string> = new Set(['staging', 'production']);

function base64UrlDecode(segment: string): string {
  const padded = segment.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(segment.length / 4) * 4, '=');
  if (typeof atob === 'function') return atob(padded);
  return Buffer.from(padded, 'base64').toString('binary');
}

/** True for any key that grants privileges beyond the public anon/publishable role. */
export function isElevatedSupabaseKey(key: string): boolean {
  if (/^sb_secret_/i.test(key)) return true;
  const parts = key.split('.');
  if (parts.length !== 3) return false;
  try {
    const payload = JSON.parse(base64UrlDecode(parts[1])) as { role?: unknown };
    return payload.role !== 'anon';
  } catch {
    return true;
  }
}

/**
 * Validates public auth configuration. Returns null when sign-in is not configured
 * (guest preview only). Throws for unsafe configuration so it fails at startup.
 */
export function resolvePublicAuthConfig(env: PublicEnv): PublicAuthConfig | null {
  const environment = (env.appEnv || 'development') as AppEnvironment;
  if (!['development', 'test', 'staging', 'production'].includes(environment)) throw new Error('Invalid app environment.');
  const devToken = env.devAuthToken?.trim() || null;
  if (devToken && HOSTED.has(environment)) throw new Error('Development identity is not allowed in hosted builds.');
  const key = env.supabaseKey?.trim() ?? '';
  if (key && isElevatedSupabaseKey(key)) throw new Error('Mobile builds may only contain the public Supabase key.');
  if (!env.supabaseUrl || !key) {
    return devToken ? { environment, supabaseUrl: '', publishableKey: '', redirectUrl: '', developmentToken: devToken } : null;
  }
  const supabaseUrl = validateApiDestination(env.supabaseUrl, environment);
  const redirectUrl = env.redirectUrl?.trim() || 'aistudy://auth/callback';
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(redirectUrl)) throw new Error('Invalid sign-in redirect.');
  return { environment, supabaseUrl, publishableKey: key, redirectUrl, developmentToken: devToken };
}

/** Expo inlines EXPO_PUBLIC_* only for static property access, so read each name directly. */
export function readPublicEnv(): PublicEnv {
  return {
    appEnv: process.env.EXPO_PUBLIC_APP_ENV,
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    redirectUrl: process.env.EXPO_PUBLIC_AUTH_REDIRECT_URL,
    devAuthToken: process.env.EXPO_PUBLIC_DEV_AUTH_TOKEN,
  };
}
