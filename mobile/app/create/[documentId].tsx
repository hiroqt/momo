import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  Platform,
  Animated,
  KeyboardAvoidingView,
} from 'react-native';
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

const TOTAL_STEPS = 5;

const STEP_TITLES = [
  'Reviewer Name',
  'Study Topic',
  'Question Count',
  'Difficulty Level',
  'Study Formats',
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
            setTitle(`${res.suggested_topics[0]} Reviewer`);
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
      const job = await createGeneration({
        document_id: documentId,
        title: title.trim() || `${topic.trim()} Reviewer`,
        topic: topic.trim() || 'Core Document Concepts',
        count: parseInt(count, 10) || 20,
        difficulty,
        question_types: selectedTypes,
        custom_instruction: instructions.trim() || undefined,
        source_only: true,
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
                    <HugeiconsIcon icon={Tick01Icon} size={10} color="#FFFFFF" strokeWidth={3} />
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
          { paddingBottom: Math.max(insets.bottom, 24) + 90 },
        ]}
      >
        {/* STEP 1: Name of the Reviewer */}
        {currentStep === 1 && (
          <View style={styles.stepSection}>
            <View style={styles.sectionHeader}>
              <View style={styles.stepTitleRow}>
                <View style={styles.stepIconBox}>
                  <HugeiconsIcon icon={Edit02Icon} size={18} color="#4F46E5" strokeWidth={2.2} />
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
                placeholderTextColor="#94A3B8"
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
                  <HugeiconsIcon icon={Target02Icon} size={18} color="#4F46E5" strokeWidth={2.2} />
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
                          color={isSelected ? '#4F46E5' : '#64748B'}
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
                placeholderTextColor="#94A3B8"
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
                  <HugeiconsIcon icon={Layers01Icon} size={18} color="#4F46E5" strokeWidth={2.2} />
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
                  <HugeiconsIcon icon={FlashIcon} size={18} color="#4F46E5" strokeWidth={2.2} />
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
                  color: '#059669',
                  bg: '#ECFDF5',
                  borderColor: '#A7F3D0',
                  desc: 'Core definitions, foundational terms, and direct factual recall.',
                },
                {
                  id: 'medium',
                  label: 'Medium (Balanced)',
                  color: '#4F46E5',
                  bg: '#EEF2FF',
                  borderColor: '#C7D2FE',
                  desc: 'Cause-and-effect relationships, mechanisms, and interactions between concepts.',
                },
                {
                  id: 'hard',
                  label: 'Hard (Mastery)',
                  color: '#D97706',
                  bg: '#FFFBEB',
                  borderColor: '#FDE68A',
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
                  <HugeiconsIcon icon={Task01Icon} size={18} color="#4F46E5" strokeWidth={2.2} />
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
                  desc: 'Front prompt & back answer with interactive 3D flip',
                  icon: BookOpen01Icon,
                },
                {
                  key: 'multiple_choice',
                  label: 'Multiple Choice',
                  desc: '4 options with 1 verified ground truth',
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
                        <HugeiconsIcon icon={Tick01Icon} size={13} color="#FFFFFF" strokeWidth={3} />
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
                placeholderTextColor="#94A3B8"
                value={instructions}
                onChangeText={setInstructions}
                multiline
                numberOfLines={3}
              />
            </View>
          </View>
        )}
      </SmoothScrollView>

      {/* Bottom Sticky Action Bar */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
        <TouchableOpacity
          style={[styles.prevBtn, currentStep === 1 && styles.prevBtnDisabled]}
          onPress={goToPreviousStep}
          activeOpacity={0.7}
        >
          <HugeiconsIcon
            icon={ArrowLeft01Icon}
            size={18}
            color={currentStep === 1 ? '#94A3B8' : '#475569'}
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
                  ? 'Cooking Up Reviewer...'
                  : 'Generate Reviewer'
                : 'Next Step'}
            </Text>
            <HugeiconsIcon
              icon={currentStep === TOTAL_STEPS ? SparklesIcon : ArrowRight01Icon}
              size={18}
              color="#FFFFFF"
              strokeWidth={2.2}
            />
          </View>
        </PlatformPressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  topProgressArea: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  stepTrack: {
    height: 6,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 12,
  },
  stepBarFill: {
    height: '100%',
    backgroundColor: '#4F46E5',
    borderRadius: 3,
  },
  stepPillRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  pillItem: {
    alignItems: 'center',
  },
  pillDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillDotCompleted: {
    backgroundColor: '#059669',
  },
  pillDotCurrent: {
    backgroundColor: '#4F46E5',
  },
  pillNumber: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#64748B',
  },
  pillNumberCurrent: {
    color: '#FFFFFF',
  },
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  stepSection: {
    flex: 1,
  },
  sectionHeader: {
    marginBottom: 20,
  },
  stepTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  stepIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepTitle: {
    fontSize: 21,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  stepDesc: {
    fontSize: 13.5,
    color: '#64748B',
    lineHeight: 20,
  },
  inputWrapper: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  sublabel: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 10,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#0F172A',
  },
  textArea: {
    minHeight: 90,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  docHintBox: {
    marginTop: 8,
    padding: 12,
    backgroundColor: '#EEF2FF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E0E7FF',
  },
  docHintLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4F46E5',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  docHintValue: {
    fontSize: 13,
    color: '#312E81',
    fontWeight: '600',
  },
  suggestedArea: {
    marginBottom: 18,
  },
  suggestedContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  topicChip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  activeTopicChip: {
    backgroundColor: '#EEF2FF',
    borderColor: '#4F46E5',
  },
  topicChipText: {
    fontSize: 12.5,
    color: '#475569',
    fontWeight: '600',
  },
  activeTopicChipText: {
    color: '#4F46E5',
    fontWeight: '700',
  },
  countGrid: {
    gap: 12,
  },
  countCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 16,
  },
  countCardActive: {
    borderColor: '#4F46E5',
    backgroundColor: '#EEF2FF',
  },
  countCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  countCardNum: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1E293B',
  },
  countCardNumActive: {
    color: '#4F46E5',
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  countBadgeActive: {
    backgroundColor: '#C7D2FE',
  },
  countBadgeText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#64748B',
  },
  countBadgeTextActive: {
    color: '#312E81',
  },
  countCardLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  countCardLabelActive: {
    color: '#4F46E5',
    fontWeight: '700',
  },
  diffCardList: {
    gap: 12,
  },
  diffCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 16,
  },
  diffHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  diffRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  diffRadioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
  diffTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
  },
  diffDesc: {
    fontSize: 12.5,
    color: '#64748B',
    lineHeight: 18,
    marginLeft: 30,
  },
  formatGroup: {
    gap: 10,
    marginBottom: 20,
  },
  formatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 14,
  },
  formatCardChecked: {
    borderColor: '#4F46E5',
    backgroundColor: '#F5F3FF',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    backgroundColor: '#FFFFFF',
  },
  checkboxChecked: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  formatInfo: {
    flex: 1,
  },
  formatTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#1E293B',
  },
  formatTitleChecked: {
    color: '#4F46E5',
  },
  formatDesc: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  instructionBox: {
    marginTop: 6,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingHorizontal: 20,
    paddingTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
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
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
  },
  prevBtnDisabled: {
    opacity: 0.5,
  },
  prevBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  prevBtnTextDisabled: {
    color: '#94A3B8',
  },
  nextBtn: {
    flex: 1,
    backgroundColor: '#4F46E5',
    borderRadius: 14,
    ...Platform.select({
      ios: {
        shadowColor: '#4F46E5',
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
    paddingVertical: 15,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  disabledBtn: {
    backgroundColor: '#94A3B8',
  },
  nextBtnText: {
    color: '#FFFFFF',
    fontSize: 15.5,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
});
