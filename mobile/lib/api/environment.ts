export type AppEnvironment = 'development' | 'test' | 'staging' | 'production';

export function validateApiDestination(value: string, environment: string = 'development'): string {
  if (!['development', 'test', 'staging', 'production'].includes(environment)) {
    throw new Error('Invalid app environment.');
  }
  const url = new URL(value);
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('API configuration requires an origin.');
  }
  if (environment === 'development' || environment === 'test') {
    const hostname = url.hostname;
    const parts = hostname.split('.').map(Number);
    const ipv4 = parts.length === 4 && parts.every(part => Number.isInteger(part) && part >= 0 && part <= 255);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(hostname) ||
      (ipv4 && (parts[0] === 10 || (parts[0] === 192 && parts[1] === 168) ||
        (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)));
    if (!local || !['http:', 'https:'].includes(url.protocol)) {
      throw new Error('Local apps require a loopback or private-network API. Hosted tests are disabled.');
    }
  } else if (url.protocol !== 'https:') {
    throw new Error('Hosted apps require an explicitly configured HTTPS API.');
  }
  return url.origin;
}
