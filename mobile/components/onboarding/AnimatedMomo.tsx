import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import LottieView from 'lottie-react-native';
import * as Haptics from 'expo-haptics';
import { AppText as Text } from '@/components/common/app-text';
import { spacing, typography } from '@/constants/theme';

export type MomoPose =
  | 'welcome'
  | 'thinking'
  | 'happy'
  | 'document'
  | 'creating'
  | 'xp'
  | 'focus'
  | 'cool'
  | 'cheer';

// Clean assets without furrowed/wavy eyebrows (thinking maps to clean happy_momo)
const MOMO_ASSETS: Record<MomoPose, any> = {
  welcome: require('@/assets/animations/welcome_momo.png'),
  thinking: require('@/assets/animations/happy_momo.png'), // clean brows, no furrowed eyebrows
  happy: require('@/assets/animations/happy_momo.png'),
  document: require('@/assets/animations/document_momo.png'),
  creating: require('@/assets/animations/creating_momo.png'),
  xp: require('@/assets/animations/xp_momo.png'),
  focus: require('@/assets/animations/creating_momo.png'), // friendly study focus without angry brows
  cool: require('@/assets/animations/cool_momo.png'),
  cheer: require('@/assets/animations/cheer_momo.png'),
};

// Strict zero-emoji clean text quotes
const CHEEKY_QUOTES = [
  "Let's lock in.",
  'Zero fluff, 100% facts.',
  'Ready to master your exams.',
  'Momo has your back.',
  'Streak master incoming.',
];

interface AnimatedMomoProps {
  pose: MomoPose;
  stage?: number;
  size?: number;
  speechText?: string;
  onTap?: () => void;
}

export const AnimatedMomo: React.FC<AnimatedMomoProps> = ({
  pose,
  stage = 1,
  size = 155,
  speechText,
  onTap,
}) => {
  const [activePose, setActivePose] = useState<MomoPose>(pose);
  const [currentQuote, setCurrentQuote] = useState<string | null>(null);

  // --- REANIMATED VALUES ---
  // Organic breathing & subtle sway anchored flush to the card (ZERO vertical lift, ZERO gap)
  const breathScaleY = useSharedValue(1);
  const idleTilt = useSharedValue(0);
  const reactScale = useSharedValue(1);

  // Speech bubble opacity
  const bubbleOpacity = useSharedValue(speechText ? 1 : 0);

  // 1. ORGANIC BREATHING & SWAY (Anchored at the bottom edge)
  useEffect(() => {
    // Gentle breathing scale Y: expands up from the bottom edge
    breathScaleY.value = withRepeat(
      withSequence(
        withTiming(1.025, { duration: 1800, easing: Easing.bezier(0.42, 0, 0.58, 1) }),
        withTiming(1.0, { duration: 1800, easing: Easing.bezier(0.42, 0, 0.58, 1) })
      ),
      -1,
      true
    );

    // Subtle sway tilt (from waist anchor)
    idleTilt.value = withRepeat(
      withSequence(
        withTiming(-0.8, { duration: 2400, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.8, { duration: 2400, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );
  }, []);

  // 2. STAGE TRANSITION (Celebratory squash & stretch from card anchor)
  useEffect(() => {
    reactScale.value = withSequence(
      withTiming(1.04, { duration: 120, easing: Easing.out(Easing.cubic) }),
      withTiming(0.99, { duration: 100, easing: Easing.inOut(Easing.quad) }),
      withTiming(1.0, { duration: 120, easing: Easing.out(Easing.quad) })
    );

    setActivePose(pose);
  }, [stage, pose]);

  // Handle Speech Bubble updates
  useEffect(() => {
    if (speechText) {
      setCurrentQuote(speechText);
      bubbleOpacity.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.ease) });
    }
  }, [speechText]);

  // Interactive tap on Momo
  const handlePressMomo = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}

    const random = CHEEKY_QUOTES[Math.floor(Math.random() * CHEEKY_QUOTES.length)];
    setCurrentQuote(random);
    bubbleOpacity.value = withSequence(
      withTiming(1, { duration: 150 }),
      withTiming(1, { duration: 2400 }),
      withTiming(0, { duration: 300, easing: Easing.in(Easing.ease) })
    );

    reactScale.value = withSequence(
      withTiming(1.06, { duration: 140, easing: Easing.out(Easing.cubic) }),
      withTiming(0.98, { duration: 100, easing: Easing.inOut(Easing.quad) }),
      withTiming(1.0, { duration: 140, easing: Easing.out(Easing.quad) })
    );

    if (onTap) {
      onTap();
    }
  };

  // Keep Momo's bottom cut-off edge 100% flush against the card (no gap, no overlap)
  // By offsetting translateY by -((scaleY - 1) * (size / 2)), the bottom edge remains exactly at y = size
  const momoMotionStyle = useAnimatedStyle(() => {
    const totalScaleY = breathScaleY.value * reactScale.value;
    const bottomAnchorOffsetY = -((totalScaleY - 1) * (size / 2));
    const volumeCompX = 1 / Math.sqrt(totalScaleY);

    return {
      transform: [
        { translateY: bottomAnchorOffsetY },
        { scaleY: totalScaleY },
        { scaleX: volumeCompX },
        { rotateZ: `${idleTilt.value}deg` },
      ],
    };
  });

  const bubbleAnimatedStyle = useAnimatedStyle(() => ({
    opacity: bubbleOpacity.value,
    transform: [
      {
        scale: withTiming(bubbleOpacity.value === 1 ? 1 : 0.92, {
          duration: 200,
          easing: Easing.out(Easing.back(1.2)),
        }),
      },
    ],
  }));

  return (
    <View style={[styles.container, { minHeight: size }]}>
      {/* Horizontal Layout: Momo on Left, Speech Bubble on Right */}
      <View style={[styles.momoRow, { minHeight: size }]}>
        {/* Momo touch target capped at card top */}
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={handlePressMomo}
          style={[styles.touchTarget, { width: size, height: size }]}
          accessibilityRole="image"
          accessibilityLabel="Momo, your AI study companion. Tap to interact."
        >
          {/* Lottie Magic Aura behind Momo */}
          <View
            style={[
              styles.lottieWrap,
              { width: size * 1.35, height: size * 1.35, top: -(size * 0.2) },
            ]}
            pointerEvents="none"
          >
            <LottieView
              source={
                stage === 6
                  ? require('@/assets/animations/momo_confetti.json')
                  : require('@/assets/animations/magic_sparkles.json')
              }
              autoPlay
              loop
              speed={0.85}
              style={styles.lottieView}
            />
          </View>

          {/* Momo Character Image: Bottom-aligned to touch card top seamlessly */}
          <Animated.Image
            source={MOMO_ASSETS[activePose] || MOMO_ASSETS.welcome}
            style={[
              styles.momoImage,
              { width: size, height: size },
              momoMotionStyle,
            ]}
            resizeMode="contain"
          />
        </TouchableOpacity>

        {/* Speech Bubble Placed on the RIGHT Side of Momo */}
        <View style={styles.speechColumn}>
          {currentQuote && (
            <Animated.View style={[styles.speechBubbleRight, bubbleAnimatedStyle]} pointerEvents="none">
              <View style={styles.speechBubbleArrowLeft} />
              <Text style={styles.speechBubbleText}>{currentQuote}</Text>
            </Animated.View>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  momoRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: spacing[12],
    paddingHorizontal: spacing[8],
  },
  touchTarget: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    position: 'relative',
    zIndex: 5,
  },
  momoImage: {
    zIndex: 5,
  },
  lottieWrap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  lottieView: {
    width: '100%',
    height: '100%',
  },
  speechColumn: {
    flex: 1,
    maxWidth: 200,
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingBottom: spacing[16],
    zIndex: 6,
  },
  speechBubbleRight: {
    position: 'relative',
    backgroundColor: '#FFFFFF',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderCurve: 'continuous',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  speechBubbleText: {
    fontSize: typography.fontSize[12],
    fontWeight: typography.fontWeight.bold,
    color: '#0F172A',
    lineHeight: 16,
  },
  speechBubbleArrowLeft: {
    position: 'absolute',
    left: -6,
    top: 12,
    width: 0,
    height: 0,
    borderTopWidth: 6,
    borderBottomWidth: 6,
    borderRightWidth: 6,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderRightColor: '#FFFFFF',
  },
});
