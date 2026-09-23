import React, { useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  Easing,
  ActivityIndicator,
  ViewStyle,
  StyleProp,
  ImageBackground,
  Dimensions,
} from 'react-native';
import { AppText as Text } from '@/components/common/app-text';
import { colors, spacing, typography } from '@/constants/theme';
import { Jungle3DLeaves } from '@/components/common/Jungle3DLeaves';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const MASCOT_SOURCES = {
  loading: require('@/assets/animations/momo_loading.png'),
  icon: require('@/assets/momo_logo.png'),
};

interface MomoLoadingScreenProps {
  title?: string;
  subtitle?: string;
  mascotSize?: number;
  mascotType?: 'loading' | 'icon';
  showSpinner?: boolean;
  fullScreen?: boolean;
  style?: StyleProp<ViewStyle>;
  variant?: 'jungle' | 'clean';
}

function FloatingLightParticle({ x, y, size, delay }: { x: number; y: number; size: number; delay: number }) {
  const floatAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0.2)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(floatAnim, {
            toValue: -25,
            duration: 2600 + delay * 4,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 0.85,
            duration: 1300 + delay * 2,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(floatAnim, {
            toValue: 0,
            duration: 2600 + delay * 4,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 0.2,
            duration: 1300 + delay * 2,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      ])
    ).start();
  }, [floatAnim, opacityAnim, delay]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.firefly,
        {
          left: x,
          top: y,
          width: size,
          height: size,
          borderRadius: size / 2,
          opacity: opacityAnim,
          transform: [{ translateY: floatAnim }],
        },
      ]}
    />
  );
}

export function MomoLoadingScreen({
  title = 'momo',
  subtitle,
  mascotSize = 250,
  mascotType = 'loading',
  showSpinner = true,
  fullScreen = true,
  style,
  variant = 'jungle',
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

  const isJungle = variant === 'jungle';

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
        duration: 350,
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
          duration: 120,
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

  const content = (
    <View style={styles.centerStage}>
      {/* Animated Mascot Container with Bounce Entry + Idle Float */}
      <View style={[styles.mascotWrapper, { width: mascotSize + 50, height: mascotSize + 50 }]}>
        {/* Soft glowing aura behind Momo (Clean subtle brand violet, no yellow circle) */}
        {!isJungle && (
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
        )}

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
          source={MASCOT_SOURCES[mascotType] || MASCOT_SOURCES.loading}
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
        <Text style={[styles.title, isJungle && styles.titleJungle]}>{title}</Text>
        {!!subtitle && (
          <Text style={[styles.subtitle, isJungle && styles.subtitleJungle]}>
            {subtitle}
          </Text>
        )}

        {showSpinner && (
          <View style={styles.spinnerRow}>
            <ActivityIndicator size="small" color={isJungle ? '#FFFFFF' : colors.primary} />
          </View>
        )}
      </Animated.View>
    </View>
  );

  if (isJungle) {
    return (
      <View style={[styles.container, fullScreen && styles.fullScreen, style]}>
        <ImageBackground
          source={require('@/assets/jungle_bg.jpg')}
          style={styles.backgroundImage}
          resizeMode="cover"
        >
          {/* Atmospheric Contrast Tint */}
          <View style={styles.jungleAtmosphere} />

          {/* Floating Golden Jungle Fireflies / Sun motes */}
          <FloatingLightParticle x={SCREEN_WIDTH * 0.18} y={SCREEN_HEIGHT * 0.22} size={7} delay={100} />
          <FloatingLightParticle x={SCREEN_WIDTH * 0.78} y={SCREEN_HEIGHT * 0.28} size={9} delay={300} />
          <FloatingLightParticle x={SCREEN_WIDTH * 0.25} y={SCREEN_HEIGHT * 0.65} size={6} delay={200} />
          <FloatingLightParticle x={SCREEN_WIDTH * 0.72} y={SCREEN_HEIGHT * 0.72} size={8} delay={400} />

          {/* Core Content: Momo & Titles */}
          {content}

          {/* 3D Jungle Leaves Overlay with Position-Based Slide-in Animation */}
          <Jungle3DLeaves active={true} />
        </ImageBackground>
      </View>
    );
  }

  return (
    <View style={[styles.container, styles.cleanContainer, fullScreen && styles.fullScreen, style]}>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#071811',
  },
  cleanContainer: {
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[24],
  },
  fullScreen: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  jungleAtmosphere: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(7, 24, 17, 0.42)',
    zIndex: 1,
  },
  centerStage: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
    paddingHorizontal: spacing[24],
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
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
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
    fontSize: 28,
    color: '#0F172A',
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: spacing[2],
  },
  titleJungle: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.65)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  subtitle: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize[14],
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: typography.lineHeight[20],
    marginTop: spacing[4],
  },
  subtitleJungle: {
    color: '#E0E7FF',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  spinnerRow: {
    marginTop: spacing[16],
    alignItems: 'center',
    justifyContent: 'center',
  },
  firefly: {
    position: 'absolute',
    backgroundColor: '#FEF08A',
    shadowColor: '#FBBF24',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 10,
    elevation: 6,
    zIndex: 2,
  },
});
