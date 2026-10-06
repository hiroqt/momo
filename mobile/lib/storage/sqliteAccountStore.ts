import type { AccountStore, RecordChange, RecordKind } from './accountStore.types';

export interface SqlConnection {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, ...params: string[]): Promise<unknown>;
  getAllAsync<T>(sql: string, ...params: string[]): Promise<T[]>;
  withExclusiveTransactionAsync(task: (tx: SqlConnection) => Promise<void>): Promise<void>;
}

/**
 * Ordered, forward-only schema migrations. Each step runs in its own exclusive
 * transaction together with its `user_version` bump, so a failed step leaves the
 * previous version intact. Never edit a released step; append a new one.
 */
export const SQLITE_MIGRATIONS: readonly string[] = [
  // v1: account-partitioned JSON records.
  `CREATE TABLE IF NOT EXISTS account_records (
    owner TEXT NOT NULL, kind TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL,
    PRIMARY KEY(owner, kind, id));`,
  // v2: bounded owner/kind scans for sessions, mutations and held sync events.
  `CREATE INDEX IF NOT EXISTS account_records_owner_kind ON account_records(owner, kind);`,
];
export const SQLITE_SCHEMA_VERSION = SQLITE_MIGRATIONS.length;

/** Kinds whose first stored payload is immutable (client event ids are idempotent). */
const INSERT_ONCE: ReadonlySet<RecordKind> = new Set<RecordKind>(['event']);

function storageError(error: unknown): Error {
  const message = error instanceof Error ? error.message : '';
  if (/SQLITE_FULL|disk is full|database or disk is full/i.test(message)) {
    return new Error('Your device is low on storage. Free some space to keep studying offline.');
  }
  return error instanceof Error ? error : new Error('Study storage failed.');
}

export function createSqliteAccountStore(open: () => Promise<SqlConnection>): AccountStore {
  let database: Promise<SqlConnection> | undefined;
  function ready() {
    database ??= (async () => {
      const db = await open();
      const version = (await db.getAllAsync<{ user_version: number }>('PRAGMA user_version'))[0]?.user_version ?? 0;
      if (version > SQLITE_SCHEMA_VERSION) throw new Error('Study database requires a newer app version.');
      for (let next = version; next < SQLITE_SCHEMA_VERSION; next++) {
        await db.withExclusiveTransactionAsync(async tx => {
          await tx.execAsync(`${SQLITE_MIGRATIONS[next]} PRAGMA user_version = ${next + 1};`);
        });
      }
      return db;
    })().catch(error => { database = undefined; throw error; });
    return database;
  }
  return {
    async list(owner: string, kind: RecordKind) {
      const db = await ready();
      const rows = await db.getAllAsync<{ id: string; data: string }>(
        'SELECT id,data FROM account_records WHERE owner=? AND kind=? ORDER BY rowid', owner, kind);
      return rows.map(row => {
        try { return { id: row.id, kind, data: JSON.parse(row.data) as unknown }; }
        catch { throw new Error('Stored study data is corrupt.'); }
      });
    },
    async write(owner: string, changes: RecordChange[]) {
      if (changes.length === 0) return;
      const db = await ready();
      try {
        await db.withExclusiveTransactionAsync(async tx => {
          for (const change of changes) {
            if (change.data === undefined) await tx.runAsync(
              'DELETE FROM account_records WHERE owner=? AND kind=? AND id=?', owner, change.kind, change.id);
            else await tx.runAsync(
              'INSERT INTO account_records(owner,kind,id,data) VALUES (?,?,?,?) ON CONFLICT(owner,kind,id) ' +
              (INSERT_ONCE.has(change.kind) ? 'DO NOTHING' : 'DO UPDATE SET data=excluded.data'),
              owner, change.kind, change.id, JSON.stringify(change.data));
          }
        });
      } catch (error) {
        throw storageError(error);
      }
    },
  };
}
