/** Legacy global values have unknown ownership, so new guest and account data use isolated namespaces. */
export function onboardingStorageKey(key: string, accountId: string | null): string {
  return `@momo_${accountId ? `account:${accountId}` : 'guest'}:${key.slice('@momo_'.length)}`;
}
