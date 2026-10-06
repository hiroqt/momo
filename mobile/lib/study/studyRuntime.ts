import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { localDb } from '../storage/localDb';
import { AppState } from 'react-native';
import { syncEngine } from '../sync/syncEngine';
import { mutationQueue } from '../sync/mutationQueue';
import { StudySessionService } from './studySessionService';
import { WalletService } from './walletService';

/** App-wide composition of the wallet and durable study sessions. */
export const walletService = new WalletService(localDb, AsyncStorage);
export const studySessions = new StudySessionService({
  db: localDb,
  wallet: walletService,
  uuid: () => Crypto.randomUUID(),
  onEventQueued: () => { void syncEngine.flushSyncQueue().catch(() => {}); },
});
export const newOperationKey = (): string => `ui:${Crypto.randomUUID()}`;

// Reconnect points: sign-in/account switch and returning to the foreground.
function flushAll(force: boolean) {
  if (!localDb.getActiveAccountId()) return;
  void syncEngine.flushSyncQueue({ force }).catch(() => {});
  void mutationQueue.processQueue({ force }).catch(() => {});
}
localDb.onAccountChange(owner => { if (owner) flushAll(true); });
AppState.addEventListener('change', state => { if (state === 'active') flushAll(false); });
