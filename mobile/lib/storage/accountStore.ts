import type { AccountStore } from './accountStore.types';
// Ordinary authenticated caching requires native SQLite. Fail closed on
// unsupported browser runtimes; previews have their independent store.
export const accountStore: AccountStore = {
  async list() { throw new Error('Persistent study storage requires a native build.'); },
  async write() { throw new Error('Persistent study storage requires a native build.'); },
};
