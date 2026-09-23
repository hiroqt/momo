import React, { useState, useRef, useMemo } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
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
import { seedSampleDeck, buildSampleDeck } from '../../lib/data/sampleDeck';
import { JungleBackdrop } from '@/components/onboarding/JungleBackdrop';
import { AnimatedMomo, MomoPose } from '@/components/onboarding/AnimatedMomo';
import { AgeScrollPicker } from '@/components/onboarding/AgeScrollPicker';

const TRACK_OPTIONS: { id: StudyTrack; label: string; icon: any; desc: string }[] = [
  { id: 'college', label: 'College & University', icon: BookOpen01Icon, desc: 'Lectures, syllabi & midterms' },
  { id: 'high_school', label: 'High School', icon: BookOpen01Icon, desc: 'AP, IB & general classes' },
  { id: 'med_nursing', label: 'Medicine & Nursing', icon: CheckmarkCircle02Icon, desc: 'Anatomy, pharma & boards' },
  { id: 'stem', label: 'STEM & Engineering', icon: FlashIcon, desc: 'Formulas, problem sets & code' },
  { id: 'boards', label: 'Board & Licensure', icon: TrophyIcon, desc: 'High-stakes practice drills' },
  { id: 'general', label: 'General Learning', icon: SparklesIcon, desc: 'Curiosity & personal growth' },
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
    label: 'All Formats (Momo Pick)',
    desc: 'Flashcards, quizzes, exams and summaries — give me everything!',
    icon: SparklesIcon,
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
    label: 'Fun Quizzes',
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

const STAGE_LABELS = ['Welcome', 'Your name', 'Your age', 'Study path', 'Study plan', 'Get started'] as const;

export default function WelcomeScreen() {
  const router = useRouter();
  const { completeWelcome } = useOnboarding();

  // 6 Streamlined Stages:
  // 1: Jungle Welcome & Superpowers
  // 2: Explorer Name (First Name + Last Name)
  // 3: Explorer Age (Centered Horizontal Scroll Ruler Reel)
  // 4: Academic Quest (Track + Program/Major)
  // 5: Study Weapons & Habit (Formats + Daily Goal & Reminders)
  // 6: Lock In (Instant Sample Deck vs Google Sign-In)
  const [stage, setStage] = useState<1 | 2 | 3 | 4 | 5 | 6>(1);

  // Profile data
  const [firstName, setFirstName] = useState<string>('');
  const [lastName, setLastName] = useState<string>('');
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
  const isTransitioning = useRef(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const scrollViewRef = useRef<ScrollView>(null);

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
        return 'creating';
      case 6:
        return 'cheer';
      default:
        return 'welcome';
    }
  };

  // Zero-emoji speech text
  const getMomoSpeech = (): string | undefined => {
    if (stage === 1) return "Let's lock in.";
    if (stage === 2) {
      return firstName.trim().length > 0 ? `Ready, ${firstName.trim()}.` : 'Who am I coaching?';
    }
    if (stage === 3) return 'What is your age, explorer?';
    if (stage === 4) return 'Let me inspect your syllabus.';
    if (stage === 5) return 'Pick your study formats.';
    if (stage === 6) return 'Ready to ace your exams.';
    return undefined;
  };

  const triggerHaptic = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
  };

  const goToStage = (nextStage: 1 | 2 | 3 | 4 | 5 | 6, direction: 'forward' | 'backward' = 'forward') => {
    if (isTransitioning.current) return;
    isTransitioning.current = true;
    setCompletionError(null);
    triggerHaptic();

    const exitOffset = direction === 'forward' ? -25 : 25;
    const enterOffset = direction === 'forward' ? 25 : -25;

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 130,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: exitOffset,
        duration: 130,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.97,
        duration: 130,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setStage(nextStage);
      scrollViewRef.current?.scrollTo({ y: 0, animated: false });
      slideAnim.setValue(enterOffset);
      scaleAnim.setValue(0.97);

      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 200,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 200,
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

    // Fallback safety watchdog
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
    <JungleBackdrop>
      <SafeAreaView style={styles.safeArea}>
        {/* Top Header: Game Progress Track + Skip Action */}
        <View style={styles.topHeader}>
          <View style={styles.progressContent}>
            <View style={styles.stageTitleRow}>
              <HugeiconsIcon icon={SparklesIcon} size={14} color="#FBBF24" strokeWidth={2.5} />
              <Text style={styles.progressLabel}>STEP {stage} OF 6 · {STAGE_LABELS[stage - 1]}</Text>
            </View>
            <View
              style={styles.progressContainer}
              accessible
              accessibilityRole="progressbar"
              accessibilityValue={{ min: 1, max: 6, now: stage }}
              accessibilityLabel={`Onboarding progress, step ${stage} of 6, ${STAGE_LABELS[stage - 1]}`}
            >
              {[1, 2, 3, 4, 5, 6].map((i) => (
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
            <Text style={styles.headerSkipText}>Skip</Text>
          </TouchableOpacity>
        </View>

        {completionError && (
          <Text style={styles.completionError} accessibilityRole="alert">{completionError}</Text>
        )}

        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
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
            <View style={styles.cardWrapper}>
              {/* Momo Capped at the Top of the Card with Speech Bubble on the Right */}
              <View style={styles.momoCapContainer}>
                <AnimatedMomo
                  pose={getActiveMomoPose()}
                  stage={stage}
                  size={155}
                  speechText={getMomoSpeech()}
                />
              </View>

              {/* STAGE 1: JUNGLE WELCOME & 3 SUPERPOWERS */}
              {stage === 1 && (
                <View style={styles.stageCard}>
                  <Text style={styles.welcomeHeading}>Turn your notes into practice</Text>
                  <Text style={styles.welcomeSub}>
                    Upload your slides or notes, then study with questions and flashcards built from your material.
                  </Text>

                  {/* 3 Core Superpower Pillars */}
                  <View style={styles.superpowerList}>
                    <View style={styles.superpowerItem}>
                      <View style={styles.superpowerIconCircle}>
                        <HugeiconsIcon icon={CheckmarkCircle02Icon} size={16} color={colors.primary} strokeWidth={2.5} />
                      </View>
                      <View style={styles.superpowerTextWrap}>
                        <Text style={styles.superpowerTitle}>Grounded in your notes</Text>
                        <Text style={styles.superpowerDesc}>
                          Review source references and check answers against your material.
                        </Text>
                      </View>
                    </View>

                    <View style={styles.superpowerItem}>
                      <View style={[styles.superpowerIconCircle, { backgroundColor: '#FEF3C7' }]}>
                        <HugeiconsIcon icon={TrophyIcon} size={16} color="#B45309" strokeWidth={2.5} />
                      </View>
                      <View style={styles.superpowerTextWrap}>
                        <Text style={styles.superpowerTitle}>Gamified Recall & XP</Text>
                        <Text style={styles.superpowerDesc}>
                          Practice what you remember and earn XP for correct answers.
                        </Text>
                      </View>
                    </View>

                    <View style={styles.superpowerItem}>
                      <View style={[styles.superpowerIconCircle, { backgroundColor: '#E0E7FF' }]}>
                        <HugeiconsIcon icon={FlashIcon} size={16} color="#4338CA" strokeWidth={2.5} />
                      </View>
                      <View style={styles.superpowerTextWrap}>
                        <Text style={styles.superpowerTitle}>Study Offline Anywhere</Text>
                        <Text style={styles.superpowerDesc}>
                          Download generated sets to review when you are offline.
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              )}

              {/* STAGE 2: EXPLORER NAME (FIRST + LAST NAME) */}
              {stage === 2 && (
                <View style={styles.stageCard}>
                  <View style={styles.cardHeaderRow}>
                    <TouchableOpacity
                      onPress={() => goToStage(1, 'backward')}
                      style={styles.backButton}
                      accessibilityRole="button"
                      accessibilityLabel="Back to welcome"
                    >
                      <HugeiconsIcon icon={ArrowLeft01Icon} size={20} color="#0F172A" strokeWidth={2} />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>Who are we locking in with?</Text>
                      <Text style={styles.cardSub}>So Momo knows what to call you</Text>
                    </View>
                  </View>

                  {/* Name Inputs */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>First Name *</Text>
                    <TextInput
                      style={styles.textInput}
                      value={firstName}
                      onChangeText={setFirstName}
                      placeholder="e.g. Alex"
                      placeholderTextColor="#94A3B8"
                      autoCapitalize="words"
                      autoCorrect={false}
                      returnKeyType="next"
                    />
                  </View>

                  <View style={[styles.inputGroup, { marginTop: spacing[12] }]}>
                    <Text style={styles.inputLabel}>Last Name (Optional)</Text>
                    <TextInput
                      style={styles.textInput}
                      value={lastName}
                      onChangeText={setLastName}
                      placeholder="e.g. Rivera"
                      placeholderTextColor="#94A3B8"
                      autoCapitalize="words"
                      autoCorrect={false}
                      returnKeyType="done"
                    />
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.primaryButton,
                      firstName.trim().length === 0 && styles.primaryButtonDisabled,
                      { marginTop: spacing[20] },
                    ]}
                    onPress={() => {
                      if (firstName.trim().length > 0) {
                        goToStage(3, 'forward');
                      }
                    }}
                    disabled={firstName.trim().length === 0}
                    accessibilityRole="button"
                    accessibilityLabel="Continue to age selector"
                  >
                    <Text
                      style={[
                        styles.primaryButtonText,
                        firstName.trim().length === 0 && styles.primaryButtonTextDisabled,
                      ]}
                    >
                      {firstName.trim().length === 0 ? 'Enter First Name to Continue' : 'Continue to Age'}
                    </Text>
                    <HugeiconsIcon
                      icon={ArrowRight01Icon}
                      size={18}
                      color={firstName.trim().length === 0 ? '#94A3B8' : '#FFFFFF'}
                      strokeWidth={2.5}
                    />
                  </TouchableOpacity>
                </View>
              )}

              {/* STAGE 3: EXPLORER AGE (CENTERED HORIZONTAL SCROLL) */}
              {stage === 3 && (
                <View style={styles.stageCard}>
                  <View style={styles.cardHeaderRow}>
                    <TouchableOpacity
                      onPress={() => goToStage(2, 'backward')}
                      style={styles.backButton}
                      accessibilityRole="button"
                      accessibilityLabel="Back to name"
                    >
                      <HugeiconsIcon icon={ArrowLeft01Icon} size={20} color="#0F172A" strokeWidth={2} />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>How old are you?</Text>
                      <Text style={styles.cardSub}>This helps tailor your study experience</Text>
                    </View>
                  </View>

                  <AgeScrollPicker
                    value={selectedAge}
                    onChange={setSelectedAge}
                    minAge={13}
                    maxAge={80}
                  />

                  <TouchableOpacity
                    style={[styles.primaryButton, { marginTop: spacing[16] }]}
                    onPress={() => goToStage(4, 'forward')}
                    accessibilityRole="button"
                    accessibilityLabel="Confirm age and continue"
                  >
                    <Text style={styles.primaryButtonText}>Confirm Age & Continue</Text>
                    <HugeiconsIcon icon={ArrowRight01Icon} size={18} color="#FFFFFF" strokeWidth={2.5} />
                  </TouchableOpacity>
                </View>
              )}

              {/* STAGE 4: ACADEMIC QUEST (TRACK + LEVEL/MAJOR) */}
              {stage === 4 && (
                <View style={styles.stageCard}>
                  <View style={styles.cardHeaderRow}>
                    <TouchableOpacity
                      onPress={() => goToStage(3, 'backward')}
                      style={styles.backButton}
                      accessibilityRole="button"
                      accessibilityLabel="Back to age"
                    >
                      <HugeiconsIcon icon={ArrowLeft01Icon} size={20} color="#0F172A" strokeWidth={2} />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>What are you conquering?</Text>
                      <Text style={styles.cardSub}>Choose the path that fits your studies</Text>
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
                              color={isSelected ? colors.primary : '#64748B'}
                              strokeWidth={2}
                            />
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

                  {/* Contextual Sub-Fields based on selected track */}
                  {selectedTrack === 'high_school' && (
                    <View style={styles.subFieldCard}>
                      <Text style={styles.subFieldLabel}>High School Grade Level</Text>
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
                      <Text style={styles.subFieldLabel}>College Year</Text>
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
                        Major / Program of Study
                      </Text>
                      <TextInput
                        style={styles.textInput}
                        value={collegeCourse}
                        onChangeText={setCollegeCourse}
                        placeholder="e.g. BS Nursing, Computer Science..."
                        placeholderTextColor="#94A3B8"
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
                        placeholderTextColor="#94A3B8"
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
                        placeholderTextColor="#94A3B8"
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

              {/* STAGE 5: STUDY WEAPONS & DAILY HABIT */}
              {stage === 5 && (
                <View style={styles.stageCard}>
                  <View style={styles.cardHeaderRow}>
                    <TouchableOpacity
                      onPress={() => goToStage(4, 'backward')}
                      style={styles.backButton}
                      accessibilityRole="button"
                      accessibilityLabel="Back to academic quest"
                    >
                      <HugeiconsIcon icon={ArrowLeft01Icon} size={20} color="#0F172A" strokeWidth={2} />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>How do you like to study?</Text>
                      <Text style={styles.cardSub}>Choose one or more formats for your reviewers</Text>
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
                              color={isSelected ? colors.primary : '#64748B'}
                              strokeWidth={2}
                            />
                          </View>
                          <View style={{ flex: 1 }}>
                            <View style={styles.formatHeaderRow}>
                              <Text style={[styles.formatTitle, isSelected && styles.formatTitleSelected]}>
                                {f.label}
                              </Text>
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
                              <HugeiconsIcon icon={Tick01Icon} size={13} color="#FFFFFF" strokeWidth={3} />
                            )}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Daily Target Section */}
                  <View style={{ marginTop: spacing[16] }}>
                    <Text style={styles.subFieldLabel}>Daily Target Pacing</Text>
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
                              <Text style={styles.goalFullDesc}>{g.desc}</Text>
                            </View>
                            <View style={[styles.radioCircle, isSelected && styles.radioCircleSelected]}>
                              {isSelected && <View style={styles.radioInner} />}
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  {/* Study Reminders Toggle */}
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
                      <Text style={styles.reminderTitle}>Study reminders</Text>
                      <Text style={styles.reminderDesc}>
                        Save my preference for daily reminders.
                      </Text>
                    </View>
                  </TouchableOpacity>
                </View>
              )}

              {/* STAGE 6: LOCK IN / LAUNCH MODE */}
              {stage === 6 && (
                <View style={styles.stageCard}>
                  <View style={styles.cardHeaderRow}>
                    <TouchableOpacity
                      onPress={() => goToStage(5, 'backward')}
                      style={styles.backButton}
                      accessibilityRole="button"
                      accessibilityLabel="Back to study weapons"
                    >
                      <HugeiconsIcon icon={ArrowLeft01Icon} size={20} color="#0F172A" strokeWidth={2} />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>
                        You're Ready{firstName ? `, ${firstName}` : ''}!
                      </Text>
                      <Text style={styles.cardSub}>Try a sample set or continue to your library</Text>
                    </View>
                  </View>

                  {/* Option A Highlight: Instant Sample Deck */}
                  <View style={styles.launchCardHighlighted}>
                    <View style={styles.launchBadge}>
                      <HugeiconsIcon icon={SparklesIcon} size={12} color={colors.primary} strokeWidth={2.5} />
                      <Text style={styles.launchBadgeText}>No upload needed</Text>
                    </View>
                    <Text style={styles.launchCardTitle}>{preview.title}</Text>
                    <Text style={styles.launchCardDesc}>
                      Get a feel for flashcards and quizzes with a ready-made biology set.
                    </Text>
                    <TouchableOpacity
                      style={styles.sampleActionButton}
                      onPress={handleFinishGuest}
                      disabled={isSeeding}
                      activeOpacity={0.85}
                    >
                      <HugeiconsIcon icon={BookOpen01Icon} size={18} color="#FFFFFF" strokeWidth={2.5} />
                      <Text style={styles.sampleActionText}>
                        {isSeeding ? 'Preparing sample...' : 'Try Sample Deck'}
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
                      Continue to your study library and add your own materials.
                    </Text>
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
        </ScrollView>
        {(stage === 1 || stage === 4 || stage === 5) && (
          <View style={styles.stickyFooter}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => goToStage((stage + 1) as 2 | 5 | 6)}
              accessibilityRole="button"
              accessibilityLabel={stage === 1 ? 'Start setup' : 'Continue to next step'}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryButtonText}>
                {stage === 1 ? 'Get started' : stage === 4 ? 'Continue to study plan' : 'Review my choices'}
              </Text>
              <HugeiconsIcon icon={ArrowRight01Icon} size={18} color="#FFFFFF" strokeWidth={2.5} />
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>
    </JungleBackdrop>
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
    color: '#F8FAFC',
    fontSize: typography.fontSize[11],
    fontWeight: typography.fontWeight.bold,
    letterSpacing: 0.8,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  headerSkipBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: colors.primary,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.primaryLight,
  },
  headerSkipText: {
    fontSize: typography.fontSize[12],
    fontWeight: typography.fontWeight.bold,
    color: '#FFFFFF',
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
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  progressDotActive: {
    backgroundColor: '#818CF8',
    shadowColor: '#818CF8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
    elevation: 4,
  },
  progressDotCompleted: {
    backgroundColor: colors.primary,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing[16],
    paddingBottom: spacing[32],
  },
  stickyFooter: {
    paddingHorizontal: spacing[16],
    paddingTop: spacing[10],
    paddingBottom: spacing[10],
    backgroundColor: 'transparent',
  },
  animatedStepWrapper: {
    width: '100%',
  },
  cardWrapper: {
    width: '100%',
    marginTop: spacing[20],
  },
  momoCapContainer: {
    width: '100%',
    height: 155,
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: 0, // Capped flush on top of the card (zero gap, zero overlap)
    zIndex: 10,
  },
  stageCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 24,
    borderCurve: 'continuous',
    padding: spacing[20],
    paddingTop: spacing[22],
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.8)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 6,
  },
  welcomeHeading: {
    fontSize: 22,
    fontWeight: typography.fontWeight.bold,
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: spacing[6],
  },
  welcomeSub: {
    fontSize: typography.fontSize[13],
    color: '#475569',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: spacing[16],
    paddingHorizontal: spacing[4],
  },
  superpowerList: {
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    borderCurve: 'continuous',
    padding: spacing[14],
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: spacing[20],
    gap: spacing[12],
  },
  superpowerItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  superpowerIconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.primarySoftStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  superpowerTextWrap: {
    flex: 1,
  },
  superpowerTitle: {
    fontSize: typography.fontSize[13],
    fontWeight: typography.fontWeight.bold,
    color: '#0F172A',
    marginBottom: 2,
  },
  superpowerDesc: {
    fontSize: typography.fontSize[11.5],
    color: '#64748B',
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
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
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
    color: '#94A3B8',
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
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: typography.fontWeight.bold,
    color: '#0F172A',
  },
  cardSub: {
    fontSize: typography.fontSize[12],
    color: '#64748B',
    marginTop: 2,
  },
  inputGroup: {
    marginBottom: spacing[4],
  },
  inputLabel: {
    fontSize: typography.fontSize[12.5],
    fontWeight: typography.fontWeight.bold,
    color: '#334155',
    marginBottom: spacing[6],
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    borderCurve: 'continuous',
    paddingHorizontal: spacing[14],
    paddingVertical: Platform.OS === 'ios' ? spacing[12] : spacing[10],
    fontSize: typography.fontSize[14],
    color: '#0F172A',
  },
  trackList: {
    gap: spacing[8],
  },
  trackCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: spacing[12],
    borderRadius: 16,
    borderCurve: 'continuous',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  trackCardSelected: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  trackIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackIconCircleSelected: {
    backgroundColor: colors.primarySoftStrong,
  },
  trackCardTitle: {
    fontSize: typography.fontSize[13.5],
    fontWeight: typography.fontWeight.bold,
    color: '#0F172A',
  },
  trackCardTitleSelected: {
    color: colors.primary,
  },
  trackCardDesc: {
    fontSize: typography.fontSize[11],
    color: '#64748B',
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
    borderColor: colors.primary,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  subFieldCard: {
    marginTop: spacing[12],
    padding: spacing[14],
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  subFieldLabel: {
    fontSize: typography.fontSize[12],
    fontWeight: typography.fontWeight.bold,
    color: '#334155',
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
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  subChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  subChipText: {
    fontSize: typography.fontSize[12],
    fontWeight: typography.fontWeight.medium,
    color: '#334155',
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
    backgroundColor: '#E2E8F0',
  },
  miniChipActive: {
    backgroundColor: colors.primarySoftStrong,
    borderWidth: 1,
    borderColor: colors.primaryLight,
  },
  miniChipText: {
    fontSize: typography.fontSize[11],
    color: '#475569',
    fontWeight: typography.fontWeight.medium,
  },
  miniChipTextActive: {
    color: colors.primary,
    fontWeight: typography.fontWeight.bold,
  },
  formatList: {
    gap: spacing[8],
  },
  formatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: spacing[12],
    borderRadius: 16,
    borderCurve: 'continuous',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  formatCardSelected: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  formatCardAll: {
    borderColor: '#FDE68A',
    backgroundColor: '#FFFBEB',
  },
  formatCardAllSelected: {
    borderColor: '#F59E0B',
    backgroundColor: '#FEF3C7',
  },
  formatHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  formatTitle: {
    fontSize: typography.fontSize[13],
    fontWeight: typography.fontWeight.bold,
    color: '#0F172A',
  },
  formatTitleSelected: {
    color: colors.primary,
  },
  formatDesc: {
    fontSize: typography.fontSize[11],
    color: '#64748B',
    marginTop: 1,
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
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  goalVerticalList: {
    gap: spacing[8],
  },
  goalFullCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: spacing[12],
    borderRadius: 14,
    borderCurve: 'continuous',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  goalFullCardSelected: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
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
    color: '#0F172A',
  },
  goalFullLabelSelected: {
    color: colors.primary,
  },
  goalTagBadge: {
    backgroundColor: '#E2E8F0',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  goalTagBadgeSelected: {
    backgroundColor: colors.primarySoftStrong,
  },
  goalTagBadgeText: {
    fontSize: typography.fontSize[10.5],
    fontWeight: typography.fontWeight.bold,
    color: '#475569',
  },
  goalTagBadgeTextSelected: {
    color: colors.primary,
  },
  goalFullDesc: {
    fontSize: typography.fontSize[11],
    color: '#64748B',
  },
  reminderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: spacing[14],
    padding: spacing[12],
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  reminderCardActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  reminderTitle: {
    fontSize: typography.fontSize[12.5],
    fontWeight: typography.fontWeight.bold,
    color: '#0F172A',
  },
  reminderDesc: {
    fontSize: typography.fontSize[11],
    color: '#64748B',
    marginTop: 1,
  },
  launchCardHighlighted: {
    backgroundColor: colors.primarySoft,
    borderRadius: 18,
    borderCurve: 'continuous',
    borderWidth: 1.5,
    borderColor: colors.primaryLight,
    padding: spacing[16],
    marginBottom: spacing[14],
  },
  launchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    backgroundColor: colors.primarySoftStrong,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginBottom: spacing[6],
  },
  launchBadgeText: {
    fontSize: typography.fontSize[10.5],
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
  },
  launchCardTitle: {
    fontSize: 16,
    fontWeight: typography.fontWeight.bold,
    color: '#0F172A',
    marginBottom: 4,
  },
  launchCardDesc: {
    fontSize: typography.fontSize[12],
    color: '#475569',
    lineHeight: 17,
    marginBottom: spacing[12],
  },
  sampleActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
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
    backgroundColor: '#E2E8F0',
  },
  orText: {
    fontSize: typography.fontSize[11],
    fontWeight: typography.fontWeight.bold,
    color: '#94A3B8',
  },
  launchCardGoogle: {
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: spacing[16],
  },
  googleCardTitle: {
    fontSize: 15,
    fontWeight: typography.fontWeight.bold,
    color: '#0F172A',
    marginBottom: 4,
  },
  googleCardDesc: {
    fontSize: typography.fontSize[12],
    color: '#64748B',
    lineHeight: 17,
    marginBottom: spacing[12],
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
    color: '#0F172A',
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
