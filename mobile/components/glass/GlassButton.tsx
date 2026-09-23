import React, { useRef } from 'react';
import {
  Pressable,
  PressableProps,
  StyleProp,
  ViewStyle,
  StyleSheet,
  Platform,
  Animated,
} from 'react-native';
import { GlassSurface } from './GlassSurface';
import {
  GlassVariant,
  HapticFeedbackType,
  triggerGlassHaptic,
  glassRadius,
} from '@/constants/glass';
import { colors } from '@/constants/theme';
import { useGlassCapability } from './useGlassCapability';

export type GlassButtonSize = 'sm' | 'md' | 'lg' | 'icon' | 'pill';

export interface GlassButtonProps extends Omit<PressableProps, 'style'> {
  variant?: GlassVariant;
  size?: GlassButtonSize;
  radius?: number;
  haptic?: HapticFeedbackType | false;
  activeScale?: number;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

export const GlassButton: React.FC<GlassButtonProps> = ({
  variant = 'regular',
  size = 'md',
  radius,
  haptic = 'light',
  activeScale = 0.94,
  disabled,
  onPress,
  onPressIn,
  onPressOut,
  style,
  contentStyle,
  children,
  accessibilityRole = 'button',
  ...rest
}) => {
  const { canUseLiquidGlass } = useGlassCapability();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const defaultRadius = (() => {
    if (radius !== undefined) return radius;
    switch (size) {
      case 'icon':
        return glassRadius.full;
      case 'pill':
        return glassRadius.full;
      case 'sm':
        return glassRadius.sm;
      case 'lg':
        return glassRadius.lg;
      case 'md':
      default:
        return glassRadius.md;
    }
  })();

  const sizeStyle = sizeStyles[size];

  const handlePressIn = (e: any) => {
    if (haptic && !disabled) {
      triggerGlassHaptic(haptic);
    }
    if (!canUseLiquidGlass) {
      Animated.spring(scaleAnim, {
        toValue: activeScale,
        useNativeDriver: true,
        speed: 40,
        bounciness: 4,
      }).start();
    }
    onPressIn?.(e);
  };

  const handlePressOut = (e: any) => {
    if (!canUseLiquidGlass) {
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        speed: 30,
        bounciness: 6,
      }).start();
    }
    onPressOut?.(e);
  };

  return (
    <Animated.View
      style={[
        { borderRadius: defaultRadius },
        !canUseLiquidGlass && { transform: [{ scale: scaleAnim }] },
        disabled && styles.disabled,
        style,
      ]}
    >
      <GlassSurface
        variant={variant}
        radius={defaultRadius}
        isInteractive={!disabled}
        style={styles.surfaceWrapper}
      >
        <Pressable
          disabled={disabled}
          accessibilityRole={accessibilityRole}
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          android_ripple={
            Platform.OS === 'android' && !disabled
              ? {
                  color: variant === 'primary' ? 'rgba(255,255,255,0.2)' : colors.primaryRipple,
                  borderless: false,
                  foreground: true,
                }
              : undefined
          }
          style={({ pressed }) => [
            styles.pressableArea,
            sizeStyle,
            { borderRadius: defaultRadius },
            // Subtle fallback press feedback when native liquid glass is not present
            !canUseLiquidGlass && pressed && styles.fallbackPressed,
            contentStyle,
          ]}
          {...rest}
        >
          {children}
        </Pressable>
      </GlassSurface>
    </Animated.View>
  );
};

const sizeStyles = StyleSheet.create({
  sm: {
    height: 34,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  md: {
    height: 44,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lg: {
    height: 52,
    paddingHorizontal: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    height: 38,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const styles = StyleSheet.create({
  surfaceWrapper: {
    alignSelf: 'flex-start',
  },
  pressableArea: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.5,
  },
  fallbackPressed: {
    opacity: 0.88,
  },
});
