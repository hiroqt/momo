import { useState, useEffect } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';
import {
  isLiquidGlassAvailable,
  isGlassEffectAPIAvailable,
} from 'expo-glass-effect';

export interface GlassCapability {
  /**
   * Whether the native Liquid Glass API is available on this iOS version (iOS 26+).
   */
  isNativeGlassAvailable: boolean;
  /**
   * Whether the user has enabled "Reduce Transparency" in system accessibility settings.
   */
  isReduceTransparencyEnabled: boolean;
  /**
   * Whether Liquid Glass should be rendered. True only on iOS when native API is available
   * and Reduce Transparency is disabled.
   */
  canUseLiquidGlass: boolean;
  /**
   * Whether blur fallback (expo-blur) should be used (e.g. Android or pre-iOS 26)
   * when Reduce Transparency is disabled.
   */
  canUseBlurFallback: boolean;
}

let cachedNativeAvailable: boolean | null = null;

function checkNativeGlassAvailable(): boolean {
  if (cachedNativeAvailable !== null) {
    return cachedNativeAvailable;
  }
  if (Platform.OS !== 'ios') {
    cachedNativeAvailable = false;
    return false;
  }
  try {
    const hasOS = typeof isLiquidGlassAvailable === 'function' ? isLiquidGlassAvailable() : false;
    const hasAPI = typeof isGlassEffectAPIAvailable === 'function' ? isGlassEffectAPIAvailable() : false;
    cachedNativeAvailable = hasOS && hasAPI;
    return cachedNativeAvailable;
  } catch {
    cachedNativeAvailable = false;
    return false;
  }
}

export function useGlassCapability(): GlassCapability {
  const isNativeGlassAvailable = checkNativeGlassAvailable();
  const [isReduceTransparencyEnabled, setIsReduceTransparencyEnabled] = useState(false);

  useEffect(() => {
    let isMounted = true;

    // Check initial state
    AccessibilityInfo.isReduceTransparencyEnabled()
      .then((enabled) => {
        if (isMounted) {
          setIsReduceTransparencyEnabled(enabled);
        }
      })
      .catch(() => {});

    // Listen for live system changes
    const subscription = AccessibilityInfo.addEventListener(
      'reduceTransparencyChanged',
      (enabled) => {
        if (isMounted) {
          setIsReduceTransparencyEnabled(enabled);
        }
      }
    );

    return () => {
      isMounted = false;
      subscription?.remove();
    };
  }, []);

  const canUseLiquidGlass = isNativeGlassAvailable && !isReduceTransparencyEnabled;
  const canUseBlurFallback = !canUseLiquidGlass && !isReduceTransparencyEnabled && Platform.OS !== 'web';

  return {
    isNativeGlassAvailable,
    isReduceTransparencyEnabled,
    canUseLiquidGlass,
    canUseBlurFallback,
  };
}
