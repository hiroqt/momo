import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import type { PreviewStore, StoredPreview } from './previewStore.types';

let database: Promise<SQLiteDatabase> | undefined;
function getDatabase() {
  database ??= (async () => {
    const db = await openDatabaseAsync('momo-onboarding.db');
    await db.execAsync(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS preview_sets (id TEXT PRIMARY KEY NOT NULL, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS preview_items (
        id TEXT PRIMARY KEY NOT NULL,
        set_id TEXT NOT NULL REFERENCES preview_sets(id) ON DELETE CASCADE,
        position INTEGER NOT NULL,
        data TEXT NOT NULL
      );
    `);
    return db;
  })().catch((error: unknown) => {
    database = undefined;
    throw error;
  });
  return database;
}

export const previewStore: PreviewStore = {
  async list() {
    const db = await getDatabase();
    const rows = await db.getAllAsync<{ id: string; data: string }>('SELECT id, data FROM preview_sets');
    const result: StoredPreview[] = [];
    for (const row of rows) {
      try {
        const set: StoredPreview['set'] = JSON.parse(row.data);
        const itemRows = await db.getAllAsync<{ data: string }>(
          'SELECT data FROM preview_items WHERE set_id = ? ORDER BY position', row.id,
        );
        const items: StoredPreview['items'] = itemRows.map((item) => JSON.parse(item.data));
        if (set.id !== row.id || set.generation_config?.preview !== true ||
            typeof set.title !== 'string' || items.length !== set.item_count ||
            items.some((item) => item.study_set_id !== row.id || typeof item.id !== 'string' ||
              typeof item.question !== 'string' || typeof item.answer !== 'string')) {
          throw new Error('Invalid stored onboarding preview');
        }
        result.push({ set, items });
      } catch {
        // Corrupt local data must not appear as a valid study item.
        console.warn('Could not read a locally stored onboarding preview.');
      }
    }
    return result;
  },
  async save(set, items) {
    if (set.generation_config?.preview !== true) return;
    const db = await getDatabase();
    await db.withExclusiveTransactionAsync(async (transaction) => {
      await transaction.runAsync('INSERT OR REPLACE INTO preview_sets (id, data) VALUES (?, ?)', set.id, JSON.stringify(set));
      await transaction.runAsync('DELETE FROM preview_items WHERE set_id = ?', set.id);
      for (const [position, item] of items.entries()) {
        await transaction.runAsync(
          'INSERT INTO preview_items (id, set_id, position, data) VALUES (?, ?, ?, ?)',
          item.id, set.id, position, JSON.stringify(item),
        );
      }
    });
  },
  async remove(id) {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM preview_sets WHERE id = ?', id);
  },
};
