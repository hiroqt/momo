import type { SecureKeyValue } from './sessionStorage';

// Non-native runtimes have no secure enclave. Keep tokens in memory only; never
// write them to localStorage. Users sign in again after a reload.
const memory = new Map<string, string>();
export const secureKeyValue: SecureKeyValue = {
  async get(key) { return memory.get(key) ?? null; },
  async set(key, value) { memory.set(key, value); },
  async remove(key) { memory.delete(key); },
};
