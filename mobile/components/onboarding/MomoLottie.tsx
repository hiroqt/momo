import React, { useEffect, useRef } from 'react';
import { AppState, StyleSheet } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import LottieView, { type AnimationObject } from 'lottie-react-native';
import { MOMO_FRAME_COUNT, type MomoAnimation, type MomoStep } from './momoSteps';

const SOURCES: Record<MomoAnimation, AnimationObject> = {
  wave: require('@/assets/animations/momo-rig/wave.json'),
  'tip-cap': require('@/assets/animations/momo-rig/tip-cap.json'),
  listen: require('@/assets/animations/momo-rig/listen.json'),
  point: require('@/assets/animations/momo-rig/point.json'),
  think: require('@/assets/animations/momo-rig/think.json'),
  'present-book': require('@/assets/animations/momo-rig/present-book.json'),
  march: require('@/assets/animations/momo-rig/march.json'),
  proud: require('@/assets/animations/momo-rig/proud.json'),
  cheer: require('@/assets/animations/momo-rig/cheer.json'),
};

interface MomoLottieProps {
  step: MomoStep;
  size: number;
}

/**
 * Rigged vector Momo. Loops its act while the app is active; under Reduce Motion it
 * renders a still frame of the same pose instead.
 */
export function MomoLottie({ step, size }: MomoLottieProps) {
  const reduceMotion = useReducedMotion();
  const ref = useRef<LottieView>(null);

  useEffect(() => {
    if (reduceMotion) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') ref.current?.resume();
      else ref.current?.pause();
    });
    return () => sub.remove();
  }, [reduceMotion]);

  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeInDown.duration(280)}
      style={{ width: size, height: size }}
      accessible
      accessibilityRole="image"
      accessibilityLabel={step.label}
    >
      <LottieView
        key={reduceMotion ? 'still' : 'live'}
        ref={ref}
        source={SOURCES[step.animation]}
        autoPlay={!reduceMotion}
        loop={!reduceMotion}
        progress={reduceMotion ? step.stillFrame / MOMO_FRAME_COUNT : undefined}
        resizeMode="contain"
        style={styles.fill}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: { width: '100%', height: '100%' },
});
