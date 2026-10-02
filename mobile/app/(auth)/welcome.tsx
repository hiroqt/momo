import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Switch,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
  ScrollView,
  BackHandler,
  type AccessibilityRole,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, { FadeIn, cubicBezier, useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { AppText as Text } from '@/components/common/app-text';
import { useRouter } from 'expo-router';
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react-native';
import {
  ArrowRight01Icon,
  Atom01Icon,
  BookOpen01Icon,
  Cards01Icon,
  Certificate01Icon,
  Coffee01Icon,
  Fire03Icon,
  Mortarboard01Icon,
  Note01Icon,
  Notification02Icon,
  Quiz01Icon,
  School01Icon,
  SparklesIcon,
  Stethoscope02Icon,
  TaskDone01Icon,
  Timer01Icon,
} from '@hugeicons/core-free-icons';
import { colors, onboardingColors, spacing, typography } from '@/constants/theme';
import {
  useOnboarding,
  StudyTrack,
  PreferredFormat,
} from '../../context/OnboardingContext';
import { seedSampleDeck, buildSampleDeck } from '../../lib/data/sampleDeck';
import { MomoBackdrop } from '@/components/onboarding/MomoBackdrop';
import { MomoLottie } from '@/components/onboarding/MomoLottie';
import { AgeScrollPicker } from '@/components/onboarding/AgeScrollPicker';
import { OnboardingProgress, PopIcon } from '@/components/onboarding/OnboardingMotion';
import { MOMO_STEPS } from '@/components/onboarding/momoSteps';

const TRACK_OPTIONS: { id: StudyTrack; label: string; icon: IconSvgElement }[] = [
  { id: 'college', label: 'College', icon: Mortarboard01Icon },
  { id: 'high_school', label: 'High school', icon: School01Icon },
  { id: 'med_nursing', label: 'Medicine & Nursing', icon: Stethoscope02Icon },
  { id: 'stem', label: 'STEM', icon: Atom01Icon },
  { id: 'boards', label: 'Board exams', icon: Certificate01Icon },
  { id: 'general', label: 'General learning', icon: BookOpen01Icon },
];

const WELCOME_FEATURES: { label: string; icon: IconSvgElement }[] = [
  { label: 'Flashcards', icon: Cards01Icon },
  { label: 'Quizzes', icon: Quiz01Icon },
  { label: 'Summaries', icon: Note01Icon },
];

const HIGH_SCHOOL_GRADES = [
  { id: 'Grade 9', label: 'Grade 9' },
  { id: 'Grade 10', label: 'Grade 10' },
  { id: 'Grade 11', label: 'Grade 11' },
  { id: 'Grade 12', label: 'Grade 12' },
];

const COLLEGE_YEARS = [
  { id: '1st Year', label: '1st Year' },
  { id: '2nd Year', label: '2nd Year' },
  { id: '3rd Year', label: '3rd Year' },
  { id: '4th Year', label: '4th Year' },
  { id: 'Grad', label: 'Grad / 5th+' },
];

const ALL_INDIVIDUAL_FORMATS: PreferredFormat[] = ['flashcards', 'quiz', 'exam', 'summary'];

const FORMAT_OPTIONS: { id: PreferredFormat; label: string; icon: IconSvgElement }[] = [
  { id: 'flashcards', label: 'Flashcards', icon: Cards01Icon },
  { id: 'quiz', label: 'Quizzes', icon: Quiz01Icon },
  { id: 'exam', label: 'Practice exams', icon: TaskDone01Icon },
  { id: 'summary', label: 'Summaries', icon: Note01Icon },
];

const GOAL_OPTIONS: { minutes: number; label: string; icon: IconSvgElement }[] = [
  { minutes: 10, label: '10 min', icon: Coffee01Icon },
  { minutes: 20, label: '20 min', icon: Timer01Icon },
  { minutes: 45, label: '45 min', icon: Fire03Icon },
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

const PRESS_EASE = cubicBezier(0.23, 1, 0.32, 1);

/** Pressable that scales to 0.97 on press-in (opacity dip under Reduce Motion). */
function PressScale({
  onPress,
  disabled,
  style,
  contentStyle,
  accessibilityRole = 'button',
  accessibilityLabel,
  accessibilityState,
  children,
}: {
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle: StyleProp<ViewStyle>;
  accessibilityRole?: AccessibilityRole;
  accessibilityLabel: string;
  accessibilityState?: { selected?: boolean; checked?: boolean; expanded?: boolean; disabled?: boolean };
  children: React.ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      style={style}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      disabled={disabled}
      hitSlop={4}
      pressRetentionOffset={12}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled, ...accessibilityState }}
    >
      <Animated.View
        style={[
          contentStyle,
          {
            transform: [{ scale: pressed && !reduceMotion ? 0.97 : 1 }],
            opacity: pressed && reduceMotion ? 0.8 : 1,
            transitionProperty: ['transform', 'opacity'],
            transitionDuration: 120,
            transitionTimingFunction: PRESS_EASE,
          },
        ]}
      >
        {children}
      </Animated.View>
    </Pressable>
  );
}

/** Compact single- or multi-select choice. One accent: selected = primary fill. */
function ChoicePill({
  label,
  selected,
  multi,
  quiet,
  expanded,
  icon,
  index = 0,
  onPress,
}: {
  label: string;
  selected: boolean;
  multi?: boolean;
  /** Secondary "More / Choose my own" style. */
  quiet?: boolean;
  expanded?: boolean;
  /** Pops in on appear and bounces when selected. */
  icon?: IconSvgElement;
  /** Stagger position for the icon pop. */
  index?: number;
  onPress: () => void;
}) {
  const role: AccessibilityRole = quiet ? 'button' : multi ? 'checkbox' : 'radio';
  const state = quiet
    ? { expanded }
    : multi
      ? { checked: selected }
      : { selected };
  return (
    <PressScale
      onPress={onPress}
      accessibilityRole={role}
      accessibilityLabel={label}
      accessibilityState={state}
      contentStyle={[styles.pill, icon && styles.pillWithIcon, quiet && styles.pillQuiet, selected && styles.pillSelected]}
    >
      {icon && <PopIcon icon={icon} selected={selected} index={index} size={16} />}
      <Text style={[styles.pillText, quiet && styles.pillTextQuiet, selected && styles.pillTextSelected]}>
        {label}
      </Text>
    </PressScale>
  );
}

export default function WelcomeScreen() {
  const router = useRouter();
  const { completeWelcome } = useOnboarding();
  const { height: viewportHeight } = useWindowDimensions();
  const compactLayout = viewportHeight < 760;
  const reduceMotion = useReducedMotion();

  // Each page asks for one understandable decision and keeps the next action visible.
  const [stage, setStage] = useState<OnboardingStage>(1);
  const [showAllTracks, setShowAllTracks] = useState(false);
  const [customizeFormats, setCustomizeFormats] = useState(false);
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (stage === 1) return false;
      setStage((current) => (current - 1) as OnboardingStage);
      return true;
    });
    return () => subscription.remove();
  }, [stage]);

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

  // Each step has its own rigged Momo act (see momoSteps.ts).
  const momoStep = MOMO_STEPS[stage];

  // Opacity-only stagger for headline / subline / options; layout never shifts.
  const fadeIn = (index: number) => (reduceMotion ? undefined : FadeIn.duration(200).delay(index * 60));

  const triggerHaptic = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
  };

  const goToStage = (nextStage: OnboardingStage) => {
    setCompletionError(null);
    triggerHaptic();
    setStage(nextStage);
  };

  const handleToggleFormat = (id: PreferredFormat | 'all') => {
    triggerHaptic();
    if (id === 'all') {
      const isAllSelected = selectedFormats.includes('all');
      if (isAllSelected) {
        setSelectedFormats(['flashcards']);
        setCustomizeFormats(true);
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

  const visibleTracks = showAllTracks
    ? TRACK_OPTIONS
    : TRACK_OPTIONS.filter((t, index) => index < 2 || t.id === selectedTrack);
  const customFormatCount = selectedFormats.filter((format) => format !== 'all').length;
  const selectedTrackOption = TRACK_OPTIONS.find((t) => t.id === selectedTrack) ?? TRACK_OPTIONS[0];
  const summaryRows: { label: string; value: string; icon: IconSvgElement }[] = [
    { label: 'Studying', value: selectedTrackOption.label, icon: selectedTrackOption.icon },
    { label: 'Daily goal', value: `${selectedGoal} min`, icon: Timer01Icon },
    {
      label: 'Formats',
      value: selectedFormats.includes('all') ? 'Momo picks' : `${customFormatCount} chosen`,
      icon: Cards01Icon,
    },
  ];

  const renderHeader = (title: string, subtitle: string) => (
    <View style={styles.questionHeader}>
      <Animated.View entering={fadeIn(0)}>
        <Text style={styles.cardTitle} accessibilityRole="header">{title}</Text>
      </Animated.View>
      <Animated.View entering={fadeIn(1)}>
        <Text style={styles.cardSub}>{subtitle}</Text>
      </Animated.View>
    </View>
  );

  const renderCourseInput = (label: string, placeholder: string, autoCapitalize: 'words' | 'sentences') => (
    <>
      <Text style={styles.groupLabel}>{label}</Text>
      <TextInput
        style={styles.textInput}
        value={collegeCourse}
        onChangeText={setCollegeCourse}
        placeholder={placeholder}
        placeholderTextColor={onboardingColors.textMuted}
        autoCapitalize={autoCapitalize}
        accessibilityLabel={label}
        maxLength={60}
      />
    </>
  );

  const primaryLabel = stage === 1
    ? 'Let’s begin'
    : stage === 7
      ? 'Build my preview'
      : stage === 8
        ? isSeeding ? 'Preparing...' : 'Open my sample'
        : 'Next';

  return (
    <MomoBackdrop>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.topHeader}>
          <OnboardingProgress step={stage} total={8} label={STAGE_LABELS[stage - 1]} />
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

        <KeyboardAvoidingView
          style={styles.pageContent}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
        >
          <ScrollView
            key={stage}
            style={styles.stepScroll}
            contentContainerStyle={styles.stepContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
            contentInsetAdjustmentBehavior="automatic"
          >
            {stage === 1 && <Text style={styles.brandName}>Momo</Text>}

            {/* One rigged Momo act per step; acts never repeat (see momoSteps.ts). */}
            <View style={[styles.momoSlot, compactLayout && styles.momoSlotCompact]}>
              <MomoLottie
                key={stage}
                step={momoStep}
                size={stage === 1 ? (compactLayout ? 230 : 290) : compactLayout ? 180 : 250}
              />
            </View>

            <View style={styles.stageBody}>
              {stage === 1 && (
                <>
                  {renderHeader('Less overwhelm.\nMore “I’ve got this.”', 'Turn your notes into a reviewer.')}
                  <Animated.View entering={fadeIn(2)} style={styles.featureRow} accessible accessibilityLabel="Flashcards, quizzes and summaries">
                    {WELCOME_FEATURES.map((f, i) => (
                      <View key={f.label} style={styles.featureChip}>
                        <PopIcon icon={f.icon} index={i + 2} size={16} />
                        <Text style={styles.featureText}>{f.label}</Text>
                      </View>
                    ))}
                  </Animated.View>
                </>
              )}

              {stage === 2 && (
                <>
                  {renderHeader('What should Momo call you?', 'Optional.')}
                  <Animated.View entering={fadeIn(2)}>
                    <TextInput
                      style={styles.textInput}
                      value={firstName}
                      onChangeText={setFirstName}
                      placeholder="Your name"
                      placeholderTextColor={onboardingColors.textMuted}
                      autoCapitalize="words"
                      autoCorrect={false}
                      maxLength={40}
                      accessibilityLabel="Your name, optional"
                      returnKeyType="done"
                      onSubmitEditing={() => goToStage(3)}
                    />
                  </Animated.View>
                </>
              )}

              {stage === 3 && (
                <>
                  {renderHeader('How old are you?', 'Helps Momo match your pace.')}
                  <Animated.View entering={fadeIn(2)}>
                    <AgeScrollPicker value={selectedAge} onChange={setSelectedAge} minAge={13} maxAge={80} />
                  </Animated.View>
                </>
              )}

              {stage === 4 && (
                <>
                  {renderHeader('What are you studying?', 'Pick the closest match.')}
                  <Animated.View entering={fadeIn(2)} style={styles.pillWrap}>
                    {visibleTracks.map((t, i) => (
                      <ChoicePill
                        key={t.id}
                        icon={t.icon}
                        index={i}
                        label={t.label}
                        selected={selectedTrack === t.id}
                        onPress={() => {
                          triggerHaptic();
                          setSelectedTrack(t.id);
                        }}
                      />
                    ))}
                    <ChoicePill
                      quiet
                      label={showAllTracks ? 'Less' : 'More'}
                      selected={false}
                      expanded={showAllTracks}
                      onPress={() => setShowAllTracks((value) => !value)}
                    />
                  </Animated.View>
                </>
              )}

              {stage === 5 && (
                <>
                  {renderHeader('Your study focus', 'This tunes your examples.')}
                  <Animated.View entering={fadeIn(2)}>
                    {selectedTrack === 'high_school' && (
                      <>
                        <Text style={styles.groupLabel}>Grade</Text>
                        <View style={styles.pillWrap}>
                          {HIGH_SCHOOL_GRADES.map((g) => (
                            <ChoicePill
                              key={g.id}
                              label={g.label}
                              selected={highSchoolGrade === g.id}
                              onPress={() => {
                                triggerHaptic();
                                setHighSchoolGrade(g.id);
                              }}
                            />
                          ))}
                        </View>
                      </>
                    )}

                    {(selectedTrack === 'college' || selectedTrack === 'med_nursing' || selectedTrack === 'stem') && (
                      <>
                        <Text style={styles.groupLabel}>Year</Text>
                        <View style={styles.pillWrap}>
                          {COLLEGE_YEARS.map((y) => (
                            <ChoicePill
                              key={y.id}
                              label={y.label}
                              selected={collegeYear === y.id}
                              onPress={() => {
                                triggerHaptic();
                                setCollegeYear(y.id);
                              }}
                            />
                          ))}
                        </View>
                        {renderCourseInput('Program (optional)', 'e.g. Nursing', 'words')}
                      </>
                    )}

                    {selectedTrack === 'boards' && renderCourseInput('Exam (optional)', 'e.g. NCLEX-RN', 'sentences')}
                    {selectedTrack === 'general' && renderCourseInput('Topic (optional)', 'e.g. Spanish', 'sentences')}
                  </Animated.View>
                </>
              )}

              {stage === 6 && (
                <>
                  {renderHeader('How do you like to study?', 'Momo can pick for you.')}
                  <Animated.View entering={fadeIn(2)} style={styles.pillWrap}>
                    <ChoicePill
                      multi
                      icon={SparklesIcon}
                      label="Let Momo pick"
                      selected={selectedFormats.includes('all')}
                      onPress={() => handleToggleFormat('all')}
                    />
                    <ChoicePill
                      quiet
                      label={customizeFormats
                        ? 'Hide choices'
                        : selectedFormats.includes('all') ? 'Choose my own' : `My formats (${customFormatCount})`}
                      selected={false}
                      expanded={customizeFormats}
                      onPress={() => setCustomizeFormats((value) => !value)}
                    />
                  </Animated.View>
                  {customizeFormats && (
                    <Animated.View entering={fadeIn(0)} style={[styles.pillWrap, styles.pillWrapSpaced]}>
                      {FORMAT_OPTIONS.map((f, i) => (
                        <ChoicePill
                          key={f.id}
                          multi
                          icon={f.icon}
                          index={i}
                          label={f.label}
                          selected={selectedFormats.includes(f.id)}
                          onPress={() => handleToggleFormat(f.id)}
                        />
                      ))}
                    </Animated.View>
                  )}
                </>
              )}

              {stage === 7 && (
                <>
                  {renderHeader('A little time, every day', 'Start with something realistic.')}
                  <Animated.View entering={fadeIn(2)}>
                    <View style={styles.pillWrap}>
                      {GOAL_OPTIONS.map((g, i) => (
                        <ChoicePill
                          key={g.minutes}
                          icon={g.icon}
                          index={i}
                          label={g.label}
                          selected={selectedGoal === g.minutes}
                          onPress={() => {
                            triggerHaptic();
                            setSelectedGoal(g.minutes);
                          }}
                        />
                      ))}
                    </View>
                    <View style={styles.reminderRow}>
                      <View style={styles.reminderLead}>
                        <PopIcon icon={Notification02Icon} selected={studyRemindersEnabled} index={3} size={16} />
                        <Text style={styles.reminderLabel}>Remind me daily</Text>
                      </View>
                      <Switch
                        value={studyRemindersEnabled}
                        onValueChange={(value) => {
                          triggerHaptic();
                          setStudyRemindersEnabled(value);
                        }}
                        trackColor={{ false: onboardingColors.border, true: onboardingColors.primary }}
                        ios_backgroundColor={onboardingColors.border}
                        accessibilityLabel="Remind me daily"
                      />
                    </View>
                  </Animated.View>
                </>
              )}

              {stage === 8 && (
                <>
                  {renderHeader('Your sample is ready', 'Saved on this device.')}
                  <Animated.View entering={fadeIn(2)} style={styles.summaryCard}>
                    <Text style={styles.summaryTitle} numberOfLines={2}>{preview.title}</Text>
                    {summaryRows.map((row, i) => (
                      <View key={row.label} style={styles.summaryRow}>
                        <PopIcon icon={row.icon} index={i + 1} size={16} />
                        <Text style={styles.summaryLabel}>{row.label}</Text>
                        <Text style={styles.summaryValue} numberOfLines={1}>{row.value}</Text>
                      </View>
                    ))}
                  </Animated.View>
                </>
              )}
            </View>
          </ScrollView>

          <View style={styles.stickyFooter}>
            {stage > 1 && (
              <TouchableOpacity
                style={styles.footerBackButton}
                onPress={() => goToStage((stage - 1) as OnboardingStage)}
                accessibilityRole="button"
                accessibilityLabel={stage === 8 ? 'Back to daily rhythm' : 'Go back'}
                activeOpacity={0.7}
              >
                <Text style={styles.footerBackText}>Back</Text>
              </TouchableOpacity>
            )}
            <PressScale
              style={styles.primaryButtonWrap}
              contentStyle={styles.primaryButton}
              disabled={stage === 8 && isSeeding}
              onPress={() => {
                if (stage === 8) {
                  handleFinishGuest();
                } else {
                  goToStage((stage + 1) as OnboardingStage);
                }
              }}
              accessibilityLabel={
                stage === 1
                  ? 'Begin setup'
                  : stage === 2
                    ? 'Continue to age selector'
                    : stage === 8
                      ? 'Open my sample'
                      : 'Continue to next step'
              }
            >
              <Text style={styles.primaryButtonText}>{primaryLabel}</Text>
              {stage !== 8 && (
                <HugeiconsIcon icon={ArrowRight01Icon} size={18} color="#FFFFFF" strokeWidth={2.5} />
              )}
            </PressScale>
          </View>
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
    paddingHorizontal: spacing[24],
    paddingTop: spacing[14],
    paddingBottom: spacing[12],
    gap: spacing[20],
    zIndex: 10,
  },
  headerSkipBtn: {
    minWidth: 48,
    minHeight: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  headerSkipText: {
    fontSize: typography.fontSize[14],
    fontFamily: typography.fontFamily.bold,
    color: onboardingColors.textSecondary,
  },
  featureRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing[8],
  },
  featureChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[6],
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[8],
    borderRadius: 999,
    borderCurve: 'continuous',
    backgroundColor: onboardingColors.surface,
    borderWidth: 1,
    borderColor: onboardingColors.border,
  },
  featureText: {
    fontSize: typography.fontSize[12],
    fontFamily: typography.fontFamily.semiBold,
    color: onboardingColors.text,
  },
  summaryCard: {
    backgroundColor: onboardingColors.surface,
    borderRadius: 20,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: onboardingColors.border,
    padding: spacing[16],
    gap: spacing[12],
    boxShadow: '0 6px 18px rgba(36, 31, 58, 0.06)',
  },
  summaryTitle: {
    fontSize: typography.fontSize[16],
    fontFamily: typography.fontFamily.bold,
    color: onboardingColors.text,
    marginBottom: spacing[2],
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[10],
  },
  summaryLabel: {
    flex: 1,
    fontSize: typography.fontSize[14],
    fontFamily: typography.fontFamily.semiBold,
    color: onboardingColors.textSecondary,
  },
  summaryValue: {
    flexShrink: 1,
    fontSize: typography.fontSize[14],
    fontFamily: typography.fontFamily.bold,
    color: onboardingColors.text,
  },
  reminderLead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[10],
  },
  pageContent: {
    flex: 1,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    paddingHorizontal: spacing[8],
  },
  stepScroll: { flex: 1 },
  stepContent: {
    width: '100%',
    flexGrow: 1,
    paddingBottom: spacing[24],
  },
  brandName: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 34,
    lineHeight: 40,
    color: onboardingColors.text,
    letterSpacing: -1.2,
    textAlign: 'center',
    marginTop: spacing[8],
  },
  momoSlot: {
    width: '100%',
    minHeight: 250,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[4],
  },
  momoSlotCompact: {
    minHeight: 180,
    marginBottom: 0,
  },
  stageBody: {
    paddingHorizontal: spacing[24],
    paddingTop: spacing[4],
  },
  questionHeader: {
    alignItems: 'center',
    marginBottom: spacing[20],
  },
  cardTitle: {
    fontSize: 28,
    fontFamily: typography.fontFamily.bold,
    color: onboardingColors.text,
    lineHeight: 35,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  cardSub: {
    fontSize: typography.fontSize[14],
    color: onboardingColors.textSecondary,
    lineHeight: 21,
    marginTop: spacing[6],
    textAlign: 'center',
  },
  groupLabel: {
    fontSize: typography.fontSize[12],
    fontFamily: typography.fontFamily.semiBold,
    color: onboardingColors.textSecondary,
    textAlign: 'center',
    marginTop: spacing[16],
    marginBottom: spacing[8],
  },
  textInput: {
    minHeight: 62,
    backgroundColor: onboardingColors.surfaceMuted,
    borderWidth: 1,
    borderColor: onboardingColors.border,
    borderRadius: 20,
    borderCurve: 'continuous',
    paddingHorizontal: spacing[18],
    paddingVertical: Platform.OS === 'ios' ? spacing[14] : spacing[12],
    fontSize: typography.fontSize[16],
    fontFamily: typography.fontFamily.semiBold,
    color: onboardingColors.text,
  },
  pillWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing[8],
  },
  pillWrapSpaced: {
    marginTop: spacing[16],
  },
  pill: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing[16],
    borderRadius: 999,
    borderCurve: 'continuous',
    backgroundColor: onboardingColors.surface,
    borderWidth: 1,
    borderColor: onboardingColors.border,
  },
  pillWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[6],
    paddingLeft: spacing[12],
  },
  pillQuiet: {
    backgroundColor: 'transparent',
    borderColor: onboardingColors.primaryBorder,
  },
  pillSelected: {
    backgroundColor: onboardingColors.primary,
    borderColor: onboardingColors.primary,
  },
  pillText: {
    fontSize: typography.fontSize[14],
    fontFamily: typography.fontFamily.semiBold,
    color: onboardingColors.text,
  },
  pillTextQuiet: {
    color: onboardingColors.primaryPressed,
  },
  pillTextSelected: {
    color: '#FFFFFF',
  },
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 52,
    marginTop: spacing[20],
    paddingHorizontal: spacing[4],
  },
  reminderLabel: {
    fontSize: typography.fontSize[14],
    fontFamily: typography.fontFamily.semiBold,
    color: onboardingColors.text,
  },
  stickyFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[14],
    paddingHorizontal: spacing[16],
    paddingTop: spacing[12],
    paddingBottom: spacing[12],
  },
  primaryButtonWrap: {
    flex: 1,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: onboardingColors.primary,
    paddingVertical: spacing[14],
    paddingHorizontal: spacing[20],
    minHeight: 54,
    borderRadius: 18,
    borderCurve: 'continuous',
    gap: spacing[8],
  },
  primaryButtonText: {
    fontSize: typography.fontSize[14],
    fontFamily: typography.fontFamily.bold,
    color: '#FFFFFF',
  },
  footerBackButton: {
    minWidth: 76,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerBackText: {
    color: onboardingColors.text,
    fontSize: typography.fontSize[14],
    fontFamily: typography.fontFamily.bold,
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
