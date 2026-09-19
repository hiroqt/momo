import React, { useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  TextInput,
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
  Tick01Icon,
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
  { id: 'high_school', label: 'High School', iconText: '📚', desc: 'AP, IB & general classes' },
  { id: 'med_nursing', label: 'Medicine & Nursing', iconText: '🩺', desc: 'Anatomy, pharma & board prep' },
  { id: 'stem', label: 'STEM & Engineering', iconText: '💻', desc: 'Formulas, problem sets & code' },
  { id: 'boards', label: 'Board & Licensure Exams', iconText: '⚖️', desc: 'High-stakes practice drills' },
  { id: 'general', label: 'General Learning', iconText: '🧠', desc: 'Curiosity & personal growth' },
];

const HIGH_SCHOOL_GRADES = [
  { id: 'Grade 7', label: 'Grade 7' },
  { id: 'Grade 8', label: 'Grade 8' },
  { id: 'Grade 9', label: 'Grade 9 (Freshman)' },
  { id: 'Grade 10', label: 'Grade 10 (Sophomore)' },
  { id: 'Grade 11', label: 'Grade 11 (Junior)' },
  { id: 'Grade 12', label: 'Grade 12 (Senior)' },
];

const COLLEGE_YEARS = [
  { id: '1st Year', label: '1st Year (Freshman)' },
  { id: '2nd Year', label: '2nd Year (Sophomore)' },
  { id: '3rd Year', label: '3rd Year (Junior)' },
  { id: '4th Year', label: '4th Year (Senior)' },
  { id: '5th+ Year / Grad', label: '5th+ Year / Grad' },
];

const POPULAR_MAJORS = [
  'Nursing',
  'Computer Science',
  'Accountancy',
  'Psychology',
  'Engineering',
  'Biology',
  'Business',
];

const POPULAR_BOARD_EXAMS = [
  'NCLEX-RN',
  'CPA Board',
  'Bar Exam',
  'Civil Service',
  'Medical Board (PLE)',
  'LET (Teachers)',
];

const POPULAR_GENERAL_TOPICS = [
  'Tech & Coding',
  'Business & Finance',
  'Language Learning',
  'Science & Health',
  'Self-Improvement',
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

// Age wheel options starting from 13 to 80
const AGE_ITEM_HEIGHT = 46;
const AGE_OPTIONS = Array.from({ length: 68 }, (_, i) => 13 + i);

export default function WelcomeScreen() {
  const router = useRouter();
  const { completeWelcome } = useOnboarding();

  // 8 Distinct Sequential Steps:
  // 1: Welcome Hook -> 2: Name Input -> 3: Age Input Wheel -> 4: Prepping For -> 5: Academic Stage & Program -> 6: Study Formats -> 7: Daily Goal & Reminders Gate -> 8: Launch Mode
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5 | 6 | 7 | 8>(1);

  // Profile fields (Step 2: Name, Step 3: Age)
  const [firstName, setFirstName] = useState<string>('');
  const [lastName, setLastName] = useState<string>('');
  const [selectedAge, setSelectedAge] = useState<number>(13);

  // Academic calibration (Step 4)
  const [selectedTrack, setSelectedTrack] = useState<StudyTrack>('college');
  const [highSchoolGrade, setHighSchoolGrade] = useState<string>('Grade 9');
  const [collegeYear, setCollegeYear] = useState<string>('1st Year');
  const [collegeCourse, setCollegeCourse] = useState<string>('');

  // Formats (Step 5)
  const [selectedFormats, setSelectedFormats] = useState<PreferredFormat[]>([
    'all',
    'flashcards',
    'quiz',
    'exam',
    'summary',
  ]);

  // Goal & Reminders (Step 6)
  const [selectedGoal, setSelectedGoal] = useState<number>(20);
  const [studyRemindersEnabled, setStudyRemindersEnabled] = useState<boolean>(false);

  // Loading indicator for sample deck
  const [isSeeding, setIsSeeding] = useState<boolean>(false);

  // Animation values
  const isTransitioning = useRef(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const scrollViewRef = useRef<ScrollView>(null);
  const ageWheelRef = useRef<ScrollView>(null);

  const goToStep = (nextStep: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8, direction: 'forward' | 'backward' = 'forward') => {
    if (isTransitioning.current) return;
    isTransitioning.current = true;

    const exitOffset = direction === 'forward' ? -30 : 30;
    const enterOffset = direction === 'forward' ? 30 : -30;

    // Phase 1: Fluid decelerate exit
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 140,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: exitOffset,
        duration: 140,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.97,
        duration: 140,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setStep(nextStep);
      scrollViewRef.current?.scrollTo({ y: 0, animated: false });
      slideAnim.setValue(enterOffset);
      scaleAnim.setValue(0.97);

      // Phase 2: Natural spring-like ease-out entrance
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(() => {
        fadeAnim.setValue(1);
        slideAnim.setValue(0);
        scaleAnim.setValue(1);
        isTransitioning.current = false;
      });
    });

    // iOS Safety watchdog: guarantee that the UI never remains at opacity 0
    setTimeout(() => {
      if (isTransitioning.current) {
        fadeAnim.setValue(1);
        slideAnim.setValue(0);
        scaleAnim.setValue(1);
        isTransitioning.current = false;
      }
    }, 450);
  };

  const handleToggleFormat = (id: PreferredFormat | 'all') => {
    if (id === 'all') {
      const isAllSelected = selectedFormats.includes('all');
      if (isAllSelected) {
        setSelectedFormats(['flashcards']);
      } else {
        setSelectedFormats(['all', 'flashcards', 'quiz', 'exam', 'summary']);
      }
      return;
    }

    const isSelected = selectedFormats.includes(id);
    if (isSelected) {
      const remaining = selectedFormats.filter((f) => f !== id && f !== 'all');
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

  const buildProfilePayload = () => ({
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    age: selectedAge,
    highSchoolGrade: selectedTrack === 'high_school' ? highSchoolGrade : null,
    collegeYear: ['college', 'med_nursing', 'stem'].includes(selectedTrack) ? collegeYear : null,
    collegeCourse: ['college', 'med_nursing', 'stem', 'boards', 'general'].includes(selectedTrack)
      ? collegeCourse.trim() || null
      : null,
    studyRemindersEnabled,
  });

  const handleFinishGuest = async () => {
    setIsSeeding(true);
    try {
      await seedSampleDeck();
      await completeWelcome(selectedTrack, selectedFormats, selectedGoal, true, buildProfilePayload());
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
      await completeWelcome(selectedTrack, selectedFormats, selectedGoal, false, buildProfilePayload());
      router.replace('/(tabs)');
    } catch (err) {
      console.error('Failed to complete google welcome:', err);
      router.replace('/(tabs)');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Header: Progress Bar Indicator + Direct Skip */}
      <View style={styles.topHeader}>
        <View style={styles.progressContainer}>
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
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
        <TouchableOpacity
          onPress={handleFinishGuest}
          style={styles.headerSkipBtn}
          accessibilityRole="button"
          accessibilityLabel="Skip setup and jump to dashboard"
          activeOpacity={0.7}
        >
          <Text style={styles.headerSkipText}>Skip</Text>
        </TouchableOpacity>
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
                accessibilityLabel="Let's Cook My Plan, continue to enter your name"
              >
                <Text style={styles.primaryButtonText}>Let's Cook My Plan!</Text>
                <HugeiconsIcon icon={ArrowRight01Icon} size={18} color={colors.onPrimary} strokeWidth={2.5} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.skipSecondaryButton}
                onPress={handleFinishGuest}
                accessibilityRole="button"
                accessibilityLabel="Skip setup, jump directly to Dashboard"
                activeOpacity={0.7}
              >
                <Text style={styles.skipSecondaryButtonText}>Skip setup, jump to Dashboard</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* STEP 2: NAME INPUT ONLY (SEPARATE SCREEN) */}
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
                  <Text style={styles.stepTitle}>What's your name?</Text>
                  <Text style={styles.stepSub}>Momo wants to know who we're locking in with!</Text>
                </View>
              </View>

              <View style={styles.formCard}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>First Name *</Text>
                  <TextInput
                    style={styles.textInput}
                    value={firstName}
                    onChangeText={setFirstName}
                    placeholder="e.g. Alex"
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="words"
                    autoCorrect={false}
                    returnKeyType="next"
                  />
                </View>

                <View style={[styles.inputGroup, { marginTop: spacing[14] }]}>
                  <Text style={styles.inputLabel}>Last Name (Optional)</Text>
                  <TextInput
                    style={styles.textInput}
                    value={lastName}
                    onChangeText={setLastName}
                    placeholder="e.g. Rivera"
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="words"
                    autoCorrect={false}
                    returnKeyType="done"
                  />
                </View>

                <Text style={styles.formHint}>
                  We only use your name to cheer you on and celebrate your study streaks!
                </Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  firstName.trim().length === 0 && styles.primaryButtonDisabled,
                  { marginTop: spacing[20] },
                ]}
                onPress={() => {
                  if (firstName.trim().length > 0) {
                    goToStep(3, 'forward');
                  }
                }}
                disabled={firstName.trim().length === 0}
                accessibilityRole="button"
                accessibilityLabel="Continue to age selection"
              >
                <Text
                  style={[
                    styles.primaryButtonText,
                    firstName.trim().length === 0 && styles.primaryButtonTextDisabled,
                  ]}
                >
                  {firstName.trim().length === 0 ? 'Enter First Name to Continue' : 'Continue'}
                </Text>
                <HugeiconsIcon
                  icon={ArrowRight01Icon}
                  size={18}
                  color={firstName.trim().length === 0 ? colors.textMuted : colors.onPrimary}
                  strokeWidth={2.5}
                />
              </TouchableOpacity>
            </View>
          )}

          {/* STEP 3: AGE INPUT WHEEL ONLY (SEPARATE SCREEN) */}
          {step === 3 && (
            <View style={styles.stepContainer}>
              <View style={styles.stepHeaderRow}>
                <TouchableOpacity
                  onPress={() => goToStep(2, 'backward')}
                  style={styles.backButton}
                  accessibilityRole="button"
                  accessibilityLabel="Go back to name input"
                >
                  <HugeiconsIcon icon={ArrowLeft01Icon} size={20} color={colors.icon} strokeWidth={2} />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                  <Text style={styles.stepTitle}>How old are you?</Text>
                  <Text style={styles.stepSub}>Momo calibrates study tone and pacing to your age</Text>
                </View>
              </View>

              {/* Centered Age Scroll Wheel Card */}
              <View style={styles.ageOnlyCard}>
                <View style={styles.ageHeaderRow}>
                  <Text style={styles.ageCardHeading}>Select Your Age</Text>
                  <View style={styles.ageDefaultBadge}>
                    <Text style={styles.ageDefaultBadgeText}>13 and above</Text>
                  </View>
                </View>
                <Text style={styles.agePromptText}>Scroll the wheel to pick your age:</Text>

                <View style={styles.wheelContainer}>
                  {/* Highlighted Selection Band */}
                  <View style={styles.wheelSelectionBand} pointerEvents="none">
                    <Text style={styles.wheelSelectionSuffix}>years old</Text>
                  </View>

                  <ScrollView
                    ref={ageWheelRef}
                    showsVerticalScrollIndicator={false}
                    snapToInterval={AGE_ITEM_HEIGHT}
                    decelerationRate="fast"
                    contentContainerStyle={{ paddingVertical: AGE_ITEM_HEIGHT }}
                    onMomentumScrollEnd={(e) => {
                      const offsetY = e.nativeEvent.contentOffset.y;
                      const index = Math.round(offsetY / AGE_ITEM_HEIGHT);
                      const clamped = Math.max(0, Math.min(AGE_OPTIONS.length - 1, index));
                      setSelectedAge(AGE_OPTIONS[clamped] ?? 13);
                    }}
                    onScrollEndDrag={(e) => {
                      const offsetY = e.nativeEvent.contentOffset.y;
                      const index = Math.round(offsetY / AGE_ITEM_HEIGHT);
                      const clamped = Math.max(0, Math.min(AGE_OPTIONS.length - 1, index));
                      setSelectedAge(AGE_OPTIONS[clamped] ?? 13);
                    }}
                    scrollEventThrottle={16}
                  >
                    {AGE_OPTIONS.map((ageVal, idx) => {
                      const isSelected = selectedAge === ageVal;
                      return (
                        <TouchableOpacity
                          key={ageVal}
                          style={styles.wheelItem}
                          onPress={() => {
                            setSelectedAge(ageVal);
                            ageWheelRef.current?.scrollTo({ y: idx * AGE_ITEM_HEIGHT, animated: true });
                          }}
                          activeOpacity={0.7}
                        >
                          <Text
                            style={[
                              styles.wheelItemText,
                              isSelected && styles.wheelItemTextSelected,
                            ]}
                          >
                            {ageVal}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>

                <Text style={styles.ageFootnote}>
                  Default is 13+ • You can adjust your age anytime in your profile.
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.primaryButton, { marginTop: spacing[20] }]}
                onPress={() => goToStep(4, 'forward')}
                accessibilityRole="button"
                accessibilityLabel="Continue to study track"
              >
                <Text style={styles.primaryButtonText}>Continue</Text>
                <HugeiconsIcon icon={ArrowRight01Icon} size={18} color={colors.onPrimary} strokeWidth={2.5} />
              </TouchableOpacity>
            </View>
          )}

          {/* STEP 4: WHAT ARE YOU PREPPING FOR? (TRACK SELECTION ONLY) */}
          {step === 4 && (
            <View style={styles.stepContainer}>
              <View style={styles.stepHeaderRow}>
                <TouchableOpacity
                  onPress={() => goToStep(3, 'backward')}
                  style={styles.backButton}
                  accessibilityRole="button"
                  accessibilityLabel="Go back to age selection"
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
                onPress={() => goToStep(5, 'forward')}
                accessibilityRole="button"
                accessibilityLabel="Continue to academic details"
              >
                <Text style={styles.primaryButtonText}>Continue</Text>
                <HugeiconsIcon icon={ArrowRight01Icon} size={18} color={colors.onPrimary} strokeWidth={2.5} />
              </TouchableOpacity>
            </View>
          )}

          {/* STEP 5: ACADEMIC STAGE & PROGRAM (DEDICATED SEPARATE SCREEN) */}
          {step === 5 && (
            <View style={styles.stepContainer}>
              <View style={styles.stepHeaderRow}>
                <TouchableOpacity
                  onPress={() => goToStep(4, 'backward')}
                  style={styles.backButton}
                  accessibilityRole="button"
                  accessibilityLabel="Go back to track selection"
                >
                  <HugeiconsIcon icon={ArrowLeft01Icon} size={20} color={colors.icon} strokeWidth={2} />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                  <Text style={styles.stepTitle}>
                    {selectedTrack === 'high_school'
                      ? 'What grade are you in?'
                      : selectedTrack === 'boards'
                      ? 'Target Licensure Exam'
                      : selectedTrack === 'general'
                      ? 'What are you exploring?'
                      : 'College Year & Program'}
                  </Text>
                  <Text style={styles.stepSub}>
                    {selectedTrack === 'high_school'
                      ? 'Momo calibrates question difficulty for your grade level'
                      : selectedTrack === 'boards'
                      ? 'Tell Momo what board exam you are prepping to crush'
                      : selectedTrack === 'general'
                      ? 'Momo tailors content to fit your learning focus'
                      : "Tell Momo what stage you're in and what you study"}
                  </Text>
                </View>
              </View>

              {/* High School Grades View */}
              {selectedTrack === 'high_school' && (
                <View style={styles.formCard}>
                  <Text style={styles.subFieldLabel}>Select Your Current Grade</Text>
                  <View style={styles.gradeGrid}>
                    {HIGH_SCHOOL_GRADES.map((g) => {
                      const isGradeSelected = highSchoolGrade === g.id;
                      return (
                        <TouchableOpacity
                          key={g.id}
                          style={[styles.subChip, isGradeSelected && styles.subChipSelected]}
                          onPress={() => setHighSchoolGrade(g.id)}
                          accessibilityRole="button"
                          accessibilityLabel={g.label}
                        >
                          <Text style={[styles.subChipText, isGradeSelected && styles.subChipTextSelected]}>
                            {g.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <Text style={[styles.formHint, { marginTop: spacing[16] }]}>
                    We adapt vocabulary, depth, and pacing to match your high school syllabus!
                  </Text>
                </View>
              )}

              {/* College & University View (also Med/Nursing, STEM) */}
              {selectedTrack !== 'high_school' && selectedTrack !== 'boards' && selectedTrack !== 'general' && (
                <View style={styles.formCard}>
                  <Text style={styles.subFieldLabel}>College Year</Text>
                  <View style={styles.gradeGrid}>
                    {COLLEGE_YEARS.map((y) => {
                      const isYearSelected = collegeYear === y.id;
                      return (
                        <TouchableOpacity
                          key={y.id}
                          style={[styles.subChip, isYearSelected && styles.subChipSelected]}
                          onPress={() => setCollegeYear(y.id)}
                          accessibilityRole="button"
                          accessibilityLabel={y.label}
                        >
                          <Text style={[styles.subChipText, isYearSelected && styles.subChipTextSelected]}>
                            {y.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <View style={{ marginTop: spacing[16] }}>
                    <Text style={styles.subFieldLabel}>Course / Program of Study</Text>
                    <TextInput
                      style={styles.textInput}
                      value={collegeCourse}
                      onChangeText={setCollegeCourse}
                      placeholder="e.g. BS Nursing, Computer Science, Biology..."
                      placeholderTextColor={colors.textMuted}
                      autoCapitalize="words"
                      autoCorrect={false}
                    />
                  </View>

                  <Text style={[styles.inputLabel, { marginTop: spacing[12], marginBottom: spacing[6] }]}>
                    Popular Programs
                  </Text>
                  <View style={styles.majorSuggestionsRow}>
                    {POPULAR_MAJORS.map((m) => {
                      const isCourseMatch = collegeCourse === m;
                      return (
                        <TouchableOpacity
                          key={m}
                          style={[
                            styles.majorSuggestionChip,
                            isCourseMatch && styles.majorSuggestionChipActive,
                          ]}
                          onPress={() => setCollegeCourse(m)}
                          accessibilityRole="button"
                          accessibilityLabel={`Select major ${m}`}
                        >
                          <Text
                            style={[
                              styles.majorSuggestionText,
                              isCourseMatch && styles.majorSuggestionTextActive,
                            ]}
                          >
                            {m}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Board & Licensure View */}
              {selectedTrack === 'boards' && (
                <View style={styles.formCard}>
                  <Text style={styles.subFieldLabel}>Target Examination</Text>
                  <TextInput
                    style={styles.textInput}
                    value={collegeCourse}
                    onChangeText={setCollegeCourse}
                    placeholder="e.g. NCLEX, CPA Board, Bar Exam..."
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="words"
                    autoCorrect={false}
                  />

                  <Text style={[styles.inputLabel, { marginTop: spacing[12], marginBottom: spacing[6] }]}>
                    Popular Board Exams
                  </Text>
                  <View style={styles.majorSuggestionsRow}>
                    {POPULAR_BOARD_EXAMS.map((m) => {
                      const isMatch = collegeCourse === m;
                      return (
                        <TouchableOpacity
                          key={m}
                          style={[
                            styles.majorSuggestionChip,
                            isMatch && styles.majorSuggestionChipActive,
                          ]}
                          onPress={() => setCollegeCourse(m)}
                          accessibilityRole="button"
                          accessibilityLabel={`Select exam ${m}`}
                        >
                          <Text
                            style={[
                              styles.majorSuggestionText,
                              isMatch && styles.majorSuggestionTextActive,
                            ]}
                          >
                            {m}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* General Learning View */}
              {selectedTrack === 'general' && (
                <View style={styles.formCard}>
                  <Text style={styles.subFieldLabel}>Primary Topic or Subject</Text>
                  <TextInput
                    style={styles.textInput}
                    value={collegeCourse}
                    onChangeText={setCollegeCourse}
                    placeholder="e.g. Tech & Coding, Spanish, Finance..."
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="words"
                    autoCorrect={false}
                  />

                  <Text style={[styles.inputLabel, { marginTop: spacing[12], marginBottom: spacing[6] }]}>
                    Popular Fields
                  </Text>
                  <View style={styles.majorSuggestionsRow}>
                    {POPULAR_GENERAL_TOPICS.map((m) => {
                      const isMatch = collegeCourse === m;
                      return (
                        <TouchableOpacity
                          key={m}
                          style={[
                            styles.majorSuggestionChip,
                            isMatch && styles.majorSuggestionChipActive,
                          ]}
                          onPress={() => setCollegeCourse(m)}
                          accessibilityRole="button"
                          accessibilityLabel={`Select topic ${m}`}
                        >
                          <Text
                            style={[
                              styles.majorSuggestionText,
                              isMatch && styles.majorSuggestionTextActive,
                            ]}
                          >
                            {m}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              <TouchableOpacity
                style={[styles.primaryButton, { marginTop: spacing[20] }]}
                onPress={() => goToStep(6, 'forward')}
                accessibilityRole="button"
                accessibilityLabel="Continue to study formats"
              >
                <Text style={styles.primaryButtonText}>Continue</Text>
                <HugeiconsIcon icon={ArrowRight01Icon} size={18} color={colors.onPrimary} strokeWidth={2.5} />
              </TouchableOpacity>
            </View>
          )}

          {/* STEP 6: HOW DO YOU LIKE TO STUDY? (MULTIPLE SELECT + ALL OPTION) */}
          {step === 6 && (
            <View style={styles.stepContainer}>
              <View style={styles.stepHeaderRow}>
                <TouchableOpacity
                  onPress={() => goToStep(5, 'backward')}
                  style={styles.backButton}
                  accessibilityRole="button"
                  accessibilityLabel="Go back to academic details"
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
                      >
                        {isSelected && (
                          <HugeiconsIcon icon={Tick01Icon} size={13} color={colors.onPrimary} strokeWidth={3} />
                        )}
                      </View>
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
                onPress={() => goToStep(7, 'forward')}
                accessibilityRole="button"
                accessibilityLabel="Continue to daily study goal"
              >
                <Text style={styles.primaryButtonText}>Continue</Text>
                <HugeiconsIcon icon={ArrowRight01Icon} size={18} color={colors.onPrimary} strokeWidth={2.5} />
              </TouchableOpacity>
            </View>
          )}

          {/* STEP 7: DAILY GOAL & STUDY REMINDERS GATE */}
          {step === 7 && (
            <View style={styles.stepContainer}>
              <View style={styles.stepHeaderRow}>
                <TouchableOpacity
                  onPress={() => goToStep(6, 'backward')}
                  style={styles.backButton}
                  accessibilityRole="button"
                  accessibilityLabel="Go back to study format"
                >
                  <HugeiconsIcon icon={ArrowLeft01Icon} size={20} color={colors.icon} strokeWidth={2} />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                  <Text style={styles.stepTitle}>How much time each day?</Text>
                  <Text style={styles.stepSub}>Set an easy goal & enable reminders to build a habit</Text>
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

              {/* Study Reminders Checkbox (Required to Continue) */}
              <TouchableOpacity
                style={[
                  styles.reminderCard,
                  studyRemindersEnabled && styles.reminderCardActive,
                ]}
                onPress={() => setStudyRemindersEnabled(!studyRemindersEnabled)}
                activeOpacity={0.8}
                accessibilityRole="checkbox"
                accessibilityLabel="Enable daily study reminders"
                accessibilityState={{ checked: studyRemindersEnabled }}
              >
                <View
                  style={[
                    styles.checkboxSquare,
                    studyRemindersEnabled && styles.checkboxSquareSelected,
                  ]}
                >
                  {studyRemindersEnabled && (
                    <HugeiconsIcon icon={Tick01Icon} size={13} color={colors.onPrimary} strokeWidth={3} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.reminderHeaderRow}>
                    <Text style={styles.reminderTitle}>Daily Study Reminders</Text>
                    <View
                      style={[
                        styles.reminderStatusBadge,
                        studyRemindersEnabled && styles.reminderStatusBadgeActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.reminderStatusBadgeText,
                          studyRemindersEnabled && styles.reminderStatusBadgeTextActive,
                        ]}
                      >
                        {studyRemindersEnabled ? 'Enabled' : 'Required'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.reminderDesc}>
                    Send me daily study reminders from Momo so I keep my streak alive and stay locked in!
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Continue Button: Disabled if Study Reminders is not checked */}
              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  !studyRemindersEnabled && styles.primaryButtonDisabled,
                  { marginTop: spacing[16] },
                ]}
                onPress={() => {
                  if (studyRemindersEnabled) {
                    goToStep(8, 'forward');
                  }
                }}
                disabled={!studyRemindersEnabled}
                accessibilityRole="button"
                accessibilityLabel={
                  studyRemindersEnabled ? "Next: Let's Jump In!" : 'Check study reminders above to continue'
                }
              >
                <Text
                  style={[
                    styles.primaryButtonText,
                    !studyRemindersEnabled && styles.primaryButtonTextDisabled,
                  ]}
                >
                  {studyRemindersEnabled ? "Next: Let's Jump In!" : 'Check Reminders to Continue'}
                </Text>
                <HugeiconsIcon
                  icon={ArrowRight01Icon}
                  size={18}
                  color={studyRemindersEnabled ? colors.onPrimary : colors.textMuted}
                  strokeWidth={2.5}
                />
              </TouchableOpacity>
            </View>
          )}

          {/* STEP 8: LAUNCH GUEST VS GOOGLE (OPTION A) */}
          {step === 8 && (
            <View style={styles.stepContainer}>
              <View style={styles.stepHeaderRow}>
                <TouchableOpacity
                  onPress={() => goToStep(7, 'backward')}
                  style={styles.backButton}
                  accessibilityRole="button"
                  accessibilityLabel="Go back to daily goal"
                >
                  <HugeiconsIcon icon={ArrowLeft01Icon} size={20} color={colors.icon} strokeWidth={2} />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                  <Text style={styles.stepTitle}>
                    We're Ready to Roll{firstName ? `, ${firstName}` : ''}!
                  </Text>
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
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[20],
    paddingTop: spacing[6],
    paddingBottom: spacing[4],
  },
  headerSkipBtn: {
    paddingVertical: spacing[6],
    paddingHorizontal: spacing[10],
  },
  headerSkipText: {
    fontSize: typography.fontSize[13],
    fontWeight: typography.fontWeight.semiBold,
    color: colors.textMuted,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  progressDot: {
    width: 14,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
  },
  progressDotActive: {
    backgroundColor: colors.primary,
    width: 24,
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
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  primaryButtonDisabled: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    shadowOpacity: 0,
    elevation: 0,
  },
  skipSecondaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[12],
    marginTop: spacing[8],
  },
  skipSecondaryButtonText: {
    fontSize: typography.fontSize[13],
    fontWeight: typography.fontWeight.medium,
    color: colors.textSecondary,
  },
  primaryButtonText: {
    fontSize: typography.fontSize[14],
    fontWeight: typography.fontWeight.bold,
    color: colors.onPrimary,
  },
  primaryButtonTextDisabled: {
    color: colors.textMuted,
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
  formCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing[16],
  },
  inputGroup: {
    width: '100%',
  },
  inputLabel: {
    fontSize: typography.fontSize[13],
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
    marginBottom: spacing[6],
  },
  textInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    borderCurve: 'continuous',
    paddingHorizontal: spacing[14],
    paddingVertical: spacing[12],
    fontSize: typography.fontSize[14],
    color: colors.text,
  },
  formHint: {
    fontSize: typography.fontSize[11.5],
    color: colors.textSecondary,
    marginTop: spacing[12],
    lineHeight: 16,
  },
  ageOnlyCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing[16],
    alignItems: 'center',
  },
  ageCardHeading: {
    fontSize: typography.fontSize[14],
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
  },
  ageHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 4,
  },
  ageDefaultBadge: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderCurve: 'continuous',
  },
  ageDefaultBadgeText: {
    fontSize: typography.fontSize[11],
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
  },
  agePromptText: {
    fontSize: typography.fontSize[12],
    color: colors.textSecondary,
    marginBottom: spacing[10],
    alignSelf: 'flex-start',
  },
  ageFootnote: {
    fontSize: typography.fontSize[11],
    color: colors.textMuted,
    marginTop: spacing[10],
    textAlign: 'center',
  },
  wheelContainer: {
    height: 138,
    width: '100%',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 16,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  wheelSelectionBand: {
    position: 'absolute',
    top: 46,
    left: 10,
    right: 10,
    height: 46,
    backgroundColor: colors.primarySoft,
    borderRadius: 12,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingRight: spacing[16],
  },
  wheelSelectionSuffix: {
    fontSize: typography.fontSize[12],
    fontWeight: typography.fontWeight.semiBold,
    color: colors.primary,
  },
  wheelItem: {
    height: 46,
    justifyContent: 'center',
    alignItems: 'center',
  },
  wheelItemText: {
    fontSize: typography.fontSize[16],
    fontWeight: typography.fontWeight.medium,
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  wheelItemTextSelected: {
    fontSize: typography.fontSize[22],
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
    fontVariant: ['tabular-nums'],
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
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 2,
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
  conditionalBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing[14],
    marginTop: spacing[12],
  },
  conditionalHeader: {
    marginBottom: spacing[10],
  },
  conditionalTitle: {
    fontSize: typography.fontSize[13],
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
    marginBottom: 2,
  },
  conditionalSub: {
    fontSize: typography.fontSize[11],
    color: colors.textSecondary,
  },
  subFieldLabel: {
    fontSize: typography.fontSize[12],
    fontWeight: typography.fontWeight.semiBold,
    color: colors.text,
    marginBottom: spacing[6],
  },
  gradeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  subChip: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing[7],
    paddingHorizontal: spacing[11],
    borderRadius: 12,
    borderCurve: 'continuous',
  },
  subChipSelected: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  subChipText: {
    fontSize: typography.fontSize[12],
    fontWeight: typography.fontWeight.medium,
    color: colors.text,
  },
  subChipTextSelected: {
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
  },
  majorSuggestionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: spacing[8],
  },
  majorSuggestionChip: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderCurve: 'continuous',
  },
  majorSuggestionChipActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  majorSuggestionText: {
    fontSize: typography.fontSize[11],
    color: colors.textSecondary,
  },
  majorSuggestionTextActive: {
    color: colors.primary,
    fontWeight: typography.fontWeight.bold,
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
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 2,
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
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  checkboxSquareSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
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
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 2,
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
  reminderCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 16,
    borderCurve: 'continuous',
    padding: spacing[14],
    marginTop: spacing[16],
    gap: 12,
  },
  reminderCardActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  reminderHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  reminderTitle: {
    fontSize: typography.fontSize[13],
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
  },
  reminderStatusBadge: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderCurve: 'continuous',
  },
  reminderStatusBadgeActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  reminderStatusBadgeText: {
    fontSize: typography.fontSize[10],
    fontWeight: typography.fontWeight.bold,
    color: '#92400E',
  },
  reminderStatusBadgeTextActive: {
    color: colors.onPrimary,
  },
  reminderDesc: {
    fontSize: typography.fontSize[11.5],
    color: colors.textSecondary,
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
