import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalDatabase } from '../../lib/storage/localDb';
import { createSqliteAccountStore, type SqlConnection } from '../../lib/storage/sqliteAccountStore';

export const noPreviews = { list: async () => [], save: async () => {}, remove: async () => {} };

export function connection(db: DatabaseSync): SqlConnection {
  return {
    async execAsync(sql) { db.exec(sql); },
    async runAsync(sql, ...args) { return db.prepare(sql).run(...args); },
    async getAllAsync<T>(sql: string, ...args: string[]) { return db.prepare(sql).all(...args) as T[]; },
    async withExclusiveTransactionAsync(task) {
      db.exec('BEGIN IMMEDIATE');
      try { await task(connection(db)); db.exec('COMMIT'); }
      catch (error) { db.exec('ROLLBACK'); throw error; }
    },
  };
}

/** File-backed SQLite that can be closed and reopened to simulate process death. */
export function sqliteFixture() {
  const directory = mkdtempSync(join(tmpdir(), 'momo-local-'));
  const path = join(directory, 'study.sqlite');
  const handles: DatabaseSync[] = [];
  return {
    restart(): { db: LocalDatabase; sqlite: DatabaseSync } {
      while (handles.length) handles.pop()!.close();
      const sqlite = new DatabaseSync(path); handles.push(sqlite);
      return { db: new LocalDatabase(noPreviews, createSqliteAccountStore(async () => connection(sqlite))), sqlite };
    },
    close() { handles.forEach(db => db.close()); rmSync(directory, { recursive: true, force: true }); },
  };
}

/** In-memory AsyncStorage stand-in. */
export function memoryKv(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    async getItem(key: string) { return data.get(key) ?? null; },
    async setItem(key: string, value: string) { data.set(key, value); },
    async multiGet(keys: readonly string[]) { return keys.map(key => [key, data.get(key) ?? null] as const); },
  };
}
