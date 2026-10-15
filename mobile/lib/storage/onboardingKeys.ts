/** Legacy global values have unknown ownership, so new guest and account data use isolated namespaces. */
export function onboardingStorageKey(key: string, accountId: string | null): string {
  return `@momo_${accountId ? `account:${accountId}` : 'guest'}:${key.slice('@momo_'.length)}`;
}

export function onboardingOwner(status: 'restoring' | 'signed_out' | 'signed_in', busy: boolean, accountId: string | null): string | null {
  if (status === 'restoring' || busy) return null;
  return status === 'signed_in' ? accountId : 'guest';
}
