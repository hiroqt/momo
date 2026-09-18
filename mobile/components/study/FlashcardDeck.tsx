import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Animated,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  RefreshIcon,
  CheckmarkCircle02Icon,
  Cancel01Icon,
  SparklesIcon,
  EyeIcon,
  BookOpen01Icon,
} from '@hugeicons/core-free-icons';
import { StudyItem } from '../../types';
import { SourceAttribution } from './SourceAttribution';
import { PlatformPressable } from '../common/PlatformPressable';
import { syncEngine } from '../../lib/sync/syncEngine';
import { isMeaningfulSection, sanitizeQuestionText } from '../../utils/formatters';

interface Props {
  items: StudyItem[];
  onFinish?: () => void;
}

export const FlashcardDeck: React.FC<Props> = ({ items, onFinish }) => {
  const insets = useSafeAreaInsets();
  const isAndroid = Platform.OS === 'android';
  const bottomPadding = Math.max(insets.bottom, isAndroid ? 28 : 16) + 16;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [masteredCount, setMasteredCount] = useState(0);

  // 3D Flip animation
  const animatedValue = useRef(new Animated.Value(0)).current;
  const currentValue = useRef(0);
  const isFlippedRef = useRef(false);

  useEffect(() => {
    const listenerId = animatedValue.addListener(({ value }) => {
      currentValue.current = value;
      const flipped = value >= 90;
      if (flipped !== isFlippedRef.current) {
        isFlippedRef.current = flipped;
        setIsFlipped(flipped);
      }
    });
    return () => {
      animatedValue.removeListener(listenerId);
    };
  }, [animatedValue]);

  const flipCard = () => {
    const targetValue = currentValue.current >= 90 ? 0 : 180;
    Animated.spring(animatedValue, {
      toValue: targetValue,
      friction: 8,
      tension: 10,
      useNativeDriver: true,
    }).start();
  };

  const resetFlip = () => {
    animatedValue.setValue(0);
    currentValue.current = 0;
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

  const frontInterpolate = animatedValue.interpolate({
    inputRange: [0, 180],
    outputRange: ['0deg', '180deg'],
  });

  const backInterpolate = animatedValue.interpolate({
    inputRange: [0, 180],
    outputRange: ['180deg', '360deg'],
  });

  const frontOpacity = animatedValue.interpolate({
    inputRange: [89, 90],
    outputRange: [1, 0],
  });

  const backOpacity = animatedValue.interpolate({
    inputRange: [89, 90],
    outputRange: [0, 1],
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

      {/* 3D Flip Card Container */}
      <View style={styles.cardWrapper}>
        {/* Front Face */}
        <Animated.View
          pointerEvents={isFlipped ? 'none' : 'auto'}
          style={[
            styles.cardFace,
            styles.cardFront,
            {
              transform: [{ perspective: 1000 }, { rotateY: frontInterpolate }],
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
              <HugeiconsIcon icon={EyeIcon} size={13} color="#4F46E5" strokeWidth={2.2} />
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
                  <HugeiconsIcon icon={BookOpen01Icon} size={12} color="#4F46E5" strokeWidth={2.2} />
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
          pointerEvents={isFlipped ? 'auto' : 'none'}
          style={[
            styles.cardFace,
            styles.cardBack,
            {
              transform: [{ perspective: 1000 }, { rotateY: backInterpolate }],
              opacity: backOpacity,
            },
          ]}
        >
          <View style={styles.cardHeaderRow}>
            <View style={styles.backTag}>
              <HugeiconsIcon icon={CheckmarkCircle02Icon} size={13} color="#059669" strokeWidth={2.4} />
              <Text style={styles.backTagText}>ANSWER REVEALED</Text>
            </View>
            <TouchableOpacity
              style={styles.backFlipHintRow}
              onPress={flipCard}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <HugeiconsIcon icon={RefreshIcon} size={13} color="#64748B" strokeWidth={2} />
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
                <HugeiconsIcon icon={CheckmarkCircle02Icon} size={14} color="#047857" strokeWidth={2.4} />
                <Text style={styles.prominentAnswerBadgeLabel}>CORRECT ANSWER</Text>
              </View>
              <Text style={styles.answerText}>{currentItem.answer}</Text>
            </View>

            {/* Relevant Explanation & Context Box */}
            {currentItem.explanation ? (
              <View style={styles.explanationBox}>
                <View style={styles.explanationHeaderRow}>
                  <HugeiconsIcon icon={BookOpen01Icon} size={14} color="#4F46E5" strokeWidth={2.2} />
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
              <HugeiconsIcon icon={EyeIcon} size={18} color="#FFFFFF" strokeWidth={2.2} />
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
                <HugeiconsIcon icon={Cancel01Icon} size={18} color="#DC2626" strokeWidth={2.4} />
                <Text style={styles.reviewAgainText}>Review Again</Text>
              </View>
            </PlatformPressable>

            <PlatformPressable
              style={styles.gotItBtn}
              onPress={() => handleNext(true)}
            >
              <View style={styles.actionBtnContent}>
                <HugeiconsIcon icon={CheckmarkCircle02Icon} size={18} color="#FFFFFF" strokeWidth={2.4} />
                <Text style={styles.gotItText}>Got It</Text>
              </View>
            </PlatformPressable>
          </View>
        </Animated.View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressCol: {
    flex: 1,
    marginRight: 12,
  },
  progressText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 4,
  },
  miniProgressBar: {
    height: 6,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  miniProgressFill: {
    height: '100%',
    backgroundColor: '#4F46E5',
    borderRadius: 3,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 6,
  },
  masteredBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  masteredText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  difficultyBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  difficultyText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4F46E5',
  },
  cardWrapper: {
    flex: 1,
    minHeight: 360,
    maxHeight: 540,
    marginBottom: 16,
    position: 'relative',
  },
  cardFace: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backfaceVisibility: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
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
    borderColor: '#E2E8F0',
    justifyContent: 'space-between',
  },
  cardBack: {
    borderColor: '#C7D2FE',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  frontTag: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 6,
  },
  frontTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#4F46E5',
    letterSpacing: 0.6,
  },
  backTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 6,
  },
  backTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#059669',
    letterSpacing: 0.6,
  },
  flipHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 6,
  },
  flipHint: {
    fontSize: 11,
    color: '#4F46E5',
    fontWeight: '600',
  },
  backFlipHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 6,
  },
  backFlipHint: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  topicBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 14,
    maxWidth: '90%',
  },
  topicBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
    letterSpacing: 0.5,
  },
  cardScroll: {
    flex: 1,
  },
  frontScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 12,
  },
  frontQuestionTouch: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  questionText: {
    fontSize: 19,
    fontWeight: '700',
    color: '#0F172A',
    lineHeight: 28,
    textAlign: 'center',
  },
  cardBottomBar: {
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  cardBottomHint: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },
  backScrollContent: {
    paddingBottom: 16,
  },
  prominentAnswerCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#86EFAC',
    marginBottom: 12,
  },
  prominentAnswerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 6,
  },
  prominentAnswerBadgeLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#047857',
    letterSpacing: 0.5,
  },
  answerText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#064E3B',
    lineHeight: 25,
  },
  explanationBox: {
    backgroundColor: '#F8FAFC',
    padding: 14,
    borderRadius: 12,
    borderLeftWidth: 3.5,
    borderLeftColor: '#4F46E5',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 8,
  },
  explanationHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  explanationLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#4F46E5',
    letterSpacing: 0.5,
  },
  explanationText: {
    fontSize: 13.5,
    color: '#334155',
    lineHeight: 20,
  },
  controls: {
    position: 'relative',
    minHeight: 56,
    justifyContent: 'center',
    marginBottom: 8,
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
  revealContent: {
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  revealButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionBtnContent: {
    paddingVertical: 15,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  reviewAgainBtn: {
    flex: 1,
    backgroundColor: '#FEE2E2',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  reviewAgainText: {
    color: '#DC2626',
    fontWeight: '700',
    fontSize: 15,
  },
  gotItBtn: {
    flex: 1,
    backgroundColor: '#059669',
    borderRadius: 14,
    ...Platform.select({
      ios: {
        shadowColor: '#059669',
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
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 15,
    color: '#64748B',
  },
});
