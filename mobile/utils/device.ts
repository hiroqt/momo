import { Platform, Dimensions, useWindowDimensions } from 'react-native';

/**
 * Checks whether the current device/window is a tablet/iPad.
 * Handles:
 * - All iPads on iOS (Platform.isPad: iPad mini, 9.7", 10.2", 10.9", 11", 12.9", 13")
 * - Android tablets and foldables (min dimension >= 600dp)
 */
export const isIpad = (): boolean => {
  if (Platform.OS === 'ios' && Platform.isPad) return true;
  const { width, height } = Dimensions.get('window');
  const minDim = Math.min(width, height);
  return minDim >= 600;
};

/**
 * Hook version that reacts dynamically to window dimension updates (e.g. split-screen or orientation).
 */
export const useIsIpad = (): boolean => {
  const { width, height } = useWindowDimensions();
  if (Platform.OS === 'ios' && Platform.isPad) {
    // If in narrow Split View on iPad (width < 500), treat as phone layout
    return width >= 500;
  }
  const minDim = Math.min(width, height);
  return minDim >= 600 && width >= 500;
};

/**
 * Returns true if the current active window width qualifies for multi-column tablet layouts (>= 720pt).
 */
export const isTabletWidth = (windowWidth: number): boolean => {
  return windowWidth >= 720;
};

/**
 * Returns true if device is in a compact phone form factor (<= 380pt, e.g. iPhone SE, 360px Androids).
 */
export const isCompactWidth = (windowWidth: number): boolean => {
  return windowWidth <= 380;
};

/**
 * Returns true if an iPad is running in a narrow multitasking Split View / Slide Over mode.
 */
export const isSplitViewActive = (windowWidth: number): boolean => {
  return Platform.OS === 'ios' && Boolean(Platform.isPad) && windowWidth < 600;
};

/**
 * Returns `ipadVal` if on a tablet/iPad, otherwise returns `phoneVal`.
 */
export function ipadValue<T>(ipadVal: T, phoneVal: T): T {
  return isIpad() ? ipadVal : phoneVal;
}

/**
 * Hook version of `ipadValue`.
 */
export function useIpadValue<T>(ipadVal: T, phoneVal: T): T {
  const isPad = useIsIpad();
  return isPad ? ipadVal : phoneVal;
}

export const IPAD_FONT_SCALE = 1.24;
export const IPAD_SPACING_SCALE = 1.30;
