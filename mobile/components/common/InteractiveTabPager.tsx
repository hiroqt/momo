import React, { useCallback, useEffect, useState } from 'react';
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
  interpolate,
  Extrapolation,
  runOnJS,
  SharedValue,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { colors } from '@/constants/theme';
import { FloatingNavBar } from './FloatingNavBar';

export interface TabPageConfig {
  key: string;
  component: React.ComponentType<any>;
}

export interface InteractiveTabPagerProps {
  pages: TabPageConfig[];
  activeIndex: number;
  onTabChange?: (index: number) => void;
}

// Physics-grounded snappy spring config for pan swipe gestures matching click responsiveness
const SWIPE_SPRING_CONFIG = {
  damping: 34,
  stiffness: 450,
  mass: 0.35,
};

const IS_ANDROID = Platform.OS === 'android';

/**
 * High-performance interactive tab swipe pager
 * Features:
 * - 1:1 hardware-accelerated linear translation with zero scale/opacity distortion
 * - Immediate tab switching on button tap: zero ease/slide animation across pages
 * - Frosted blur shown only on the revealing page while swipe gesture is held and unreleased
 * - Instant blur clearance and crisp snap when swipe gesture is released
 * - 100% UI-thread execution with Reanimated worklets and Gesture Handler
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

  // Shared values to track whether change came from a gesture or tab press
  const isGestureSettling = useSharedValue(false);
  const isTabPressing = useSharedValue(false);

  // Lazy tab mounting to prevent loading all 4 screens and firing all API calls on app startup
  const [mountedTabs, setMountedTabs] = useState<Set<number>>(() => new Set([activeIndex]));

  useEffect(() => {
    setMountedTabs((prev) => {
      const next = new Set(prev);
      next.add(activeIndex);
      // Pre-mount adjacent tabs when active changes
      if (activeIndex > 0) next.add(activeIndex - 1);
      if (activeIndex < maxIndex) next.add(activeIndex + 1);
      return next;
    });
  }, [activeIndex, maxIndex]);

  // Sync shared value when activeIndex prop updates programmatically
  useEffect(() => {
    if (isGestureSettling.value) {
      isGestureSettling.value = false;
      return;
    }
    if (isTabPressing.value) {
      isTabPressing.value = false;
      return;
    }

    // External navigation or initial sync: snap immediately with zero delay
    if (!isDragging.value) {
      progress.value = activeIndex;
      blurIntensity.value = 0;
    }
  }, [activeIndex, isDragging, progress, blurIntensity, isGestureSettling, isTabPressing]);

  const handleTabSettled = useCallback(
    (newIndex: number) => {
      isGestureSettling.value = false;
      if (newIndex !== activeIndex) {
        if (onTabChange) {
          onTabChange(newIndex);
        }
      }
    },
    [onTabChange, activeIndex, isGestureSettling]
  );

  const handleTabPress = useCallback(
    (targetIndex: number) => {
      if (targetIndex === activeIndex) return;

      isTabPressing.value = true;
      isGestureSettling.value = false;

      // Ensure target tab is mounted
      setMountedTabs((prev) => new Set(prev).add(targetIndex));

      // Remove the ease animation for switching tabs: switch immediately with zero slide
      progress.value = targetIndex;
      blurIntensity.value = 0;

      if (onTabChange) {
        onTabChange(targetIndex);
      }
    },
    [activeIndex, onTabChange, progress, blurIntensity, isTabPressing, isGestureSettling]
  );

  // Pan Gesture Handler running 100% on the UI thread
  // calibrated with [-25, 25] active offset to prevent capturing horizontal scroll gestures from carousels
  const panGesture = Gesture.Pan()
    .activeOffsetX([-25, 25])
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

      isGestureSettling.value = true;

      // Snappy spring to target tab position
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
    });

  return (
    <GestureDetector gesture={panGesture}>
      <View style={styles.container}>
        {/* Render all pages side-by-side with 1:1 UI-thread transformations */}
        {pages.map((page, index) => {
          return (
            <TabScene
              key={page.key}
              index={index}
              isActive={activeIndex === index}
              isMounted={mountedTabs.has(index)}
              progress={progress}
              startProgress={startProgress}
              screenWidth={screenWidth}
              isDragging={isDragging}
              Component={page.component}
            />
          );
        })}

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
  isActive: boolean;
  isMounted: boolean;
  progress: SharedValue<number>;
  startProgress: SharedValue<number>;
  screenWidth: number;
  isDragging: SharedValue<boolean>;
  Component: React.ComponentType<any>;
}

const TabScene: React.FC<TabSceneProps> = React.memo(
  ({ index, isActive, isMounted, progress, startProgress, screenWidth, isDragging, Component }) => {
    // Pure 1:1 hardware-accelerated translation with solid opacity
    const animatedStyle = useAnimatedStyle(() => {
      'worklet';
      const offset = (index - progress.value) * screenWidth;
      const dist = Math.abs(index - progress.value);

      return {
        transform: [{ translateX: offset }],
        opacity: 1,
        display: dist > 1.1 ? 'none' : 'flex',
      };
    });

    // Frosted glass blur applied ONLY to the revealing page while swipe is held (iOS only)
    const blurAnimatedStyle = useAnimatedStyle(() => {
      'worklet';
      if (!isDragging.value || IS_ANDROID) {
        return { opacity: 0 };
      }

      // The active page the user started swiping from remains completely crisp and unblurred
      const isSourcePage = index === Math.round(startProgress.value);
      if (isSourcePage) {
        return { opacity: 0 };
      }

      // The adjacent page being revealed shows the frosted blur smoothly
      const distanceFromCenter = Math.abs(index - progress.value);
      const blurOpacity = interpolate(
        distanceFromCenter,
        [0.02, 0.2],
        [0, 1],
        Extrapolation.CLAMP
      );

      return {
        opacity: blurOpacity,
      };
    });

    return (
      <Animated.View
        pointerEvents={isActive ? 'auto' : 'none'}
        style={[
          styles.pageScene,
          { width: screenWidth },
          animatedStyle,
        ]}
      >
        {isMounted ? (
          <Component />
        ) : (
          <View style={{ flex: 1, backgroundColor: colors.background }} />
        )}

        {/* Revealing page blur overlay: enabled on iOS native; omitted on Android to prevent HWUI layer allocation flicker */}
        {!IS_ANDROID && (
          <Animated.View
            pointerEvents="none"
            style={[styles.sceneBlurOverlay, blurAnimatedStyle]}
          >
            <BlurView
              intensity={45}
              tint="light"
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.iosBlurTintBackdrop} />
          </Animated.View>
        )}
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
  },
  sceneBlurOverlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 50,
  },
  iosBlurTintBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
});
