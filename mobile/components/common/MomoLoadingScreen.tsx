import React, { useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  Easing,
  ActivityIndicator,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { AppText as Text } from '@/components/common/app-text';
import { colors, spacing, typography } from '@/constants/theme';

interface MomoLoadingScreenProps {
  title?: string;
  subtitle?: string;
  mascotSize?: number;
  showSpinner?: boolean;
  fullScreen?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function MomoLoadingScreen({
  title = 'momo',
  subtitle,
  mascotSize = 250,
  showSpinner = true,
  fullScreen = true,
  style,
}: MomoLoadingScreenProps) {
  // Pop-in bounce entry animation values
  const scaleAnim = useRef(new Animated.Value(0.15)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const translateYAnim = useRef(new Animated.Value(70)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  // Continuous idle floating/bobbing bounce
  const floatAnim = useRef(new Animated.Value(0)).current;
  const auraScaleAnim = useRef(new Animated.Value(0.85)).current;
  const auraOpacityAnim = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    // 1. Dynamic Bouncy Pop-in Entry with spring overshoot and settling tilt
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 75,
        friction: 4.5,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(translateYAnim, {
        toValue: 0,
        tension: 70,
        friction: 5,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(rotateAnim, {
          toValue: -1,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.spring(rotateAnim, {
          toValue: 0,
          tension: 85,
          friction: 4,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      // 2. Smooth continuous idle gentle float & rhythmic breathing bounce
      Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(floatAnim, {
              toValue: -12,
              duration: 1100,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
            Animated.timing(auraScaleAnim, {
              toValue: 1.15,
              duration: 1100,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
            Animated.timing(auraOpacityAnim, {
              toValue: 0.7,
              duration: 1100,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(floatAnim, {
              toValue: 0,
              duration: 1100,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
            Animated.timing(auraScaleAnim, {
              toValue: 0.85,
              duration: 1100,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
            Animated.timing(auraOpacityAnim, {
              toValue: 0.35,
              duration: 1100,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
          ]),
        ])
      ).start();
    });
  }, [scaleAnim, opacityAnim, translateYAnim, rotateAnim, floatAnim, auraScaleAnim, auraOpacityAnim]);

  const rotateInterpolate = rotateAnim.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-5deg', '0deg', '5deg'],
  });

  const containerStyle = [
    styles.container,
    fullScreen && styles.fullScreen,
    style,
  ];

  return (
    <View style={containerStyle}>
      {/* Animated Mascot Container with Bounce Entry + Idle Float */}
      <View style={[styles.mascotWrapper, { width: mascotSize + 50, height: mascotSize + 50 }]}>
        {/* Soft glowing aura behind Momo */}
        <Animated.View
          style={[
            styles.auraGlow,
            {
              width: mascotSize * 0.9,
              height: mascotSize * 0.9,
              borderRadius: (mascotSize * 0.9) / 2,
              opacity: auraOpacityAnim,
              transform: [{ scale: auraScaleAnim }],
            },
          ]}
        />

        {/* Shadow underneath Momo */}
        <Animated.View
          style={[
            styles.mascotShadow,
            {
              width: mascotSize * 0.55,
              bottom: 12,
              opacity: auraOpacityAnim,
              transform: [{ scaleX: auraScaleAnim }],
            },
          ]}
        />

        {/* Mascot Image */}
        <Animated.Image
          source={require('@/assets/animations/momo_loading.png')}
          style={[
            styles.mascotImage,
            {
              width: mascotSize,
              height: mascotSize,
              opacity: opacityAnim,
              transform: [
                { translateY: translateYAnim },
                { translateY: floatAnim },
                { scale: scaleAnim },
                { rotate: rotateInterpolate },
              ],
            },
          ]}
          resizeMode="contain"
        />
      </View>

      {/* Brand Text Container */}
      <Animated.View style={[styles.textContainer, { opacity: opacityAnim }]}>
        <Text style={styles.title}>{title}</Text>
        {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}

        {showSpinner && (
          <View style={styles.spinnerRow}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[24],
    backgroundColor: '#FFFFFF',
  },
  fullScreen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    width: '100%',
    height: '100%',
  },
  mascotWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: spacing[12],
  },
  auraGlow: {
    position: 'absolute',
    backgroundColor: colors.primarySoftStrong,
    zIndex: 0,
  },
  mascotShadow: {
    position: 'absolute',
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(15, 23, 42, 0.08)',
    zIndex: 1,
  },
  mascotImage: {
    zIndex: 2,
  },
  textContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: 320,
    marginTop: spacing[4],
  },
  title: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 26,
    color: '#0F172A',
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: spacing[2],
  },
  subtitle: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize[14],
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: typography.lineHeight[20],
    marginTop: spacing[4],
  },
  spinnerRow: {
    marginTop: spacing[16],
    alignItems: 'center',
    justifyContent: 'center',
  },
});
