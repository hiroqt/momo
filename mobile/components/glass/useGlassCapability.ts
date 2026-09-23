import { useSyncExternalStore } from 'react';
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
let reduceTransparency = false;
let transparencyLoaded = false;
const subscribers = new Set<() => void>();
let systemSubscription: { remove: () => void } | null = null;

function notifySubscribers() {
  subscribers.forEach((subscriber) => subscriber());
}

function subscribeToTransparency(subscriber: () => void) {
  subscribers.add(subscriber);
  if (subscribers.size === 1 && Platform.OS !== 'web') {
    if (!transparencyLoaded) {
      AccessibilityInfo.isReduceTransparencyEnabled()
        .then((enabled) => {
          transparencyLoaded = true;
          if (reduceTransparency !== enabled) {
            reduceTransparency = enabled;
            notifySubscribers();
          }
        })
        .catch(() => {});
    }
    systemSubscription = AccessibilityInfo.addEventListener('reduceTransparencyChanged', (enabled) => {
      transparencyLoaded = true;
      if (reduceTransparency !== enabled) {
        reduceTransparency = enabled;
        notifySubscribers();
      }
    });
  }
  return () => {
    subscribers.delete(subscriber);
    if (subscribers.size === 0) {
      systemSubscription?.remove();
      systemSubscription = null;
    }
  };
}

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
  const isReduceTransparencyEnabled = useSyncExternalStore(
    subscribeToTransparency,
    () => reduceTransparency,
    () => false,
  );

  const canUseLiquidGlass = isNativeGlassAvailable && !isReduceTransparencyEnabled;
  const canUseBlurFallback = !canUseLiquidGlass && !isReduceTransparencyEnabled && Platform.OS !== 'web';

  return {
    isNativeGlassAvailable,
    isReduceTransparencyEnabled,
    canUseLiquidGlass,
    canUseBlurFallback,
  };
}
