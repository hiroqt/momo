import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, StyleSheet, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import { useIsFocused } from 'expo-router';
import { fitMotionSize } from '@/lib/animations/motionLayout';
import LottieView from 'lottie-react-native';
import { useOnboardingReducedMotion } from '@/components/onboarding/useOnboardingReducedMotion';
import { SHOP_MOTION, type ShopMotionName } from '@/lib/animations/shopMotion';
import { MOMO_MOTION, motionPlayback, type MomoMotionName } from '@/lib/animations/momoMotion';

interface MomoAnimationProps {
  name: MomoMotionName | ShopMotionName;
  size?: number;
  /** Global status overlays have no screen navigation context. */
  screenAware?: boolean;
  speed?: number;
  /** Hide/pause motion in a closed modal or invisible panel. */
  active?: boolean;
  /** Change for a new celebration, answer or reward; does not repeat a one shot. */
  replayKey?: string | number;
  /** Leave undefined when a neighbouring label already conveys the same state. */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  onFinish?: () => void;
}

/** Offline source-quality illustrations with live accessibility and visibility handling. */
export function MomoAnimation({ screenAware = true, ...props }: MomoAnimationProps) {
  return screenAware ? <ScreenAnimation {...props} /> : <AnimationPlayer {...props} focused />;
}

function ScreenAnimation(props: MomoAnimationProps) {
  const focused = useIsFocused();
  return <AnimationPlayer {...props} focused={focused} />;
}

function AnimationPlayer({
  name, size = 180, active = true, replayKey = 0, accessibilityLabel, style, onFinish, focused, speed = 1,
}: MomoAnimationProps & { focused: boolean }) {
  const metadata = name in SHOP_MOTION ? SHOP_MOTION[name as ShopMotionName] : MOMO_MOTION[name as MomoMotionName];
  const source = useMemo(() => metadata.source(), [metadata]);
  const reducedMotion = useOnboardingReducedMotion();
  const viewport = useWindowDimensions();
  const flattened = StyleSheet.flatten(style);
  const layout = fitMotionSize(typeof flattened?.width === 'number' ? flattened.width : size,
    typeof flattened?.height === 'number' ? flattened.height : size, viewport.width, viewport.height);
  const ref = useRef<LottieView>(null);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [finishedKey, setFinishedKey] = useState<string>();
  const animationKey = `${name}:${replayKey}`;
  const playback = motionPlayback({ reducedMotion, active: active && foreground,
    focused, completed: finishedKey === animationKey, decorativeBurst: metadata.decorativeBurst });

  useEffect(() => {
    const listener = AppState.addEventListener('change', state => setForeground(state === 'active'));
    return () => listener.remove();
  }, []);

  useEffect(() => {
    if (playback === 'playing') ref.current?.resume();
    else ref.current?.pause();
  }, [playback, animationKey]);

  if (playback === 'hidden') return null;
  return (
    <View pointerEvents="none" style={[style, { width: layout.width, height: undefined, aspectRatio: layout.aspectRatio, maxWidth: '100%', flexShrink: 1 }]}
      accessible={!!accessibilityLabel} accessibilityRole="image"
      accessibilityLabel={accessibilityLabel} importantForAccessibility={accessibilityLabel ? 'auto' : 'no-hide-descendants'}>
      <LottieView key={`${animationKey}:${reducedMotion ? 'still' : 'motion'}`}
        ref={ref} source={source} speed={speed} autoPlay={playback === 'playing'} loop={metadata.loop && !reducedMotion}
        progress={playback === 'still' ? metadata.stillFrame / metadata.frames : undefined}
        resizeMode="contain" style={styles.fill}
        onAnimationFinish={cancelled => {
          if (cancelled || metadata.loop) return;
          setFinishedKey(animationKey);
          onFinish?.();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({ fill: { width: '100%', height: '100%' } });
