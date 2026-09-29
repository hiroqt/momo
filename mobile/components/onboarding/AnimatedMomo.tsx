import React from 'react';
import { Image, StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeOut, ReduceMotion } from 'react-native-reanimated';

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

const MOMO_POSES: Record<MomoPose, number> = {
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

/** Momo stays still. Only opacity changes as a pose enters or leaves. */
export function AnimatedMomo({ pose, stage = 1, size = 205 }: AnimatedMomoProps) {
  return (
    <Animated.View
      key={`${stage}-${pose}`}
      entering={FadeIn.duration(240).reduceMotion(ReduceMotion.System)}
      exiting={FadeOut.duration(160).reduceMotion(ReduceMotion.System)}
      style={[styles.container, { width: size, height: size }]}
      accessibilityRole="image"
      accessibilityLabel="Momo, your study companion"
    >
      <Image source={MOMO_POSES[pose]} resizeMode="contain" style={styles.media} />
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
