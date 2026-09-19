import React, { useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  Animated,
  Easing,
  Platform,
  UIManager,
  LayoutAnimation,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText as Text } from '@/components/common/app-text';
import { useRouter } from 'expo-router';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  ArrowRight01Icon,
  ArrowLeft01Icon,
  CheckmarkCircle02Icon,
  SparklesIcon,
  BookOpen01Icon,
  FlashIcon,
  TrophyIcon,
} from '@hugeicons/core-free-icons';
import { colors, spacing, typography } from '@/constants/theme';
import {
  useOnboarding,
  StudyTrack,
  PreferredFormat,
} from '../../context/OnboardingContext';
import { seedSampleDeck } from '../../lib/data/sampleDeck';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const TRACK_OPTIONS: { id: StudyTrack; label: string; iconText: string; desc: string }[] = [
  { id: 'college', label: 'College & University', iconText: '🎓', desc: 'Lectures, syllabi & midterms' },
  { id: 'med_nursing', label: 'Medicine & Nursing', iconText: '🩺', desc: 'Anatomy, pharma & board prep' },
  { id: 'stem', label: 'STEM & Engineering', iconText: '💻', desc: 'Formulas, problem sets & code' },
  { id: 'boards', label: 'Board & Licensure Exams', iconText: '⚖️', desc: 'High-stakes practice drills' },
  { id: 'high_school', label: 'High School', iconText: '📚', desc: 'AP, IB & general classes' },
  { id: 'general', label: 'General Learning', iconText: '🧠', desc: 'Curiosity & personal growth' },
];

const ALL_INDIVIDUAL_FORMATS: PreferredFormat[] = ['flashcards', 'quiz', 'exam', 'summary'];

const FORMAT_OPTIONS: {
  id: PreferredFormat | 'all';
  label: string;
  desc: string;
  iconText: string;
  isAll?: boolean;
}[] = [
  {
    id: 'all',
    label: 'All Formats',
    desc: 'Give me everything! Flashcards, quizzes, exams & summaries',
    iconText: '✨',
    isAll: true,
  },
  {
    id: 'flashcards',
    label: 'Flashcards',
    desc: 'Bite-sized cards to test your memory fast',
    iconText: '⚡',
  },
  {
    id: 'quiz',
    label: 'Fun Quizzes',
    desc: 'Active recall tests with instant answers & XP',
    iconText: '🎯',
  },
  {
    id: 'exam',
    label: 'Practice Exams',
    desc: 'Timed mock tests to get ready for exam day',
    iconText: '📝',
  },
  {
    id: 'summary',
    label: 'Quick Summaries',
    desc: 'Key takeaways cooked into simple bullet points',
    iconText: '📖',
  },
];

const GOAL_OPTIONS = [
  { minutes: 10, label: '10 min/day', tag: 'Chill', desc: 'Easy routine to build a daily habit without stress' },
  { minutes: 20, label: '20 min/day', tag: 'Momo Pick', desc: 'Sweet spot for optimal memory retention & streak XP' },
  { minutes: 45, label: '45 min/day', tag: 'Lock In!', desc: 'Serious crunch mode for upcoming exams' },
];

export default function WelcomeScreen() {
  const router = useRouter();
  const { completeWelcome } = useOnboarding();

  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [selectedTrack, setSelectedTrack] = useState<StudyTrack>('college');
  // Multiple formats selection, defaults to All Formats
  const [selectedFormats, setSelectedFormats] = useState<PreferredFormat[]>([
    'all',
    'flashcards',
    'quiz',
    'exam',
    'summary',
  ]);
  const [selectedGoal, setSelectedGoal] = useState<number>(20);
  const [isSeeding, setIsSeeding] = useState<boolean>(false);

  // Smooth ease-in ease-out transition values
  const isTransitioning = useRef(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const scrollViewRef = useRef<ScrollView>(null);

  const goToStep = (nextStep: 1 | 2 | 3 | 4 | 5, direction: 'forward' | 'backward' = 'forward') => {
    if (isTransitioning.current) return;
    isTransitioning.current = true;

    const exitOffset = direction === 'forward' ? -36 : 36;
    const enterOffset = direction === 'forward' ? 36 : -36;

    // Phase 1: Fluid decelerate exit
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 160,
        easing: Easing.bezier(0.4, 0, 0.6, 1),
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: exitOffset,
        duration: 160,
        easing: Easing.bezier(0.4, 0, 0.6, 1),
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.96,
        duration: 160,
        easing: Easing.bezier(0.4, 0, 0.6, 1),
        useNativeDriver: true,
      }),
    ]).start(() => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setStep(nextStep);
      scrollViewRef.current?.scrollTo({ y: 0, animated: false });
      slideAnim.setValue(enterOffset);
      scaleAnim.setValue(0.96);

      // Phase 2: Natural spring-like ease-out entrance
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 260,
          easing: Easing.bezier(0.16, 1, 0.3, 1),
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 260,
          easing: Easing.bezier(0.16, 1, 0.3, 1),
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 260,
          easing: Easing.bezier(0.16, 1, 0.3, 1),
          useNativeDriver: true,
        }),
      ]).start(() => {
        isTransitioning.current = false;
      });
    });
  };

  const handleToggleFormat = (id: PreferredFormat | 'all') => {
    if (id === 'all') {
      const isAllSelected = selectedFormats.includes('all');
      if (isAllSelected) {
        // Uncheck all except a default single format
        setSelectedFormats(['flashcards']);
      } else {
        // Select all formats
        setSelectedFormats(['all', 'flashcards', 'quiz', 'exam', 'summary']);
      }
      return;
    }

    const isSelected = selectedFormats.includes(id);
    if (isSelected) {
      const remaining = selectedFormats.filter((f) => f !== id && f !== 'all');
      // Ensure at least 1 format remains selected
      if (remaining.length === 0) return;
      setSelectedFormats(remaining);
    } else {
      const next: PreferredFormat[] = [...selectedFormats.filter((f) => f !== 'all'), id];
      const hasAllFour = ALL_INDIVIDUAL_FORMATS.every((item) => next.some((n) => n === item));
      if (hasAllFour) {
        setSelectedFormats(['all', ...next]);
      } else {
        setSelectedFormats(next);
      }
    }
  };

  const handleFinishGuest = async () => {
    setIsSeeding(true);
    try {
      await seedSampleDeck();
      await completeWelcome(selectedTrack, selectedFormats, selectedGoal, true);
      router.replace('/(tabs)');
    } catch (err) {
      console.error('Failed to complete guest welcome:', err);
      router.replace('/(tabs)');
    } finally {
      setIsSeeding(false);
    }
  };

  const handleFinishGoogle = async () => {
    try {
      await completeWelcome(selectedTrack, selectedFormats, selectedGoal, false);
      router.replace('/(tabs)');
    } catch (err) {
      console.error('Failed to complete google welcome:', err);
      router.replace('/(tabs)');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* 5-Step Progress Bar Indicator with Smooth Layout Animation */}
      <View style={styles.progressContainer}>
        {[1, 2, 3, 4, 5].map((i) => (
          <View
            key={i}
            style={[
              styles.progressDot,
              step === i && styles.progressDotActive,
              step > i && styles.progressDotCompleted,
            ]}
          />
        ))}
      </View>

      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View
          style={[
            styles.animatedStepWrapper,
            {
              opacity: fadeAnim,
              transform: [
                { translateX: slideAnim },
                { scale: scaleAnim },
              ],
            },
          ]}
        >
          {/* STEP 1: VALUE HOOK & MOMO GREETING */}
          {step === 1 && (
            <View style={styles.stepContainer}>
              <View style={styles.mascotWrapper}>
                <Image
                  source={require('@/assets/animations/welcome_momo.png')}
                  style={styles.welcomeMomoImage}
                  resizeMode="contain"
                />
                <View style={styles.mascotTag}>
                  <HugeiconsIcon icon={SparklesIcon} size={14} color="#B45309" strokeWidth={2.5} />
                  <Text style={styles.mascotTagText}>Your Study Buddy Momo</Text>
                </View>
              </View>

              <Text style={styles.welcomeHeading}>Hey! I'm Momo, Let's Lock In!</Text>
              <Text style={styles.welcomeSub}>
                Drop your lecture slides, PDFs, or class notes here! I'll whip up fun flashcards and quizzes based strictly on what's in your files — zero made-up stuff.
              </Text>

              {/* Benefit Bullets */}
              <View style={styles.benefitBox}>
                <View style={styles.benefitItem}>
                  <View style={styles.benefitIconCircle}>
                    <HugeiconsIcon icon={CheckmarkCircle02Icon} size={16} color={colors.primary} strokeWidth={2.5} />
                  </View>
                  <View style={styles.benefitTextWrap}>
                    <Text style={styles.benefitTitle}>100% From Your Notes</Text>
                    <Text style={styles.benefitDesc}>Every question points right to the page in your file so you can double check anytime.</Text>
                  </View>
                </View>

                <View style={styles.benefitItem}>
                  <View style={[styles.benefitIconCircle, { backgroundColor: colors.warningSoft }]}>
                    <HugeiconsIcon icon={TrophyIcon} size={16} color={colors.warningAccent} strokeWidth={2.5} />
                  </View>
                  <View style={styles.benefitTextWrap}>
                    <Text style={styles.benefitTitle}>Earn XP & Keep Streaks</Text>
                    <Text style={styles.benefitDesc}>Every right answer scores you XP! Build streaks, unlock badges, and stay motivated.</Text>
                  </View>
                </View>

                <View style={styles.benefitItem}>
                  <View style={[styles.benefitIconCircle, { backgroundColor: colors.successSoft }]}>
                    <HugeiconsIcon icon={FlashIcon} size={16} color={colors.success} strokeWidth={2.5} />
                  </View>
                  <View style={styles.benefitTextWrap}>
                    <Text style={styles.benefitTitle}>Study Anywhere Offline</Text>
                    <Text style={styles.benefitDesc}>No internet on the bus? No problem! Your study decks stay right on your phone.</Text>
                  </View>
                </View>
              </View>

              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => goToStep(2, 'forward')}
                accessibilityRole="button"
                accessibilityLabel="Let's Cook My Plan, continue to personalize study"
              >
                <Text style={styles.primaryButtonText}>Let's Cook My Plan!</Text>
                <HugeiconsIcon icon={ArrowRight01Icon} size={18} color={colors.onPrimary} strokeWidth={2.5} />
              </TouchableOpacity>
            </View>
          )}

          {/* STEP 2: WHAT ARE YOU PREPPING FOR? */}
          {step === 2 && (
            <View style={styles.stepContainer}>
              <View style={styles.stepHeaderRow}>
                <TouchableOpacity
                  onPress={() => goToStep(1, 'backward')}
                  style={styles.backButton}
                  accessibilityRole="button"
                  accessibilityLabel="Go back to welcome screen"
                >
                  <HugeiconsIcon icon={ArrowLeft01Icon} size={20} color={colors.icon} strokeWidth={2} />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                  <Text style={styles.stepTitle}>What are you prepping for?</Text>
                  <Text style={styles.stepSub}>Momo tailors questions to match your exact level</Text>
                </View>
              </View>

              {/* Track Option Cards */}
              <View style={styles.trackList}>
                {TRACK_OPTIONS.map((t) => {
                  const isSelected = selectedTrack === t.id;
                  return (
                    <TouchableOpacity
                      key={t.id}
                      style={[styles.trackCard, isSelected && styles.trackCardSelected]}
                      onPress={() => setSelectedTrack(t.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`${t.label}, ${t.desc}`}
                      accessibilityState={{ selected: isSelected }}
                    >
                      <View style={[styles.trackIconCircle, isSelected && styles.trackIconCircleSelected]}>
                        <Text style={styles.trackIconEmoji}>{t.iconText}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.trackCardTitle, isSelected && styles.trackCardTitleSelected]}>
                          {t.label}
                        </Text>
                        <Text style={styles.trackCardDesc}>{t.desc}</Text>
                      </View>
                      <View style={[styles.radioCircle, isSelected && styles.radioCircleSelected]}>
                        {isSelected && <View style={styles.radioInner} />}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                style={[styles.primaryButton, { marginTop: spacing[20] }]}
                onPress={() => goToStep(3, 'forward')}
                accessibilityRole="button"
                accessibilityLabel="Continue to study formats"
              >
                <Text style={styles.primaryButtonText}>Continue</Text>
                <HugeiconsIcon icon={ArrowRight01Icon} size={18} color={colors.onPrimary} strokeWidth={2.5} />
              </TouchableOpacity>
            </View>
          )}

          {/* STEP 3: HOW DO YOU LIKE TO STUDY? (MULTIPLE SELECT + ALL OPTION) */}
          {step === 3 && (
            <View style={styles.stepContainer}>
              <View style={styles.stepHeaderRow}>
                <TouchableOpacity
                  onPress={() => goToStep(2, 'backward')}
                  style={styles.backButton}
                  accessibilityRole="button"
                  accessibilityLabel="Go back to track selection"
                >
                  <HugeiconsIcon icon={ArrowLeft01Icon} size={20} color={colors.icon} strokeWidth={2} />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                  <Text style={styles.stepTitle}>How do you like to study?</Text>
                  <Text style={styles.stepSub}>Pick any or all formats — customize your experience</Text>
                </View>
              </View>

              {/* Format Option Cards (Multiple Select with All) */}
              <View style={styles.formatList}>
                {FORMAT_OPTIONS.map((f) => {
                  const isSelected = selectedFormats.includes(f.id);
                  return (
                    <TouchableOpacity
                      key={f.id}
                      style={[
                        styles.formatCard,
                        isSelected && styles.formatCardSelected,
                        f.isAll && styles.formatCardAll,
                        f.isAll && isSelected && styles.formatCardAllSelected,
                      ]}
                      onPress={() => handleToggleFormat(f.id)}
                      accessibilityRole="checkbox"
                      accessibilityLabel={`${f.label}, ${f.desc}`}
                      accessibilityState={{ checked: isSelected }}
                    >
                      <View style={[styles.trackIconCircle, isSelected && styles.trackIconCircleSelected]}>
                        <Text style={styles.trackIconEmoji}>{f.iconText}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={styles.formatHeaderRow}>
                          <Text style={[styles.formatTitle, isSelected && styles.formatTitleSelected]}>
                            {f.label}
                          </Text>
                          {f.isAll && (
                            <View style={styles.allTagBadge}>
                              <Text style={styles.allTagBadgeText}>Momo's Pick</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.formatDesc}>{f.desc}</Text>
                      </View>
                      <View
                        style={[
                          styles.checkboxSquare,
                          isSelected && styles.checkboxSquareSelected,
                        ]}
                      />
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Selection Summary Pill */}
              <View style={styles.selectionCountWrap}>
                <Text style={styles.selectionCountText}>
                  {selectedFormats.includes('all')
                    ? '✨ All formats active! Momo will create every type of reviewer.'
                    : `${selectedFormats.filter((f) => f !== 'all').length} format${
                        selectedFormats.filter((f) => f !== 'all').length > 1 ? 's' : ''
                      } selected`}
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.primaryButton, { marginTop: spacing[16] }]}
                onPress={() => goToStep(4, 'forward')}
                accessibilityRole="button"
                accessibilityLabel="Continue to daily study goal"
              >
                <Text style={styles.primaryButtonText}>Continue</Text>
                <HugeiconsIcon icon={ArrowRight01Icon} size={18} color={colors.onPrimary} strokeWidth={2.5} />
              </TouchableOpacity>
            </View>
          )}

          {/* STEP 4: HOW MUCH TIME CAN WE STUDY TOGETHER EACH DAY? */}
          {step === 4 && (
            <View style={styles.stepContainer}>
              <View style={styles.stepHeaderRow}>
                <TouchableOpacity
                  onPress={() => goToStep(3, 'backward')}
                  style={styles.backButton}
                  accessibilityRole="button"
                  accessibilityLabel="Go back to study format"
                >
                  <HugeiconsIcon icon={ArrowLeft01Icon} size={20} color={colors.icon} strokeWidth={2} />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                  <Text style={styles.stepTitle}>How much time each day?</Text>
                  <Text style={styles.stepSub}>Set an easy goal. You can change this anytime!</Text>
                </View>
              </View>

              {/* Goal Option Cards */}
              <View style={styles.goalVerticalList}>
                {GOAL_OPTIONS.map((g) => {
                  const isSelected = selectedGoal === g.minutes;
                  return (
                    <TouchableOpacity
                      key={g.minutes}
                      style={[styles.goalFullCard, isSelected && styles.goalFullCardSelected]}
                      onPress={() => setSelectedGoal(g.minutes)}
                      accessibilityRole="button"
                      accessibilityLabel={`${g.label}, ${g.tag}, ${g.desc}`}
                      accessibilityState={{ selected: isSelected }}
                    >
                      <View style={{ flex: 1 }}>
                        <View style={styles.goalTitleRow}>
                          <Text style={[styles.goalFullLabel, isSelected && styles.goalFullLabelSelected]}>
                            {g.label}
                          </Text>
                          <View style={[styles.goalTagBadge, isSelected && styles.goalTagBadgeSelected]}>
                            <Text style={[styles.goalTagBadgeText, isSelected && styles.goalTagBadgeTextSelected]}>
                              {g.tag}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.goalFullDesc}>{g.desc}</Text>
                      </View>
                      <View style={[styles.radioCircle, isSelected && styles.radioCircleSelected]}>
                        {isSelected && <View style={styles.radioInner} />}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Encouragement Momo Tip Box */}
              <View style={styles.momoTipBox}>
                <View style={styles.momoTipIconWrap}>
                  <HugeiconsIcon icon={SparklesIcon} size={18} color="#B45309" strokeWidth={2.5} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.momoTipTitle}>Momo's Study Secret</Text>
                  <Text style={styles.momoTipDesc}>
                    Just 10 to 20 minutes a day creates unbreakable recall without burnout. Plus, staying consistent unlocks bonus streak XP!
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.primaryButton, { marginTop: spacing[20] }]}
                onPress={() => goToStep(5, 'forward')}
                accessibilityRole="button"
                accessibilityLabel="Next, choose launch mode"
              >
                <Text style={styles.primaryButtonText}>Next: Let's Jump In!</Text>
                <HugeiconsIcon icon={ArrowRight01Icon} size={18} color={colors.onPrimary} strokeWidth={2.5} />
              </TouchableOpacity>
            </View>
          )}

          {/* STEP 5: LAUNCH GUEST VS GOOGLE (OPTION A) */}
          {step === 5 && (
            <View style={styles.stepContainer}>
              <View style={styles.stepHeaderRow}>
                <TouchableOpacity
                  onPress={() => goToStep(4, 'backward')}
                  style={styles.backButton}
                  accessibilityRole="button"
                  accessibilityLabel="Go back to daily goal"
                >
                  <HugeiconsIcon icon={ArrowLeft01Icon} size={20} color={colors.icon} strokeWidth={2} />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                  <Text style={styles.stepTitle}>We're Ready to Roll!</Text>
                  <Text style={styles.stepSub}>Pick how you'd like to begin</Text>
                </View>
              </View>

              {/* Option A Highlight: Instant Sample Deck */}
              <View style={styles.launchCardHighlighted}>
                <View style={styles.launchBadge}>
                  <HugeiconsIcon icon={SparklesIcon} size={12} color={colors.primary} strokeWidth={2.5} />
                  <Text style={styles.launchBadgeText}>Instant Taste • No Sign-Up Needed</Text>
                </View>
                <Text style={styles.launchCardTitle}>Try a Fresh Sample Deck</Text>
                <Text style={styles.launchCardDesc}>
                  Take Momo for a quick spin with Biology 101! Flip flashcards and answer quiz questions right away — no signup or uploads needed.
                </Text>
                <TouchableOpacity
                  style={styles.sampleActionButton}
                  onPress={handleFinishGuest}
                  disabled={isSeeding}
                  accessibilityRole="button"
                  accessibilityLabel="Start sample deck without signing up"
                >
                  <HugeiconsIcon icon={BookOpen01Icon} size={18} color={colors.onPrimary} strokeWidth={2.5} />
                  <Text style={styles.sampleActionText}>
                    {isSeeding ? 'Whipping up deck...' : 'Start Sample Deck'}
                  </Text>
                  <HugeiconsIcon icon={ArrowRight01Icon} size={16} color={colors.onPrimary} strokeWidth={2.5} />
                </TouchableOpacity>
              </View>

              <View style={styles.orDivider}>
                <View style={styles.dividerLine} />
                <Text style={styles.orText}>OR</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* Option B: Google Sign-In */}
              <View style={styles.launchCardGoogle}>
                <Text style={styles.googleCardTitle}>Sign In with Google</Text>
                <Text style={styles.googleCardDesc}>
                  Save your streaks, upload your own class notes, and cook up to 10 fresh reviewers with Momo every month!
                </Text>
                <TouchableOpacity
                  style={styles.googleButton}
                  onPress={handleFinishGoogle}
                  accessibilityRole="button"
                  accessibilityLabel="Continue with Google sign in"
                >
                  <Text style={styles.googleIconPlaceholder}>G</Text>
                  <Text style={styles.googleButtonText}>Continue with Google</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing[12],
    gap: 8,
  },
  progressDot: {
    width: 20,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
  },
  progressDotActive: {
    backgroundColor: colors.primary,
    width: 32,
  },
  progressDotCompleted: {
    backgroundColor: colors.primaryBorder,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing[20],
    paddingTop: spacing[8],
    paddingBottom: spacing[24],
  },
  animatedStepWrapper: {
    width: '100%',
    justifyContent: 'center',
  },
  stepContainer: {
    width: '100%',
    justifyContent: 'center',
    paddingVertical: spacing[4],
  },
  mascotWrapper: {
    alignItems: 'center',
    marginBottom: spacing[12],
  },
  welcomeMomoImage: {
    width: 170,
    height: 170,
  },
  mascotTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[12],
    borderRadius: 20,
    borderCurve: 'continuous',
    gap: 4,
    marginTop: -spacing[8],
  },
  mascotTagText: {
    fontSize: typography.fontSize[11],
    fontWeight: typography.fontWeight.bold,
    color: '#92400E',
  },
  welcomeHeading: {
    fontSize: typography.fontSize[24],
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing[8],
  },
  welcomeSub: {
    fontSize: typography.fontSize[13.5],
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing[20],
    paddingHorizontal: spacing[8],
  },
  benefitBox: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderCurve: 'continuous',
    padding: spacing[16],
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing[24],
    gap: spacing[14],
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  benefitIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitTextWrap: {
    flex: 1,
  },
  benefitTitle: {
    fontSize: typography.fontSize[13],
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
    marginBottom: 2,
  },
  benefitDesc: {
    fontSize: typography.fontSize[11.5],
    color: colors.textSecondary,
    lineHeight: 16,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: spacing[14],
    paddingHorizontal: spacing[20],
    borderRadius: 16,
    borderCurve: 'continuous',
    gap: 8,
    boxShadow: '0 4px 10px rgba(99, 102, 241, 0.25)',
  },
  primaryButtonText: {
    fontSize: typography.fontSize[14],
    fontWeight: typography.fontWeight.bold,
    color: colors.onPrimary,
  },
  stepHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[16],
    gap: 12,
  },
  backButton: {
    padding: spacing[6],
    borderRadius: 10,
    borderCurve: 'continuous',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stepTitle: {
    fontSize: typography.fontSize[20],
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
  },
  stepSub: {
    fontSize: typography.fontSize[12.5],
    color: colors.textSecondary,
  },
  trackList: {
    gap: 10,
  },
  trackCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    borderCurve: 'continuous',
    padding: spacing[12],
    gap: 12,
  },
  trackCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
    boxShadow: '0 2px 8px rgba(99, 102, 241, 0.12)',
  },
  trackIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackIconCircleSelected: {
    backgroundColor: '#FFFFFF',
  },
  trackIconEmoji: {
    fontSize: 18,
  },
  trackCardTitle: {
    fontSize: typography.fontSize[13.5],
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
    marginBottom: 2,
  },
  trackCardTitleSelected: {
    color: colors.primary,
  },
  trackCardDesc: {
    fontSize: typography.fontSize[11],
    color: colors.textSecondary,
  },
  formatList: {
    gap: 10,
  },
  formatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    borderCurve: 'continuous',
    padding: spacing[13],
    gap: 12,
  },
  formatCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
    boxShadow: '0 2px 8px rgba(99, 102, 241, 0.12)',
  },
  formatCardAll: {
    borderWidth: 1.5,
    borderColor: '#C7D2FE',
    backgroundColor: '#FAF5FF',
  },
  formatCardAllSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  formatHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  formatTitle: {
    fontSize: typography.fontSize[13.5],
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
  },
  formatTitleSelected: {
    color: colors.primary,
  },
  formatDesc: {
    fontSize: typography.fontSize[11],
    color: colors.textSecondary,
    lineHeight: 15,
  },
  allTagBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  allTagBadgeText: {
    fontSize: typography.fontSize[10],
    fontWeight: typography.fontWeight.bold,
    color: '#92400E',
  },
  checkboxSquare: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderCurve: 'continuous',
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  checkboxSquareSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  selectionCountWrap: {
    alignItems: 'center',
    paddingVertical: spacing[6],
    marginTop: spacing[4],
  },
  selectionCountText: {
    fontSize: typography.fontSize[12],
    color: colors.primary,
    fontWeight: typography.fontWeight.semiBold,
    textAlign: 'center',
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleSelected: {
    borderColor: colors.primary,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  goalVerticalList: {
    gap: 10,
  },
  goalFullCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    borderCurve: 'continuous',
    padding: spacing[14],
    gap: 12,
  },
  goalFullCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
    boxShadow: '0 2px 8px rgba(99, 102, 241, 0.12)',
  },
  goalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  goalFullLabel: {
    fontSize: typography.fontSize[14],
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  goalFullLabelSelected: {
    color: colors.primary,
  },
  goalTagBadge: {
    backgroundColor: colors.background,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderCurve: 'continuous',
  },
  goalTagBadgeSelected: {
    backgroundColor: colors.primary,
  },
  goalTagBadgeText: {
    fontSize: typography.fontSize[10.5],
    fontWeight: typography.fontWeight.bold,
    color: colors.textSecondary,
  },
  goalTagBadgeTextSelected: {
    color: colors.onPrimary,
  },
  goalFullDesc: {
    fontSize: typography.fontSize[11.5],
    color: colors.textSecondary,
  },
  momoTipBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 16,
    borderCurve: 'continuous',
    padding: spacing[14],
    marginTop: spacing[16],
    gap: 10,
  },
  momoTipIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FDE68A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  momoTipTitle: {
    fontSize: typography.fontSize[12.5],
    fontWeight: typography.fontWeight.bold,
    color: '#92400E',
    marginBottom: 2,
  },
  momoTipDesc: {
    fontSize: typography.fontSize[11.5],
    color: '#78350F',
    lineHeight: 16,
  },
  launchCardHighlighted: {
    backgroundColor: '#EEF2FF',
    borderRadius: 20,
    borderCurve: 'continuous',
    padding: spacing[16],
    borderWidth: 1.5,
    borderColor: '#C7D2FE',
    marginBottom: spacing[16],
  },
  launchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderCurve: 'continuous',
    gap: 4,
    marginBottom: spacing[8],
  },
  launchBadgeText: {
    fontSize: typography.fontSize[10.5],
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
  },
  launchCardTitle: {
    fontSize: typography.fontSize[17],
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
    marginBottom: 4,
  },
  launchCardDesc: {
    fontSize: typography.fontSize[12.5],
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: spacing[14],
  },
  sampleActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: spacing[12],
    borderRadius: 12,
    borderCurve: 'continuous',
    gap: 8,
  },
  sampleActionText: {
    fontSize: typography.fontSize[13],
    fontWeight: typography.fontWeight.bold,
    color: colors.onPrimary,
  },
  orDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing[14],
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  orText: {
    fontSize: typography.fontSize[11],
    fontWeight: typography.fontWeight.bold,
    color: colors.textMuted,
  },
  launchCardGoogle: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderCurve: 'continuous',
    padding: spacing[16],
    borderWidth: 1,
    borderColor: colors.border,
  },
  googleCardTitle: {
    fontSize: typography.fontSize[15],
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
    marginBottom: 4,
  },
  googleCardDesc: {
    fontSize: typography.fontSize[12],
    color: colors.textSecondary,
    lineHeight: 17,
    marginBottom: spacing[14],
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    paddingVertical: spacing[11],
    borderRadius: 12,
    borderCurve: 'continuous',
    gap: 10,
  },
  googleIconPlaceholder: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4285F4',
  },
  googleButtonText: {
    fontSize: typography.fontSize[13],
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
  },
});
