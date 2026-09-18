import React, { useRef } from 'react';
import { colors } from '@/constants/theme';
import {
  Pressable,
  PressableProps,
  Animated,
  Platform,
  StyleProp,
  ViewStyle,
  StyleSheet,
} from 'react-native';

interface PlatformPressableProps extends PressableProps {
  style?: StyleProp<ViewStyle>;
  activeScale?: number;
  rippleColor?: string;
  children: React.ReactNode;
}

export const PlatformPressable: React.FC<PlatformPressableProps> = ({
  style,
  activeScale = 0.97,
  rippleColor = colors.primaryRipple,
  disabled,
  children,
  onPressIn,
  onPressOut,
  ...rest
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = (e: any) => {
    if (Platform.OS === 'ios') {
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
    if (Platform.OS === 'ios') {
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
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, style]}>
      <Pressable
        disabled={disabled}
        android_ripple={
          Platform.OS === 'android' && !disabled
            ? {
                color: rippleColor,
                borderless: false,
              }
            : undefined
        }
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={({ pressed }) => [
          styles.fill,
          Platform.OS === 'ios' && pressed && !disabled && styles.iosPressed,
        ]}
        {...rest}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  fill: {
    width: '100%',
  },
  iosPressed: {
    opacity: 0.92,
  },
});
