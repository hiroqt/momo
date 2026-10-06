import type { AuthSession } from './supabaseAuthClient';

/** Device-secure key/value storage (Keychain/Keystore on native). */
export interface SecureKeyValue {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export interface StoredAuthSession extends AuthSession {
  /** Account id previously returned by the backend for this session, used for offline cold start. */
  verified_account_id: string;
}

export interface SessionStorage {
  load(): Promise<StoredAuthSession | null>;
  save(session: StoredAuthSession): Promise<void>;
  clear(): Promise<void>;
}

const PREFIX = 'momo.auth.session';
// SecureStore warns above ~2 KB per value; Supabase sessions can exceed that.
const CHUNK = 1800;
const MAX_CHUNKS = 16;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validStored(value: unknown): value is StoredAuthSession {
  const v = value as Record<string, unknown> | null;
  return !!v && typeof v.access_token === 'string' && !!v.access_token && typeof v.refresh_token === 'string' && !!v.refresh_token &&
    Number.isFinite(v.expires_at) && typeof v.user_id === 'string' && UUID.test(v.user_id) &&
    typeof v.verified_account_id === 'string' && UUID.test(v.verified_account_id);
}

/** Splits the session across numbered secure entries; corrupt data is cleared, never trusted. */
export function createChunkedSessionStorage(kv: SecureKeyValue): SessionStorage {
  async function removeAll() {
    const count = Number(await kv.get(`${PREFIX}.count`).catch(() => null));
    const total = Number.isInteger(count) && count > 0 && count <= MAX_CHUNKS ? count : MAX_CHUNKS;
    await kv.remove(`${PREFIX}.count`);
    for (let index = 0; index < total; index++) await kv.remove(`${PREFIX}.${index}`);
  }
  return {
    async load() {
      const count = Number(await kv.get(`${PREFIX}.count`));
      if (!Number.isInteger(count) || count <= 0) return null;
      if (count > MAX_CHUNKS) { await removeAll(); return null; }
      let serialized = '';
      for (let index = 0; index < count; index++) {
        const chunk = await kv.get(`${PREFIX}.${index}`);
        if (chunk === null) { await removeAll(); return null; }
        serialized += chunk;
      }
      try {
        const parsed: unknown = JSON.parse(serialized);
        if (validStored(parsed)) return parsed;
      } catch { /* fall through */ }
      await removeAll();
      return null;
    },
    async save(session) {
      if (!validStored(session)) throw new Error('Invalid session.');
      const serialized = JSON.stringify(session);
      const chunks = Math.ceil(serialized.length / CHUNK);
      if (chunks > MAX_CHUNKS) throw new Error('Session is too large to store securely.');
      // Invalidate first so a crash mid-write cannot combine old and new chunks.
      await kv.remove(`${PREFIX}.count`);
      for (let index = 0; index < chunks; index++) await kv.set(`${PREFIX}.${index}`, serialized.slice(index * CHUNK, (index + 1) * CHUNK));
      await kv.set(`${PREFIX}.count`, String(chunks));
    },
    clear: removeAll,
  };
}
