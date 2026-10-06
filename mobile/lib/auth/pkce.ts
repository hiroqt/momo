export interface PkcePair { verifier: string; challenge: string }
export interface PkceCrypto {
  randomBytes(count: number): Uint8Array;
  /** Standard base64 SHA-256 digest of a UTF-8 string. */
  sha256Base64(value: string): Promise<string>;
}

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function bytesToBase64Url(bytes: Uint8Array): string {
  let output = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const a = bytes[index], b = bytes[index + 1] ?? 0, c = bytes[index + 2] ?? 0;
    const triple = (a << 16) | (b << 8) | c;
    output += BASE64[(triple >> 18) & 63] + BASE64[(triple >> 12) & 63];
    if (index + 1 < bytes.length) output += BASE64[(triple >> 6) & 63];
    if (index + 2 < bytes.length) output += BASE64[triple & 63];
  }
  return output.replace(/\+/g, '-').replace(/\//g, '_');
}

export function base64ToBase64Url(value: string): string {
  return value.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** RFC 7636 S256 pair: 32 random bytes give a 43-character verifier. */
export async function createPkcePair(crypto: PkceCrypto): Promise<PkcePair> {
  const verifier = bytesToBase64Url(crypto.randomBytes(32));
  if (!/^[A-Za-z0-9\-._~]{43,128}$/.test(verifier)) throw new Error('Could not prepare a secure sign-in.');
  return { verifier, challenge: base64ToBase64Url(await crypto.sha256Base64(verifier)) };
}
