import React, { useState, useMemo } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  FadeInRight,
  FadeInLeft,
  FadeOutLeft,
  FadeOutRight,
  ReduceMotion,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { AppText as Text } from '@/components/common/app-text';
import { useRouter } from 'expo-router';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  ArrowRight01Icon,
  ArrowLeft01Icon,
  CheckmarkCircle02Icon,
  BookOpen01Icon,
  FlashIcon,
  TrophyIcon,
  Tick01Icon,
} from '@hugeicons/core-free-icons';
import { colors, onboardingColors, spacing, typography } from '@/constants/theme';
import {
  useOnboarding,
  StudyTrack,
  PreferredFormat,
} from '../../context/OnboardingContext';
import { seedSampleDeck, buildSampleDeck } from '../../lib/data/sampleDeck';
import { MomoBackdrop } from '@/components/onboarding/MomoBackdrop';
import { AnimatedMomo, MomoPose } from '@/components/onboarding/AnimatedMomo';
import { AgeScrollPicker } from '@/components/onboarding/AgeScrollPicker';

const TRACK_OPTIONS: { id: StudyTrack; label: string; icon: any; desc: string }[] = [
  { id: 'college', label: 'College & University', icon: BookOpen01Icon, desc: 'Lectures, syllabi & midterms' },
  { id: 'high_school', label: 'High School', icon: BookOpen01Icon, desc: 'AP, IB & general classes' },
  { id: 'med_nursing', label: 'Medicine & Nursing', icon: CheckmarkCircle02Icon, desc: 'Anatomy, pharma & boards' },
  { id: 'stem', label: 'STEM & Engineering', icon: FlashIcon, desc: 'Formulas, problem sets & code' },
  { id: 'boards', label: 'Board & Licensure', icon: TrophyIcon, desc: 'High-stakes practice drills' },
  { id: 'general', label: 'General Learning', icon: BookOpen01Icon, desc: 'Curiosity & personal growth' },
];

const HIGH_SCHOOL_GRADES = [
  { id: 'Grade 9', label: 'Grade 9 (Freshman)' },
  { id: 'Grade 10', label: 'Grade 10 (Sophomore)' },
  { id: 'Grade 11', label: 'Grade 11 (Junior)' },
  { id: 'Grade 12', label: 'Grade 12 (Senior)' },
];

const COLLEGE_YEARS = [
  { id: '1st Year', label: '1st Year' },
  { id: '2nd Year', label: '2nd Year' },
  { id: '3rd Year', label: '3rd Year' },
  { id: '4th Year', label: '4th Year' },
  { id: 'Grad', label: 'Grad / 5th+' },
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
  'Medical Board',
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
  icon: any;
  isAll?: boolean;
}[] = [
  {
    id: 'all',
    label: 'Let Momo choose',
    desc: 'Flashcards, quizzes, exams and summaries — give me everything!',
    icon: CheckmarkCircle02Icon,
    isAll: true,
  },
  {
    id: 'flashcards',
    label: 'Flashcards',
    desc: 'Bite-sized cards to test recall speed and memory retention',
    icon: FlashIcon,
  },
  {
    id: 'quiz',
    label: 'Quick quizzes',
    desc: 'Active recall challenges with instant answers and XP score',
    icon: TrophyIcon,
  },
  {
    id: 'exam',
    label: 'Practice Exams',
    desc: 'Timed mock tests to get bulletproof for exam day',
    icon: BookOpen01Icon,
  },
  {
    id: 'summary',
    label: 'Quick Summaries',
    desc: 'Key lecture takeaways boiled down into clear bullet points',
    icon: CheckmarkCircle02Icon,
  },
];

const GOAL_OPTIONS = [
  { minutes: 10, label: '10 min/day', tag: 'Easy start', desc: 'A small daily study target' },
  { minutes: 20, label: '20 min/day', tag: 'Suggested', desc: 'Time for a short review session' },
  { minutes: 45, label: '45 min/day', tag: 'Deep focus', desc: 'More time for practice and review' },
];

const STAGE_LABELS = [
  'Meet Momo',
  'About you',
  'Your level',
  'Study path',
  'Study details',
  'Study style',
  'Daily rhythm',
  'Your preview',
] as const;

type OnboardingStage = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export default function WelcomeScreen() {
  const router = useRouter();
  const { completeWelcome } = useOnboarding();
  const { height: viewportHeight } = useWindowDimensions();
  const compactLayout = viewportHeight < 760;

  // Each page asks for one understandable decision and keeps the next action visible.
  const [stage, setStage] = useState<OnboardingStage>(1);
  const [transitionDirection, setTransitionDirection] = useState<'forward' | 'backward'>('forward');

  // Profile data
  const [firstName, setFirstName] = useState<string>('');
  const [selectedAge, setSelectedAge] = useState<number>(18);

  // Academic calibration
  const [selectedTrack, setSelectedTrack] = useState<StudyTrack>('college');
  const [highSchoolGrade, setHighSchoolGrade] = useState<string>('Grade 9');
  const [collegeYear, setCollegeYear] = useState<string>('1st Year');
  const [collegeCourse, setCollegeCourse] = useState<string>('');

  // Formats
  const [selectedFormats, setSelectedFormats] = useState<PreferredFormat[]>([
    'all',
    'flashcards',
    'quiz',
    'exam',
    'summary',
  ]);

  // Goal & Reminders
  const [selectedGoal, setSelectedGoal] = useState<number>(20);
  const [studyRemindersEnabled, setStudyRemindersEnabled] = useState<boolean>(false);

  const preview = useMemo(
    () => buildSampleDeck({
      studyTrack: selectedTrack,
      highSchoolGrade,
      collegeYear,
      collegeCourse,
    }).set,
    [selectedTrack, highSchoolGrade, collegeYear, collegeCourse]
  );

  // Loading state
  const [isSeeding, setIsSeeding] = useState<boolean>(false);
  const [completionError, setCompletionError] = useState<string | null>(null);

  // Transitions
  // Dynamic Momo Pose: Stage 2 uses 'happy' with clean, un-furrowed brows
  const getActiveMomoPose = (): MomoPose => {
    switch (stage) {
      case 1:
        return 'welcome';
      case 2:
        return 'happy'; // Clean, friendly, zero furrowed eyebrows
      case 3:
        return 'cool';
      case 4:
        return 'document';
      case 5:
        return 'thinking';
      case 6:
        return 'creating';
      case 7:
        return 'focus';
      case 8:
        return 'cheer';
      default:
        return 'welcome';
    }
  };

  const triggerHaptic = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
  };

  const goToStage = (nextStage: OnboardingStage, direction: 'forward' | 'backward' = 'forward') => {
    setCompletionError(null);
    triggerHaptic();
    setTransitionDirection(direction);
    setStage(nextStage);
  };

  const handleToggleFormat = (id: PreferredFormat | 'all') => {
    triggerHaptic();
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
    lastName: '',
    age: selectedAge,
    highSchoolGrade: selectedTrack === 'high_school' ? highSchoolGrade : null,
    collegeYear: ['college', 'med_nursing', 'stem'].includes(selectedTrack) ? collegeYear : null,
    collegeCourse: ['college', 'med_nursing', 'stem', 'boards', 'general'].includes(selectedTrack)
      ? collegeCourse.trim() || null
      : null,
    studyRemindersEnabled,
  });

  const handleFinishGuest = async () => {
    if (isSeeding) return;
    setIsSeeding(true);
    setCompletionError(null);
    triggerHaptic();
    try {
      await seedSampleDeck({ studyTrack: selectedTrack, highSchoolGrade, collegeYear, collegeCourse });
      await completeWelcome(selectedTrack, selectedFormats, selectedGoal, true, buildProfilePayload());
      router.replace('/(auth)/momo-intro');
    } catch (err) {
      console.error('Failed to complete guest welcome:', err);
      setCompletionError('We could not prepare your sample deck. Please try again.');
    } finally {
      setIsSeeding(false);
    }
  };

  const handleFinishGoogle = async () => {
    if (isSeeding) return;
    setIsSeeding(true);
    setCompletionError(null);
    triggerHaptic();
    setIsSeeding(true);
    try {
      await seedSampleDeck({ studyTrack: selectedTrack, highSchoolGrade, collegeYear, collegeCourse });
      await completeWelcome(selectedTrack, selectedFormats, selectedGoal, false, buildProfilePayload());
      router.replace('/(auth)/momo-intro');
    } catch (err) {
      console.error('Failed to complete google welcome:', err);
      setCompletionError('We could not save your choices. Please try again.');
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <MomoBackdrop>
      <SafeAreaView style={styles.safeArea}>
        {stage > 1 && <View style={styles.topHeader}>
          <View style={styles.progressContent}>
            <View style={styles.stageTitleRow}>
              <Text style={styles.progressLabel}>{stage} of 8 · {STAGE_LABELS[stage - 1]}</Text>
            </View>
            <View
              style={styles.progressContainer}
              accessible
              accessibilityRole="progressbar"
              accessibilityValue={{ min: 1, max: 8, now: stage }}
              accessibilityLabel={`Onboarding progress, step ${stage} of 8, ${STAGE_LABELS[stage - 1]}`}
            >
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <View
                  key={i}
                  style={[
                    styles.progressDot,
                    stage === i && styles.progressDotActive,
                    stage > i && styles.progressDotCompleted,
                  ]}
                />
              ))}
            </View>
          </View>
          <TouchableOpacity
            onPress={handleFinishGuest}
            style={styles.headerSkipBtn}
            disabled={isSeeding}
            accessibilityRole="button"
            accessibilityLabel="Skip setup and try a sample deck"
            activeOpacity={0.7}
          >
            <Text style={styles.headerSkipText}>Try Momo</Text>
          </TouchableOpacity>
        </View>}

        {completionError && (
          <Text style={styles.completionError} accessibilityRole="alert">{completionError}</Text>
        )}

        <KeyboardAvoidingView
          style={styles.pageContent}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
        >
          <Animated.View
            key={stage}
            entering={(transitionDirection === 'forward' ? FadeInRight : FadeInLeft)
              .duration(220)
              .reduceMotion(ReduceMotion.System)}
            exiting={(transitionDirection === 'forward' ? FadeOutLeft : FadeOutRight)
              .duration(160)
              .reduceMotion(ReduceMotion.System)}
            style={styles.animatedStepWrapper}
          >
            <View style={[styles.cardWrapper, compactLayout && styles.cardWrapperCompact]}>
              {stage === 1 && (
                <View style={styles.brandLockup}>
                  <Text style={styles.brandName}>Momo</Text>
                  <Text style={styles.brandLine}>your grounded study companion</Text>
                </View>
              )}

              {/* Momo Capped at the Top of the Card with Speech Bubble on the Right */}
              <View style={[styles.momoCapContainer, compactLayout && styles.momoCapContainerCompact]}>
                <AnimatedMomo
                  pose={getActiveMomoPose()}
                  stage={stage}
                  size={stage === 1 ? (compactLayout ? 210 : 250) : (compactLayout ? 96 : 128)}
                />
              </View>

              {stage === 1 && (
                <Animated.View
                  entering={FadeInRight.delay(180).duration(260).reduceMotion(ReduceMotion.System)}
                  style={styles.transformationVisual}
                  accessibilityLabel="Your notes become a focused reviewer"
                >
                  <View style={styles.transformationPoint}>
                    <HugeiconsIcon icon={BookOpen01Icon} size={18} color={onboardingColors.text} strokeWidth={2} />
                    <Text style={styles.transformationText}>Your notes</Text>
                  </View>
                  <View style={styles.transformationLine} />
                  <HugeiconsIcon icon={ArrowRight01Icon} size={18} color={onboardingColors.primary} strokeWidth={2.5} />
                  <View style={styles.transformationLine} />
                  <View style={styles.transformationPoint}>
                    <HugeiconsIcon icon={CheckmarkCircle02Icon} size={18} color={onboardingColors.text} strokeWidth={2} />
                    <Text style={styles.transformationText}>Your reviewer</Text>
                  </View>
                </Animated.View>
              )}

              {/* STAGE 1: MOMO VALUE INTRODUCTION */}
              {stage === 1 && (
                <View style={styles.stageCard}>
                  <Text style={styles.welcomeHeading}>Make your notes work for you</Text>
                  <Text style={styles.welcomeSub}>
                    Turn material you trust into focused reviewers, practice, and source-backed explanations.
                  </Text>
                  <TouchableOpacity
                    style={styles.welcomeContinue}
                    onPress={() => goToStage(2)}
                    accessibilityRole="button"
                    accessibilityLabel="Meet Momo and continue"
                    activeOpacity={0.82}
                  >
                    <HugeiconsIcon icon={ArrowRight01Icon} size={22} color="#FFFFFF" strokeWidth={2.5} />
                  </TouchableOpacity>
                </View>
              )}

              {/* STAGE 2: NAME */}
              {stage === 2 && (
                <View style={styles.stageCard}>
                  <View style={styles.cardHeaderRow}>
                    <TouchableOpacity
                      onPress={() => goToStage(1, 'backward')}
                      style={styles.backButton}
                      accessibilityRole="button"
                      accessibilityLabel="Back to welcome"
                    >
                      <HugeiconsIcon icon={ArrowLeft01Icon} size={20} color={onboardingColors.text} strokeWidth={2} />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>What should Momo call you?</Text>
                      <Text style={styles.cardSub}>So this feels like your study space.</Text>
                    </View>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Your first name</Text>
                    <TextInput
                      style={styles.textInput}
                      value={firstName}
                      onChangeText={setFirstName}
                      placeholder="Alex"
                      placeholderTextColor={onboardingColors.textMuted}
                      autoCapitalize="words"
                      autoCorrect={false}
                      returnKeyType="done"
                      onSubmitEditing={() => {
                        if (firstName.trim().length > 0) goToStage(3, 'forward');
                      }}
                    />
                  </View>
                </View>
              )}

              {/* STAGE 3: LEARNING LEVEL CALIBRATION */}
              {stage === 3 && (
                <View style={styles.stageCard}>
                  <View style={styles.cardHeaderRow}>
                    <TouchableOpacity
                      onPress={() => goToStage(2, 'backward')}
                      style={styles.backButton}
                      accessibilityRole="button"
                      accessibilityLabel="Back to name"
                    >
                      <HugeiconsIcon icon={ArrowLeft01Icon} size={20} color={onboardingColors.text} strokeWidth={2} />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>What’s your age?</Text>
                      <Text style={styles.cardSub}>Momo matches the pace to you.</Text>
                    </View>
                  </View>

                  <AgeScrollPicker
                    value={selectedAge}
                    onChange={setSelectedAge}
                    minAge={13}
                    maxAge={80}
                  />
                </View>
              )}

              {/* STAGE 4: CURRENT STUDY CONTEXT */}
              {stage === 4 && (
                <View style={styles.stageCard}>
                  <View style={styles.cardHeaderRow}>
                    <TouchableOpacity
                      onPress={() => goToStage(3, 'backward')}
                      style={styles.backButton}
                      accessibilityRole="button"
                      accessibilityLabel="Back to age"
                    >
                      <HugeiconsIcon icon={ArrowLeft01Icon} size={20} color={onboardingColors.text} strokeWidth={2} />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>What are you studying?</Text>
                      <Text style={styles.cardSub}>Pick the path closest to you.</Text>
                    </View>
                  </View>

                  {/* Track Cards */}
                  <View style={styles.trackList}>
                    {TRACK_OPTIONS.map((t) => {
                      const isSelected = selectedTrack === t.id;
                      const IconComp = t.icon;
                      return (
                        <TouchableOpacity
                          key={t.id}
                          style={[styles.trackCard, isSelected && styles.trackCardSelected]}
                          onPress={() => {
                            triggerHaptic();
                            setSelectedTrack(t.id);
                          }}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: isSelected }}
                          accessibilityLabel={`${t.label}. ${t.desc}`}
                        >
                          <View style={[styles.trackIconCircle, isSelected && styles.trackIconCircleSelected]}>
                            <HugeiconsIcon
                              icon={IconComp}
                              size={18}
                              color={isSelected ? onboardingColors.primary : onboardingColors.textSecondary}
                              strokeWidth={2}
                            />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.trackCardTitle, isSelected && styles.trackCardTitleSelected]}>
                              {t.label}
                            </Text>
                          </View>
                          <View style={[styles.radioCircle, isSelected && styles.radioCircleSelected]}>
                            {isSelected && <View style={styles.radioInner} />}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                </View>
              )}

              {/* STAGE 5: STUDY DETAILS */}
              {stage === 5 && (
                <View style={styles.stageCard}>
                  <View style={styles.cardHeaderRow}>
                    <TouchableOpacity
                      onPress={() => goToStage(4, 'backward')}
                      style={styles.backButton}
                      accessibilityRole="button"
                      accessibilityLabel="Back to study path"
                    >
                      <HugeiconsIcon icon={ArrowLeft01Icon} size={20} color={onboardingColors.text} strokeWidth={2} />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>Make it specific to you</Text>
                      <Text style={styles.cardSub}>This tunes your examples.</Text>
                    </View>
                  </View>

                  {selectedTrack === 'high_school' && (
                    <View style={styles.subFieldCard}>
                      <Text style={styles.subFieldLabel}>Your grade level</Text>
                      <View style={styles.chipsWrap}>
                        {HIGH_SCHOOL_GRADES.map((g) => {
                          const isGradeSelected = highSchoolGrade === g.id;
                          return (
                            <TouchableOpacity
                              key={g.id}
                              style={[styles.subChip, isGradeSelected && styles.subChipSelected]}
                              onPress={() => {
                                triggerHaptic();
                                setHighSchoolGrade(g.id);
                              }}
                            >
                              <Text style={[styles.subChipText, isGradeSelected && styles.subChipTextSelected]}>
                                {g.label}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  )}

                  {selectedTrack !== 'high_school' && selectedTrack !== 'boards' && selectedTrack !== 'general' && (
                    <View style={styles.subFieldCard}>
                      <Text style={styles.subFieldLabel}>Your college year</Text>
                      <View style={styles.chipsWrap}>
                        {COLLEGE_YEARS.map((y) => {
                          const isYearSelected = collegeYear === y.id;
                          return (
                            <TouchableOpacity
                              key={y.id}
                              style={[styles.subChip, isYearSelected && styles.subChipSelected]}
                              onPress={() => {
                                triggerHaptic();
                                setCollegeYear(y.id);
                              }}
                            >
                              <Text style={[styles.subChipText, isYearSelected && styles.subChipTextSelected]}>
                                {y.label}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>

                      <Text style={[styles.subFieldLabel, { marginTop: spacing[12] }]}>
                        Your program
                      </Text>
                      <TextInput
                        style={styles.textInput}
                        value={collegeCourse}
                        onChangeText={setCollegeCourse}
                        placeholder="e.g. BS Nursing, Computer Science..."
                        placeholderTextColor={onboardingColors.textMuted}
                        autoCapitalize="words"
                      />

                      <View style={styles.popularRow}>
                        {POPULAR_MAJORS.slice(0, 4).map((m) => (
                          <TouchableOpacity
                            key={m}
                            style={[styles.miniChip, collegeCourse === m && styles.miniChipActive]}
                            onPress={() => {
                              triggerHaptic();
                              setCollegeCourse(m);
                            }}
                          >
                            <Text style={[styles.miniChipText, collegeCourse === m && styles.miniChipTextActive]}>
                              {m}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  )}

                  {selectedTrack === 'boards' && (
                    <View style={styles.subFieldCard}>
                      <Text style={styles.subFieldLabel}>Target Examination</Text>
                      <TextInput
                        style={styles.textInput}
                        value={collegeCourse}
                        onChangeText={setCollegeCourse}
                        placeholder="e.g. NCLEX-RN, CPA Board, Bar Exam..."
                        placeholderTextColor={onboardingColors.textMuted}
                      />
                      <View style={styles.popularRow}>
                        {POPULAR_BOARD_EXAMS.slice(0, 4).map((m) => (
                          <TouchableOpacity
                            key={m}
                            style={[styles.miniChip, collegeCourse === m && styles.miniChipActive]}
                            onPress={() => {
                              triggerHaptic();
                              setCollegeCourse(m);
                            }}
                          >
                            <Text style={[styles.miniChipText, collegeCourse === m && styles.miniChipTextActive]}>
                              {m}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  )}

                  {selectedTrack === 'general' && (
                    <View style={styles.subFieldCard}>
                      <Text style={styles.subFieldLabel}>Primary Topic Focus</Text>
                      <TextInput
                        style={styles.textInput}
                        value={collegeCourse}
                        onChangeText={setCollegeCourse}
                        placeholder="e.g. Tech & Coding, Spanish, Investing..."
                        placeholderTextColor={onboardingColors.textMuted}
                      />
                      <View style={styles.popularRow}>
                        {POPULAR_GENERAL_TOPICS.slice(0, 3).map((m) => (
                          <TouchableOpacity
                            key={m}
                            style={[styles.miniChip, collegeCourse === m && styles.miniChipActive]}
                            onPress={() => {
                              triggerHaptic();
                              setCollegeCourse(m);
                            }}
                          >
                            <Text style={[styles.miniChipText, collegeCourse === m && styles.miniChipTextActive]}>
                              {m}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  )}
                </View>
              )}

              {/* STAGE 6: STUDY FORMAT */}
              {stage === 6 && (
                <View style={styles.stageCard}>
                  <View style={styles.cardHeaderRow}>
                    <TouchableOpacity
                      onPress={() => goToStage(5, 'backward')}
                      style={styles.backButton}
                      accessibilityRole="button"
                      accessibilityLabel="Back to study details"
                    >
                      <HugeiconsIcon icon={ArrowLeft01Icon} size={20} color={onboardingColors.text} strokeWidth={2} />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>How do you like to study?</Text>
                      <Text style={styles.cardSub}>Pick one or more. Change them anytime.</Text>
                    </View>
                  </View>

                  {/* Format Cards */}
                  <View style={styles.formatList}>
                    {FORMAT_OPTIONS.map((f) => {
                      const isSelected = selectedFormats.includes(f.id);
                      const IconComp = f.icon;
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
                          accessibilityState={{ checked: isSelected }}
                          accessibilityLabel={`${f.label}. ${f.desc}`}
                        >
                          <View style={[styles.trackIconCircle, isSelected && styles.trackIconCircleSelected]}>
                            <HugeiconsIcon
                              icon={IconComp}
                              size={18}
                              color={isSelected ? onboardingColors.primary : onboardingColors.textSecondary}
                              strokeWidth={2}
                            />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.formatTitle, isSelected && styles.formatTitleSelected]}>
                              {f.label}
                            </Text>
                          </View>
                          <View
                            style={[
                              styles.checkboxSquare,
                              isSelected && styles.checkboxSquareSelected,
                            ]}
                          >
                            {isSelected && (
                              <HugeiconsIcon icon={Tick01Icon} size={13} color="#FFFFFF" strokeWidth={3} />
                            )}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                </View>
              )}

              {/* STAGE 7: DAILY RHYTHM */}
              {stage === 7 && (
                <View style={styles.stageCard}>
                  <View style={styles.cardHeaderRow}>
                    <TouchableOpacity
                      onPress={() => goToStage(6, 'backward')}
                      style={styles.backButton}
                      accessibilityRole="button"
                      accessibilityLabel="Back to study formats"
                    >
                      <HugeiconsIcon icon={ArrowLeft01Icon} size={20} color={onboardingColors.text} strokeWidth={2} />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>Choose a rhythm you can keep</Text>
                      <Text style={styles.cardSub}>Start with something realistic.</Text>
                    </View>
                  </View>

                  <View style={styles.goalVerticalList}>
                    {GOAL_OPTIONS.map((g) => {
                      const isSelected = selectedGoal === g.minutes;
                      return (
                        <TouchableOpacity
                          key={g.minutes}
                          style={[styles.goalFullCard, isSelected && styles.goalFullCardSelected]}
                          onPress={() => {
                            triggerHaptic();
                            setSelectedGoal(g.minutes);
                          }}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: isSelected }}
                          accessibilityLabel={`${g.label}. ${g.desc}`}
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
                          </View>
                          <View style={[styles.radioCircle, isSelected && styles.radioCircleSelected]}>
                            {isSelected && <View style={styles.radioInner} />}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.reminderCard,
                      studyRemindersEnabled && styles.reminderCardActive,
                    ]}
                    onPress={() => {
                      triggerHaptic();
                      setStudyRemindersEnabled(!studyRemindersEnabled);
                    }}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: studyRemindersEnabled }}
                    activeOpacity={0.8}
                  >
                    <View
                      style={[
                        styles.checkboxSquare,
                        studyRemindersEnabled && styles.checkboxSquareSelected,
                      ]}
                    >
                      {studyRemindersEnabled && (
                        <HugeiconsIcon icon={Tick01Icon} size={13} color="#FFFFFF" strokeWidth={3} />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.reminderTitle}>Remind me to return</Text>
                    </View>
                  </TouchableOpacity>
                </View>
              )}

              {/* STAGE 8: PERSONALIZED PREVIEW */}
              {stage === 8 && (
                <View style={styles.stageCard}>
                  <View style={styles.cardHeaderRow}>
                    <TouchableOpacity
                      onPress={() => goToStage(7, 'backward')}
                      style={styles.backButton}
                      accessibilityRole="button"
                      accessibilityLabel="Back to study preferences"
                    >
                      <HugeiconsIcon icon={ArrowLeft01Icon} size={20} color={onboardingColors.text} strokeWidth={2} />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>
                        Your first reviewer is ready{firstName ? `, ${firstName}` : ''}
                      </Text>
                      <Text style={styles.cardSub}>Open it now or save your setup.</Text>
                    </View>
                  </View>

                  {/* Option A Highlight: Instant Sample Deck */}
                  <View style={styles.launchCardHighlighted}>
                    <View style={styles.launchBadge}>
                      <Text style={styles.launchBadgeText}>READY NOW</Text>
                    </View>
                    <Text style={styles.launchCardTitle}>{preview.title}</Text>
                    <TouchableOpacity
                      style={styles.sampleActionButton}
                      onPress={handleFinishGuest}
                      disabled={isSeeding}
                      activeOpacity={0.85}
                    >
                      <HugeiconsIcon icon={BookOpen01Icon} size={18} color="#FFFFFF" strokeWidth={2.5} />
                      <Text style={styles.sampleActionText}>
                        {isSeeding ? 'Preparing...' : 'Open my sample'}
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
                    <Text style={styles.googleCardTitle}>Save my study space</Text>
                    <TouchableOpacity
                      style={styles.googleButton}
                      onPress={handleFinishGoogle}
                      disabled={isSeeding}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.googleIconPlaceholder}>G</Text>
                      <Text style={styles.googleButtonText}>Continue with Google</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          </Animated.View>
        {stage >= 2 && stage <= 7 && (
          <View style={styles.stickyFooter}>
            <TouchableOpacity
              style={[
                styles.primaryButton,
                stage === 2 && firstName.trim().length === 0 && styles.primaryButtonDisabled,
              ]}
              onPress={() => {
                if (stage !== 2 || firstName.trim().length > 0) {
                  goToStage((stage + 1) as OnboardingStage);
                }
              }}
              disabled={stage === 2 && firstName.trim().length === 0}
              accessibilityRole="button"
              accessibilityLabel={stage === 2 ? 'Continue to age selector' : 'Continue to next step'}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  styles.primaryButtonText,
                  stage === 2 && firstName.trim().length === 0 && styles.primaryButtonTextDisabled,
                ]}
              >
                {stage === 2 && firstName.trim().length === 0
                  ? 'Enter your first name'
                  : stage === 7
                    ? 'Build my preview'
                    : 'Continue'}
              </Text>
              <HugeiconsIcon
                icon={ArrowRight01Icon}
                size={18}
                color={stage === 2 && firstName.trim().length === 0 ? onboardingColors.textMuted : '#FFFFFF'}
                strokeWidth={2.5}
              />
            </TouchableOpacity>
          </View>
        )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </MomoBackdrop>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[20],
    paddingTop: spacing[6],
    paddingBottom: spacing[6],
    zIndex: 10,
  },
  progressContent: {
    flex: 1,
    marginRight: spacing[16],
  },
  stageTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: spacing[4],
  },
  progressLabel: {
    color: onboardingColors.textSecondary,
    fontSize: typography.fontSize[11],
    fontWeight: typography.fontWeight.bold,
    letterSpacing: 0.8,
  },
  headerSkipBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: onboardingColors.primarySoft,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: onboardingColors.primaryBorder,
  },
  headerSkipText: {
    fontSize: typography.fontSize[12],
    fontWeight: typography.fontWeight.bold,
    color: onboardingColors.primary,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  progressDot: {
    flex: 1,
    height: 5,
    borderRadius: 3,
    backgroundColor: onboardingColors.border,
  },
  progressDotActive: {
    backgroundColor: onboardingColors.primary,
  },
  progressDotCompleted: {
    backgroundColor: onboardingColors.primary,
  },
  pageContent: {
    flex: 1,
    paddingHorizontal: spacing[16],
    paddingBottom: spacing[8],
  },
  stickyFooter: {
    paddingHorizontal: spacing[16],
    paddingTop: spacing[10],
    paddingBottom: spacing[10],
    backgroundColor: 'transparent',
  },
  animatedStepWrapper: {
    width: '100%',
    flexGrow: 1,
  },
  cardWrapper: {
    width: '100%',
    flexGrow: 1,
    marginTop: spacing[4],
  },
  cardWrapperCompact: {
    marginTop: 0,
  },
  brandLockup: {
    alignItems: 'center',
    marginTop: spacing[12],
    marginBottom: spacing[4],
  },
  brandName: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 34,
    lineHeight: 40,
    color: onboardingColors.text,
    letterSpacing: -1.2,
  },
  brandLine: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize[12],
    color: onboardingColors.textSecondary,
    marginTop: -2,
  },
  momoCapContainer: {
    width: '100%',
    minHeight: 156,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[4],
    zIndex: 10,
  },
  momoCapContainerCompact: {
    minHeight: 112,
    marginBottom: 0,
  },
  stageCard: {
    backgroundColor: 'transparent',
    padding: spacing[20],
    paddingTop: spacing[8],
  },
  welcomeHeading: {
    fontSize: 28,
    fontWeight: typography.fontWeight.bold,
    color: onboardingColors.text,
    textAlign: 'center',
    lineHeight: 36,
    marginBottom: spacing[8],
  },
  welcomeSub: {
    fontSize: typography.fontSize[14],
    color: onboardingColors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing[20],
    paddingHorizontal: spacing[4],
  },
  welcomeContinue: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: onboardingColors.primary,
  },
  transformationVisual: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[20],
    marginBottom: spacing[8],
  },
  transformationPoint: {
    alignItems: 'center',
    gap: spacing[4],
  },
  transformationText: {
    fontSize: typography.fontSize[11],
    fontFamily: typography.fontFamily.semiBold,
    color: onboardingColors.textSecondary,
  },
  transformationLine: {
    width: 28,
    height: StyleSheet.hairlineWidth,
    backgroundColor: onboardingColors.primaryBorder,
    marginHorizontal: spacing[6],
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: onboardingColors.primary,
    paddingVertical: spacing[14],
    paddingHorizontal: spacing[20],
    borderRadius: 16,
    borderCurve: 'continuous',
    gap: 8,
  },
  primaryButtonDisabled: {
    backgroundColor: '#CBD5E1',
    shadowOpacity: 0,
    elevation: 0,
  },
  primaryButtonText: {
    fontSize: typography.fontSize[14],
    fontWeight: typography.fontWeight.bold,
    color: '#FFFFFF',
  },
  primaryButtonTextDisabled: {
    color: onboardingColors.textMuted,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: spacing[16],
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: onboardingColors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: typography.fontWeight.bold,
    color: onboardingColors.text,
    lineHeight: 31,
  },
  cardSub: {
    fontSize: typography.fontSize[13],
    color: onboardingColors.textSecondary,
    lineHeight: 20,
    marginTop: 4,
  },
  inputGroup: {
    marginBottom: spacing[4],
  },
  inputLabel: {
    fontSize: typography.fontSize[12.5],
    fontWeight: typography.fontWeight.bold,
    color: onboardingColors.text,
    marginBottom: spacing[6],
  },
  textInput: {
    backgroundColor: 'transparent',
    borderBottomWidth: 1.5,
    borderBottomColor: onboardingColors.primaryBorder,
    paddingHorizontal: 0,
    paddingVertical: Platform.OS === 'ios' ? spacing[12] : spacing[10],
    fontSize: typography.fontSize[16],
    color: onboardingColors.text,
  },
  trackList: {
    gap: 0,
  },
  trackCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: spacing[14],
    paddingHorizontal: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: onboardingColors.border,
  },
  trackCardSelected: {
    borderBottomWidth: 2,
    borderBottomColor: onboardingColors.primary,
  },
  trackIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackIconCircleSelected: {
    backgroundColor: onboardingColors.primarySoft,
  },
  trackCardTitle: {
    fontSize: typography.fontSize[13.5],
    fontWeight: typography.fontWeight.bold,
    color: onboardingColors.text,
  },
  trackCardTitleSelected: {
    color: onboardingColors.primary,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleSelected: {
    borderColor: onboardingColors.primary,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: onboardingColors.primary,
  },
  subFieldCard: {
    marginTop: spacing[20],
    paddingTop: spacing[16],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: onboardingColors.border,
  },
  subFieldLabel: {
    fontSize: typography.fontSize[12],
    fontWeight: typography.fontWeight.bold,
    color: onboardingColors.text,
    marginBottom: spacing[6],
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  subChip: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: onboardingColors.surface,
    borderWidth: 1,
    borderColor: onboardingColors.border,
  },
  subChipSelected: {
    backgroundColor: onboardingColors.primary,
    borderColor: onboardingColors.primary,
  },
  subChipText: {
    fontSize: typography.fontSize[12],
    fontWeight: typography.fontWeight.medium,
    color: onboardingColors.text,
  },
  subChipTextSelected: {
    color: '#FFFFFF',
    fontWeight: typography.fontWeight.bold,
  },
  popularRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: spacing[8],
  },
  miniChip: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: onboardingColors.surfaceMuted,
  },
  miniChipActive: {
    backgroundColor: onboardingColors.primarySoft,
    borderWidth: 1,
    borderColor: onboardingColors.primaryBorder,
  },
  miniChipText: {
    fontSize: typography.fontSize[11],
    color: onboardingColors.textSecondary,
    fontWeight: typography.fontWeight.medium,
  },
  miniChipTextActive: {
    color: onboardingColors.primary,
    fontWeight: typography.fontWeight.bold,
  },
  formatList: {
    gap: 0,
  },
  formatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: spacing[14],
    paddingHorizontal: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: onboardingColors.border,
  },
  formatCardSelected: {
    borderBottomWidth: 2,
    borderBottomColor: onboardingColors.primary,
  },
  formatCardAll: {
    borderBottomColor: onboardingColors.border,
  },
  formatCardAllSelected: {
    borderBottomColor: onboardingColors.primary,
  },
  formatTitle: {
    fontSize: typography.fontSize[13],
    fontWeight: typography.fontWeight.bold,
    color: onboardingColors.text,
  },
  formatTitleSelected: {
    color: onboardingColors.primary,
  },
  checkboxSquare: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  checkboxSquareSelected: {
    backgroundColor: onboardingColors.primary,
    borderColor: onboardingColors.primary,
  },
  goalVerticalList: {
    gap: 0,
  },
  goalFullCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: spacing[14],
    paddingHorizontal: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: onboardingColors.border,
  },
  goalFullCardSelected: {
    borderBottomWidth: 2,
    borderBottomColor: onboardingColors.primary,
  },
  goalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  goalFullLabel: {
    fontSize: typography.fontSize[13],
    fontWeight: typography.fontWeight.bold,
    color: onboardingColors.text,
  },
  goalFullLabelSelected: {
    color: onboardingColors.primary,
  },
  goalTagBadge: {
    backgroundColor: onboardingColors.surfaceMuted,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  goalTagBadgeSelected: {
    backgroundColor: onboardingColors.primarySoft,
  },
  goalTagBadgeText: {
    fontSize: typography.fontSize[10.5],
    fontWeight: typography.fontWeight.bold,
    color: onboardingColors.textSecondary,
  },
  goalTagBadgeTextSelected: {
    color: onboardingColors.primary,
  },
  reminderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: spacing[14],
    paddingVertical: spacing[16],
    paddingHorizontal: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: onboardingColors.border,
  },
  reminderCardActive: {
    borderTopColor: onboardingColors.primary,
  },
  reminderTitle: {
    fontSize: typography.fontSize[12.5],
    fontWeight: typography.fontWeight.bold,
    color: onboardingColors.text,
  },
  launchCardHighlighted: {
    paddingVertical: spacing[20],
    borderTopWidth: 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: onboardingColors.primary,
  },
  launchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    paddingVertical: 3,
    marginBottom: spacing[6],
  },
  launchBadgeText: {
    fontSize: typography.fontSize[10.5],
    fontWeight: typography.fontWeight.bold,
    color: onboardingColors.primary,
  },
  launchCardTitle: {
    fontSize: 16,
    fontWeight: typography.fontWeight.bold,
    color: onboardingColors.text,
    marginBottom: 4,
  },
  sampleActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: onboardingColors.primary,
    paddingVertical: spacing[12],
    borderRadius: 14,
    borderCurve: 'continuous',
  },
  sampleActionText: {
    fontSize: typography.fontSize[13],
    fontWeight: typography.fontWeight.bold,
    color: '#FFFFFF',
  },
  orDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: spacing[12],
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: onboardingColors.border,
  },
  orText: {
    fontSize: typography.fontSize[11],
    fontWeight: typography.fontWeight.bold,
    color: onboardingColors.textMuted,
  },
  launchCardGoogle: {
    paddingVertical: spacing[20],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: onboardingColors.border,
  },
  googleCardTitle: {
    fontSize: 15,
    fontWeight: typography.fontWeight.bold,
    color: onboardingColors.text,
    marginBottom: 4,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    paddingVertical: spacing[12],
    borderRadius: 14,
    borderCurve: 'continuous',
  },
  googleIconPlaceholder: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#EA4335',
  },
  googleButtonText: {
    fontSize: typography.fontSize[13],
    fontWeight: typography.fontWeight.bold,
    color: onboardingColors.text,
  },
  completionError: {
    color: colors.danger,
    fontSize: typography.fontSize[12],
    lineHeight: 18,
    marginHorizontal: spacing[20],
    marginVertical: spacing[8],
    padding: spacing[12],
    borderRadius: 12,
    backgroundColor: colors.dangerSoft,
    textAlign: 'center',
  },
});
