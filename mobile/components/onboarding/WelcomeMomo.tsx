import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, AppState, Image, StyleSheet, View } from 'react-native';
import { useEvent } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { onboardingColors } from '@/constants/theme';

interface WelcomeMomoProps {
  size: number;
  animate: boolean;
  onStarted: () => void;
}

/** Offline, silent, one-time welcome; the learner never has to wait for it. */
export function WelcomeMomo({ size, animate, onStarted }: WelcomeMomoProps) {
  // Default to the accessible static state until the system preference resolves.
  const [reduceMotion, setReduceMotion] = useState(true);
  const [firstFrameReady, setFirstFrameReady] = useState(false);
  const [finished, setFinished] = useState(false);
  const [active, setActive] = useState(AppState.currentState === 'active');
  const player = useVideoPlayer(require('@/assets/onboarding/momo-welcome.mp4'), (video) => {
    video.loop = false;
    video.muted = true;
    video.audioMixingMode = 'mixWithOthers';
  });
  const { status } = useEvent(player, 'statusChange', { status: player.status });

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    }).catch(() => {});
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    const app = AppState.addEventListener('change', (state) => setActive(state === 'active'));
    const end = player.addListener('playToEnd', () => setFinished(true));
    return () => {
      mounted = false;
      motion.remove();
      app.remove();
      end.remove();
    };
  }, [player]);

  useEffect(() => {
    if (animate && !reduceMotion && active && !finished && status === 'readyToPlay') {
      player.play();
      onStarted();
    } else {
      player.pause();
    }
  }, [active, animate, finished, onStarted, player, reduceMotion, status]);

  const showVideo = animate && !reduceMotion && status !== 'error' && firstFrameReady;
  return (
    <View
      style={[styles.container, { width: size, height: size }]}
      accessible
      accessibilityRole="image"
      accessibilityLabel="Momo waves hello, your study companion"
    >
      <Image
        source={require('@/assets/onboarding/frames/frame-01.png')}
        resizeMode="contain"
        style={[StyleSheet.absoluteFill, styles.media]}
        accessible={false}
      />
      {!reduceMotion && animate && status !== 'error' && (
        <VideoView
          player={player}
          style={[StyleSheet.absoluteFill, styles.media, { opacity: showVideo ? 1 : 0 }]}
          contentFit="contain"
          nativeControls={false}
          allowsVideoFrameAnalysis={false}
          onFirstFrameRender={() => setFirstFrameReady(true)}
          accessible={false}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          pointerEvents="none"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: onboardingColors.canvas, overflow: 'hidden' },
  media: { width: '100%', height: '100%' },
});
