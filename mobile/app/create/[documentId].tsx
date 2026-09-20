import React, { useEffect, useState, useRef } from 'react';
import { colors, spacing, typography } from '@/constants/theme';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
  Animated,
  KeyboardAvoidingView,
} from 'react-native';
import { AppText as Text, AppTextInput as TextInput } from '@/components/common/app-text';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  Tick01Icon,
  Add01Icon,
  SparklesIcon,
  ArrowRight01Icon,
  ArrowLeft01Icon,
  BookOpen01Icon,
  CheckmarkCircle02Icon,
  Clock01Icon,
  Edit02Icon,
  FlashIcon,
  Target02Icon,
  Layers01Icon,
  Task01Icon,
} from '@hugeicons/core-free-icons';
import { createGeneration } from '../../lib/api/generations';
import { getDocument } from '../../lib/api/documents';
import { PageHeader } from '../../components/common/PageHeader';
import { PlatformPressable } from '../../components/common/PlatformPressable';
import { SmoothScrollView } from '../../components/common/SmoothScrollView';
import { isIpad } from '../../utils/device';

const TOTAL_STEPS = 6;

const STEP_TITLES = [
  'Reviewer Name',
  'Study Topic',
  'Question Count',
  'Difficulty Level',
  'Study Formats',
  'Question Timer',
];

export default function CreateReviewerScreen() {
  const { documentId } = useLocalSearchParams<{ documentId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Step state (1 to 5)
  const [currentStep, setCurrentStep] = useState(1);
  const progressAnim = useRef(new Animated.Value(1 / TOTAL_STEPS)).current;

  // Step 1: Name
  const [title, setTitle] = useState('');

  // Step 2: Topic
  const [topic, setTopic] = useState('');
  const [suggestedTopics, setSuggestedTopics] = useState<string[]>([]);
  const [documentName, setDocumentName] = useState('');

  // Step 3: Count
  const [count, setCount] = useState('20');

  // Step 4: Difficulty
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');

  // Step 5: Formats & Instructions
  const [formats, setFormats] = useState<{ [key: string]: boolean }>({
    flashcard: true,
    multiple_choice: true,
    true_false: false,
    identification: false,
  });
  const [instructions, setInstructions] = useState('');
  const [timerOption, setTimerOption] = useState<'none' | '15' | '30' | '45' | '60' | 'custom'>('none');
  const [customTimer, setCustomTimer] = useState('90');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!documentId) return;
    getDocument(documentId)
      .then((res) => {
        if (res.original_filename) {
          setDocumentName(res.original_filename);
          // Set smart default title if empty
          const baseName = res.original_filename.replace(/\.[^/.]+$/, '');
          setTitle(`${baseName} Reviewer`);
        }
        if (res.suggested_topics && res.suggested_topics.length > 0) {
          setSuggestedTopics(res.suggested_topics);
          setTopic(res.suggested_topics[0]);
          if (!title) {
            const rawTopic = res.suggested_topics[0];
            const cleanTopic = rawTopic.replace(/^entire\s+document\s*(?:\((.*?)\))?/i, '$1').trim();
            setTitle(`${cleanTopic || res.original_filename?.replace(/\.[^/.]+$/, '') || 'Study'} Reviewer`);
          }
        }
      })
      .catch((err) => {
        console.warn('Failed to load document details:', err);
      });
  }, [documentId]);

  const animateProgress = (targetStep: number) => {
    Animated.timing(progressAnim, {
      toValue: targetStep / TOTAL_STEPS,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  const goToNextStep = () => {
    // Step-by-step validations
    if (currentStep === 1) {
      if (!title.trim()) {
        Alert.alert('Name Required', 'Please enter a name for your reviewer.');
        return;
      }
    } else if (currentStep === 2) {
      if (!topic.trim()) {
        Alert.alert('Topic Required', 'Please enter or select a topic to study.');
        return;
      }
    } else if (currentStep === 5) {
      const selectedTypes = Object.keys(formats).filter((k) => formats[k]);
      if (selectedTypes.length === 0) {
        Alert.alert('Selection Required', 'Please select at least one study format.');
        return;
      }
    } else if (currentStep === 6) {
      handleGenerate();
      return;
    }

    const next = Math.min(currentStep + 1, TOTAL_STEPS);
    setCurrentStep(next);
    animateProgress(next);
  };

  const goToPreviousStep = () => {
    if (currentStep > 1) {
      const prev = currentStep - 1;
      setCurrentStep(prev);
      animateProgress(prev);
    } else {
      router.back();
    }
  };

  const toggleFormat = (key: string) => {
    setFormats((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleGenerate = async () => {
    const selectedTypes = Object.keys(formats).filter((k) => formats[k]);
    if (selectedTypes.length === 0) {
      Alert.alert('Selection Required', 'Please select at least one study format.');
      return;
    }

    setIsSubmitting(true);
    try {
      const parsedCustom = parseInt(customTimer, 10);
      const timerSeconds =
        timerOption === 'none'
          ? undefined
          : timerOption === 'custom'
          ? (Number.isFinite(parsedCustom) && parsedCustom > 0 ? parsedCustom : 60)
          : parseInt(timerOption, 10);

      const job = await createGeneration({
        document_id: documentId,
        title: title.trim() || `${topic.trim()} Reviewer`,
        topic: topic.trim() || 'Core Document Concepts',
        count: parseInt(count, 10) || 20,
        difficulty,
        question_types: selectedTypes,
        custom_instruction: instructions.trim() || undefined,
        source_only: true,
        time_limit_per_question: timerSeconds,
      });

      router.replace(`/generation/${job.generation_id}`);
    } catch (err: any) {
      Alert.alert('Generation Error', err.message);
      setIsSubmitting(false);
    }
  };

  const progressPercentWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <PageHeader
        title="Create Reviewer"
        subtitle={`Step ${currentStep} of ${TOTAL_STEPS} • ${STEP_TITLES[currentStep - 1]}`}
        onBack={goToPreviousStep}
      />

      {/* Top Progressive Bar */}
      <View style={styles.topProgressArea}>
        <View style={styles.stepTrack}>
          <Animated.View style={[styles.stepBarFill, { width: progressPercentWidth }]} />
        </View>

        {/* Step indicator pills */}
        <View style={styles.stepPillRow}>
          {STEP_TITLES.map((t, idx) => {
            const stepNum = idx + 1;
            const isCompleted = currentStep > stepNum;
            const isCurrent = currentStep === stepNum;
            return (
              <View key={idx} style={styles.pillItem}>
                <View
                  style={[
                    styles.pillDot,
                    isCompleted && styles.pillDotCompleted,
                    isCurrent && styles.pillDotCurrent,
                  ]}
                >
                  {isCompleted ? (
                    <HugeiconsIcon icon={Tick01Icon} size={10} color={colors.onPrimary} strokeWidth={3} />
                  ) : (
                    <Text
                      style={[
                        styles.pillNumber,
                        isCurrent && styles.pillNumberCurrent,
                      ]}
                    >
                      {stepNum}
                    </Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      </View>

      <SmoothScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, spacing[24]) + spacing[90] },
        ]}
      >
        {/* STEP 1: Name of the Reviewer */}
        {currentStep === 1 && (
          <View style={styles.stepSection}>
            <View style={styles.sectionHeader}>
              <View style={styles.stepTitleRow}>
                <View style={styles.stepIconBox}>
                  <HugeiconsIcon icon={Edit02Icon} size={18} color={colors.primary} strokeWidth={2.2} />
                </View>
                <Text style={styles.stepTitle}>Name your reviewer</Text>
              </View>
              <Text style={styles.stepDesc}>
                Give your study reviewer a clear, memorable title so you can easily find it in your library.
              </Text>
            </View>

            <View style={styles.inputWrapper}>
              <Text style={styles.label}>Reviewer Title</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Cardiovascular Exam Prep, Biology Ch. 3"
                placeholderTextColor={colors.textDisabled}
                value={title}
                onChangeText={setTitle}
                autoFocus={true}
                returnKeyType="next"
                onSubmitEditing={goToNextStep}
              />
            </View>

            {documentName ? (
              <View style={styles.docHintBox}>
                <Text style={styles.docHintLabel}>Source Document:</Text>
                <Text style={styles.docHintValue} numberOfLines={1}>{documentName}</Text>
              </View>
            ) : null}
          </View>
        )}

        {/* STEP 2: Topic Selection */}
        {currentStep === 2 && (
          <View style={styles.stepSection}>
            <View style={styles.sectionHeader}>
              <View style={styles.stepTitleRow}>
                <View style={styles.stepIconBox}>
                  <HugeiconsIcon icon={Target02Icon} size={18} color={colors.primary} strokeWidth={2.2} />
                </View>
                <Text style={styles.stepTitle}>What topic are you studying?</Text>
              </View>
              <Text style={styles.stepDesc}>
                Pick an extracted topic from your material or type a specific concept to focus on.
              </Text>
            </View>

            {suggestedTopics.length > 0 && (
              <View style={styles.suggestedArea}>
                <Text style={styles.sublabel}>Key topics found in your document:</Text>
                <View style={styles.suggestedContainer}>
                  {suggestedTopics.map((item) => {
                    const isSelected = topic === item;
                    return (
                      <TouchableOpacity
                        key={item}
                        style={[styles.topicChip, isSelected && styles.activeTopicChip]}
                        onPress={() => {
                          setTopic(item);
                          if (!title || title.endsWith('Reviewer')) {
                            setTitle(`${item} Reviewer`);
                          }
                        }}
                        activeOpacity={0.7}
                      >
                        <HugeiconsIcon
                          icon={isSelected ? Tick01Icon : Add01Icon}
                          size={13}
                          color={isSelected ? colors.primary : colors.textMuted}
                          strokeWidth={2.5}
                        />
                        <Text style={[styles.topicChipText, isSelected && styles.activeTopicChipText]}>
                          {item}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            <View style={styles.inputWrapper}>
              <Text style={styles.label}>Selected Topic</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Action Potential, Cardiac Cycle, Chapter 4"
                placeholderTextColor={colors.textDisabled}
                value={topic}
                onChangeText={setTopic}
                returnKeyType="next"
                onSubmitEditing={goToNextStep}
              />
            </View>
          </View>
        )}

        {/* STEP 3: Question Count */}
        {currentStep === 3 && (
          <View style={styles.stepSection}>
            <View style={styles.sectionHeader}>
              <View style={styles.stepTitleRow}>
                <View style={styles.stepIconBox}>
                  <HugeiconsIcon icon={Layers01Icon} size={18} color={colors.primary} strokeWidth={2.2} />
                </View>
                <Text style={styles.stepTitle}>How many items?</Text>
              </View>
              <Text style={styles.stepDesc}>
                Choose the target number of cards and questions. Select Maximum Coverage (50) to generate as many flashcards and questions as possible from your material.
              </Text>
            </View>

            <View style={styles.countGrid}>
              {[
                { num: '10', label: 'Quick Warmup', badge: '5 mins' },
                { num: '20', label: 'Recommended', badge: 'Standard deck' },
                { num: '30', label: 'Deep Practice', badge: 'Comprehensive' },
                { num: '50', label: 'Maximum Coverage', badge: 'As many as possible' },
              ].map((c) => {
                const isSelected = count === c.num;
                return (
                  <TouchableOpacity
                    key={c.num}
                    style={[styles.countCard, isSelected && styles.countCardActive]}
                    onPress={() => setCount(c.num)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.countCardTop}>
                      <Text style={[styles.countCardNum, isSelected && styles.countCardNumActive]}>
                        {c.num}
                      </Text>
                      <View style={[styles.countBadge, isSelected && styles.countBadgeActive]}>
                        <Text style={[styles.countBadgeText, isSelected && styles.countBadgeTextActive]}>
                          {c.badge}
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.countCardLabel, isSelected && styles.countCardLabelActive]}>
                      {c.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* STEP 4: Difficulty */}
        {currentStep === 4 && (
          <View style={styles.stepSection}>
            <View style={styles.sectionHeader}>
              <View style={styles.stepTitleRow}>
                <View style={styles.stepIconBox}>
                  <HugeiconsIcon icon={FlashIcon} size={18} color={colors.primary} strokeWidth={2.2} />
                </View>
                <Text style={styles.stepTitle}>Choose difficulty level</Text>
              </View>
              <Text style={styles.stepDesc}>
                Adjust question complexity, distractor subtlety, and depth of explanation.
              </Text>
            </View>

            <View style={styles.diffCardList}>
              {[
                {
                  id: 'easy',
                  label: 'Easy',
                  color: colors.success,
                  bg: colors.successSoft,
                  borderColor: colors.successBorder,
                  desc: 'Core definitions, foundational terms, and direct factual recall.',
                },
                {
                  id: 'medium',
                  label: 'Medium (Balanced)',
                  color: colors.primary,
                  bg: colors.primarySoft,
                  borderColor: colors.primaryBorder,
                  desc: 'Cause-and-effect relationships, mechanisms, and interactions between concepts.',
                },
                {
                  id: 'hard',
                  label: 'Hard (Mastery)',
                  color: colors.warning,
                  bg: colors.warningSoft,
                  borderColor: colors.warningBorder,
                  desc: 'In-depth mechanisms, clinical scenarios, nuanced distinctions, and multi-step pathways.',
                },
              ].map((d) => {
                const isSelected = difficulty === d.id;
                return (
                  <TouchableOpacity
                    key={d.id}
                    style={[
                      styles.diffCard,
                      isSelected && {
                        borderColor: d.color,
                        backgroundColor: d.bg,
                      },
                    ]}
                    onPress={() => setDifficulty(d.id as any)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.diffHeader}>
                      <View
                        style={[
                          styles.diffRadio,
                          isSelected && { borderColor: d.color, backgroundColor: d.color },
                        ]}
                      >
                        {isSelected && <View style={styles.diffRadioInner} />}
                      </View>
                      <Text style={[styles.diffTitle, isSelected && { color: d.color }]}>
                        {d.label}
                      </Text>
                    </View>
                    <Text style={styles.diffDesc}>{d.desc}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* STEP 5: Study Formats & Additional Instructions */}
        {currentStep === 5 && (
          <View style={styles.stepSection}>
            <View style={styles.sectionHeader}>
              <View style={styles.stepTitleRow}>
                <View style={styles.stepIconBox}>
                  <HugeiconsIcon icon={Task01Icon} size={18} color={colors.primary} strokeWidth={2.2} />
                </View>
                <Text style={styles.stepTitle}>Select study formats</Text>
              </View>
              <Text style={styles.stepDesc}>
                Only the study formats you check below will be generated and shown in your reviewer.
              </Text>
            </View>

            {/* Study Formats checkboxes */}
            <View style={styles.formatGroup}>
              {[
                {
                  key: 'flashcard',
                  label: 'Flashcards',
                  desc: 'Key concept prompts & concise recall answers',
                  icon: BookOpen01Icon,
                },
                {
                  key: 'multiple_choice',
                  label: 'Multiple Choice',
                  desc: '4 options with 1 verified correct answer',
                  icon: CheckmarkCircle02Icon,
                },
                {
                  key: 'true_false',
                  label: 'True / False',
                  desc: 'Fast concept validation statements',
                  icon: Tick01Icon,
                },
                {
                  key: 'identification',
                  label: 'Identification',
                  desc: 'Active recall short answers typed in directly',
                  icon: Edit02Icon,
                },
              ].map((fmt) => {
                const isChecked = formats[fmt.key];
                return (
                  <TouchableOpacity
                    key={fmt.key}
                    style={[styles.formatCard, isChecked && styles.formatCardChecked]}
                    onPress={() => toggleFormat(fmt.key)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.checkbox, isChecked && styles.checkboxChecked]}>
                      {isChecked && (
                        <HugeiconsIcon icon={Tick01Icon} size={13} color={colors.onPrimary} strokeWidth={3} />
                      )}
                    </View>
                    <View style={styles.formatInfo}>
                      <Text style={[styles.formatTitle, isChecked && styles.formatTitleChecked]}>
                        {fmt.label}
                      </Text>
                      <Text style={styles.formatDesc}>{fmt.desc}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Additional Instructions */}
            <View style={styles.instructionBox}>
              <Text style={styles.label}>Additional Study Instructions (Optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="e.g. Focus heavily on exam-relevant definitions and clinical symptoms..."
                placeholderTextColor={colors.textDisabled}
                value={instructions}
                onChangeText={setInstructions}
                multiline
                numberOfLines={3}
              />
            </View>
          </View>
        )}

        {/* STEP 6: Question Timer */}
        {currentStep === 6 && (
          <View style={styles.stepSection}>
            <View style={styles.sectionHeader}>
              <View style={styles.stepTitleRow}>
                <View style={styles.stepIconBox}>
                  <HugeiconsIcon icon={Clock01Icon} size={18} color={colors.primary} strokeWidth={2.2} />
                </View>
                <Text style={styles.stepTitle}>Set question timer</Text>
              </View>
              <Text style={styles.stepDesc}>
                Set a time limit for each question during quiz sessions, or select Untimed for relaxed studying.
              </Text>
            </View>

            <View style={styles.timerSection}>
              <View style={styles.timerGrid}>
                {[
                  { id: 'none', label: 'Untimed', sub: 'Relaxed' },
                  { id: '15', label: '15s', sub: 'Rapid fire' },
                  { id: '30', label: '30s', sub: 'Standard' },
                  { id: '45', label: '45s', sub: 'Challenging' },
                  { id: '60', label: '60s', sub: 'Exam pace' },
                  { id: 'custom', label: 'Custom', sub: 'Set secs' },
                ].map((t) => {
                  const isSelected = timerOption === t.id;
                  return (
                    <TouchableOpacity
                      key={t.id}
                      style={[styles.timerChip, isSelected && styles.timerChipSelected]}
                      onPress={() => setTimerOption(t.id as any)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.timerChipLabel, isSelected && styles.timerChipLabelSelected]}>
                        {t.label}
                      </Text>
                      <Text style={[styles.timerChipSub, isSelected && styles.timerChipSubSelected]}>
                        {t.sub}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {timerOption === 'custom' && (
                <View style={styles.customTimerRow}>
                  <Text style={styles.customTimerLabel}>Seconds per question:</Text>
                  <TextInput
                    style={styles.customTimerInput}
                    keyboardType="number-pad"
                    value={customTimer}
                    onChangeText={setCustomTimer}
                    placeholder="90"
                    placeholderTextColor={colors.textDisabled}
                    maxLength={4}
                  />
                  <Text style={styles.customTimerUnit}>seconds</Text>
                </View>
              )}
            </View>
          </View>
        )}
      </SmoothScrollView>

      {/* Bottom Sticky Action Bar */}
      <View
        style={[
          styles.bottomBar,
          { paddingBottom: Math.max(insets.bottom, spacing[16]) + spacing[8] },
        ]}
      >
        <TouchableOpacity
          style={[styles.prevBtn, currentStep === 1 && styles.prevBtnDisabled]}
          onPress={goToPreviousStep}
          activeOpacity={0.7}
        >
          <HugeiconsIcon
            icon={ArrowLeft01Icon}
            size={18}
            color={currentStep === 1 ? colors.textDisabled : colors.textSecondary}
            strokeWidth={2}
          />
          <Text style={[styles.prevBtnText, currentStep === 1 && styles.prevBtnTextDisabled]}>
            Previous
          </Text>
        </TouchableOpacity>

        <PlatformPressable
          style={[styles.nextBtn, isSubmitting && styles.disabledBtn]}
          disabled={isSubmitting}
          onPress={goToNextStep}
        >
          <View style={styles.nextBtnContent}>
            <Text style={styles.nextBtnText}>
              {currentStep === TOTAL_STEPS
                ? isSubmitting
                  ? 'Creating Reviewer...'
                  : 'Generate Reviewer'
                : 'Next Step'}
            </Text>
            <HugeiconsIcon
              icon={currentStep === TOTAL_STEPS ? SparklesIcon : ArrowRight01Icon}
              size={18}
              color={colors.onPrimary}
              strokeWidth={2.2}
            />
          </View>
        </PlatformPressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const isPadDevice = isIpad();

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topProgressArea: {
    paddingHorizontal: isPadDevice ? spacing[36] : spacing[20],
    paddingTop: isPadDevice ? spacing[14] : spacing[8],
    paddingBottom: isPadDevice ? spacing[18] : spacing[14],
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceMuted,
  },
  stepTrack: {
    height: isPadDevice ? 10 : 6,
    backgroundColor: colors.surfaceMuted,
    borderRadius: isPadDevice ? 5 : 3,
    overflow: 'hidden',
    marginBottom: spacing[12],
  },
  stepBarFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: isPadDevice ? 5 : 3,
  },
  stepPillRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
  },
  pillItem: {
    alignItems: 'center',
  },
  pillDot: {
    width: isPadDevice ? 32 : 22,
    height: isPadDevice ? 32 : 22,
    borderRadius: isPadDevice ? 16 : 11,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillDotCompleted: {
    backgroundColor: colors.success,
  },
  pillDotCurrent: {
    backgroundColor: colors.primary,
  },
  pillNumber: {
    fontSize: isPadDevice ? typography.fontSize[14] : typography.fontSize[10.5],
    fontWeight: typography.fontWeight.bold,
    color: colors.textMuted,
  },
  pillNumberCurrent: {
    color: colors.onPrimary,
  },
  container: {
    flex: 1,
  },
  content: {
    padding: isPadDevice ? spacing[36] : spacing[20],
    maxWidth: isPadDevice ? 860 : undefined,
    width: isPadDevice ? '100%' : undefined,
    alignSelf: isPadDevice ? 'center' : undefined,
  },
  stepSection: {
    flex: 1,
  },
  sectionHeader: {
    marginBottom: isPadDevice ? spacing[26] : spacing[20],
  },
  stepTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[10],
    marginBottom: spacing[6],
  },
  stepIconBox: {
    width: isPadDevice ? 40 : 32,
    height: isPadDevice ? 40 : 32,
    borderRadius: isPadDevice ? 10 : 8,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepTitle: {
    fontSize: isPadDevice ? typography.fontSize[26] : typography.fontSize[21],
    fontWeight: typography.fontWeight.extraBold,
    color: colors.text,
    letterSpacing: typography.letterSpacing[-0.3],
  },
  stepDesc: {
    fontSize: isPadDevice ? typography.fontSize[16] : typography.fontSize[13.5],
    color: colors.textMuted,
    lineHeight: isPadDevice ? typography.lineHeight[24] : typography.lineHeight[20],
  },
  inputWrapper: {
    marginBottom: spacing[16],
  },
  label: {
    fontSize: isPadDevice ? typography.fontSize[16] : typography.fontSize[13.5],
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
    marginBottom: spacing[8],
    letterSpacing: typography.letterSpacing[-0.2],
  },
  sublabel: {
    fontSize: isPadDevice ? typography.fontSize[14] : typography.fontSize[12.5],
    fontWeight: typography.fontWeight.semiBold,
    color: colors.textMuted,
    marginBottom: spacing[10],
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderRadius: isPadDevice ? 18 : 14,
    paddingHorizontal: isPadDevice ? spacing[20] : spacing[16],
    paddingVertical: isPadDevice ? spacing[18] : spacing[14],
    fontSize: isPadDevice ? typography.fontSize[18] : typography.fontSize[15],
    color: colors.text,
  },
  textArea: {
    minHeight: isPadDevice ? 120 : 90,
    textAlignVertical: 'top',
    paddingTop: isPadDevice ? spacing[16] : spacing[12],
  },
  docHintBox: {
    marginTop: spacing[8],
    padding: isPadDevice ? spacing[16] : spacing[12],
    backgroundColor: colors.primarySoft,
    borderRadius: isPadDevice ? 14 : 10,
    borderWidth: 1,
    borderColor: colors.primarySoftStrong,
  },
  docHintLabel: {
    fontSize: isPadDevice ? typography.fontSize[13] : typography.fontSize[11],
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
    textTransform: 'uppercase',
    marginBottom: spacing[2],
  },
  docHintValue: {
    fontSize: isPadDevice ? typography.fontSize[15] : typography.fontSize[13],
    color: colors.primaryDark,
    fontWeight: typography.fontWeight.semiBold,
  },
  suggestedArea: {
    marginBottom: spacing[18],
  },
  suggestedContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: isPadDevice ? spacing[12] : spacing[8],
  },
  topicChip: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: isPadDevice ? spacing[18] : spacing[12],
    paddingVertical: isPadDevice ? spacing[12] : spacing[8],
    borderRadius: isPadDevice ? 24 : 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[6],
  },
  activeTopicChip: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  topicChipText: {
    fontSize: isPadDevice ? typography.fontSize[15] : typography.fontSize[12.5],
    color: colors.textSecondary,
    fontWeight: typography.fontWeight.semiBold,
  },
  activeTopicChipText: {
    color: colors.primary,
    fontWeight: typography.fontWeight.bold,
  },
  countGrid: {
    gap: spacing[12],
  },
  countCard: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: isPadDevice ? 20 : 16,
    padding: isPadDevice ? spacing[22] : spacing[16],
  },
  countCardActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  countCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[4],
  },
  countCardNum: {
    fontSize: isPadDevice ? typography.fontSize[28] : typography.fontSize[22],
    fontWeight: typography.fontWeight.extraBold,
    color: colors.text,
  },
  countCardNumActive: {
    color: colors.primary,
  },
  countBadge: {
    paddingHorizontal: spacing[8],
    paddingVertical: spacing[3],
    borderRadius: 8,
    backgroundColor: colors.surfaceMuted,
  },
  countBadgeActive: {
    backgroundColor: colors.primarySoftStrong,
  },
  countBadgeText: {
    fontSize: typography.fontSize[11.5],
    fontWeight: typography.fontWeight.bold,
    color: colors.textMuted,
  },
  countBadgeTextActive: {
    color: colors.primaryDark,
  },
  countCardLabel: {
    fontSize: isPadDevice ? typography.fontSize[15] : typography.fontSize[13],
    color: colors.textMuted,
    fontWeight: typography.fontWeight.medium,
  },
  countCardLabelActive: {
    color: colors.primary,
    fontWeight: typography.fontWeight.bold,
  },
  diffCardList: {
    gap: isPadDevice ? spacing[16] : spacing[12],
  },
  diffCard: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: isPadDevice ? 20 : 16,
    padding: isPadDevice ? spacing[22] : spacing[16],
  },
  diffHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[10],
    marginBottom: spacing[6],
  },
  diffRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  diffRadioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.surface,
  },
  diffTitle: {
    fontSize: isPadDevice ? typography.fontSize[18] : typography.fontSize[15],
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
  },
  diffDesc: {
    fontSize: isPadDevice ? typography.fontSize[15] : typography.fontSize[12.5],
    color: colors.textMuted,
    lineHeight: isPadDevice ? typography.lineHeight[22] : typography.lineHeight[18],
    marginLeft: spacing[30],
  },
  formatGroup: {
    gap: isPadDevice ? spacing[14] : spacing[10],
    marginBottom: spacing[20],
  },
  formatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: isPadDevice ? 18 : 14,
    padding: isPadDevice ? spacing[18] : spacing[14],
  },
  formatCardChecked: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing[12],
    backgroundColor: colors.surface,
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  formatInfo: {
    flex: 1,
  },
  formatTitle: {
    fontSize: isPadDevice ? typography.fontSize[17] : typography.fontSize[14.5],
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
  },
  formatTitleChecked: {
    color: colors.primary,
  },
  formatDesc: {
    fontSize: isPadDevice ? typography.fontSize[14] : typography.fontSize[12],
    color: colors.textMuted,
    marginTop: spacing[2],
  },
  instructionBox: {
    marginTop: spacing[6],
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: isPadDevice ? spacing[36] : spacing[20],
    paddingTop: isPadDevice ? spacing[16] : spacing[12],
    flexDirection: 'row',
    alignItems: 'center',
    gap: isPadDevice ? spacing[16] : spacing[12],
    ...Platform.select({
      ios: {
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  prevBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[6],
    paddingVertical: isPadDevice ? spacing[18] : spacing[14],
    paddingHorizontal: isPadDevice ? spacing[22] : spacing[16],
    borderRadius: isPadDevice ? 16 : 12,
    backgroundColor: colors.surfaceMuted,
  },
  prevBtnDisabled: {
    opacity: 0.5,
  },
  prevBtnText: {
    fontSize: isPadDevice ? typography.fontSize[16] : typography.fontSize[14],
    fontWeight: typography.fontWeight.semiBold,
    color: colors.textSecondary,
  },
  prevBtnTextDisabled: {
    color: colors.textDisabled,
  },
  nextBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: isPadDevice ? 18 : 14,
    ...Platform.select({
      ios: {
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  nextBtnContent: {
    paddingVertical: isPadDevice ? spacing[18] : spacing[15],
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing[8],
  },
  disabledBtn: {
    backgroundColor: colors.textDisabled,
  },
  nextBtnText: {
    color: colors.onPrimary,
    fontSize: isPadDevice ? typography.fontSize[18] : typography.fontSize[15.5],
    fontWeight: typography.fontWeight.bold,
    letterSpacing: typography.letterSpacing[-0.2],
  },
  timerSection: {
    marginTop: spacing[20],
    marginBottom: spacing[20],
    backgroundColor: colors.surface,
    padding: isPadDevice ? spacing[22] : spacing[16],
    borderRadius: isPadDevice ? 20 : 16,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
  },
  timerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[8],
    marginBottom: spacing[4],
  },
  timerIconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerDesc: {
    fontSize: typography.fontSize[13],
    color: colors.textMuted,
    lineHeight: typography.lineHeight[18],
    marginBottom: spacing[14],
  },
  timerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[8],
  },
  timerChip: {
    flexBasis: '31%',
    flexGrow: 1,
    paddingVertical: isPadDevice ? spacing[14] : spacing[10],
    paddingHorizontal: isPadDevice ? spacing[12] : spacing[8],
    borderRadius: isPadDevice ? 16 : 12,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
  },
  timerChipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  timerChipLabel: {
    fontSize: isPadDevice ? typography.fontSize[16] : typography.fontSize[13.5],
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
    marginBottom: 2,
  },
  timerChipLabelSelected: {
    color: colors.primary,
  },
  timerChipSub: {
    fontSize: typography.fontSize[11],
    color: colors.textMuted,
    fontWeight: typography.fontWeight.medium,
  },
  timerChipSubSelected: {
    color: colors.primaryDark,
    fontWeight: typography.fontWeight.semiBold,
  },
  customTimerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing[12],
    gap: spacing[10],
    backgroundColor: colors.surfaceMuted,
    padding: spacing[10],
    borderRadius: 10,
  },
  customTimerLabel: {
    fontSize: typography.fontSize[13],
    color: colors.text,
    fontWeight: typography.fontWeight.medium,
  },
  customTimerInput: {
    width: 64,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderRadius: 8,
    paddingHorizontal: spacing[8],
    paddingVertical: spacing[6],
    fontSize: typography.fontSize[14],
    fontWeight: typography.fontWeight.bold,
    textAlign: 'center',
    color: colors.text,
  },
  customTimerUnit: {
    fontSize: typography.fontSize[13],
    color: colors.textMuted,
  },
});
