import type { UserProfile } from '../../types';

export interface AccountProfileSnapshot {
  accountId: string;
  profile: UserProfile;
}

export function getVisibleProfile(
  snapshot: AccountProfileSnapshot | null,
  accountId: string | null,
  identityStable: boolean,
): UserProfile | null {
  return identityStable && accountId && snapshot?.accountId === accountId &&
    snapshot.profile.id.toLowerCase() === accountId.toLowerCase()
    ? snapshot.profile
    : null;
}

export function getProfileDisplayName(
  profile: UserProfile | null,
  isGuest: boolean,
  firstName: string,
  lastName: string,
): string {
  if (isGuest) {
    return [firstName, lastName].filter(Boolean).join(' ') || 'Your study space';
  }
  return profile?.full_name || 'Your study space';
}
