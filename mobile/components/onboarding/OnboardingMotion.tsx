import { useOnboardingReducedMotion } from '@/components/onboarding/useOnboardingReducedMotion';
import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation, Easing, useAnimatedStyle, useSharedValue,
  withDelay, withSequence, withSpring, withTiming,
} from 'react-native-reanimated';
import { MomoAnimation } from '@/components/mascot/MomoAnimation';
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react-native';
import { AppText as Text } from '@/components/common/app-text';
import { onboardingColors, spacing, typography } from '@/constants/theme';

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

/**
 * Icon that pops in once on appear and does a short bounce-and-wiggle when it becomes selected.
 * No continuous motion. Reduce Motion renders it still.
 */
export function PopIcon({
  icon, selected = false, index = 0, size = 18, color,
}: {
  icon: IconSvgElement;
  selected?: boolean;
  /** Stagger position for the entrance pop. */
  index?: number;
  size?: number;
  color?: string;
}) {
  const reduceMotion = useOnboardingReducedMotion();
  const scale = useSharedValue(reduceMotion ? 1 : 0.4);
  const rotate = useSharedValue(reduceMotion ? 0 : -25);
  const wasSelected = useRef(selected);

  useEffect(() => {
    if (reduceMotion) {
      cancelAnimation(scale); cancelAnimation(rotate);
      scale.set(1); rotate.set(0);
      return;
    }
    const delay = 80 + index * 55;
    scale.set(withDelay(delay, withSpring(1, { damping: 10, stiffness: 200 })));
    rotate.set(withDelay(delay, withSpring(0, { damping: 12, stiffness: 180 })));
  }, [index, reduceMotion, rotate, scale]);

  useEffect(() => {
    if (reduceMotion || selected === wasSelected.current) {
      wasSelected.current = selected;
      return;
    }
    wasSelected.current = selected;
    if (!selected) return;
    scale.set(withSequence(
      withTiming(1.28, { duration: 120, easing: EASE_OUT }),
      withSpring(1, { damping: 9, stiffness: 220 }),
    ));
    rotate.set(withSequence(
      withTiming(-14, { duration: 90 }),
      withTiming(10, { duration: 110 }),
      withTiming(0, { duration: 140, easing: EASE_OUT }),
    ));
  }, [reduceMotion, rotate, scale, selected]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.get() }, { rotate: `${rotate.get()}deg` }],
  }));

  return (
    <Animated.View style={[styles.iconChip, style]}>
      <HugeiconsIcon
        icon={icon}
        size={size}
        color={color ?? (selected ? '#FFFFFF' : onboardingColors.primary)}
        strokeWidth={2}
      />
    </Animated.View>
  );
}

/** Segmented progress with a smoothly filling active segment and a short step label. */
export function OnboardingProgress({ step, total, label }: { step: number; total: number; label: string }) {
  const reduceMotion = useOnboardingReducedMotion();
  const progress = useSharedValue(step / total);

  useEffect(() => {
    const target = step / total;
    progress.set(reduceMotion ? target : withTiming(target, { duration: 420, easing: EASE_OUT }));
  }, [progress, reduceMotion, step, total]);

  const fill = useAnimatedStyle(() => ({ width: `${progress.get() * 100}%` }));

  return (
    <View
      style={styles.progressWrap}
      accessible
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: total, now: step }}
      accessibilityLabel={`Onboarding progress, step ${step} of ${total}, ${label}`}
    >
      <View style={styles.progressTrack}>
        <Animated.View style={[styles.progressFill, fill]} />
      </View>
      <Text style={styles.progressLabel} importantForAccessibility="no">
        <Text style={styles.progressStep}>{step}/{total}</Text>  {label}
      </Text>
    </View>
  );
}

/** A single confetti burst for the final celebration. Hidden under Reduce Motion. */
export function ConfettiBurst({ size = 360 }: { size?: number }) {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.confetti]} accessible={false} importantForAccessibility="no-hide-descendants">
      <MomoAnimation name="confetti-burst" size={size} />
    </View>
  );
}

const styles = StyleSheet.create({
  iconChip: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressWrap: {
    flex: 1,
    gap: spacing[6],
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: onboardingColors.border,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: onboardingColors.primary,
  },
  progressLabel: {
    fontSize: typography.fontSize[12],
    fontFamily: typography.fontFamily.semiBold,
    color: onboardingColors.textSecondary,
  },
  progressStep: {
    fontFamily: typography.fontFamily.bold,
    color: onboardingColors.primary,
    fontVariant: ['tabular-nums'],
  },
  confetti: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    zIndex: 20,
  },
});
