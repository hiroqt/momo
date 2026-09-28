import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, Image, StyleSheet } from 'react-native';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';
import LottieView, { type AnimationObject } from 'lottie-react-native';

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

const MOMO_ANIMATIONS: Record<MomoPose, AnimationObject> = {
  welcome: require('@/assets/animations/welcome_momo.lottie.json'),
  thinking: require('@/assets/animations/happy_momo.lottie.json'),
  happy: require('@/assets/animations/happy_momo.lottie.json'),
  document: require('@/assets/animations/document_momo.lottie.json'),
  creating: require('@/assets/animations/creating_momo.lottie.json'),
  xp: require('@/assets/animations/cheer_momo.lottie.json'),
  focus: require('@/assets/animations/creating_momo.lottie.json'),
  cool: require('@/assets/animations/cool_momo.lottie.json'),
  cheer: require('@/assets/animations/cheer_momo.lottie.json'),
};

const MOMO_FALLBACKS: Record<MomoPose, number> = {
  welcome: require('@/assets/animations/welcome_momo.png'),
  thinking: require('@/assets/animations/happy_momo.png'),
  happy: require('@/assets/animations/happy_momo.png'),
  document: require('@/assets/animations/document_momo.png'),
  creating: require('@/assets/animations/creating_momo.png'),
  xp: require('@/assets/animations/cheer_momo.png'),
  focus: require('@/assets/animations/creating_momo.png'),
  cool: require('@/assets/animations/cool_momo.png'),
  cheer: require('@/assets/animations/cheer_momo.png'),
};

interface AnimatedMomoProps {
  pose: MomoPose;
  stage?: number;
  size?: number;
}

/** Momo is the only animated illustration; the surrounding interface stays quiet. */
export function AnimatedMomo({ pose, stage = 1, size = 205 }: AnimatedMomoProps) {
  const [reduceMotion, setReduceMotion] = useState(false);
  const [animationFailed, setAnimationFailed] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => subscription.remove();
  }, []);

  useEffect(() => setAnimationFailed(false), [pose]);

  return (
    <Animated.View
      key={`${stage}-${pose}`}
      entering={FadeIn.duration(180).reduceMotion(ReduceMotion.System)}
      style={[styles.container, { width: size, height: size }]}
      accessibilityRole="image"
      accessibilityLabel="Momo, your study companion"
    >
      {reduceMotion || animationFailed ? (
        <Image source={MOMO_FALLBACKS[pose]} resizeMode="contain" style={styles.media} />
      ) : (
        <LottieView
          source={MOMO_ANIMATIONS[pose]}
          autoPlay
          loop
          onAnimationFailure={() => setAnimationFailed(true)}
          style={styles.media}
        />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  media: {
    width: '100%',
    height: '100%',
  },
});
