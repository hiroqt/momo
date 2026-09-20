import React, { useState, useRef, useEffect } from 'react';
import { colors, spacing, typography } from '@/constants/theme';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Animated,
  Platform,
} from 'react-native';
import { AppText as Text } from '@/components/common/app-text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  RefreshIcon,
  CheckmarkCircle02Icon,
  Cancel01Icon,
  EyeIcon,
  BookOpen01Icon,
} from '@hugeicons/core-free-icons';
import { StudyItem } from '../../types';
import { SourceAttribution } from './SourceAttribution';
import { PlatformPressable } from '../common/PlatformPressable';
import { syncEngine } from '../../lib/sync/syncEngine';
import { isMeaningfulSection, sanitizeQuestionText } from '../../utils/formatters';
import { useOnboarding } from '../../context/OnboardingContext';
import { CoachmarkTooltip } from '../onboarding/CoachmarkTooltip';
import { isIpad } from '../../utils/device';

interface Props {
  items: StudyItem[];
  onFinish?: () => void;
}

export const FlashcardDeck: React.FC<Props> = ({ items, onFinish }) => {
  const isPadDevice = isIpad();
  const insets = useSafeAreaInsets();
  const isAndroid = Platform.OS === 'android';
  const bottomPadding = Math.max(insets.bottom, isAndroid ? spacing[28] : spacing[16]) + spacing[16];

  const { hasSeenFlashcardGestureTip, hasSeenSourceProvenanceTip, markTipSeen } = useOnboarding();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [masteredCount, setMasteredCount] = useState(0);

  // 3D Flip animation
  const animatedValue = useRef(new Animated.Value(0)).current;
  const isFlippedRef = useRef(false);
  const isAnimating = useRef(false);
  const flipTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (flipTimeoutRef.current) {
        clearTimeout(flipTimeoutRef.current);
      }
    };
  }, []);

  const flipCard = () => {
    if (isAnimating.current) return;
    if (flipTimeoutRef.current) {
      clearTimeout(flipTimeoutRef.current);
      flipTimeoutRef.current = null;
    }
    const nextFlipped = !isFlippedRef.current;
    isFlippedRef.current = nextFlipped;
    isAnimating.current = true;

    Animated.spring(animatedValue, {
      toValue: nextFlipped ? 180 : 0,
      friction: 8,
      tension: 10,
      useNativeDriver: true,
    }).start(({ finished }) => {
      isAnimating.current = false;
      if (finished) {
        setIsFlipped(nextFlipped);
      }
    });
  };

  const resetFlip = () => {
    if (flipTimeoutRef.current) {
      clearTimeout(flipTimeoutRef.current);
      flipTimeoutRef.current = null;
    }
    isAnimating.current = false;
    animatedValue.setValue(0);
    isFlippedRef.current = false;
    setIsFlipped(false);
  };

  if (!items || items.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No flashcards in this set.</Text>
      </View>
    );
  }

  const currentItem = items[currentIndex];
  const isLast = currentIndex === items.length - 1;

  const handleNext = (mastered: boolean) => {
    const result = mastered ? 'correct' : 'review_again';
    syncEngine.recordStudyAnswer(currentItem.id, result);

    if (mastered) {
      setMasteredCount((prev) => prev + 1);
    }

    if (isLast) {
      if (onFinish) onFinish();
    } else {
      resetFlip();
      setCurrentIndex((prev) => prev + 1);
    }
  };

  // Android: Standard 3D Y-axis rotation with perspective
  const frontInterpolate = animatedValue.interpolate({
    inputRange: [0, 180],
    outputRange: ['0deg', '180deg'],
    extrapolate: 'clamp',
  });

  const backInterpolate = animatedValue.interpolate({
    inputRange: [0, 180],
    outputRange: ['180deg', '360deg'],
    extrapolate: 'clamp',
  });

  // iOS: Symmetric horizontal flip scaling so Core Animation never bisects/clips the card at Z=0
  const frontScaleX = animatedValue.interpolate({
    inputRange: [0, 90, 180],
    outputRange: [1, 0, 0],
    extrapolate: 'clamp',
  });

  const backScaleX = animatedValue.interpolate({
    inputRange: [0, 90, 180],
    outputRange: [0, 0, 1],
    extrapolate: 'clamp',
  });

  // Subtle 3D perspective lift during flip
  const cardScale = animatedValue.interpolate({
    inputRange: [0, 90, 180],
    outputRange: [1, 0.95, 1],
    extrapolate: 'clamp',
  });

  const frontOpacity = animatedValue.interpolate({
    inputRange: [0, 89.9, 90, 180],
    outputRange: [1, 1, 0, 0],
    extrapolate: 'clamp',
  });

  const backOpacity = animatedValue.interpolate({
    inputRange: [0, 90, 90.1, 180],
    outputRange: [0, 0, 1, 1],
    extrapolate: 'clamp',
  });

  const frontTransform = Platform.select({
    ios: [
      { scaleX: frontScaleX },
      { scale: cardScale },
    ],
    default: [
      { perspective: 1000 },
      { rotateY: frontInterpolate },
    ],
  });

  const backTransform = Platform.select({
    ios: [
      { scaleX: backScaleX },
      { scale: cardScale },
    ],
    default: [
      { perspective: 1000 },
      { rotateY: backInterpolate },
    ],
  });

  // Buttons transition synchronously in lockstep with the card flip
  const frontBtnOpacity = animatedValue.interpolate({
    inputRange: [0, 75, 90],
    outputRange: [1, 0, 0],
    extrapolate: 'clamp',
  });

  const frontBtnTranslateY = animatedValue.interpolate({
    inputRange: [0, 90],
    outputRange: [0, 8],
    extrapolate: 'clamp',
  });

  const backBtnOpacity = animatedValue.interpolate({
    inputRange: [90, 105, 180],
    outputRange: [0, 1, 1],
    extrapolate: 'clamp',
  });

  const backBtnTranslateY = animatedValue.interpolate({
    inputRange: [90, 180],
    outputRange: [8, 0],
    extrapolate: 'clamp',
  });

  const progressPercent = Math.round(((currentIndex + 1) / items.length) * 100);

  return (
    <View style={[styles.container, { paddingBottom: bottomPadding }]}>
      {/* Progress & Header */}
      <View style={styles.header}>
        <View style={styles.progressCol}>
          <Text style={styles.progressText}>
            Card {currentIndex + 1} of {items.length}
          </Text>
          <View style={styles.miniProgressBar}>
            <View style={[styles.miniProgressFill, { width: `${progressPercent}%` }]} />
          </View>
        </View>
        <View style={styles.badgeRow}>
          <View style={styles.masteredBadge}>
            <Text style={styles.masteredText}>{masteredCount} Mastered</Text>
          </View>
          <View style={styles.difficultyBadge}>
            <Text style={styles.difficultyText}>{currentItem.difficulty.toUpperCase()}</Text>
          </View>
        </View>
      </View>

      {/* Progressive Contextual Coachmarks */}
      {!isFlipped && !hasSeenFlashcardGestureTip && (
        <CoachmarkTooltip
          title="Tap to Flip & Check Yourself"
          description="Give it your best guess first, then tap anywhere on the card to see the answer and explanation."
          onDismiss={() => markTipSeen('flashcardGesture')}
          arrowPosition="bottom"
        />
      )}

      {isFlipped && !hasSeenSourceProvenanceTip && (
        <CoachmarkTooltip
          title="100% Backed by Your Notes"
          description="Notice that little citation tag? Momo links every single card back to the exact page and section from your document!"
          onDismiss={() => markTipSeen('sourceProvenance')}
          arrowPosition="top"
        />
      )}

      {/* 3D Flip Card Container */}
      <View style={styles.cardWrapper} collapsable={false}>
        {/* Front Face */}
        <Animated.View
          collapsable={false}
          pointerEvents={isFlipped ? 'none' : 'auto'}
          style={[
            styles.cardFace,
            styles.cardFront,
            {
              transform: frontTransform,
              opacity: frontOpacity,
            },
          ]}
        >
          <View style={styles.cardHeaderRow}>
            <View style={styles.frontTag}>
              <Text style={styles.frontTagText}>FLASHCARD</Text>
            </View>
            <TouchableOpacity
              style={styles.flipHintRow}
              onPress={flipCard}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <HugeiconsIcon icon={EyeIcon} size={isPadDevice ? 18 : 13} color={colors.primary} strokeWidth={2.2} />
              <Text style={styles.flipHint}>Tap to reveal</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.cardScroll}
            contentContainerStyle={styles.frontScrollContent}
            showsVerticalScrollIndicator={true}
            nestedScrollEnabled={true}
            bounces={true}
          >
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={flipCard}
              style={styles.frontQuestionTouch}
            >
              {isMeaningfulSection(currentItem.source_metadata?.section) ? (
                <View style={styles.topicBadge}>
                  <HugeiconsIcon icon={BookOpen01Icon} size={isPadDevice ? 16 : 12} color={colors.primary} strokeWidth={2.2} />
                  <Text style={styles.topicBadgeText} numberOfLines={1}>
                    {currentItem.source_metadata?.section?.toUpperCase()}
                  </Text>
                </View>
              ) : null}
              <Text style={styles.questionText}>{sanitizeQuestionText(currentItem.question)}</Text>
            </TouchableOpacity>
          </ScrollView>

          <TouchableOpacity
            style={styles.cardBottomBar}
            onPress={flipCard}
            activeOpacity={0.7}
          >
            <Text style={styles.cardBottomHint}>Check your recall, then tap to reveal answer</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Back Face */}
        <Animated.View
          collapsable={false}
          pointerEvents={isFlipped ? 'auto' : 'none'}
          style={[
            styles.cardFace,
            styles.cardBack,
            {
              transform: backTransform,
              opacity: backOpacity,
            },
          ]}
        >
          <View style={styles.cardHeaderRow}>
            <View style={styles.backTag}>
              <HugeiconsIcon icon={CheckmarkCircle02Icon} size={isPadDevice ? 18 : 13} color={colors.success} strokeWidth={2.4} />
              <Text style={styles.backTagText}>ANSWER REVEALED</Text>
            </View>
            <TouchableOpacity
              style={styles.backFlipHintRow}
              onPress={flipCard}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <HugeiconsIcon icon={RefreshIcon} size={isPadDevice ? 18 : 13} color={colors.textMuted} strokeWidth={2} />
              <Text style={styles.backFlipHint}>Flip back</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.cardScroll}
            contentContainerStyle={styles.backScrollContent}
            showsVerticalScrollIndicator={true}
            nestedScrollEnabled={true}
            bounces={true}
          >
            {/* Prominent Answer Hero Box */}
            <View style={styles.prominentAnswerCard}>
              <View style={styles.prominentAnswerHeader}>
                <HugeiconsIcon icon={CheckmarkCircle02Icon} size={isPadDevice ? 20 : 14} color={colors.success} strokeWidth={2.4} />
                <Text style={styles.prominentAnswerBadgeLabel}>CORRECT ANSWER</Text>
              </View>
              <Text style={styles.answerText}>{currentItem.answer}</Text>
            </View>

            {/* Relevant Explanation & Context Box */}
            {currentItem.explanation ? (
              <View style={styles.explanationBox}>
                <View style={styles.explanationHeaderRow}>
                  <HugeiconsIcon icon={BookOpen01Icon} size={isPadDevice ? 20 : 14} color={colors.primary} strokeWidth={2.2} />
                  <Text style={styles.explanationLabel}>EXPLANATION & CONTEXT</Text>
                </View>
                <Text style={styles.explanationText}>{currentItem.explanation}</Text>
              </View>
            ) : null}

            {/* Source Reference Bar */}
            <SourceAttribution source={currentItem.source_metadata} />
          </ScrollView>
        </Animated.View>
      </View>

      {/* Bottom Controls - Synchronized with card flip */}
      <View style={styles.controls}>
        {/* Front Layer: Show Answer */}
        <Animated.View
          pointerEvents={isFlipped ? 'none' : 'auto'}
          style={[
            styles.buttonLayer,
            {
              opacity: frontBtnOpacity,
              transform: [{ translateY: frontBtnTranslateY }],
            },
          ]}
        >
          <PlatformPressable style={styles.revealButton} onPress={flipCard}>
            <View style={styles.revealContent}>
              <HugeiconsIcon icon={EyeIcon} size={isPadDevice ? 24 : 18} color={colors.onPrimary} strokeWidth={2.2} />
              <Text style={styles.revealButtonText}>Show Answer</Text>
            </View>
          </PlatformPressable>
        </Animated.View>

        {/* Back Layer: Review Again & Got It */}
        <Animated.View
          pointerEvents={isFlipped ? 'auto' : 'none'}
          style={[
            styles.buttonLayer,
            styles.backButtonLayer,
            {
              opacity: backBtnOpacity,
              transform: [{ translateY: backBtnTranslateY }],
            },
          ]}
        >
          <View style={styles.actionRow}>
            <PlatformPressable
              style={styles.reviewAgainBtn}
              onPress={() => handleNext(false)}
            >
              <View style={styles.actionBtnContent}>
                <HugeiconsIcon icon={Cancel01Icon} size={isPadDevice ? 24 : 18} color={colors.danger} strokeWidth={2.4} />
                <Text style={styles.reviewAgainText}>Review Again</Text>
              </View>
            </PlatformPressable>

            <PlatformPressable
              style={styles.gotItBtn}
              onPress={() => handleNext(true)}
            >
              <View style={styles.actionBtnContent}>
                <HugeiconsIcon icon={CheckmarkCircle02Icon} size={isPadDevice ? 24 : 18} color={colors.onPrimary} strokeWidth={2.4} />
                <Text style={styles.gotItText}>Got It</Text>
              </View>
            </PlatformPressable>
          </View>
        </Animated.View>
      </View>
    </View>
  );
};

const isPadDevice = isIpad();

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: isPadDevice ? spacing[28] : spacing[16],
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: isPadDevice ? 860 : undefined,
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: isPadDevice ? spacing[18] : spacing[12],
  },
  progressCol: {
    flex: 1,
    marginRight: spacing[12],
  },
  progressText: {
    fontSize: isPadDevice ? typography.fontSize[16] : typography.fontSize[13],
    fontWeight: typography.fontWeight.bold,
    color: colors.textMuted,
    marginBottom: isPadDevice ? spacing[6] : spacing[4],
  },
  miniProgressBar: {
    height: isPadDevice ? 10 : 6,
    backgroundColor: colors.surfaceMuted,
    borderRadius: isPadDevice ? 5 : 3,
    overflow: 'hidden',
  },
  miniProgressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: isPadDevice ? 5 : 3,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: isPadDevice ? spacing[10] : spacing[6],
  },
  masteredBadge: {
    backgroundColor: colors.successSoft,
    paddingHorizontal: isPadDevice ? spacing[12] : spacing[8],
    paddingVertical: isPadDevice ? spacing[6] : spacing[3],
    borderRadius: isPadDevice ? 8 : 6,
  },
  masteredText: {
    fontSize: isPadDevice ? typography.fontSize[14] : typography.fontSize[11],
    fontWeight: typography.fontWeight.bold,
    color: colors.success,
  },
  difficultyBadge: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: isPadDevice ? spacing[12] : spacing[8],
    paddingVertical: isPadDevice ? spacing[6] : spacing[3],
    borderRadius: isPadDevice ? 8 : 6,
  },
  difficultyText: {
    fontSize: isPadDevice ? typography.fontSize[14] : typography.fontSize[11],
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
  },
  cardWrapper: {
    flex: 1,
    minHeight: isPadDevice ? 540 : 360,
    maxHeight: isPadDevice ? 740 : 540,
    marginBottom: isPadDevice ? spacing[24] : spacing[16],
    position: 'relative',
    overflow: 'visible',
  },
  cardFace: {
    backgroundColor: colors.surface,
    borderRadius: isPadDevice ? 28 : 20,
    padding: isPadDevice ? spacing[28] : spacing[20],
    borderWidth: 1,
    borderColor: colors.border,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backfaceVisibility: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 14,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  cardFront: {
    borderColor: colors.border,
    justifyContent: 'space-between',
  },
  cardBack: {
    borderColor: colors.primaryBorder,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: isPadDevice ? spacing[16] : spacing[12],
  },
  frontTag: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: isPadDevice ? spacing[12] : spacing[8],
    paddingVertical: isPadDevice ? 6 : 3.5,
    borderRadius: isPadDevice ? 8 : 6,
  },
  frontTagText: {
    fontSize: isPadDevice ? typography.fontSize[12] : typography.fontSize[10],
    fontWeight: typography.fontWeight.extraBold,
    color: colors.primary,
    letterSpacing: typography.letterSpacing[0.6],
  },
  backTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    backgroundColor: colors.successSoft,
    paddingHorizontal: isPadDevice ? spacing[12] : spacing[8],
    paddingVertical: isPadDevice ? 6 : 3.5,
    borderRadius: isPadDevice ? 8 : 6,
  },
  backTagText: {
    fontSize: isPadDevice ? typography.fontSize[12] : typography.fontSize[10],
    fontWeight: typography.fontWeight.extraBold,
    color: colors.success,
    letterSpacing: typography.letterSpacing[0.6],
  },
  flipHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    flexShrink: 0,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: isPadDevice ? spacing[12] : spacing[8],
    paddingVertical: isPadDevice ? 6 : 3.5,
    borderRadius: isPadDevice ? 8 : 6,
  },
  flipHint: {
    fontSize: isPadDevice ? typography.fontSize[13] : typography.fontSize[11],
    color: colors.primary,
    fontWeight: typography.fontWeight.semiBold,
  },
  backFlipHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    flexShrink: 0,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: isPadDevice ? spacing[12] : spacing[8],
    paddingVertical: isPadDevice ? 6 : 3.5,
    borderRadius: isPadDevice ? 8 : 6,
  },
  backFlipHint: {
    fontSize: isPadDevice ? typography.fontSize[13] : typography.fontSize[11],
    color: colors.textMuted,
    fontWeight: typography.fontWeight.semiBold,
  },
  topicBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: isPadDevice ? spacing[8] : spacing[5],
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: isPadDevice ? spacing[14] : spacing[10],
    paddingVertical: isPadDevice ? spacing[6] : spacing[4],
    borderRadius: isPadDevice ? 10 : 8,
    marginBottom: isPadDevice ? spacing[18] : spacing[14],
    maxWidth: '90%',
  },
  topicBadgeText: {
    fontSize: isPadDevice ? typography.fontSize[12] : typography.fontSize[10],
    fontWeight: typography.fontWeight.bold,
    color: colors.textSecondary,
    letterSpacing: typography.letterSpacing[0.5],
  },
  cardScroll: {
    flex: 1,
  },
  frontScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: isPadDevice ? spacing[18] : spacing[12],
  },
  frontQuestionTouch: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  questionText: {
    fontSize: isPadDevice ? typography.fontSize[28] : typography.fontSize[19],
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
    lineHeight: isPadDevice ? typography.lineHeight[40] : typography.lineHeight[28],
    textAlign: 'center',
  },
  cardBottomBar: {
    alignItems: 'center',
    paddingTop: isPadDevice ? spacing[16] : spacing[12],
    borderTopWidth: 1,
    borderTopColor: colors.surfaceMuted,
  },
  cardBottomHint: {
    fontSize: isPadDevice ? typography.fontSize[15] : typography.fontSize[12],
    color: colors.textDisabled,
    fontWeight: typography.fontWeight.medium,
  },
  backScrollContent: {
    paddingBottom: spacing[16],
  },
  prominentAnswerCard: {
    backgroundColor: colors.successSoft,
    borderRadius: isPadDevice ? 18 : 14,
    padding: isPadDevice ? spacing[22] : spacing[16],
    borderWidth: 1.5,
    borderColor: colors.successBorder,
    marginBottom: isPadDevice ? spacing[16] : spacing[12],
  },
  prominentAnswerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[5],
    marginBottom: spacing[6],
  },
  prominentAnswerBadgeLabel: {
    fontSize: isPadDevice ? typography.fontSize[13] : typography.fontSize[10.5],
    fontWeight: typography.fontWeight.extraBold,
    color: colors.success,
    letterSpacing: typography.letterSpacing[0.5],
  },
  answerText: {
    fontSize: isPadDevice ? typography.fontSize[26] : typography.fontSize[18],
    fontWeight: typography.fontWeight.extraBold,
    color: colors.success,
    lineHeight: isPadDevice ? typography.lineHeight[36] : typography.lineHeight[25],
  },
  explanationBox: {
    backgroundColor: colors.background,
    padding: isPadDevice ? spacing[20] : spacing[14],
    borderRadius: isPadDevice ? 16 : 12,
    borderLeftWidth: isPadDevice ? 4.5 : 3.5,
    borderLeftColor: colors.primary,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: isPadDevice ? spacing[14] : spacing[8],
  },
  explanationHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[6],
    marginBottom: spacing[6],
  },
  explanationLabel: {
    fontSize: isPadDevice ? typography.fontSize[13] : typography.fontSize[10.5],
    fontWeight: typography.fontWeight.extraBold,
    color: colors.primary,
    letterSpacing: typography.letterSpacing[0.5],
  },
  explanationText: {
    fontSize: isPadDevice ? typography.fontSize[16] : typography.fontSize[13.5],
    color: colors.textSecondary,
    lineHeight: isPadDevice ? typography.lineHeight[24] : typography.lineHeight[20],
  },
  controls: {
    position: 'relative',
    minHeight: isPadDevice ? 66 : 56,
    justifyContent: 'center',
    marginBottom: spacing[8],
  },
  buttonLayer: {
    width: '100%',
  },
  backButtonLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  revealButton: {
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
  revealContent: {
    paddingVertical: isPadDevice ? spacing[20] : spacing[16],
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing[8],
  },
  revealButtonText: {
    color: colors.onPrimary,
    fontSize: isPadDevice ? typography.fontSize[19] : typography.fontSize[16],
    fontWeight: typography.fontWeight.bold,
  },
  actionRow: {
    flexDirection: 'row',
    gap: isPadDevice ? spacing[16] : spacing[12],
  },
  actionBtnContent: {
    paddingVertical: isPadDevice ? spacing[18] : spacing[15],
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing[8],
  },
  reviewAgainBtn: {
    flex: 1,
    backgroundColor: colors.dangerSoft,
    borderRadius: isPadDevice ? 18 : 14,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
  },
  reviewAgainText: {
    color: colors.danger,
    fontWeight: typography.fontWeight.bold,
    fontSize: isPadDevice ? typography.fontSize[17] : typography.fontSize[15],
  },
  gotItBtn: {
    flex: 1,
    backgroundColor: colors.success,
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
  gotItText: {
    color: colors.onPrimary,
    fontWeight: typography.fontWeight.bold,
    fontSize: isPadDevice ? typography.fontSize[17] : typography.fontSize[15],
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[32],
  },
  emptyText: {
    fontSize: isPadDevice ? typography.fontSize[18] : typography.fontSize[15],
    color: colors.textMuted,
  },
});
