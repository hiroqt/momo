import { Platform, Dimensions, useWindowDimensions } from 'react-native';

/**
 * Checks whether the current device is an iPad (specifically 11-inch to 13-inch).
 * Target devices: iPad Pro 11", iPad Air 11", iPad 10th/11th Gen (A16/M1/M2/M4),
 * and iPad Pro 12.9" / 13" (M1/M2/M4).
 * Point dimensions: 820x1180, 834x1194, up to 1024x1366.
 *
 * Excludes:
 * - All iPhones (Platform.isPad is false, minDim < 500)
 * - All Android devices (Platform.OS !== 'ios')
 */
export const isIpad = (): boolean => {
  if (Platform.OS !== 'ios') return false;
  if (!Platform.isPad) return false;
  const { width, height } = Dimensions.get('window');
  const minDim = Math.min(width, height);
  const maxDim = Math.max(width, height);
  return minDim >= 768 && maxDim >= 1100;
};

/**
 * Hook version that reacts dynamically to window dimension updates (e.g. split-screen or orientation).
 */
export const useIsIpad = (): boolean => {
  const { width, height } = useWindowDimensions();
  if (Platform.OS !== 'ios') return false;
  if (!Platform.isPad) return false;
  const minDim = Math.min(width, height);
  const maxDim = Math.max(width, height);
  return minDim >= 768 && maxDim >= 1100;
};

/**
 * Returns `ipadVal` if on an 11"-13" iPad on iOS, otherwise returns `phoneVal`.
 */
export const ipadValue = <T>(ipadVal: T, phoneVal: T): T => {
  return isIpad() ? ipadVal : phoneVal;
};

/**
 * Hook version of `ipadValue`.
 */
export const useIpadValue = <T>(ipadVal: T, phoneVal: T): T => {
  const isPad = useIsIpad();
  return isPad ? ipadVal : phoneVal;
};

export const IPAD_FONT_SCALE = 1.24;
export const IPAD_SPACING_SCALE = 1.30;
