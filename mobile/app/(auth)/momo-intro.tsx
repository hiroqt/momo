import { useOnboardingReducedMotion } from '@/components/onboarding/useOnboardingReducedMotion';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, cubicBezier } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText as Text } from '@/components/common/app-text';
import { MomoLottie } from '@/components/onboarding/MomoLottie';
import { MomoBackdrop } from '@/components/onboarding/MomoBackdrop';
import { MOMO_STEPS } from '@/components/onboarding/momoSteps';
import { ConfettiBurst } from '@/components/onboarding/OnboardingMotion';
import { useOnboarding } from '../../context/OnboardingContext';
import { getStarterTopic } from '../../lib/data/sampleDeck';
import { colors, onboardingColors, spacing, typography } from '@/constants/theme';

const PRESS_EASE = cubicBezier(0.23, 1, 0.32, 1);

export default function MomoIntroScreen() {
  const router = useRouter();
  const { firstName, studyTrack, highSchoolGrade, collegeYear, collegeCourse, finishMomoIntro } = useOnboarding();
  const { height: viewportHeight } = useWindowDimensions();
  const compactLayout = viewportHeight < 760;
  const reduceMotion = useOnboardingReducedMotion();
  const [busy, setBusy] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [completionError, setCompletionError] = useState<string | null>(null);
  const topic = getStarterTopic({ studyTrack, highSchoolGrade, collegeYear, collegeCourse }).label;
  const momoStep = MOMO_STEPS[9];

  const continueToDashboard = async () => {
    if (busy) return;
    setBusy(true);
    setCompletionError(null);
    try {
      await finishMomoIntro();
      router.replace('/(tabs)');
    } catch (error) {
      console.warn('Could not save Momo introduction state:', error);
      setCompletionError('We couldn’t open your study space. Please try again.');
      setBusy(false);
    }
  };

  return (
    <MomoBackdrop>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
          <View style={styles.visualArea}>
            <MomoLottie step={momoStep} size={compactLayout ? 240 : 300} />
            <ConfettiBurst size={compactLayout ? 300 : 380} />
          </View>

          <View style={styles.copyArea}>
            <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(200)}>
              <Text style={styles.title} accessibilityRole="header">
                You’re ready{firstName ? `, ${firstName}` : ''}
              </Text>
            </Animated.View>
            <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(200).delay(60)}>
              <Text style={styles.subtitle}>Your {topic.toLowerCase()} reviewer is waiting.</Text>
            </Animated.View>
          </View>

          <View style={styles.footer}>
            {completionError && <Text accessibilityRole="alert" style={styles.error}>{completionError}</Text>}
            <Pressable
              onPress={continueToDashboard}
              onPressIn={() => setPressed(true)}
              onPressOut={() => setPressed(false)}
              disabled={busy}
              pressRetentionOffset={12}
              accessibilityRole="button"
              accessibilityLabel="Open my study space"
              accessibilityState={{ disabled: busy, busy }}
            >
              <Animated.View
                style={[
                  styles.button,
                  {
                    transform: [{ scale: pressed && !reduceMotion ? 0.97 : 1 }],
                    opacity: pressed && reduceMotion ? 0.8 : 1,
                    transitionProperty: ['transform', 'opacity'],
                    transitionDuration: 120,
                    transitionTimingFunction: PRESS_EASE,
                  },
                ]}
              >
                <Text style={styles.buttonText}>{busy ? 'Opening...' : 'Open my study space'}</Text>
              </Animated.View>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </MomoBackdrop>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    paddingHorizontal: spacing[24],
  },
  visualArea: {
    minHeight: 205,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copyArea: {
    flex: 1,
    justifyContent: 'center',
    paddingBottom: spacing[12],
  },
  title: {
    fontSize: 30,
    lineHeight: 37,
    fontWeight: typography.fontWeight.bold,
    color: onboardingColors.text,
    textAlign: 'center',
    marginBottom: spacing[6],
  },
  subtitle: {
    fontSize: typography.fontSize[14],
    color: onboardingColors.textSecondary,
    lineHeight: 21,
    textAlign: 'center',
  },
  footer: {
    paddingVertical: spacing[12],
  },
  button: {
    backgroundColor: onboardingColors.primary,
    borderRadius: 18,
    borderCurve: 'continuous',
    paddingVertical: spacing[14],
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: typography.fontSize[14],
    fontWeight: typography.fontWeight.bold,
  },
  error: {
    color: colors.danger,
    backgroundColor: colors.dangerSoft,
    fontSize: typography.fontSize[12],
    lineHeight: 18,
    textAlign: 'center',
    padding: spacing[12],
    borderRadius: 12,
    marginBottom: spacing[12],
  },
});
