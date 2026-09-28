import React, { useState } from 'react';
import { StyleSheet, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInUp, ReduceMotion } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText as Text } from '@/components/common/app-text';
import { AnimatedMomo } from '@/components/onboarding/AnimatedMomo';
import { MomoBackdrop } from '@/components/onboarding/MomoBackdrop';
import { useOnboarding } from '../../context/OnboardingContext';
import { getStarterTopic } from '../../lib/data/sampleDeck';
import { onboardingColors, spacing, typography } from '@/constants/theme';

const TIPS = [
  'Answer before you flip',
  'Upload your own notes when ready',
  'Return for a short daily review',
];

export default function MomoIntroScreen() {
  const router = useRouter();
  const { firstName, studyTrack, highSchoolGrade, collegeYear, collegeCourse, finishMomoIntro } = useOnboarding();
  const { height: viewportHeight } = useWindowDimensions();
  const compactLayout = viewportHeight < 760;
  const [busy, setBusy] = useState(false);
  const topic = getStarterTopic({ studyTrack, highSchoolGrade, collegeYear, collegeCourse }).label;

  const continueToDashboard = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await finishMomoIntro();
      router.replace('/(tabs)');
    } catch (error) {
      console.warn('Could not save Momo introduction state:', error);
      setBusy(false);
    }
  };

  return (
    <MomoBackdrop>
      <SafeAreaView style={styles.safeArea}>
        <Animated.View
          entering={FadeInUp.duration(220).reduceMotion(ReduceMotion.System)}
          style={styles.content}
        >
          <View style={styles.visualArea}>
            <AnimatedMomo pose="cheer" stage={9} size={compactLayout ? 170 : 225} />
          </View>

          <View style={styles.copyArea}>
            <Text style={styles.title}>You’re ready{firstName ? `, ${firstName}` : ''}</Text>
            <Text style={styles.subtitle}>Your {topic.toLowerCase()} reviewer is waiting.</Text>

            <View style={styles.nextSteps} accessibilityLabel="How to begin">
              {TIPS.map((tip, index) => (
                <View key={tip} style={styles.tipRow}>
                  <Text style={styles.numberText}>0{index + 1}</Text>
                  <Text style={styles.tipTitle}>{tip}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.button}
              onPress={continueToDashboard}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Open my study space"
              activeOpacity={0.85}
            >
              <Text style={styles.buttonText}>{busy ? 'Opening...' : 'Open my study space'}</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </SafeAreaView>
    </MomoBackdrop>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
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
  nextSteps: {
    marginTop: spacing[20],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: onboardingColors.border,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[12],
    paddingVertical: spacing[12],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: onboardingColors.border,
  },
  numberText: {
    width: 26,
    color: onboardingColors.primary,
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize[12],
  },
  tipTitle: {
    flex: 1,
    color: onboardingColors.text,
    fontSize: typography.fontSize[13.5],
    fontWeight: typography.fontWeight.semiBold,
  },
  footer: {
    paddingVertical: spacing[12],
  },
  button: {
    backgroundColor: onboardingColors.primary,
    borderRadius: 16,
    paddingVertical: spacing[14],
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: typography.fontSize[14],
    fontWeight: typography.fontWeight.bold,
  },
});
