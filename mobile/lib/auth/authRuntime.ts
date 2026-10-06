import * as WebBrowser from 'expo-web-browser';
import * as Crypto from 'expo-crypto';
import {
  apiFetch, clearAuthenticatedSession, installSessionHooks, replaceAccessToken, setAuthenticatedSession, setAuthToken,
} from '../api/client';
import { classifyFailure } from '../api/errors';
import { localDb } from '../storage/localDb';
import { readPublicEnv, resolvePublicAuthConfig } from './authConfig';
import { AuthSessionManager } from './authSessionManager';
import { createPkcePair } from './pkce';
import { secureKeyValue } from './secureKeyValue';
import { createChunkedSessionStorage } from './sessionStorage';
import { SupabaseAuthClient } from './supabaseAuthClient';
import { SessionVerificationError } from './verifiedSession';

WebBrowser.maybeCompleteAuthSession();

const config = resolvePublicAuthConfig(readPublicEnv());
const client = config?.supabaseUrl
  ? new SupabaseAuthClient(config.supabaseUrl, config.publishableKey, (url, init) => fetch(url, init))
  : null;

/** App-wide auth session. Composition only; behavior lives in AuthSessionManager. */
export const authSession = new AuthSessionManager({
  config,
  client,
  storage: createChunkedSessionStorage(secureKeyValue),
  identity: {
    establish: setAuthenticatedSession,
    async reverify(token) {
      try {
        const profile = await apiFetch<{ id: string }>('/api/me', { headers: { Authorization: `Bearer ${token}` } }, 15000, { skipSessionHooks: true });
        return String(profile.id).toLowerCase();
      } catch (error) {
        throw new SessionVerificationError(classifyFailure(error) === 'transient');
      }
    },
    replaceToken: replaceAccessToken,
    bindOffline(token, accountId) { setAuthToken(token); localDb.bindVerifiedAccount(accountId); },
    clear: clearAuthenticatedSession,
  },
  openAuthSession: (url, redirectUrl) => WebBrowser.openAuthSessionAsync(url, redirectUrl),
  createPkce: () => createPkcePair({
    randomBytes: count => Crypto.getRandomBytes(count),
    sha256Base64: value => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, value, { encoding: Crypto.CryptoEncoding.BASE64 }),
  }),
});

installSessionHooks({
  refresh: () => authSession.ensureFresh(),
  unauthorized: () => authSession.handleUnauthorized(),
});
