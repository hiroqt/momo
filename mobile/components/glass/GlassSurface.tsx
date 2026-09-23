import React from 'react';
import {
  View,
  ViewProps,
  StyleSheet,
  Platform,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { GlassView, GlassStyle, GlassColorScheme } from 'expo-glass-effect';
import { BlurView } from 'expo-blur';
import { useGlassCapability } from './useGlassCapability';
import {
  GlassVariant,
  glassTokens,
  continuousCurveStyle,
  glassRadius,
} from '@/constants/glass';
import { colors } from '@/constants/theme';

export interface GlassSurfaceProps extends ViewProps {
  /**
   * The visual variant for the glass surface.
   * @default 'regular'
   */
  variant?: GlassVariant;
  /**
   * Override the glass effect style ('regular' | 'clear' | 'none').
   */
  glassEffectStyle?: GlassStyle;
  /**
   * Override tint color for the glass surface.
   */
  tintColor?: string;
  /**
   * Override appearance scheme ('auto' | 'light' | 'dark').
   */
  colorScheme?: GlassColorScheme;
  /**
   * Whether the glass effect should be interactive.
   * @default false
   */
  isInteractive?: boolean;
  /**
   * Corner radius preset or explicit number.
   * @default glassRadius.md
   */
  radius?: number;
  /**
   * Whether to show a fine specular rim border.
   * @default true
   */
  hasBorder?: boolean;
  /**
   * Content inside the glass surface.
   */
  children?: React.ReactNode;
}

export const GlassSurface: React.FC<GlassSurfaceProps> = ({
  variant = 'regular',
  glassEffectStyle,
  tintColor,
  colorScheme = 'auto',
  isInteractive = false,
  radius = glassRadius.md,
  hasBorder = true,
  children,
  style,
  ...rest
}) => {
  const { canUseLiquidGlass, isReduceTransparencyEnabled } = useGlassCapability();
  const token = glassTokens[variant];

  const resolvedGlassStyle = glassEffectStyle ?? token.glassEffectStyle;
  const resolvedTintColor = tintColor ?? token.tintColor;

  const baseSurfaceStyle: StyleProp<ViewStyle> = [
    continuousCurveStyle,
    {
      borderRadius: radius,
    },
    hasBorder && {
      borderWidth: token.borderWidth,
      borderColor: token.borderColor,
    },
    style,
  ];

  // 1. Accessibility: User has enabled "Reduce Transparency" in system settings
  if (isReduceTransparencyEnabled) {
    return (
      <View
        style={[
          styles.solidFallback,
          baseSurfaceStyle,
          {
            backgroundColor: variant === 'primary' ? colors.primary : colors.surface,
            borderColor: variant === 'primary' ? colors.primaryDark : colors.border,
          },
        ]}
        {...rest}
      >
        {children}
      </View>
    );
  }

  // 2. iOS 26+ Native Liquid Glass
  if (canUseLiquidGlass && Platform.OS === 'ios') {
    return (
      <GlassView
        glassEffectStyle={resolvedGlassStyle}
        tintColor={resolvedTintColor}
        colorScheme={colorScheme}
        isInteractive={isInteractive}
        style={[styles.glassRoot, baseSurfaceStyle]}
        {...rest}
      >
        {children}
      </GlassView>
    );
  }

  // 3. Android High-Performance Specular Surface (Eliminates BlurView frame drops and GPU thrashing)
  if (Platform.OS === 'android') {
    return (
      <View
        style={[
          styles.solidFallback,
          baseSurfaceStyle,
          {
            backgroundColor: variant === 'primary' ? colors.primary : '#FFFFFF',
            borderColor: variant === 'primary' ? colors.primaryDark : token.borderColor,
            overflow: 'hidden',
          },
        ]}
        {...rest}
      >
        {children}
      </View>
    );
  }

  // 4. Fallback: Pre-iOS 26 Apple devices using expo-blur
  return (
    <View
      style={[
        styles.blurContainer,
        baseSurfaceStyle,
      ]}
      {...rest}
    >
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius: radius,
            overflow: 'hidden',
            backgroundColor: token.backgroundColor,
          },
        ]}
      >
        <BlurView
          tint={token.fallbackTint}
          intensity={token.fallbackIntensity}
          style={StyleSheet.absoluteFill}
        />
      </View>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  glassRoot: {
    // Note: Do NOT set overflow: 'hidden' on native GlassView;
    // it clips the native Apple rim highlight and press bulge
  },
  blurContainer: {
    position: 'relative',
  },
  solidFallback: {
    borderWidth: 1,
  },
});
