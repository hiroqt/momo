import { apiFetch } from './client';

export interface EconomyWalletResponse { credits: number }

export function getEconomyWallet(): Promise<EconomyWalletResponse> {
  return apiFetch<EconomyWalletResponse>('/api/economy/wallet');
}
