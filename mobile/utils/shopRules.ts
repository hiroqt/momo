/** Formatting for a compact wallet; raw balances are preserved in accessible labels. */
export function formatBalance(value: number): string {
  const balance = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  if (balance >= 1_000_000) return `${(balance / 1_000_000).toFixed(1).replace(/\.0$/, '')}m`;
  if (balance >= 10_000) return `${(balance / 1_000).toFixed(1).replace(/\.0$/, '')}k`;
  return balance.toLocaleString('en-US');
}

export function tradeEligibility(xp: number, cost: number): { eligible: boolean; missingXp: number } {
  if (!Number.isFinite(xp) || !Number.isFinite(cost) || xp < 0 || cost <= 0 || !Number.isInteger(cost)) {
    return { eligible: false, missingXp: Math.max(0, Number.isFinite(cost) ? cost : 0) };
  }
  return { eligible: xp >= cost, missingXp: Math.max(0, cost - xp) };
}
