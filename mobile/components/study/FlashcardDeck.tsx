import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Platform, ScrollView, StyleSheet, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, FadeIn, ReduceMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText as Text } from '@/components/common/app-text';
import { StudyIcon } from '@/components/common/StudyIcon';
import { PlatformPressable } from '@/components/common/PlatformPressable';
import { ImageZoomModal } from '@/components/common/ImageZoomModal';
import { CoachmarkTooltip } from '@/components/onboarding/CoachmarkTooltip';
import { useOnboardingReducedMotion } from '@/components/onboarding/useOnboardingReducedMotion';
import { useCredits } from '@/context/CreditsContext';
import { useOnboarding } from '@/context/OnboardingContext';
import { colors } from '@/constants/theme';
import { generateStudyImage } from '@/lib/api/images';
import { syncEngine } from '@/lib/sync/syncEngine';
import { canRecordFlashcardResult, flashcardProgress, recordFlashcardResult, type FlashcardScore } from '@/utils/flashcardScore';
import { isMeaningfulSection, sanitizeQuestionText } from '@/utils/formatters';
import type { StudyItem } from '@/types';
import { SourceAttribution } from './SourceAttribution';

interface Props { items: StudyItem[]; onFinish?: (score: FlashcardScore) => void }

/** Recall first, reveal second, then commit one self-assessment per card. */
export const FlashcardDeck: React.FC<Props> = ({ items, onFinish }) => {
  const insets = useSafeAreaInsets();
  const { width, fontScale } = useWindowDimensions();
  const reducedMotion = useOnboardingReducedMotion();
  const { addXP } = useCredits();
  const { hasSeenFlashcardGestureTip, hasSeenSourceProvenanceTip, markTipSeen } = useOnboarding();
  const [deckItems, setDeckItems] = useState(items);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isRevealed, setIsRevealed] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [masteredCount, setMasteredCount] = useState(0);
  const [generatingImageId, setGeneratingImageId] = useState<string | null>(null);
  const [diagramError, setDiagramError] = useState<string | null>(null);
  const [zoomDiagram, setZoomDiagram] = useState<{ uri: string; caption: string } | null>(null);
  const scoreRef = useRef<FlashcardScore>({ correct: 0, total: 0, xp: 0 });
  const answeredIndexRef = useRef(-1);
  const revealedRef = useRef(false);
  const mountedRef = useRef(true);
  const scrollRef = useRef<ScrollView>(null);
  const stackActions = width < 350 || fontScale > 1.3;

  useEffect(() => { setDeckItems(items); }, [items]);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const currentItem = deckItems[currentIndex];
  if (!currentItem) return (
    <View style={styles.empty} testID="flashcard-empty">
      <StudyIcon name="cards" size={72} />
      <Text style={styles.emptyTitle}>No flashcards here yet</Text>
      <Text style={styles.helper}>Choose another study format or create a flashcard set from your notes.</Text>
    </View>
  );

  const progress = flashcardProgress(currentIndex, deckItems.length);
  const revealAnswer = () => {
    revealedRef.current = true;
    setIsRevealed(true);
  };
  const hideAnswer = () => {
    revealedRef.current = false;
    setIsRevealed(false);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };

  const handleNext = (mastered: boolean) => {
    if (!canRecordFlashcardResult(currentIndex, answeredIndexRef.current, revealedRef.current)) return;
    answeredIndexRef.current = currentIndex;
    syncEngine.recordStudyAnswer(currentItem.id, mastered ? 'correct' : 'review_again').catch(() => {
      // Offline progress remains in the existing synchronization queue.
    });
    // Commit before requesting React updates so the last card is included exactly once.
    const score = recordFlashcardResult(scoreRef.current, mastered);
    scoreRef.current = score;
    setMasteredCount(score.correct);
    if (mastered) addXP(15);
    if (currentIndex === deckItems.length - 1) {
      onFinish?.(score);
      return;
    }
    revealedRef.current = false;
    setIsRevealed(false);
    setShowHint(false);
    setDiagramError(null);
    setCurrentIndex(index => index + 1);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };

  const handleGenerateDiagram = async () => {
    if (generatingImageId || currentItem.image_base64) return;
    const itemId = currentItem.id;
    setGeneratingImageId(itemId);
    setDiagramError(null);
    try {
      const prompt = currentItem.diagram_prompt || `${currentItem.source_metadata?.section || ''}: ${currentItem.question}`;
      const result = await generateStudyImage(prompt);
      if (!result?.image_base64) throw new Error('No diagram returned');
      if (mountedRef.current) setDeckItems(previous => previous.map(item => item.id === itemId ? { ...item, image_base64: result.image_base64 } : item));
    } catch {
      if (mountedRef.current) setDiagramError('We could not create this visual. Check your connection and try again.');
    } finally {
      if (mountedRef.current) setGeneratingImageId(null);
    }
  };

  const imageUri = currentItem.image_base64
    ? /^(data:|https?:)/.test(currentItem.image_base64) ? currentItem.image_base64 : `data:image/png;base64,${currentItem.image_base64}`
    : null;

  return (
    <ScrollView ref={scrollRef} style={styles.screen} testID="flashcard-deck" keyboardShouldPersistTaps="handled"
      contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, Platform.OS === 'android' ? 28 : 16) + 16 }]}
      showsVerticalScrollIndicator>
      <View style={styles.header}>
        <View style={styles.progressCopy}>
          <Text style={styles.eyebrow}>RECALL PRACTICE</Text>
          <Text style={styles.progressText}>Card {progress.position} of {deckItems.length}</Text>
        </View>
        <View style={styles.masteryPill}><Text style={styles.masteryText}>{masteredCount} recalled</Text></View>
      </View>
      <View style={styles.progressTrack} accessibilityRole="progressbar" accessibilityLabel="Cards reviewed"
        accessibilityValue={{ min: 0, max: deckItems.length, now: currentIndex }}>
        <View style={[styles.progressFill, { width: `${progress.completedPercent}%` }]} />
      </View>
      {!isRevealed && !hasSeenFlashcardGestureTip && <CoachmarkTooltip title="Give your memory a moment"
        description="Try answering first. Reveal the answer, then choose how well you remembered it."
        onDismiss={() => markTipSeen('flashcardGesture')} arrowPosition="none" />}

      <View style={styles.questionCard}>
        <View style={styles.cardHeading}>
          <StudyIcon name="cards" size={44} />
          <View style={styles.headingCopy}><Text style={styles.cardLabel}>YOUR QUESTION</Text><Text style={styles.difficulty}>{currentItem.difficulty} difficulty</Text></View>
        </View>
        {isMeaningfulSection(currentItem.source_metadata?.section) && <Text style={styles.topic}>{currentItem.source_metadata.section}</Text>}
        <Text style={styles.question} selectable testID="flashcard-question">{sanitizeQuestionText(currentItem.question)}</Text>
        {!isRevealed && <Text style={styles.recallPrompt}>Think of the answer before you look.</Text>}
        {!isRevealed && currentItem.hint && <>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={showHint ? 'Hide hint' : 'Show a hint'}
            onPress={() => setShowHint(value => !value)} style={styles.textAction}>
            <Text style={styles.textActionLabel}>{showHint ? 'Hide hint' : 'Need a little hint?'}</Text>
          </TouchableOpacity>
          {showHint && <Text style={styles.hint}>{currentItem.hint}</Text>}
        </>}
      </View>

      {isRevealed ? <Animated.View key={`answer-${currentItem.id}`} testID="flashcard-answer"
        entering={reducedMotion ? undefined : FadeIn.duration(180).easing(Easing.bezier(0.23, 1, 0.32, 1)).reduceMotion(ReduceMotion.System)}>
        <View style={styles.answerCard} accessibilityLiveRegion="polite">
          <View style={styles.cardHeading}><StudyIcon name="book" size={40} /><Text style={styles.cardLabel}>THE ANSWER</Text></View>
          <Text style={styles.answer} selectable>{currentItem.answer}</Text>
          {currentItem.explanation && <View style={styles.explanation}>
            <Text style={styles.explanationTitle}>Why it makes sense</Text>
            <Text style={styles.body} selectable>{currentItem.explanation}</Text>
          </View>}
          <TouchableOpacity onPress={hideAnswer} style={styles.textAction} accessibilityRole="button" accessibilityLabel="Hide the answer and recall again">
            <Text style={styles.textActionLabel}>Try recalling it again</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.selfCheck}>
          <Text style={styles.selfCheckTitle}>How did you remember it?</Text>
          <Text style={styles.helper}>A self-check, not a test. Be honest with yourself.</Text>
          <View style={[styles.actions, stackActions && styles.stackedActions]}>
            <PlatformPressable testID="flashcard-review-again" accessibilityRole="button" accessibilityLabel="Review again"
              style={styles.reviewButton} onPress={() => handleNext(false)}>
              <View style={styles.actionContent}><Text style={styles.reviewText}>Review again</Text><Text style={styles.reviewHelper}>I need more practice</Text></View>
            </PlatformPressable>
            <PlatformPressable testID="flashcard-correct" accessibilityRole="button" accessibilityLabel="Got it"
              style={styles.correctButton} onPress={() => handleNext(true)}>
              <View style={styles.actionContent}><Text style={styles.correctText}>Got it</Text><Text style={styles.correctHelper}>I recalled this</Text></View>
            </PlatformPressable>
          </View>
        </View>
        {!hasSeenSourceProvenanceTip && <CoachmarkTooltip title="Keep your source close"
          description="Use the reference below to revisit the page, section, or excerpt saved with this card."
          onDismiss={() => markTipSeen('sourceProvenance')} arrowPosition="none" />}
        <SourceAttribution key={currentItem.id} source={currentItem.source_metadata} defaultExpanded />
      </Animated.View> : <PlatformPressable testID="flashcard-reveal" accessibilityRole="button" accessibilityLabel="Reveal answer"
        style={styles.revealButton} onPress={revealAnswer}>
        <View style={styles.revealContent}><StudyIcon name="book" size={32} /><Text style={styles.correctText}>Reveal answer</Text></View>
      </PlatformPressable>}

      <View style={styles.visualSection}>
        {imageUri ? <TouchableOpacity style={styles.diagramCard} accessibilityRole="button" accessibilityLabel="Enlarge study visual"
          onPress={() => setZoomDiagram({ uri: imageUri, caption: sanitizeQuestionText(currentItem.question) })}>
          <Text style={styles.explanationTitle}>Study visual · tap to enlarge</Text>
          <Image source={{ uri: imageUri }} style={styles.diagram} resizeMode="contain" />
        </TouchableOpacity> : <TouchableOpacity style={styles.visualButton} accessibilityRole="button" accessibilityLabel="Create a study visual, requires internet"
          accessibilityState={{ disabled: !!generatingImageId, busy: generatingImageId === currentItem.id }} disabled={!!generatingImageId} onPress={handleGenerateDiagram}>
          {generatingImageId === currentItem.id ? <ActivityIndicator color={colors.primary} /> : <StudyIcon name="brain" size={30} />}
          <View style={styles.headingCopy}><Text style={styles.textActionLabel}>{generatingImageId === currentItem.id ? 'Creating your study visual…' : 'Create a study visual'}</Text><Text style={styles.visualHelper}>Optional · needs internet</Text></View>
        </TouchableOpacity>}
        {diagramError && <Text style={styles.error} accessibilityLiveRegion="polite">{diagramError}</Text>}
      </View>
      <ImageZoomModal visible={!!zoomDiagram} onClose={() => setZoomDiagram(null)} imageBase64={zoomDiagram?.uri}
        title={currentItem.source_metadata?.section || 'Study visual'} caption={zoomDiagram?.caption} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, width: '100%', maxWidth: 820, alignSelf: 'center', padding: 20, gap: 16 },
  header: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12 },
  progressCopy: { flex: 1, minWidth: 130 },
  eyebrow: { color: colors.primary, fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: 4 },
  progressText: { color: colors.text, fontSize: 17, lineHeight: 24, fontWeight: '700', fontVariant: ['tabular-nums'] },
  masteryPill: { backgroundColor: colors.primarySoft, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, borderCurve: 'continuous' },
  masteryText: { color: colors.primary, fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: colors.surfaceMuted, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: colors.primary },
  questionCard: { backgroundColor: colors.surface, borderRadius: 26, borderCurve: 'continuous', padding: 24, borderWidth: 1, borderColor: colors.border, gap: 16 },
  cardHeading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headingCopy: { flex: 1 },
  cardLabel: { color: colors.primary, fontSize: 10, lineHeight: 16, letterSpacing: 1, fontWeight: '700', flexShrink: 1 },
  difficulty: { color: colors.textSecondary, fontSize: 12, lineHeight: 18, textTransform: 'capitalize' },
  topic: { color: colors.primary, fontSize: 12, lineHeight: 18, fontWeight: '600' },
  question: { color: colors.text, fontSize: 23, lineHeight: 34, fontWeight: '700', letterSpacing: -0.3 },
  recallPrompt: { color: colors.textSecondary, fontSize: 12, lineHeight: 19 },
  hint: { color: colors.textSecondary, fontSize: 14, lineHeight: 22 },
  textAction: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  textActionLabel: { color: colors.primary, fontSize: 13, lineHeight: 20, fontWeight: '600' },
  answerCard: { padding: 24, backgroundColor: colors.primarySoft, borderRadius: 26, borderCurve: 'continuous', borderColor: colors.primaryBorder, borderWidth: 1, gap: 16 },
  answer: { color: colors.text, fontSize: 22, lineHeight: 32, fontWeight: '700' },
  explanation: { borderTopWidth: 1, borderColor: colors.primaryBorder, paddingTop: 16, gap: 8 },
  explanationTitle: { color: colors.text, fontSize: 14, lineHeight: 22, fontWeight: '600' },
  body: { color: colors.textSecondary, fontSize: 15, lineHeight: 24 },
  helper: { color: colors.textSecondary, fontSize: 12, lineHeight: 20 },
  selfCheck: { gap: 8, marginTop: 20 },
  selfCheckTitle: { color: colors.text, fontSize: 16, lineHeight: 24, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  stackedActions: { flexDirection: 'column' },
  reviewButton: { flex: 1, backgroundColor: colors.surface, borderColor: colors.primaryBorder, borderWidth: 1, borderRadius: 18, borderCurve: 'continuous' },
  correctButton: { flex: 1, backgroundColor: colors.primary, borderRadius: 18, borderCurve: 'continuous' },
  actionContent: { minHeight: 72, padding: 14, alignItems: 'center', justifyContent: 'center', gap: 4 },
  reviewText: { color: colors.primary, fontSize: 15, lineHeight: 23, fontWeight: '700', textAlign: 'center' },
  reviewHelper: { color: colors.textSecondary, fontSize: 11, lineHeight: 17, textAlign: 'center' },
  correctText: { color: colors.onPrimary, fontSize: 15, lineHeight: 23, fontWeight: '700', textAlign: 'center' },
  correctHelper: { color: colors.onPrimary, fontSize: 11, lineHeight: 17, textAlign: 'center' },
  revealButton: { backgroundColor: colors.primary, borderRadius: 18, borderCurve: 'continuous' },
  revealContent: { minHeight: 56, padding: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10 },
  visualSection: { marginTop: 8, gap: 8 },
  visualButton: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, minHeight: 56, borderRadius: 18, borderCurve: 'continuous', borderColor: colors.border, borderWidth: 1, backgroundColor: colors.surface },
  visualHelper: { color: colors.textSecondary, fontSize: 11, lineHeight: 17 },
  diagramCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: 16, borderRadius: 20, borderCurve: 'continuous', gap: 12 },
  diagram: { width: '100%', height: 200 },
  error: { color: colors.danger, fontSize: 12, lineHeight: 20 },
  empty: { flex: 1, padding: 32, alignItems: 'center', justifyContent: 'center', gap: 16 },
  emptyTitle: { color: colors.text, fontSize: 18, lineHeight: 26, fontWeight: '700' },
});
