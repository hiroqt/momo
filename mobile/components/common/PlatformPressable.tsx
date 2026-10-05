import { useOnboardingReducedMotion } from '@/components/onboarding/useOnboardingReducedMotion';
import React, { useState } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { cubicBezier } from 'react-native-reanimated';

interface PlatformPressableProps extends PressableProps {
  style?: StyleProp<ViewStyle>;
  activeScale?: number;
  rippleColor?: string;
  children: React.ReactNode;
}

/** Identical 120ms press feedback on both platforms; Reduce Motion keeps a highlight. */
export function PlatformPressable({ style, activeScale = 0.97, rippleColor: _ripple,
  disabled, children, onPressIn, onPressOut, ...rest }: PlatformPressableProps) {
  const [pressed, setPressed] = useState(false);
  const reduced = useOnboardingReducedMotion();
  return (
    <Animated.View style={[style, {
      transform: [{ scale: pressed && !disabled && !reduced ? activeScale : 1 }],
      opacity: disabled ? 0.5 : pressed ? 0.88 : 1,
      transitionProperty: ['transform', 'opacity'],
      transitionDuration: '120ms',
      transitionTimingFunction: cubicBezier(0.23, 1, 0.32, 1),
    }]}>
      <Pressable {...rest} disabled={disabled} style={{ width: '100%' }}
        pressRetentionOffset={16}
        onPressIn={event => { setPressed(true); onPressIn?.(event); }}
        onPressOut={event => { setPressed(false); onPressOut?.(event); }}>
        {children}
      </Pressable>
    </Animated.View>
  );
}
