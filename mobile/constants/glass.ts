import { Platform, ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors } from './theme';

export type GlassVariant = 'regular' | 'clear' | 'subtle' | 'prominent' | 'primary';

export interface GlassStyleConfig {
  glassEffectStyle: 'regular' | 'clear' | 'none';
  tintColor?: string;
  fallbackIntensity: number;
  fallbackTint: 'light' | 'dark' | 'default' | 'systemMaterial' | 'systemThinMaterial';
  borderColor: string;
  borderWidth: number;
  backgroundColor: string;
}

export const glassTokens: Record<GlassVariant, GlassStyleConfig> = {
  regular: {
    glassEffectStyle: 'regular',
    tintColor: 'rgba(255, 255, 255, 0.45)',
    fallbackIntensity: 75,
    fallbackTint: 'systemMaterial',
    borderColor: 'rgba(255, 255, 255, 0.35)',
    borderWidth: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
  },
  clear: {
    glassEffectStyle: 'clear',
    tintColor: 'rgba(255, 255, 255, 0.15)',
    fallbackIntensity: 45,
    fallbackTint: 'systemThinMaterial',
    borderColor: 'rgba(255, 255, 255, 0.25)',
    borderWidth: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  subtle: {
    glassEffectStyle: 'regular',
    tintColor: 'rgba(248, 250, 252, 0.35)',
    fallbackIntensity: 50,
    fallbackTint: 'systemThinMaterial',
    borderColor: 'rgba(226, 232, 240, 0.6)',
    borderWidth: 1,
    backgroundColor: 'rgba(248, 250, 252, 0.55)',
  },
  prominent: {
    glassEffectStyle: 'regular',
    tintColor: 'rgba(255, 255, 255, 0.75)',
    fallbackIntensity: 90,
    fallbackTint: 'systemMaterial',
    borderColor: 'rgba(255, 255, 255, 0.55)',
    borderWidth: 1.2,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
  },
  primary: {
    glassEffectStyle: 'regular',
    tintColor: 'rgba(79, 70, 229, 0.45)',
    fallbackIntensity: 80,
    fallbackTint: 'systemMaterial',
    borderColor: 'rgba(199, 210, 254, 0.6)',
    borderWidth: 1.2,
    backgroundColor: 'rgba(79, 70, 229, 0.88)',
  },
};

export const glassRadius = {
  sm: 12,
  md: 18,
  lg: 24,
  navBarPhone: 30,
  navBarTablet: 36,
  full: 999,
} as const;

export const continuousCurveStyle: ViewStyle = {
  borderCurve: 'continuous',
};

export type HapticFeedbackType = 'light' | 'medium' | 'heavy' | 'selection' | 'success' | 'warning' | 'error';

/**
 * Trigger appropriate tactile haptic feedback on supported devices.
 * Gracefully no-ops on platforms without vibration or when disabled.
 */
export async function triggerGlassHaptic(type: HapticFeedbackType = 'light'): Promise<void> {
  if (Platform.OS === 'web') return;

  try {
    switch (type) {
      case 'light':
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        break;
      case 'medium':
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        break;
      case 'heavy':
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        break;
      case 'selection':
        await Haptics.selectionAsync();
        break;
      case 'success':
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        break;
      case 'warning':
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        break;
      case 'error':
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        break;
    }
  } catch {
    // Graceful no-op if device does not support haptics
  }
}
