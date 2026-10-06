import React, { createContext, useContext, useEffect, useState } from 'react';
import { MAX_HEARTS } from '../lib/study/heartCapacity';
import { newOperationKey, walletService } from '../lib/study/studyRuntime';
import type { WalletState } from '../lib/study/wallet';

interface CreditsContextType {
  credits: number;
  xp: number;
  hearts: number;
  /** False while the active account's wallet is loading. */
  ready: boolean;
  addCredits: (amount: number) => void;
  deductCredits: (amount: number) => boolean;
  addXP: (amount: number) => void;
  convertXPToCredits: (xpAmount: number, creditAmount: number) => boolean;
  convertXPToHearts: (xpAmount: number, heartAmount: number) => boolean;
  deductHeart: () => boolean;
  addHeart: (amount: number) => void;
}

const CreditsContext = createContext<CreditsContextType | null>(null);

function positive(value: number): boolean { return Number.isSafeInteger(value) && value > 0; }
function run(op: Parameters<typeof walletService.apply>[0]): boolean {
  const result = walletService.apply(op);
  result.persisted.catch(() => {});
  return result.outcome === 'applied';
}

/**
 * Thin view over the account-partitioned wallet service. Balances are a device preview
 * until the server economy ledger is authoritative; rules live in lib/study/wallet.ts.
 */
export const CreditsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [wallet, setWallet] = useState<WalletState | null>(() => walletService.getState());

  useEffect(() => {
    const unsubscribe = walletService.subscribe(setWallet);
    if (!walletService.getState()) void walletService.load().catch(() => {});
    return unsubscribe;
  }, []);

  const value: CreditsContextType = {
    credits: wallet?.credits ?? 0,
    xp: wallet?.xp ?? 0,
    hearts: wallet?.hearts ?? MAX_HEARTS,
    ready: !!wallet,
    addCredits: amount => { if (positive(amount)) run({ key: newOperationKey(), credits: amount }); },
    deductCredits: amount => positive(amount) && run({ key: newOperationKey(), credits: -amount }),
    addXP: amount => { if (positive(amount)) run({ key: newOperationKey(), xp: amount }); },
    convertXPToCredits: (xpAmount, creditAmount) =>
      positive(xpAmount) && positive(creditAmount) && run({ key: newOperationKey(), xp: -xpAmount, credits: creditAmount }),
    convertXPToHearts: (xpAmount, heartAmount) =>
      positive(xpAmount) && positive(heartAmount) && run({ key: newOperationKey(), xp: -xpAmount, hearts: heartAmount }),
    deductHeart: () => run({ key: newOperationKey(), hearts: -1 }),
    addHeart: amount => { if (positive(amount)) run({ key: newOperationKey(), hearts: amount }); },
  };

  return <CreditsContext.Provider value={value}>{children}</CreditsContext.Provider>;
};

export const useCredits = () => {
  const context = useContext(CreditsContext);
  if (!context) {
    throw new Error('useCredits must be used within a CreditsProvider');
  }
  return context;
};
