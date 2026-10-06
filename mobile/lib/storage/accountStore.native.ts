import { openDatabaseAsync } from 'expo-sqlite';
import { createSqliteAccountStore, type SqlConnection } from './sqliteAccountStore';
export const accountStore = createSqliteAccountStore(async () =>
  await openDatabaseAsync('momo-study.db') as unknown as SqlConnection);
