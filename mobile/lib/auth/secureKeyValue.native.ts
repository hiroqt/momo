import * as SecureStore from 'expo-secure-store';
import type { SecureKeyValue } from './sessionStorage';

// This-device-only: tokens are excluded from backups and device migration.
const options: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };

export const secureKeyValue: SecureKeyValue = {
  get: key => SecureStore.getItemAsync(key, options),
  set: (key, value) => SecureStore.setItemAsync(key, value, options),
  remove: key => SecureStore.deleteItemAsync(key, options),
};
