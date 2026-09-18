import React, { useState, useRef, useMemo } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Animated,
  StyleProp,
  ViewStyle,
  TextStyle,
  ScrollView,
} from 'react-native';
import { AppText as Text, AppTextInput as TextInput } from '@/components/common/app-text';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  CheckmarkCircle02Icon,
  Cancel01Icon,
  ArrowRight01Icon,
  ArrowDown01Icon,
  ArrowUp01Icon,
  BookOpen01Icon,
  TrophyIcon,
  Idea01Icon,
  RefreshIcon,
  SparklesIcon,
  EyeIcon,
} from '@hugeicons/core-free-icons';
import { StudyItem } from '../../types';
import { SourceAttribution } from './SourceAttribution';
import { PlatformPressable } from '../common/PlatformPressable';
import { SmoothScrollView } from '../common/SmoothScrollView';
import { syncEngine } from '../../lib/sync/syncEngine';
import { isMeaningfulSection, sanitizeQuestionText } from '../../utils/formatters';
import { useCredits } from '../../context/CreditsContext';
import { Image } from 'react-native';
import { Modal } from 'react-native';

interface Props {
  items: StudyItem[];
  isExamMode?: boolean;
  onFinish?: (score: { correct: number; total: number; xp: number }) => void;
  onRestart?: () => void;
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

/**
 * Returns the XP value awarded based on question type (exam format):
 * - Identification (free typing active recall): 25 XP
 * - Multiple Choice: 15 XP
 * - True / False: 10 XP
 */
export function getQuestionXP(type: string): number {
  switch (type) {
    case 'identification':
      return 25;
    case 'true_false':
      return 10;
    case 'multiple_choice':
    default:
      return 15;
  }
}

function generateIdentificationClue(answer: string): {
  masked: string;
  summary: string;
} {
  if (!answer) return { masked: '', summary: '' };
  const clean = answer.trim();
  const words = clean.split(/\s+/);
  const totalChars = clean.replace(/\s+/g, '').length;
  const summary = `${words.length} ${words.length === 1 ? 'word' : 'words'} • ${totalChars} letters`;

  const maskedWords = words.map((w) => {
    if (w.length <= 1) return w.toUpperCase();
    const first = w[0].toUpperCase();
    const dots = '• '.repeat(w.length - 1).trim();
    return `${first} ${dots}`;
  });

  return {
    masked: maskedWords.join('    '),
    summary,
  };
}

function checkIsCorrect(userAns: string, item: StudyItem): boolean {
  if (!userAns || !userAns.trim()) return false;
  const cleanUser = userAns.trim().toLowerCase();
  const cleanAns = item.answer.trim().toLowerCase();

  if (item.type === 'multiple_choice' || item.type === 'true_false') {
    return cleanUser === cleanAns;
  }
  return cleanUser === cleanAns || cleanUser.includes(cleanAns) || cleanAns.includes(cleanUser);
}

export const QuizRunner: React.FC<Props> = ({ items, onFinish, onRestart }) => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isAndroid = Platform.OS === 'android';
  const bottomPadding = Math.max(insets.bottom, isAndroid ? 28 : 16) + 16;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [typedAnswer, setTypedAnswer] = useState<string>('');
  const [showHint, setShowHint] = useState(false);
  const [isCurrentQuestionRevealed, setIsCurrentQuestionRevealed] = useState(false);
  const [currentXP, setCurrentXP] = useState(0);
  const [isQuizFinished, setIsQuizFinished] = useState(false);
  const [selectedReviewIndex, setSelectedReviewIndex] = useState<number | null>(null);
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [lastAnswerResult, setLastAnswerResult] = useState<{
    isCorrect: boolean;
    earnedXP: number;
  } | null>(null);
  const [userAnswers, setUserAnswers] = useState<
    Record<
      number,
      {
        userAnswer: string;
        isCorrect: boolean;
        selectedOption: string | null;
        xpAwarded: number;
        wasRevealed?: boolean;
      }
    >
  >({});

  const { credits, deductCredits, addXP } = useCredits();
  const [showCreditsModal, setShowCreditsModal] = useState(false);

  // Animated values
  const xpBarAnim = useRef(new Animated.Value(0)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.7)).current;

  const maxSessionXP = useMemo(() => {
    if (!items || items.length === 0) return 0;
    return items.reduce((acc, item) => acc + getQuestionXP(item.type), 0);
  }, [items]);

  if (!items || items.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.textMuted}>No quiz questions available.</Text>
      </View>
    );
  }

  const currentItem = items[currentIndex];
  const isLast = currentIndex === items.length - 1;
  const options = currentItem.options || (currentItem.type === 'true_false' ? ['True', 'False'] : []);

  const handleRevealAnswer = () => {
    if (isCurrentQuestionRevealed || isSubmittingFeedback) return;
    
    if (!deductCredits(50)) {
      setShowCreditsModal(true);
      return;
    }

    setIsCurrentQuestionRevealed(true);

    if (options.length > 0) {
      const matchedOption = options.find(
        (opt) => opt.trim().toLowerCase() === currentItem.answer.trim().toLowerCase()
      );
      setSelectedOption(matchedOption || currentItem.answer);
    } else {
      setTypedAnswer(currentItem.answer);
    }
  };

  const handleNextQuestion = () => {
    if (isSubmittingFeedback) return;

    const userAnswer = selectedOption || typedAnswer.trim();
    const wasRevealed = isCurrentQuestionRevealed;
    const isCorrect = !wasRevealed && checkIsCorrect(userAnswer, currentItem);
    const earnedXP = isCorrect ? getQuestionXP(currentItem.type) : 0;
    const nextXP = currentXP + earnedXP;

    const updatedAnswers = {
      ...userAnswers,
      [currentIndex]: {
        userAnswer: wasRevealed ? `${userAnswer} (Revealed)` : (userAnswer || '(Unanswered)'),
        isCorrect,
        selectedOption,
        xpAwarded: earnedXP,
        wasRevealed,
      },
    };
    setUserAnswers(updatedAnswers);

    syncEngine.recordStudyAnswer(
      currentItem.id,
      isCorrect ? 'correct' : 'incorrect',
      wasRevealed ? `(Answer Revealed: ${currentItem.answer})` : (userAnswer || '(Unanswered)')
    );

    // Show visual feedback on the item selected or inputed
    setIsSubmittingFeedback(true);
    setLastAnswerResult({ isCorrect, earnedXP });

    if (isCorrect) {
      setCurrentXP(nextXP);
      addXP(earnedXP); // Add earned XP to credits
      const targetPercent = maxSessionXP > 0 ? (nextXP / maxSessionXP) * 100 : 0;
      Animated.timing(xpBarAnim, {
        toValue: targetPercent,
        duration: 450,
        useNativeDriver: false,
      }).start();
    }

    // Trigger floating animation rising directly from the item
    floatAnim.setValue(0);
    fadeAnim.setValue(0);
    scaleAnim.setValue(0.7);

    Animated.sequence([
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 160, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1.15, friction: 6, tension: 140, useNativeDriver: true }),
        Animated.timing(floatAnim, { toValue: -32, duration: 380, useNativeDriver: true }),
      ]),
      Animated.delay(260),
      Animated.timing(fadeAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start();

    // After animation plays, transition smoothly to next question
    setTimeout(() => {
      setIsSubmittingFeedback(false);
      setLastAnswerResult(null);

      if (isLast) {
        const totalCorrect = Object.values(updatedAnswers).filter((a) => a.isCorrect).length;
        onFinish?.({ correct: totalCorrect, total: items.length, xp: nextXP });
        setIsQuizFinished(true);
      } else {
        setCurrentIndex((prev) => prev + 1);
        setSelectedOption(null);
        setTypedAnswer('');
        setShowHint(false);
        setIsCurrentQuestionRevealed(false);
      }
    }, 700);
  };

  const handleRestartQuiz = () => {
    setCurrentIndex(0);
    setSelectedOption(null);
    setTypedAnswer('');
    setShowHint(false);
    setIsCurrentQuestionRevealed(false);
    setIsSubmittingFeedback(false);
    setLastAnswerResult(null);
    setUserAnswers({});
    setCurrentXP(0);
    setIsQuizFinished(false);
    setSelectedReviewIndex(null);
    xpBarAnim.setValue(0);
    if (onRestart) {
      onRestart();
    }
  };

  // ----------------------------------------------------
  // COMPREHENSIVE POST-QUIZ REVIEW SCREEN
  // "show all the answers of the user after the question green for right and red for wrong with explanation"
  // ----------------------------------------------------
  if (isQuizFinished) {
    const totalQuestions = items.length;
    const answeredRecords = Object.values(userAnswers);
    const totalCorrect = answeredRecords.filter((r) => r.isCorrect).length;
    const percent = Math.round((totalCorrect / totalQuestions) * 100);
    const isMastered = percent >= 70;

    return (
      <SmoothScrollView
        contentContainerStyle={[styles.reviewContainer, { paddingBottom: bottomPadding + 24 }]}
      >
        {/* Score & XP Hero Summary Card */}
        <View style={styles.reviewHeroCard}>
          <View style={[styles.heroBadgeCircle, isMastered ? styles.trophyBg : styles.bookBg]}>
            <HugeiconsIcon
              icon={isMastered ? TrophyIcon : BookOpen01Icon}
              size={38}
              color={isMastered ? '#D97706' : '#4F46E5'}
              strokeWidth={2}
            />
          </View>
          <Text style={styles.heroTitle}>
            {isMastered ? 'Outstanding Job!' : 'Quiz Completed!'}
          </Text>

          {/* Prominent XP Earned Banner */}
          <View style={styles.xpEarnedCard}>
            <View style={styles.xpEarnedIconBox}>
              <HugeiconsIcon icon={SparklesIcon} size={20} color="#D97706" strokeWidth={2.4} />
            </View>
            <View style={styles.xpEarnedTextBox}>
              <Text style={styles.xpEarnedValue}>+{currentXP} XP Earned</Text>
              <Text style={styles.xpEarnedSub}>
                {currentXP} of {maxSessionXP} max possible XP
              </Text>
            </View>
          </View>

          {/* Accuracy & Mastery Metrics */}
          <View style={styles.metricsRow}>
            <View style={styles.metricPill}>
              <Text style={styles.metricValue}>
                {totalCorrect} / {totalQuestions}
              </Text>
              <Text style={styles.metricLabel}>Correct</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricPill}>
              <Text style={styles.metricValue}>{percent}%</Text>
              <Text style={styles.metricLabel}>Accuracy</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricPill}>
              <Text
                style={[
                  styles.metricValue,
                  isMastered ? styles.masteredColor : styles.practiceColor,
                ]}
              >
                {isMastered ? 'Mastered' : 'Learning'}
              </Text>
              <Text style={styles.metricLabel}>Status</Text>
            </View>
          </View>
        </View>

        {/* Section Header */}
        <View style={styles.reviewSectionHeader}>
          <View style={styles.reviewSectionTitleRow}>
            <HugeiconsIcon icon={BookOpen01Icon} size={20} color="#4F46E5" strokeWidth={2.2} />
            <Text style={styles.reviewSectionTitle}>Detailed Answer Key & Explanations</Text>
          </View>
          <Text style={styles.reviewSectionSubtitle}>
            Green highlights your correct answers; red highlights incorrect responses. Review explanations and verified document excerpts below.
          </Text>
        </View>

        {/* Number Pagination */}
        <View style={styles.paginationContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.paginationScroll}>
            {items.map((_, idx) => {
              const uRecord = userAnswers[idx];
              const isCorrect = uRecord?.isCorrect ?? false;
              const isRevealed = uRecord?.wasRevealed ?? false;
              const isSelected = selectedReviewIndex === idx;

              let btnStyle: StyleProp<ViewStyle> = styles.pageBtnDefault;
              let txtStyle: StyleProp<TextStyle> = styles.pageBtnTextDefault;

              if (isRevealed) {
                btnStyle = styles.pageBtnRevealed;
                txtStyle = styles.pageBtnTextRevealed;
              } else if (isCorrect) {
                btnStyle = styles.pageBtnCorrect;
                txtStyle = styles.pageBtnTextCorrect;
              } else {
                btnStyle = styles.pageBtnWrong;
                txtStyle = styles.pageBtnTextWrong;
              }

              return (
                <TouchableOpacity
                  key={idx}
                  style={[styles.pageBtn, btnStyle, isSelected && styles.pageBtnSelected]}
                  onPress={() => setSelectedReviewIndex(idx)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.pageBtnText, txtStyle, isSelected && styles.pageBtnTextSelected]}>
                    {idx + 1}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Selected Question Card */}
        {(() => {
          if (selectedReviewIndex === null) {
            return (
              <View style={styles.reviewInstructionBox}>
                <HugeiconsIcon icon={ArrowUp01Icon} size={24} color="#64748B" strokeWidth={2} />
                <Text style={styles.reviewInstructionText}>
                  Select a question number above to view its detailed answer and explanation.
                </Text>
              </View>
            );
          }
          const item = items[selectedReviewIndex];
          if (!item) return null;
          const idx = selectedReviewIndex;
          const userRecord = userAnswers[idx];
          const isCorrect = userRecord?.isCorrect ?? false;
          const userAnsText = userRecord?.userAnswer || '(Unanswered)';
          const xpGained = userRecord?.xpAwarded ?? 0;

          return (
            <View
              style={[
                styles.reviewQuestionCard,
                userRecord?.wasRevealed
                  ? styles.reviewCardRevealedBorder
                  : isCorrect
                  ? styles.reviewCardCorrectBorder
                  : styles.reviewCardWrongBorder,
              ]}
            >
              {/* Question Header: Number, Type, and Status Badge */}
              <View style={styles.reviewQuestionHeaderRow}>
                <View style={styles.reviewQuestionNumberCol}>
                  <Text style={styles.reviewQuestionNumber}>Question {idx + 1}</Text>
                  <View style={styles.questionTypeTag}>
                    <Text style={styles.questionTypeTagText}>
                      {item.type === 'true_false'
                        ? 'TRUE / FALSE'
                        : item.type === 'multiple_choice'
                        ? 'MULTIPLE CHOICE'
                        : 'IDENTIFICATION'}
                    </Text>
                  </View>
                </View>

                {/* Status Badge: Green for Right, Amber for Revealed, Red for Wrong */}
                <View
                  style={[
                    styles.statusBadge,
                    userRecord?.wasRevealed
                      ? styles.badgeRevealed
                      : isCorrect
                      ? styles.badgeCorrect
                      : styles.badgeWrong,
                  ]}
                >
                  <HugeiconsIcon
                    icon={
                      userRecord?.wasRevealed
                        ? EyeIcon
                        : isCorrect
                        ? CheckmarkCircle02Icon
                        : Cancel01Icon
                    }
                    size={14}
                    color={
                      userRecord?.wasRevealed ? '#D97706' : isCorrect ? '#047857' : '#DC2626'
                    }
                    strokeWidth={2.4}
                  />
                  <Text
                    style={[
                      styles.statusBadgeText,
                      userRecord?.wasRevealed
                        ? styles.statusTextRevealed
                        : isCorrect
                        ? styles.statusTextCorrect
                        : styles.statusTextWrong,
                    ]}
                  >
                    {userRecord?.wasRevealed
                      ? 'REVEALED (+0 XP)'
                      : isCorrect
                      ? `CORRECT (+${xpGained} XP)`
                      : 'INCORRECT (+0 XP)'}
                  </Text>
                </View>
              </View>

              {/* Question Text */}
              <Text style={styles.reviewQuestionPrompt}>{sanitizeQuestionText(item.question)}</Text>

              {/* User Answer Card */}
              <View
                style={[
                  styles.userAnswerBox,
                  userRecord?.wasRevealed
                    ? styles.userAnswerBoxRevealed
                    : isCorrect
                    ? styles.userAnswerBoxCorrect
                    : styles.userAnswerBoxWrong,
                ]}
              >
                <View style={styles.userAnswerHeaderRow}>
                  <HugeiconsIcon
                    icon={
                      userRecord?.wasRevealed
                        ? EyeIcon
                        : isCorrect
                        ? CheckmarkCircle02Icon
                        : Cancel01Icon
                    }
                    size={15}
                    color={
                      userRecord?.wasRevealed ? '#D97706' : isCorrect ? '#059669' : '#DC2626'
                    }
                    strokeWidth={2.4}
                  />
                  <Text
                    style={[
                      styles.userAnswerLabel,
                      userRecord?.wasRevealed
                        ? styles.userAnswerLabelRevealed
                        : isCorrect
                        ? styles.userAnswerLabelCorrect
                        : styles.userAnswerLabelWrong,
                    ]}
                  >
                    {userRecord?.wasRevealed ? 'Answer Auto-Revealed:' : 'Your Answer:'}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.userAnswerValue,
                    userRecord?.wasRevealed
                      ? styles.userAnswerValueRevealed
                      : isCorrect
                      ? styles.userAnswerValueCorrect
                      : styles.userAnswerValueWrong,
                  ]}
                >
                  {userAnsText}
                </Text>
              </View>

              {/* Prominent Correct Answer Card */}
              <View style={styles.correctAnswerBox}>
                <View style={styles.correctAnswerHeader}>
                  <HugeiconsIcon
                    icon={CheckmarkCircle02Icon}
                    size={14}
                    color="#047857"
                    strokeWidth={2.4}
                  />
                  <Text style={styles.correctAnswerHeaderLabel}>CORRECT ANSWER</Text>
                </View>
                <Text style={styles.correctAnswerValue}>{item.answer}</Text>
              </View>

              {/* Concept Connection & Explanation */}
              {item.explanation ? (
                <View style={styles.explanationCard}>
                  <View style={styles.explanationHeaderRow}>
                    <HugeiconsIcon icon={BookOpen01Icon} size={14} color="#4F46E5" strokeWidth={2.2} />
                    <Text style={styles.explanationLabel}>EXPLANATION & CONTEXT</Text>
                  </View>
                  <Text style={styles.explanationText}>{item.explanation}</Text>
                </View>
              ) : null}

              {/* Grounded Source Provenance Citation */}
              <SourceAttribution source={item.source_metadata} defaultExpanded={false} />
            </View>
          );
        })()}

        {/* Post-Quiz Actions */}
        <View style={styles.reviewActionFooter}>
          <PlatformPressable style={styles.restartBtn} onPress={handleRestartQuiz}>
            <View style={styles.btnRow}>
              <HugeiconsIcon icon={RefreshIcon} size={18} color="#4F46E5" strokeWidth={2.2} />
              <Text style={styles.restartBtnText}>Practice Again</Text>
            </View>
          </PlatformPressable>

          <PlatformPressable
            style={styles.doneBtn}
            onPress={() => router.replace('/(tabs)/library')}
          >
            <View style={styles.btnRow}>
              <Text style={styles.doneBtnText}>Back to Library</Text>
            </View>
          </PlatformPressable>
        </View>
      </SmoothScrollView>
    );
  }

  // ----------------------------------------------------
  // ACTIVE QUIZ RUNNER VIEW (WITH XP ANIMATION & PROGRESS BAR)
  // "Dont show answers every question finish show all the answers after the question finish"
  // "the xp bar must increment each and the incrementation must based on the type of exam and if answer is wrong no increment"
  // ----------------------------------------------------
  const hasAnswered = Boolean(selectedOption || typedAnswer.trim());

  return (
    <SmoothScrollView
      contentContainerStyle={[styles.container, { paddingBottom: bottomPadding }]}
    >
      {/* Top Bar: XP Progress & Question Counter */}
      <View style={styles.topHeader}>
        <View style={styles.topInfoRow}>
          <View style={styles.questionCounterBox}>
            <Text style={styles.questionCounterText}>
              QUESTION {currentIndex + 1} OF {items.length}
            </Text>
          </View>

          {/* Live XP Badge */}
          <View style={styles.xpBadge}>
            <HugeiconsIcon icon={SparklesIcon} size={15} color="#D97706" strokeWidth={2.4} />
            <Text style={styles.xpBadgeText}>{currentXP} XP</Text>
          </View>
        </View>

        {/* XP Progress Bar Track */}
        <View style={styles.xpTrackContainer}>
          <View style={styles.xpTrack}>
            <Animated.View
              style={[
                styles.xpFill,
                {
                  width: xpBarAnim.interpolate({
                    inputRange: [0, 100],
                    outputRange: ['0%', '100%'],
                    extrapolate: 'clamp',
                  }),
                },
              ]}
            />
          </View>
          <View style={styles.xpLabelRow}>
            <Text style={styles.xpTrackLabel}>XP Level Progress</Text>
            <Text style={styles.xpTrackLabelBold}>
              {currentXP} / {maxSessionXP} XP
            </Text>
          </View>
        </View>
      </View>

      {/* Main Question Card */}
      <View style={styles.card}>
        <View style={styles.questionHeaderRow}>
          <View style={styles.questionTypeTag}>
            <Text style={styles.questionTypeTagText}>
              {currentItem.type === 'true_false'
                ? 'TRUE / FALSE • +10 XP'
                : currentItem.type === 'multiple_choice'
                ? 'MULTIPLE CHOICE • +15 XP'
                : 'IDENTIFICATION • +25 XP'}
            </Text>
          </View>
          {isMeaningfulSection(currentItem.source_metadata?.section) ? (
            <View style={styles.questionSectionTag}>
              <Text style={styles.questionSectionText} numberOfLines={1}>
                {currentItem.source_metadata?.section?.toUpperCase()}
              </Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.questionText}>{sanitizeQuestionText(currentItem.question)}</Text>

        {/* Revealed Notice Banner */}
        {isCurrentQuestionRevealed && (
          <View style={styles.revealedNoticeBanner}>
            <HugeiconsIcon icon={EyeIcon} size={15} color="#D97706" strokeWidth={2.4} />
            <Text style={styles.revealedNoticeText}>
              Answer auto-revealed. Tap Next Question to proceed (+0 XP).
            </Text>
          </View>
        )}

        {/* Multiple Choice & True/False Options */}
        {options.length > 0 ? (
          <View style={styles.optionsList}>
            {options.map((opt, idx) => {
              const isSelected = selectedOption === opt;
              const letter = OPTION_LETTERS[idx] || `${idx + 1}`;

              let cardStyle: StyleProp<ViewStyle> = styles.optionBtn;
              let letterStyle: StyleProp<ViewStyle> = styles.optionLetter;
              let letterTextStyle: StyleProp<TextStyle> = styles.optionLetterText;
              let textStyle: StyleProp<TextStyle> = styles.optionText;

              if (isSubmittingFeedback && isSelected) {
                if (lastAnswerResult?.isCorrect) {
                  cardStyle = [styles.optionBtn, styles.optionBtnCorrect];
                  letterStyle = [styles.optionLetter, styles.optionLetterCorrect];
                  letterTextStyle = [styles.optionLetterText, styles.optionLetterTextCorrect];
                  textStyle = [styles.optionText, styles.optionTextCorrect];
                } else {
                  cardStyle = [styles.optionBtn, styles.optionBtnWrong];
                  letterStyle = [styles.optionLetter, styles.optionLetterWrong];
                  letterTextStyle = [styles.optionLetterText, styles.optionLetterTextWrong];
                  textStyle = [styles.optionText, styles.optionTextWrong];
                }
              } else if (isSelected) {
                cardStyle = [styles.optionBtn, styles.selectedOptionBtn];
                letterStyle = [styles.optionLetter, styles.selectedOptionLetter];
                letterTextStyle = [styles.optionLetterText, styles.selectedOptionLetterText];
                textStyle = [styles.optionText, styles.selectedOptionText];
              }

              return (
                <TouchableOpacity
                  key={idx}
                  style={cardStyle}
                  onPress={() => !isSubmittingFeedback && setSelectedOption(opt)}
                  disabled={isSubmittingFeedback}
                  activeOpacity={0.7}
                >
                  <View style={letterStyle}>
                    <Text style={letterTextStyle}>{letter}</Text>
                  </View>
                  <Text style={textStyle}>{opt}</Text>

                  {/* Floating XP Animation popping directly out of the selected item */}
                  {isSubmittingFeedback && isSelected && (
                    <Animated.View
                      style={[
                        styles.itemFloatingXP,
                        {
                          opacity: fadeAnim,
                          transform: [{ translateY: floatAnim }, { scale: scaleAnim }],
                        },
                      ]}
                      pointerEvents="none"
                    >
                      <View
                        style={[
                          styles.floatingXPPill,
                          lastAnswerResult?.isCorrect
                            ? styles.floatingXPPillCorrect
                            : styles.floatingXPPillWrong,
                        ]}
                      >
                        <HugeiconsIcon
                          icon={lastAnswerResult?.isCorrect ? SparklesIcon : Cancel01Icon}
                          size={14}
                          color={lastAnswerResult?.isCorrect ? '#D97706' : '#DC2626'}
                          strokeWidth={2.4}
                        />
                        <Text
                          style={[
                            styles.floatingXPText,
                            lastAnswerResult?.isCorrect
                              ? styles.floatingXPTextCorrect
                              : styles.floatingXPTextWrong,
                          ]}
                        >
                          {lastAnswerResult?.isCorrect
                            ? `+${lastAnswerResult.earnedXP} XP`
                            : '+0 XP'}
                        </Text>
                      </View>
                    </Animated.View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          /* Identification text input */
          <View style={styles.inputContainer}>
            <View style={styles.inputRelativeWrapper}>
              <TextInput
                style={[
                  styles.textInput,
                  isSubmittingFeedback && (
                    lastAnswerResult?.isCorrect
                      ? styles.textInputCorrect
                      : styles.textInputWrong
                  ),
                ]}
                placeholder="Type your answer here..."
                placeholderTextColor="#94A3B8"
                value={typedAnswer}
                onChangeText={setTypedAnswer}
                editable={!isSubmittingFeedback}
                autoCapitalize="none"
                autoCorrect={false}
              />

              {/* Floating XP Animation popping directly out of the text input */}
              {isSubmittingFeedback && (
                <Animated.View
                  style={[
                    styles.itemFloatingXP,
                    {
                      opacity: fadeAnim,
                      transform: [{ translateY: floatAnim }, { scale: scaleAnim }],
                    },
                  ]}
                  pointerEvents="none"
                >
                  <View
                    style={[
                      styles.floatingXPPill,
                      lastAnswerResult?.isCorrect
                        ? styles.floatingXPPillCorrect
                        : styles.floatingXPPillWrong,
                    ]}
                  >
                    <HugeiconsIcon
                      icon={lastAnswerResult?.isCorrect ? SparklesIcon : Cancel01Icon}
                      size={14}
                      color={lastAnswerResult?.isCorrect ? '#D97706' : '#DC2626'}
                      strokeWidth={2.4}
                    />
                    <Text
                      style={[
                        styles.floatingXPText,
                        lastAnswerResult?.isCorrect
                          ? styles.floatingXPTextCorrect
                          : styles.floatingXPTextWrong,
                      ]}
                    >
                      {lastAnswerResult?.isCorrect
                        ? `+${lastAnswerResult.earnedXP} XP`
                        : '+0 XP'}
                    </Text>
                  </View>
                </Animated.View>
              )}
            </View>

            {/* Identification Active Recall Hint Toggle */}
            <TouchableOpacity
              style={[styles.hintTriggerBtn, showHint && styles.hintTriggerBtnActive]}
              onPress={() => setShowHint((prev) => !prev)}
              disabled={isSubmittingFeedback}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel={showHint ? 'Hide hint' : 'Show hint'}
            >
              <View style={styles.hintTriggerLeft}>
                <View style={[styles.hintIconBox, showHint && styles.hintIconBoxActive]}>
                  <HugeiconsIcon
                    icon={Idea01Icon}
                    size={14}
                    color={showHint ? '#D97706' : '#64748B'}
                    strokeWidth={2.4}
                  />
                </View>
                <Text style={[styles.hintTriggerText, showHint && styles.hintTriggerTextActive]}>
                  {showHint ? 'Hide Hint' : 'Need a hint?'}
                </Text>
              </View>
              <HugeiconsIcon
                icon={showHint ? ArrowUp01Icon : ArrowDown01Icon}
                size={14}
                color={showHint ? '#D97706' : '#64748B'}
                strokeWidth={2.2}
              />
            </TouchableOpacity>

            {showHint && (() => {
              const clue = generateIdentificationClue(currentItem.answer);
              const detail =
                currentItem.hint ||
                (isMeaningfulSection(currentItem.source_metadata?.section)
                  ? `Topic section: ${currentItem.source_metadata?.section}`
                  : `First letter starts with "${currentItem.answer.trim()[0]?.toUpperCase()}"`);
              return (
                <View style={styles.hintCard}>
                  <View style={styles.hintCardHeader}>
                    <View style={styles.hintBadge}>
                      <HugeiconsIcon icon={Idea01Icon} size={13} color="#D97706" strokeWidth={2.4} />
                      <Text style={styles.hintBadgeText}>ACTIVE RECALL CLUE</Text>
                    </View>
                    <Text style={styles.hintStructureSummary}>{clue.summary}</Text>
                  </View>

                  <View style={styles.maskedSkeletonBox}>
                    <Text style={styles.maskedSkeletonText}>{clue.masked}</Text>
                  </View>

                  {detail ? (
                    <View style={styles.hintDetailRow}>
                      <Text style={styles.hintDetailText}>{detail}</Text>
                    </View>
                  ) : null}
                </View>
              );
            })()}
          </View>
        )}
      </View>

      {/* Footer: Reveal Answer & Next Question Button */}
      <View style={styles.footer}>
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[
              styles.revealBtn,
              (isCurrentQuestionRevealed || isSubmittingFeedback) && styles.revealBtnActive,
            ]}
            disabled={isCurrentQuestionRevealed || isSubmittingFeedback}
            onPress={handleRevealAnswer}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="Reveal answer automatically"
          >
            <HugeiconsIcon
              icon={EyeIcon}
              size={16}
              color={isCurrentQuestionRevealed || isSubmittingFeedback ? '#D97706' : '#4F46E5'}
              strokeWidth={2.2}
            />
            <Text
              style={[
                styles.revealBtnText,
                (isCurrentQuestionRevealed || isSubmittingFeedback) && styles.revealBtnTextActive,
              ]}
            >
              {isCurrentQuestionRevealed ? 'Revealed' : `Reveal Answer (50) • ${credits} left`}
            </Text>
          </TouchableOpacity>

          <PlatformPressable
            style={[
              styles.primaryBtn,
              (!hasAnswered || isSubmittingFeedback) && styles.disabledBtn,
            ]}
            disabled={!hasAnswered || isSubmittingFeedback}
            onPress={handleNextQuestion}
          >
            <View style={styles.btnContent}>
              <Text
                style={[
                  styles.primaryBtnText,
                  (!hasAnswered || isSubmittingFeedback) && styles.disabledBtnText,
                ]}
              >
                {isLast ? 'Complete Quiz' : 'Next Question'}
              </Text>
              <HugeiconsIcon
                icon={ArrowRight01Icon}
                size={18}
                color={hasAnswered && !isSubmittingFeedback ? '#FFFFFF' : '#94A3B8'}
                strokeWidth={2.4}
              />
            </View>
          </PlatformPressable>
        </View>
      </View>

      {/* Insufficient Credits Modal */}
      <Modal
        visible={showCreditsModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowCreditsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Image source={require('../../assets/animations/no_credits_momo.png')} style={{ width: 120, height: 120 }} resizeMode="contain" />
            <Text style={styles.modalTitle}>Out of Credits!</Text>
            <Text style={styles.modalDesc}>
              You need 50 credits to reveal an answer. You currently have {credits}.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalPurchaseBtn}
                onPress={() => {
                  setShowCreditsModal(false);
                  router.push('/shop');
                }}
              >
                <Text style={styles.modalPurchaseText}>Purchase more credits</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowCreditsModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SmoothScrollView>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 16,
    marginBottom: 8,
  },
  modalDesc: {
    fontSize: 14,
    color: '#475569',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  modalActions: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 12,
    width: '100%',
  },
  modalCancelBtn: {
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    fontSize: 15,
    fontFamily: 'Poppins-Bold',
    color: '#475569',
  },
  modalPurchaseBtn: {
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalPurchaseText: {
    fontSize: 15,
    fontFamily: 'Poppins-Bold',
    color: '#FFFFFF',
  },
  container: {
    padding: 16,
    flexGrow: 1,
    justifyContent: 'space-between',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  textMuted: {
    color: '#64748B',
    fontSize: 15,
  },

  // -------------------------
  // Header & XP Progress Bar
  // -------------------------
  topHeader: {
    marginBottom: 16,
    position: 'relative',
  },
  topInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  questionCounterBox: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  questionCounterText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  xpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  xpBadgeText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#B45309',
    fontVariant: ['tabular-nums'],
  },
  xpTrackContainer: {
    marginTop: 2,
  },
  xpTrack: {
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 4,
  },
  xpFill: {
    height: '100%',
    backgroundColor: '#F59E0B',
    borderRadius: 4,
  },
  xpLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  xpTrackLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  xpTrackLabelBold: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D97706',
    fontVariant: ['tabular-nums'],
  },
  floatingXPPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1.5,
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  floatingXPPillCorrect: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
    shadowColor: '#D97706',
  },
  floatingXPPillWrong: {
    backgroundColor: '#FEF2F2',
    borderColor: '#F87171',
    shadowColor: '#DC2626',
  },
  floatingXPText: {
    fontSize: 13,
    fontWeight: '900',
  },
  floatingXPTextCorrect: {
    color: '#B45309',
  },
  floatingXPTextWrong: {
    color: '#DC2626',
  },
  itemFloatingXP: {
    position: 'absolute',
    top: -16,
    right: 14,
    zIndex: 100,
  },

  // -------------------------
  // Question Card
  // -------------------------
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  questionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  questionTypeTag: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  questionTypeTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.5,
  },
  questionSectionTag: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    maxWidth: 160,
  },
  questionSectionText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#4F46E5',
    letterSpacing: 0.4,
  },
  questionText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    lineHeight: 26,
    marginBottom: 20,
    letterSpacing: -0.2,
  },
  optionsList: {
    gap: 10,
  },
  optionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  selectedOptionBtn: {
    borderColor: '#4F46E5',
    backgroundColor: '#EEF2FF',
  },
  optionLetter: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  selectedOptionLetter: {
    backgroundColor: '#4F46E5',
  },
  optionLetterText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  selectedOptionLetterText: {
    color: '#FFFFFF',
  },
  optionText: {
    fontSize: 15,
    color: '#334155',
    fontWeight: '500',
    flex: 1,
  },
  selectedOptionText: {
    color: '#4F46E5',
    fontWeight: '700',
  },
  optionBtnCorrect: {
    backgroundColor: '#ECFDF5',
    borderColor: '#059669',
  },
  optionLetterCorrect: {
    backgroundColor: '#059669',
  },
  optionLetterTextCorrect: {
    color: '#FFFFFF',
  },
  optionTextCorrect: {
    color: '#065F46',
    fontWeight: '700',
  },
  optionBtnWrong: {
    backgroundColor: '#FEF2F2',
    borderColor: '#DC2626',
  },
  optionLetterWrong: {
    backgroundColor: '#DC2626',
  },
  optionLetterTextWrong: {
    color: '#FFFFFF',
  },
  optionTextWrong: {
    color: '#991B1B',
    fontWeight: '700',
  },
  inputContainer: {
    marginBottom: 12,
  },
  inputRelativeWrapper: {
    position: 'relative',
  },
  textInput: {
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    backgroundColor: '#FFFFFF',
    color: '#0F172A',
  },
  textInputCorrect: {
    backgroundColor: '#ECFDF5',
    borderColor: '#059669',
    color: '#065F46',
  },
  textInputWrong: {
    backgroundColor: '#FEF2F2',
    borderColor: '#DC2626',
    color: '#991B1B',
  },
  hintTriggerBtn: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFBEB',
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  hintTriggerBtnActive: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
  },
  hintTriggerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  hintIconBox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  hintIconBoxActive: {
    backgroundColor: '#FEF3C7',
    borderColor: '#D97706',
  },
  hintTriggerText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#92400E',
  },
  hintTriggerTextActive: {
    color: '#78350F',
  },
  hintCard: {
    marginTop: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    padding: 14,
  },
  hintCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  hintBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  hintBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#D97706',
    letterSpacing: 0.5,
  },
  hintStructureSummary: {
    fontSize: 11,
    fontWeight: '600',
    color: '#78350F',
  },
  maskedSkeletonBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 8,
  },
  maskedSkeletonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1E293B',
    letterSpacing: 2,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  hintDetailRow: {
    paddingTop: 2,
  },
  hintDetailText: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 17,
  },

  revealedNoticeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginBottom: 14,
  },
  revealedNoticeText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#B45309',
    flex: 1,
  },

  // -------------------------
  // Footer & Action Buttons
  // -------------------------
  footer: {
    marginBottom: 12,
  },
  actionRow: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 10,
    width: '100%',
  },
  revealBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 15,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#C7D2FE',
    backgroundColor: '#EEF2FF',
  },
  revealBtnActive: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
  },
  revealBtnText: {
    color: '#4F46E5',
    fontSize: 14,
    fontFamily: 'Poppins-Bold',
  },
  revealBtnTextActive: {
    color: '#B45309',
  },
  primaryBtn: {
    backgroundColor: '#4F46E5',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#4338CA',
    ...Platform.select({
      ios: {
        shadowColor: '#4338CA',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.28,
        shadowRadius: 10,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  btnContent: {
    paddingVertical: 15,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  disabledBtn: {
    backgroundColor: '#E2E8F0',
    borderColor: '#CBD5E1',
    shadowOpacity: 0,
    elevation: 0,
  },
  disabledBtnText: {
    color: '#94A3B8',
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15.5,
    fontFamily: 'Poppins-Bold',
    letterSpacing: -0.2,
  },

  // -------------------------
  // Review Screen Styles
  // -------------------------
  reviewContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  reviewHeroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 22,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  heroBadgeCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  trophyBg: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1.5,
    borderColor: '#FDE68A',
  },
  bookBg: {
    backgroundColor: '#EEF2FF',
    borderWidth: 1.5,
    borderColor: '#E0E7FF',
  },
  heroTitle: {
    fontSize: 21,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 12,
  },
  xpEarnedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    width: '100%',
    marginBottom: 16,
  },
  xpEarnedIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  xpEarnedTextBox: {
    flex: 1,
  },
  xpEarnedValue: {
    fontSize: 17,
    fontWeight: '900',
    color: '#92400E',
  },
  xpEarnedSub: {
    fontSize: 12,
    fontWeight: '600',
    color: '#B45309',
    marginTop: 1,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    width: '100%',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  metricPill: {
    alignItems: 'center',
    flex: 1,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    fontVariant: ['tabular-nums'],
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },
  masteredColor: {
    color: '#059669',
  },
  practiceColor: {
    color: '#4F46E5',
  },
  metricDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E2E8F0',
  },
  reviewSectionHeader: {
    marginBottom: 14,
  },
  reviewSectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  reviewSectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  reviewSectionSubtitle: {
    fontSize: 12.5,
    color: '#64748B',
    lineHeight: 18,
  },
  reviewInstructionBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
    borderStyle: 'dashed',
  },
  reviewInstructionText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  paginationContainer: {
    marginBottom: 16,
  },
  paginationScroll: {
    gap: 8,
    paddingHorizontal: 2,
    paddingVertical: 4,
  },
  pageBtn: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  pageBtnDefault: {
    backgroundColor: '#F1F5F9',
    borderColor: '#CBD5E1',
  },
  pageBtnRevealed: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  pageBtnCorrect: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  pageBtnWrong: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  pageBtnSelected: {
    borderWidth: 2.5,
    borderColor: '#4F46E5',
    transform: [{ scale: 1.05 }],
  },
  pageBtnText: {
    fontSize: 16,
    fontWeight: '700',
  },
  pageBtnTextDefault: {
    color: '#64748B',
  },
  pageBtnTextRevealed: {
    color: '#B45309',
  },
  pageBtnTextCorrect: {
    color: '#047857',
  },
  pageBtnTextWrong: {
    color: '#B91C1C',
  },
  pageBtnTextSelected: {
    color: '#4F46E5',
    fontWeight: '800',
  },
  reviewQuestionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    marginBottom: 14,
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  reviewCardCorrectBorder: {
    borderColor: '#A7F3D0',
  },
  reviewCardWrongBorder: {
    borderColor: '#FECACA',
  },
  reviewCardRevealedBorder: {
    borderColor: '#FDE68A',
  },
  reviewQuestionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  reviewQuestionNumberCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reviewQuestionNumber: {
    fontSize: 13,
    fontWeight: '800',
    color: '#334155',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  badgeCorrect: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  badgeWrong: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  badgeRevealed: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  statusTextCorrect: {
    color: '#047857',
  },
  statusTextWrong: {
    color: '#B91C1C',
  },
  statusTextRevealed: {
    color: '#B45309',
  },
  reviewQuestionPrompt: {
    fontSize: 15.5,
    fontWeight: '700',
    color: '#0F172A',
    lineHeight: 22,
    marginBottom: 12,
  },
  userAnswerBox: {
    borderRadius: 12,
    padding: 12,
    borderWidth: 1.5,
    marginBottom: 10,
  },
  userAnswerBoxCorrect: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  userAnswerBoxWrong: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  userAnswerBoxRevealed: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  userAnswerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  userAnswerLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  userAnswerLabelCorrect: {
    color: '#047857',
  },
  userAnswerLabelWrong: {
    color: '#DC2626',
  },
  userAnswerLabelRevealed: {
    color: '#B45309',
  },
  userAnswerValue: {
    fontSize: 14.5,
    fontWeight: '700',
    paddingLeft: 21,
  },
  userAnswerValueCorrect: {
    color: '#065F46',
  },
  userAnswerValueWrong: {
    color: '#991B1B',
  },
  userAnswerValueRevealed: {
    color: '#92400E',
  },
  correctAnswerBox: {
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#86EFAC',
    marginBottom: 10,
  },
  correctAnswerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
  },
  correctAnswerHeaderLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#047857',
    letterSpacing: 0.5,
  },
  correctAnswerValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#064E3B',
    lineHeight: 21,
  },
  explanationCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
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
    marginBottom: 4,
  },
  explanationLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#4F46E5',
    letterSpacing: 0.5,
  },
  explanationText: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 19,
  },
  reviewActionFooter: {
    width: '100%',
    gap: 10,
    marginTop: 8,
    marginBottom: 20,
  },
  restartBtn: {
    backgroundColor: '#EEF2FF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  restartBtnText: {
    color: '#4F46E5',
    fontWeight: '700',
    fontSize: 15,
  },
  doneBtn: {
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
  doneBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  btnRow: {
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
});
