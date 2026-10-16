export type EntryAuthStatus = 'restoring' | 'signed_out' | 'signed_in';

export interface EntryState {
  authStatus: EntryAuthStatus;
  onboardingLoaded: boolean;
  hasCompletedWelcome: boolean;
  hasSeenMomoIntro: boolean;
  isGuestMode: boolean;
  guestPreviewSelected: boolean;
  currentRoute: string;
}

/** Returns the next first-run/session route, or null when the current route is valid. */
export function resolveEntryRedirect(state: EntryState): string | null {
  if (state.authStatus === 'restoring' || !state.onboardingLoaded) return null;

  const guestHasAccess = state.guestPreviewSelected || (state.hasCompletedWelcome && state.isGuestMode);
  if (state.authStatus !== 'signed_in' && !guestHasAccess) {
    return state.currentRoute === '(auth)/sign-in' ? null : '/(auth)/sign-in';
  }
  if (!state.hasCompletedWelcome && state.currentRoute !== '(auth)/welcome') return '/(auth)/welcome';
  if (state.hasCompletedWelcome && !state.hasSeenMomoIntro && state.currentRoute !== '(auth)/momo-intro') return '/(auth)/momo-intro';
  if (state.hasCompletedWelcome && state.hasSeenMomoIntro && state.currentRoute.startsWith('(auth)')) return '/(tabs)';
  return null;
}
