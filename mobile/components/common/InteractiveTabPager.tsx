import React, { useCallback, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  Extrapolation,
  runOnJS,
  SharedValue,
  Easing,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { colors } from '@/constants/theme';
import { FloatingNavBar, TABS } from './FloatingNavBar';

export interface TabPageConfig {
  key: string;
  component: React.ComponentType<any>;
}

export interface InteractiveTabPagerProps {
  pages: TabPageConfig[];
  activeIndex: number;
  onTabChange?: (index: number) => void;
}

// Snappy, highly-responsive spring config for programmatic tab taps (zero perceived latency, settles in ~140ms)
const TAB_TAP_SPRING_CONFIG = {
  damping: 28,
  stiffness: 380,
  mass: 0.45,
};

// Physics-grounded snappy spring config for pan swipe gestures matching click responsiveness
const SWIPE_SPRING_CONFIG = {
  damping: 28,
  stiffness: 380,
  mass: 0.45,
};

const IS_ANDROID = Platform.OS === 'android';

/**
 * High-performance iOS-style interactive tab swipe pager
 * Features:
 * - Full multi-page horizontal layout: adjacent content is revealed alongside disappearing content
 * - No empty white screen or black shadow artifacts on both Android and iOS
 * - Hardware-accelerated UI-thread gesture tracking with Reanimated & Gesture Handler
 * - Real-time animated translateX, opacity crossfade, and iOS parallax scale
 * - Frosted blur intensity that scales with drag delta and smoothly returns to 0 on completion
 * - Android-optimized compositor: eliminates RenderEffect buffer flash and hardware layer destruction shadow
 * - Integrated 1:1 real-time sliding bottom navigation pill
 */
export const InteractiveTabPager: React.FC<InteractiveTabPagerProps> = ({
  pages,
  activeIndex,
  onTabChange,
}) => {
  const { width: screenWidth } = useWindowDimensions();
  const maxIndex = pages.length - 1;

  // Continuous progress value (0.0 = Tab 0, 1.0 = Tab 1, 2.0 = Tab 2, etc.)
  const progress = useSharedValue(activeIndex);
  const startProgress = useSharedValue(activeIndex);
  const blurIntensity = useSharedValue(0);
  const isDragging = useSharedValue(false);

  // Ref to track whether change came from a gesture or tab press to prevent double-animation
  const isGestureSettling = useRef(false);
  const isTabPressing = useRef(false);

  // Sync shared value when activeIndex prop updates programmatically
  useEffect(() => {
    if (isGestureSettling.current) {
      isGestureSettling.current = false;
      return;
    }
    if (isTabPressing.current) {
      isTabPressing.current = false;
      return;
    }

    // External navigation or initial sync: snap immediately with zero delay
    // This fixes the issue where the page is already loaded but the fill/indicator
    // took 0.2s - 0.5s to spring across from the previous tab.
    if (!isDragging.value) {
      progress.value = activeIndex;
      blurIntensity.value = 0;
    }
  }, [activeIndex, isDragging, progress, blurIntensity]);

  const handleTabSettled = useCallback(
    (newIndex: number) => {
      if (newIndex !== activeIndex) {
        isGestureSettling.current = true;
        if (onTabChange) {
          onTabChange(newIndex);
        }
      }
    },
    [onTabChange, activeIndex]
  );

  const handleTabPress = useCallback(
    (targetIndex: number) => {
      if (targetIndex === activeIndex) return;

      isTabPressing.current = true;
      isGestureSettling.current = false;

      // Animate progress smoothly with ultra-responsive tab tap spring
      progress.value = withSpring(targetIndex, TAB_TAP_SPRING_CONFIG, (finished) => {
        'worklet';
        if (finished) {
          runOnJS(handleTabSettled)(targetIndex);
        }
      });

      // Immediately notify parent so route, activeIndex, and active indicator highlights update with zero lag
      if (onTabChange) {
        onTabChange(targetIndex);
      }
    },
    [activeIndex, onTabChange, handleTabSettled, progress]
  );

  // Pan Gesture Handler running 100% on the UI thread
  const panGesture = Gesture.Pan()
    .activeOffsetX([-14, 14])
    .failOffsetY([-14, 14])
    .onStart(() => {
      'worklet';
      isDragging.value = true;
      startProgress.value = progress.value;
    })
    .onUpdate((event) => {
      'worklet';
      const deltaX = event.translationX;
      const rawProgress = startProgress.value - deltaX / screenWidth;

      // Rubber-band resistance at edges
      let clampedProgress = rawProgress;
      if (rawProgress < 0) {
        clampedProgress = rawProgress * 0.28;
      } else if (rawProgress > maxIndex) {
        clampedProgress = maxIndex + (rawProgress - maxIndex) * 0.28;
      }

      progress.value = clampedProgress;

      // Calculate blur intensity based on gesture distance
      const distance = Math.abs(deltaX);
      const blurLevel = interpolate(
        distance,
        [0, screenWidth * 0.3],
        [0, 1],
        Extrapolation.CLAMP
      );
      blurIntensity.value = blurLevel;
    })
    .onEnd((event) => {
      'worklet';
      isDragging.value = false;
      const { translationX: dx, velocityX: vx } = event;

      // Velocity & translation threshold calculations
      const velocityUnits = -vx / screenWidth;
      const projectedTarget = progress.value + velocityUnits * 0.25;
      let targetIndex = Math.round(projectedTarget);

      // Bound within available tabs
      targetIndex = Math.max(0, Math.min(maxIndex, targetIndex));

      // Fast velocity override if drag was small but fast
      if (Math.abs(vx) > 500) {
        if (vx < 0 && Math.floor(startProgress.value) < maxIndex) {
          targetIndex = Math.min(maxIndex, Math.floor(startProgress.value) + 1);
        } else if (vx > 0 && Math.ceil(startProgress.value) > 0) {
          targetIndex = Math.max(0, Math.ceil(startProgress.value) - 1);
        }
      }

      // Smoothly animate blur back to zero
      blurIntensity.value = withTiming(0, {
        duration: 180,
        easing: Easing.out(Easing.quad),
      });

      // Spring to target tab position
      progress.value = withSpring(
        targetIndex,
        {
          ...SWIPE_SPRING_CONFIG,
          velocity: velocityUnits,
        },
        (finished) => {
          'worklet';
          if (finished) {
            runOnJS(handleTabSettled)(targetIndex);
          }
        }
      );

      // Immediately notify active state change so navbar & route respond with 0ms delay just like click navigation!
      if (targetIndex !== activeIndex) {
        isGestureSettling.current = true;
        runOnJS(handleTabSettled)(targetIndex);
      }
    });

  // Frosted Glass Blur Overlay Style
  const blurOverlayAnimatedStyle = useAnimatedStyle(() => {
    'worklet';
    return {
      opacity: blurIntensity.value,
    };
  });

  return (
    <GestureDetector gesture={panGesture}>
      <View style={styles.container}>
        {/* Render all pages side-by-side with individual UI-thread transformations */}
        {pages.map((page, index) => {
          return (
            <TabScene
              key={page.key}
              index={index}
              progress={progress}
              screenWidth={screenWidth}
              Component={page.component}
            />
          );
        })}

        {/* Dynamic Frosted Glass Blur Overlay during active swipe */}
        <Animated.View
          pointerEvents="none"
          style={[styles.blurOverlay, blurOverlayAnimatedStyle]}
        >
          {IS_ANDROID ? (
            // Android: Pure hardware-accelerated frosted glass diffusion (zero buffer flash or dark shadow)
            <View style={styles.androidFrostedOverlay} />
          ) : (
            // iOS: Native Apple UIVisualEffectView frosted glass
            <>
              <BlurView
                intensity={55}
                tint="light"
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.iosBlurTintBackdrop} />
            </>
          )}
        </Animated.View>

        {/* Floating Bottom Nav Bar synced with progress */}
        <FloatingNavBar
          activeIndex={activeIndex}
          progressAnim={progress}
          onTabPress={handleTabPress}
        />
      </View>
    </GestureDetector>
  );
};

interface TabSceneProps {
  index: number;
  progress: SharedValue<number>;
  screenWidth: number;
  Component: React.ComponentType<any>;
}

const TabScene: React.FC<TabSceneProps> = React.memo(
  ({ index, progress, screenWidth, Component }) => {
    const animatedStyle = useAnimatedStyle(() => {
      'worklet';
      const offset = (index - progress.value) * screenWidth;
      const distanceFromCenter = Math.abs(index - progress.value);

      if (IS_ANDROID) {
        // Android: 100% solid opacity and clean translateX to eliminate dark canvas shadow leaks
        return {
          transform: [{ translateX: offset }],
          opacity: 1,
        };
      }

      // iOS: Opacity crossfade & subtle depth scale
      const opacity = interpolate(
        distanceFromCenter,
        [0, 0.7, 1.2],
        [1.0, 0.88, 0.65],
        Extrapolation.CLAMP
      );

      const scale = interpolate(
        distanceFromCenter,
        [0, 1],
        [1.0, 0.965],
        Extrapolation.CLAMP
      );

      return {
        transform: [{ translateX: offset }, { scale }],
        opacity,
      };
    });

    return (
      <Animated.View
        style={[
          styles.pageScene,
          { width: screenWidth },
          animatedStyle,
        ]}
      >
        <Component />
      </Animated.View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    overflow: 'hidden',
    position: 'relative',
  },
  pageScene: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.background,
    ...(IS_ANDROID ? { elevation: 0 } : {}),
  },
  blurOverlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 900,
  },
  androidFrostedOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(248, 250, 252, 0.42)',
  },
  iosBlurTintBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
});
