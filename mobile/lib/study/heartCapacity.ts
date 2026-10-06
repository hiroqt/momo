export const MAX_HEARTS = 5;

export function normalizeHearts(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(MAX_HEARTS, Math.floor(number))) : MAX_HEARTS;
}

/**
 * Hearts a pack grants at the current balance; 0 means it cannot be bought now.
 * A refill pack tops up whatever is missing; a fixed pack must fit under the cap.
 */
export function heartPackGrant(hearts: number, pack: { amount: number; refill?: boolean }): number {
  if (!Number.isSafeInteger(hearts) || hearts < 0 || hearts >= MAX_HEARTS) return 0;
  if (pack.refill) return MAX_HEARTS - hearts;
  return canRefillHearts(hearts, pack.amount) ? pack.amount : 0;
}
export function canRefillHearts(hearts: number, amount: number): boolean {
  return Number.isSafeInteger(hearts) && hearts >= 0 && hearts <= MAX_HEARTS &&
    Number.isSafeInteger(amount) && amount > 0 && hearts + amount <= MAX_HEARTS;
}
