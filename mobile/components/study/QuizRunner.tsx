import React, { useState, useRef, useMemo, forwardRef, useImperativeHandle } from 'react';
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
  Alert,
} from 'react-native';
import { colors, spacing, typography } from '@/constants/theme';
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
  ArrowLeft01Icon,
  BookOpen01Icon,
  TrophyIcon,
  Idea01Icon,
  RefreshIcon,
  SparklesIcon,
  EyeIcon,
  FavouriteIcon,
  Clock01Icon,
  Task01Icon,
} from '@hugeicons/core-free-icons';
import { StudyItem } from '../../types';
import { AcademicWeaponShareModal } from '../social/AcademicWeaponShareModal';
import { InstagramStoryButton } from '../social/InstagramStoryButton';
import { SourceAttribution } from './SourceAttribution';
import { PlatformPressable } from '../common/PlatformPressable';
import { SmoothScrollView } from '../common/SmoothScrollView';
import { syncEngine } from '../../lib/sync/syncEngine';
import { isMeaningfulSection, sanitizeQuestionText } from '../../utils/formatters';
import { useCredits } from '../../context/CreditsContext';
import { useOnboarding } from '../../context/OnboardingContext';
import { CoachmarkTooltip } from '../onboarding/CoachmarkTooltip';
import { Image } from 'react-native';
import { Modal } from 'react-native';
import { isIpad } from '../../utils/device';

interface Props {
  items: StudyItem[];
  title?: string;
  isExamMode?: boolean;
  timeLimitPerQuestion?: number;
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

export interface QuizRunnerRef {
  showOverview: () => void;
}

export const QuizRunner = forwardRef<QuizRunnerRef, Props>(({
  items,
  title,
  timeLimitPerQuestion,
  onFinish,
  onRestart,
}, ref) => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isAndroid = Platform.OS === 'android';
  const bottomPadding = Math.max(insets.bottom, isAndroid ? 28 : 16) + 16;

  const { hasSeenQuizXpTip, markTipSeen } = useOnboarding();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [typedAnswer, setTypedAnswer] = useState<string>('');
  const [showHint, setShowHint] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [showOverviewModal, setShowOverviewModal] = useState(false);
  const [overviewFilter, setOverviewFilter] = useState<'all' | 'correct' | 'wrong' | 'pending'>('all');
  const [timerSeconds, setTimerSeconds] = useState<number>(timeLimitPerQuestion || 0);
  const [isCurrentQuestionRevealed, setIsCurrentQuestionRevealed] = useState(false);
  const [currentXP, setCurrentXP] = useState(0);
  const [isQuizFinished, setIsQuizFinished] = useState(false);
  const [showStoryModal, setShowStoryModal] = useState(false);
  const [selectedReviewIndex, setSelectedReviewIndex] = useState<number | null>(null);
  const [isOverviewExpanded, setIsOverviewExpanded] = useState(false);
  const [reviewFilter, setReviewFilter] = useState<'all' | 'correct' | 'wrong' | 'skipped'>('all');
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [correctStreak, setCorrectStreak] = useState(0);
  const [lastAnswerResult, setLastAnswerResult] = useState<{
    isCorrect: boolean;
    earnedXP: number;
    streakBonus?: boolean;
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
        isSkipped?: boolean;
      }
    >
  >({});

  const { credits, deductCredits, addXP, hearts, deductHeart, addHeart } = useCredits();
  const [showCreditsModal, setShowCreditsModal] = useState(false);
  const [showNoHeartsModal, setShowNoHeartsModal] = useState(false);

  React.useEffect(() => {
    if (hearts <= 0) {
      setShowNoHeartsModal(true);
    }
  }, [hearts]);

  // Default review index to 0 when finished
  React.useEffect(() => {
    if (isQuizFinished && selectedReviewIndex === null && items.length > 0) {
      setSelectedReviewIndex(0);
    }
  }, [isQuizFinished]);

  const isTimerSet = Boolean(timeLimitPerQuestion && timeLimitPerQuestion > 0);
  const [hasSkippedInSession, setHasSkippedInSession] = useState(false);
  const [skippedQueue, setSkippedQueue] = useState<number[]>([]);
  const [isRevisitingSkipped, setIsRevisitingSkipped] = useState(false);
  const [revisitQueueIndex, setRevisitQueueIndex] = useState(0);

  useImperativeHandle(ref, () => ({
    showOverview: () => setShowOverviewModal(true),
  }));

  // Animated values & timer reference
  const xpBarAnim = useRef(new Animated.Value(0)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.7)).current;
  const remainingSecondsRef = useRef<number>(timeLimitPerQuestion || 0);

  const canGoPrev = !isTimerSet
    ? currentIndex > 0
    : currentIndex > 0 && !hasSkippedInSession && !isRevisitingSkipped;

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

  const goToQuestion = (targetIdx: number) => {
    if (targetIdx < 0 || targetIdx >= items.length) return;
    setCurrentIndex(targetIdx);
    const existing = userAnswers[targetIdx];
    if (existing && !existing.isSkipped) {
      setSelectedOption(existing.selectedOption);
      setTypedAnswer(existing.selectedOption ? '' : (existing.userAnswer.includes('(Revealed)') ? '' : existing.userAnswer));
      setIsCurrentQuestionRevealed(existing.wasRevealed || false);
      setShowExplanation(!isTimerSet);
    } else {
      setSelectedOption(null);
      setTypedAnswer('');
      setIsCurrentQuestionRevealed(false);
      setShowExplanation(false);
    }
    setShowHint(false);
    if (timeLimitPerQuestion && timeLimitPerQuestion > 0) {
      remainingSecondsRef.current = timeLimitPerQuestion;
      setTimerSeconds(timeLimitPerQuestion);
    }
  };

  const advanceQuestion = (
    answersSnapshot: typeof userAnswers,
    queueSnapshot?: number[]
  ) => {
    const activeQueue = queueSnapshot ?? skippedQueue;

    // Untimed mode: free sequential progression without restrictions
    if (!isTimerSet) {
      if (currentIndex === items.length - 1) {
        const totalCorrect = Object.values(answersSnapshot).filter((a) => a.isCorrect).length;
        onFinish?.({ correct: totalCorrect, total: items.length, xp: currentXP });
        setIsQuizFinished(true);
      } else {
        goToQuestion(currentIndex + 1);
      }
      return;
    }

    // Timed mode: during initial pass through all questions
    if (!isRevisitingSkipped) {
      if (currentIndex < items.length - 1) {
        goToQuestion(currentIndex + 1);
      } else {
        // Reached end of initial pass: all questions have now been passed once
        const pendingSkipped = activeQueue.filter(
          (idx) => answersSnapshot[idx]?.isSkipped
        );

        if (pendingSkipped.length > 0) {
          setIsRevisitingSkipped(true);
          setRevisitQueueIndex(0);
          goToQuestion(pendingSkipped[0]);
        } else {
          // No pending skipped questions: complete quiz
          const totalCorrect = Object.values(answersSnapshot).filter((a) => a.isCorrect).length;
          onFinish?.({ correct: totalCorrect, total: items.length, xp: currentXP });
          setIsQuizFinished(true);
        }
      }
      return;
    }

    // Timed mode: during revisit of skipped questions
    const nextRevisitIndex = revisitQueueIndex + 1;
    if (nextRevisitIndex < activeQueue.length) {
      setRevisitQueueIndex(nextRevisitIndex);
      goToQuestion(activeQueue[nextRevisitIndex]);
    } else {
      // Finished all skipped questions: complete quiz
      const totalCorrect = Object.values(answersSnapshot).filter((a) => a.isCorrect).length;
      onFinish?.({ correct: totalCorrect, total: items.length, xp: currentXP });
      setIsQuizFinished(true);
    }
  };

  const handleTimeout = () => {
    if (isSubmittingFeedback || isQuizFinished) return;

    // Timer expired without user answer: strictly counted as WRONG
    deductHeart();
    setCorrectStreak(0);
    syncEngine.recordStudyAnswer(currentItem.id, 'incorrect', '(Time Expired)');

    const updatedAnswers = {
      ...userAnswers,
      [currentIndex]: {
        userAnswer: '(Time Expired)',
        isCorrect: false,
        selectedOption: null,
        xpAwarded: 0,
        wasRevealed: false,
        isSkipped: false, // Counted as wrong, not skipped
      },
    };
    setUserAnswers(updatedAnswers);

    setIsSubmittingFeedback(true);
    setLastAnswerResult({ isCorrect: false, earnedXP: 0 });

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

    setTimeout(() => {
      setIsSubmittingFeedback(false);
      setLastAnswerResult(null);
      advanceQuestion(updatedAnswers);
    }, 700);
  };

  // Question timer: reset on question change
  React.useEffect(() => {
    if (!timeLimitPerQuestion || timeLimitPerQuestion <= 0 || isQuizFinished) {
      return;
    }
    remainingSecondsRef.current = timeLimitPerQuestion;
    setTimerSeconds(timeLimitPerQuestion);
  }, [currentIndex, timeLimitPerQuestion, isQuizFinished]);

  // Question timer: countdown ticker (runs independently in macrotask interval)
  React.useEffect(() => {
    if (!timeLimitPerQuestion || timeLimitPerQuestion <= 0 || isQuizFinished || isSubmittingFeedback) {
      return;
    }

    const interval = setInterval(() => {
      remainingSecondsRef.current -= 1;
      if (remainingSecondsRef.current <= 0) {
        clearInterval(interval);
        setTimerSeconds(0);
        setTimeout(() => {
          handleTimeout();
        }, 0);
      } else {
        setTimerSeconds(remainingSecondsRef.current);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [currentIndex, timeLimitPerQuestion, isQuizFinished, isSubmittingFeedback]);

  const goToPrevQuestion = () => {
    if (!canGoPrev) return;
    if (currentIndex > 0) {
      goToQuestion(currentIndex - 1);
    }
  };

  const handleSkipQuestion = () => {
    if (isSubmittingFeedback) return;

    let updatedQueue = skippedQueue;
    if (isTimerSet) {
      setHasSkippedInSession(true);
      if (!skippedQueue.includes(currentIndex)) {
        updatedQueue = [...skippedQueue, currentIndex];
        setSkippedQueue(updatedQueue);
      }
    }

    const updatedAnswers = {
      ...userAnswers,
      [currentIndex]: {
        userAnswer: '(Skipped)',
        isCorrect: false,
        selectedOption: null,
        xpAwarded: 0,
        wasRevealed: false,
        isSkipped: true,
      },
    };
    setUserAnswers(updatedAnswers);

    advanceQuestion(updatedAnswers, updatedQueue);
  };

  const handlePillPress = (targetIdx: number) => {
    if (isQuizFinished) {
      setSelectedReviewIndex(targetIdx);
      setShowOverviewModal(false);
    setOverviewFilter('all');
      return;
    }
    if (targetIdx === currentIndex) {
      setShowOverviewModal(false);
      return;
    }

    if (
      isTimerSet &&
      !isRevisitingSkipped &&
      (targetIdx < currentIndex || Boolean(userAnswers[targetIdx]?.isSkipped))
    ) {
      Alert.alert(
        'Navigation Locked',
        'During timed quizzes, previous and skipped questions cannot be opened until all questions have passed.'
      );
      return;
    }

    goToQuestion(targetIdx);
    if (showOverviewModal) {
      setShowOverviewModal(false);
    }
  };

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

  const handleNextQuestion = (overrideAnswer?: string) => {
    if (isSubmittingFeedback) return;
    
    if (hearts <= 0) {
      setShowNoHeartsModal(true);
      return;
    }

    const answerToUse = overrideAnswer || selectedOption || typedAnswer.trim();
    if (!answerToUse) {
      handleSkipQuestion();
      return;
    }

    const wasRevealed = isCurrentQuestionRevealed;
    const isCorrect = !wasRevealed && checkIsCorrect(answerToUse, currentItem);
    let earnedXP = isCorrect ? getQuestionXP(currentItem.type) : 0;
    
    let nextStreak = isCorrect ? correctStreak + 1 : 0;
    let streakBonus = false;

    if (isCorrect && nextStreak > 0 && nextStreak % 5 === 0) {
      earnedXP *= 2;
      addHeart(1);
      streakBonus = true;
    }

    if (!isCorrect && !wasRevealed) {
      deductHeart();
    }
    
    setCorrectStreak(nextStreak);

    const nextXP = currentXP + earnedXP;

    const updatedAnswers = {
      ...userAnswers,
      [currentIndex]: {
        userAnswer: wasRevealed ? `${answerToUse} (Revealed)` : (answerToUse || '(Unanswered)'),
        isCorrect,
        selectedOption: overrideAnswer || selectedOption,
        xpAwarded: earnedXP,
        wasRevealed,
        isSkipped: false,
      },
    };
    setUserAnswers(updatedAnswers);

    syncEngine.recordStudyAnswer(
      currentItem.id,
      isCorrect ? 'correct' : 'incorrect',
      wasRevealed ? `(Answer Revealed: ${currentItem.answer})` : (answerToUse || '(Unanswered)')
    );

    // Show visual feedback on the item selected or inputed
    setIsSubmittingFeedback(true);
    setLastAnswerResult({ isCorrect, earnedXP, streakBonus });

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

      advanceQuestion(updatedAnswers);
    }, 700);
  };

  const handleOptionPress = (opt: string) => {
    if (isSubmittingFeedback) return;
    const isQuestionChecked = Boolean(
      userAnswers[currentIndex] && !userAnswers[currentIndex].isSkipped
    );
    if (isQuestionChecked) return;

    setSelectedOption(opt);
    if (isTimerSet) {
      // In timed mode: clicking an answer immediately submits it, updating the indicator and advancing
      handleNextQuestion(opt);
    }
  };

  const handleCheckAnswer = () => {
    if (isSubmittingFeedback) return;

    if (hearts <= 0) {
      setShowNoHeartsModal(true);
      return;
    }

    const userAnswer = selectedOption || typedAnswer.trim();
    if (!userAnswer) return;

    const wasRevealed = isCurrentQuestionRevealed;
    const isCorrect = !wasRevealed && checkIsCorrect(userAnswer, currentItem);
    let earnedXP = isCorrect ? getQuestionXP(currentItem.type) : 0;

    let nextStreak = isCorrect ? correctStreak + 1 : 0;
    let streakBonus = false;

    if (isCorrect && nextStreak > 0 && nextStreak % 5 === 0) {
      earnedXP *= 2;
      addHeart(1);
      streakBonus = true;
    }

    if (!isCorrect && !wasRevealed) {
      deductHeart();
    }

    setCorrectStreak(nextStreak);

    const nextXP = currentXP + earnedXP;

    const updatedAnswers = {
      ...userAnswers,
      [currentIndex]: {
        userAnswer: wasRevealed ? `${userAnswer} (Revealed)` : (userAnswer || '(Unanswered)'),
        isCorrect,
        selectedOption,
        xpAwarded: earnedXP,
        wasRevealed,
        isSkipped: false,
      },
    };
    setUserAnswers(updatedAnswers);

    syncEngine.recordStudyAnswer(
      currentItem.id,
      isCorrect ? 'correct' : 'incorrect',
      wasRevealed ? `(Answer Revealed: ${currentItem.answer})` : (userAnswer || '(Unanswered)')
    );

    setIsSubmittingFeedback(true);
    setLastAnswerResult({ isCorrect, earnedXP, streakBonus });

    if (isCorrect) {
      setCurrentXP(nextXP);
      addXP(earnedXP);
      const targetPercent = maxSessionXP > 0 ? (nextXP / maxSessionXP) * 100 : 0;
      Animated.timing(xpBarAnim, {
        toValue: targetPercent,
        duration: 450,
        useNativeDriver: false,
      }).start();
    }

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

    // In untimed mode, do not auto-advance; reveal explanation so user can study
    setTimeout(() => {
      setIsSubmittingFeedback(false);
      setLastAnswerResult(null);
      setShowExplanation(true);
    }, 600);
  };

  const handleRestartQuiz = () => {
    if (hearts <= 0) {
      setShowNoHeartsModal(true);
      return;
    }
    setCurrentIndex(0);
    setSelectedOption(null);
    setTypedAnswer('');
    setShowHint(false);
    setShowExplanation(false);
    setShowOverviewModal(false);
    setIsCurrentQuestionRevealed(false);
    setIsSubmittingFeedback(false);
    setLastAnswerResult(null);
    setUserAnswers({});
    setCurrentXP(0);
    setCorrectStreak(0);
    setIsQuizFinished(false);
    setSelectedReviewIndex(0);
    setIsOverviewExpanded(false);
    setReviewFilter('all');
    setHasSkippedInSession(false);
    setSkippedQueue([]);
    setIsRevisitingSkipped(false);
    setRevisitQueueIndex(0);
    if (timeLimitPerQuestion && timeLimitPerQuestion > 0) {
      remainingSecondsRef.current = timeLimitPerQuestion;
      setTimerSeconds(timeLimitPerQuestion);
    }
    xpBarAnim.setValue(0);
    if (onRestart) {
      onRestart();
    }
  };

  // ----------------------------------------------------
  // COMPREHENSIVE QUIZ OVERVIEW MODAL (ACCESSIBLE DURING & AFTER QUIZ)
  // ----------------------------------------------------
  const renderOverviewModal = () => {
    const totalCorrect = Object.values(userAnswers).filter((a) => a.isCorrect).length;
    const totalWrong = Object.values(userAnswers).filter(
      (a) => !a.isCorrect && !a.isSkipped && a.userAnswer !== '(Time Expired)'
    ).length;
    const totalTimeout = Object.values(userAnswers).filter(
      (a) => a.userAnswer === '(Time Expired)'
    ).length;
    const totalSkipped = items.length - (totalCorrect + totalWrong + totalTimeout);
    const totalPending = totalSkipped + totalTimeout;

    // Filter items based on active filter
    const filteredQuestionIndices = items
      .map((_, idx) => idx)
      .filter((idx) => {
        if (overviewFilter === 'all') return true;
        const rec = userAnswers[idx];
        if (overviewFilter === 'correct') {
          return rec?.isCorrect === true;
        }
        if (overviewFilter === 'wrong') {
          return rec && !rec.isCorrect && !rec.isSkipped && rec.userAnswer !== '(Time Expired)';
        }
        if (overviewFilter === 'pending') {
          return !rec || rec.isSkipped || rec.userAnswer === '(Time Expired)';
        }
        return true;
      });

    return (
      <Modal
        visible={showOverviewModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowOverviewModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.overviewModalCard}>
            {/* Top Sheet Handle */}
            <View style={styles.overviewHandleBar} />

            {/* Header: Icon, Title, Progress & Close Button */}
            <View style={styles.overviewModalHeader}>
              <View style={styles.overviewModalTitleRow}>
                <View style={styles.overviewIconBadge}>
                  <HugeiconsIcon icon={Task01Icon} size={18} color="#4F46E5" strokeWidth={2.2} />
                </View>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={styles.overviewModalTitle} numberOfLines={1}>Quiz Overview</Text>
                  <Text style={styles.overviewModalSubtitle} numberOfLines={1}>
                    {isQuizFinished
                      ? `Final score: ${totalCorrect}/${items.length} correct`
                      : `Question ${currentIndex + 1} of ${items.length} in progress`}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.overviewCloseBtn}
                onPress={() => setShowOverviewModal(false)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Close Overview"
              >
                <HugeiconsIcon icon={Cancel01Icon} size={18} color="#64748B" strokeWidth={2.2} />
              </TouchableOpacity>
            </View>

            {/* Quick Stats Summary with Minimalist Badges */}
            <View style={styles.overviewStatsRow}>
              <TouchableOpacity
                style={[
                  styles.overviewStatBadge,
                  styles.overviewStatCorrect,
                  overviewFilter === 'correct' && styles.overviewStatBadgeActiveCorrect,
                ]}
                onPress={() => setOverviewFilter(overviewFilter === 'correct' ? 'all' : 'correct')}
                activeOpacity={0.75}
              >
                <View style={styles.statBadgeHeader}>
                  <HugeiconsIcon icon={CheckmarkCircle02Icon} size={13} color="#059669" strokeWidth={2.2} />
                  <Text style={[styles.overviewStatNum, { color: '#047857' }]}>{totalCorrect}</Text>
                </View>
                <Text style={[styles.overviewStatLabel, { color: '#065F46' }]}>Correct</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.overviewStatBadge,
                  styles.overviewStatWrong,
                  overviewFilter === 'wrong' && styles.overviewStatBadgeActiveWrong,
                ]}
                onPress={() => setOverviewFilter(overviewFilter === 'wrong' ? 'all' : 'wrong')}
                activeOpacity={0.75}
              >
                <View style={styles.statBadgeHeader}>
                  <HugeiconsIcon icon={Cancel01Icon} size={13} color="#DC2626" strokeWidth={2.2} />
                  <Text style={[styles.overviewStatNum, { color: '#B91C1C' }]}>{totalWrong}</Text>
                </View>
                <Text style={[styles.overviewStatLabel, { color: '#991B1B' }]}>Wrong</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.overviewStatBadge,
                  styles.overviewStatPending,
                  overviewFilter === 'pending' && styles.overviewStatBadgeActivePending,
                ]}
                onPress={() => setOverviewFilter(overviewFilter === 'pending' ? 'all' : 'pending')}
                activeOpacity={0.75}
              >
                <View style={styles.statBadgeHeader}>
                  <HugeiconsIcon icon={Clock01Icon} size={13} color="#4F46E5" strokeWidth={2.2} />
                  <Text style={[styles.overviewStatNum, { color: '#4338CA' }]}>{totalPending}</Text>
                </View>
                <Text style={[styles.overviewStatLabel, { color: '#4F46E5' }]}>
                  {isQuizFinished ? 'Skipped' : 'Pending'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Interactive Filter Pills (No Overlapping Scroll) */}
            <View style={{ marginBottom: 12 }}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.overviewFilterRow}
              >
                <TouchableOpacity
                  style={[
                    styles.overviewFilterPill,
                    overviewFilter === 'all' && styles.overviewFilterPillActive,
                  ]}
                  onPress={() => setOverviewFilter('all')}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.overviewFilterPillText,
                      overviewFilter === 'all' && styles.overviewFilterPillTextActive,
                    ]}
                  >
                    All ({items.length})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.overviewFilterPill,
                    overviewFilter === 'correct' && styles.overviewFilterPillActive,
                  ]}
                  onPress={() => setOverviewFilter('correct')}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.overviewFilterPillText,
                      overviewFilter === 'correct' && styles.overviewFilterPillTextActive,
                    ]}
                  >
                    Correct ({totalCorrect})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.overviewFilterPill,
                    overviewFilter === 'wrong' && styles.overviewFilterPillActive,
                  ]}
                  onPress={() => setOverviewFilter('wrong')}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.overviewFilterPillText,
                      overviewFilter === 'wrong' && styles.overviewFilterPillTextActive,
                    ]}
                  >
                    Wrong ({totalWrong})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.overviewFilterPill,
                    overviewFilter === 'pending' && styles.overviewFilterPillActive,
                  ]}
                  onPress={() => setOverviewFilter('pending')}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.overviewFilterPillText,
                      overviewFilter === 'pending' && styles.overviewFilterPillTextActive,
                    ]}
                  >
                    Pending ({totalPending})
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            </View>

            {/* Scrollable Content: Question Grid & Breakdown */}
            <ScrollView
              style={styles.overviewGridContainer}
              contentContainerStyle={styles.overviewGridScroll}
              showsVerticalScrollIndicator={false}
            >
              {/* Question Grid Section */}
              <View style={styles.overviewSectionHeaderRow}>
                <Text style={styles.overviewSectionTitle}>Jump to Question</Text>
                <Text style={styles.overviewSectionSubtitle}>Tap to navigate</Text>
              </View>

              <View style={styles.overviewGridWrap}>
                {items.map((_, idx) => {
                  const record = userAnswers[idx];
                  const isCurrent = !isQuizFinished && idx === currentIndex;
                  const isTimeout = record?.userAnswer === '(Time Expired)';
                  const isCorrect = record?.isCorrect ?? false;
                  const isRevealed = record?.wasRevealed ?? false;
                  const isSkipped = record?.isSkipped ?? false;
                  const isAnswered = Boolean(record && !isSkipped && !isTimeout);

                  let cellStyle: StyleProp<ViewStyle> = styles.pageBtnDefault;
                  let cellTextStyle: StyleProp<TextStyle> = styles.pageBtnTextDefault;

                  if (isTimeout) {
                    cellStyle = styles.pageBtnTimeout;
                    cellTextStyle = styles.pageBtnTextTimeout;
                  } else if (isRevealed) {
                    cellStyle = styles.pageBtnRevealed;
                    cellTextStyle = styles.pageBtnTextRevealed;
                  } else if (isCorrect) {
                    cellStyle = styles.pageBtnCorrect;
                    cellTextStyle = styles.pageBtnTextCorrect;
                  } else if (isAnswered) {
                    cellStyle = styles.pageBtnWrong;
                    cellTextStyle = styles.pageBtnTextWrong;
                  } else if (isSkipped) {
                    cellStyle = styles.pageBtnSkipped;
                    cellTextStyle = styles.pageBtnTextSkipped;
                  }

                  const isCellLocked =
                    !isQuizFinished &&
                    isTimerSet &&
                    !isRevisitingSkipped &&
                    (idx < currentIndex || Boolean(record?.isSkipped));

                  const isDimmed =
                    overviewFilter !== 'all' && !filteredQuestionIndices.includes(idx);

                  return (
                    <TouchableOpacity
                      key={idx}
                      style={[
                        styles.overviewGridCell,
                        cellStyle,
                        isCurrent && styles.overviewGridCellCurrent,
                        isCellLocked && styles.overviewGridCellLocked,
                        isDimmed && { opacity: 0.3 },
                      ]}
                      disabled={isCellLocked}
                      onPress={() => handlePillPress(idx)}
                      activeOpacity={isCellLocked ? 1 : 0.7}
                      accessibilityRole="button"
                      accessibilityLabel={`Go to question ${idx + 1}${isCellLocked ? ' (Locked)' : ''}`}
                    >
                      <Text
                        style={[
                          styles.overviewGridCellText,
                          cellTextStyle,
                          isCurrent && styles.overviewGridCellTextCurrent,
                          isCellLocked && styles.quizPillTextLocked,
                        ]}
                      >
                        {idx + 1}
                      </Text>
                      {isCurrent && <View style={styles.overviewCurrentDot} />}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Detailed Question Breakdown List */}
              <View style={styles.overviewListSection}>
                <View style={styles.overviewSectionHeaderRow}>
                  <Text style={styles.overviewSectionTitle}>
                    {overviewFilter === 'all'
                      ? 'Question Breakdown'
                      : `Question Breakdown (${filteredQuestionIndices.length})`}
                  </Text>
                  {overviewFilter !== 'all' && (
                    <TouchableOpacity onPress={() => setOverviewFilter('all')}>
                      <Text style={styles.overviewClearFilterText}>Show All</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {filteredQuestionIndices.length === 0 ? (
                  <View style={styles.overviewEmptyState}>
                    <HugeiconsIcon icon={CheckmarkCircle02Icon} size={32} color="#10B981" strokeWidth={2} />
                    <Text style={styles.overviewEmptyStateText}>
                      No questions match this filter
                    </Text>
                  </View>
                ) : (
                  filteredQuestionIndices.map((idx) => {
                    const it = items[idx];
                    const rec = userAnswers[idx];
                    const isTimeout = rec?.userAnswer === '(Time Expired)';
                    const isCorrect = rec?.isCorrect ?? false;
                    const isRevealed = rec?.wasRevealed ?? false;
                    const isSkipped = rec?.isSkipped ?? false;
                    const isAnswered = Boolean(rec && !isSkipped && !isTimeout);
                    const isCurrent = !isQuizFinished && idx === currentIndex;
                    const isRowLocked =
                      !isQuizFinished &&
                      isTimerSet &&
                      !isRevisitingSkipped &&
                      (idx < currentIndex || Boolean(rec?.isSkipped));

                    return (
                      <TouchableOpacity
                        key={idx}
                        style={[
                          styles.overviewListItem,
                          isCurrent && styles.overviewListItemActive,
                          isRowLocked && { opacity: 0.5 },
                        ]}
                        disabled={isRowLocked}
                        onPress={() => handlePillPress(idx)}
                        activeOpacity={isRowLocked ? 1 : 0.75}
                      >
                        <View style={styles.overviewListHeader}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <View
                              style={[
                                styles.overviewListNumBadge,
                                isTimeout
                                  ? styles.pageBtnTimeout
                                  : isRevealed
                                  ? styles.pageBtnRevealed
                                  : isCorrect
                                  ? styles.pageBtnCorrect
                                  : isAnswered
                                  ? styles.pageBtnWrong
                                  : styles.pageBtnDefault,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.overviewListNumBadgeText,
                                  isTimeout
                                    ? styles.pageBtnTextTimeout
                                    : isRevealed
                                    ? styles.pageBtnTextRevealed
                                    : isCorrect
                                    ? styles.pageBtnTextCorrect
                                    : isAnswered
                                    ? styles.pageBtnTextWrong
                                    : styles.pageBtnTextDefault,
                                ]}
                              >
                                {idx + 1}
                              </Text>
                            </View>
                            <Text style={styles.overviewListItemTitle}>Question {idx + 1}</Text>
                            {isCurrent && (
                              <View style={styles.currentBadgePill}>
                                <Text style={styles.currentBadgePillText}>Current</Text>
                              </View>
                            )}
                          </View>

                          <View
                            style={[
                              styles.overviewStatusPill,
                              isTimeout
                                ? styles.statusPillTimeout
                                : isCorrect
                                ? styles.statusPillCorrect
                                : isAnswered
                                ? styles.statusPillWrong
                                : styles.statusPillSkipped,
                            ]}
                          >
                            <Text
                              style={[
                                styles.overviewStatusPillText,
                                isTimeout
                                  ? styles.statusTextTimeout
                                  : isCorrect
                                  ? styles.statusTextCorrect
                                  : isAnswered
                                  ? styles.statusTextWrong
                                  : styles.statusTextSkipped,
                              ]}
                            >
                              {isTimeout
                                ? 'Timed Out'
                                : isCorrect
                                ? 'Correct'
                                : isRevealed
                                ? 'Revealed'
                                : isAnswered
                                ? 'Wrong'
                                : isSkipped
                                ? 'Skipped'
                                : 'Pending'}
                            </Text>
                          </View>
                        </View>

                        <Text style={styles.overviewListPrompt} numberOfLines={2}>
                          {sanitizeQuestionText(it.question)}
                        </Text>

                        {Boolean(rec) && (
                          <View style={styles.overviewListAnswersRow}>
                            <View
                              style={[
                                styles.overviewAnswerBox,
                                isCorrect ? styles.overviewAnswerBoxCorrect : styles.overviewAnswerBoxWrong,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.overviewAnswerBoxText,
                                  isCorrect ? { color: '#065F46' } : { color: '#991B1B' },
                                ]}
                                numberOfLines={1}
                              >
                                {isCorrect ? '✓ Your answer: ' : '✗ Your answer: '}
                                <Text style={{ fontWeight: '800' }}>
                                  {rec?.userAnswer || '(Unanswered)'}
                                </Text>
                              </Text>
                            </View>

                            {!isCorrect && Boolean(it.answer) && (
                              <View style={[styles.overviewAnswerBox, styles.overviewAnswerBoxCorrect]}>
                                <Text
                                  style={[styles.overviewAnswerBoxText, { color: '#065F46' }]}
                                  numberOfLines={1}
                                >
                                  ✓ Correct: <Text style={{ fontWeight: '800' }}>{it.answer}</Text>
                                </Text>
                              </View>
                            )}
                          </View>
                        )}

                        {!rec && (
                          <View style={styles.overviewUnansweredBox}>
                            <Text style={styles.overviewUnansweredText}>Not answered yet</Text>
                          </View>
                        )}

                        {(isQuizFinished || !isTimerSet) && Boolean(it.explanation) && (
                          <View style={styles.overviewListExplanationBox}>
                            <View style={styles.overviewListExplanationHeader}>
                              <HugeiconsIcon icon={BookOpen01Icon} size={13} color="#4F46E5" strokeWidth={2.2} />
                              <Text style={styles.overviewListExplanationTitle}>Explanation</Text>
                            </View>
                            <Text style={styles.overviewListExplanationText}>{it.explanation}</Text>
                          </View>
                        )}

                        {!isRowLocked && (
                          <View style={styles.overviewJumpRow}>
                            <Text style={styles.overviewJumpText}>
                              {isCurrent ? 'Continue this question' : 'Jump to this question'}
                            </Text>
                            <HugeiconsIcon icon={ArrowRight01Icon} size={13} color="#4F46E5" strokeWidth={2.2} />
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })
                )}
              </View>
            </ScrollView>

            {/* Sticky Bottom Action: Resume Quiz */}
            <TouchableOpacity
              style={styles.overviewResumeBtn}
              onPress={() => setShowOverviewModal(false)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Resume Quiz"
            >
              <HugeiconsIcon icon={Task01Icon} size={18} color="#FFFFFF" strokeWidth={2.4} />
              <Text style={styles.overviewResumeBtnText}>
                {isQuizFinished ? 'Done Reviewing' : 'Resume Quiz'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
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

        {/* Quiz Overview & Answer Key Dropdown Toggle Button */}
        <TouchableOpacity
          style={[
            styles.overviewDropdownBtn,
            isOverviewExpanded && styles.overviewDropdownBtnExpanded,
          ]}
          onPress={() => setIsOverviewExpanded((prev) => !prev)}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={isOverviewExpanded ? "Collapse Quiz Overview & Answer Key" : "Expand Quiz Overview & Answer Key"}
        >
          <View style={styles.overviewDropdownLeft}>
            <View
              style={[
                styles.overviewDropdownIconBox,
                isOverviewExpanded && styles.overviewDropdownIconBoxExpanded,
              ]}
            >
              <HugeiconsIcon
                icon={Task01Icon}
                size={20}
                color={isOverviewExpanded ? '#FFFFFF' : '#4F46E5'}
                strokeWidth={2.2}
              />
            </View>
            <View style={styles.overviewDropdownTextBox}>
              <View style={styles.overviewDropdownTitleRow}>
                <Text style={styles.overviewDropdownTitle}>Quiz Overview & Answer Key</Text>
                <View style={styles.overviewCountBadge}>
                  <Text style={styles.overviewCountBadgeText}>
                    {totalCorrect}/{totalQuestions}
                  </Text>
                </View>
              </View>
              <Text style={styles.overviewDropdownSubtitle}>
                {isOverviewExpanded
                  ? 'Tap to collapse overview & answer key'
                  : 'Tap to review question breakdown, answers & explanations'}
              </Text>
            </View>
          </View>
          <View
            style={[
              styles.overviewChevronCircle,
              isOverviewExpanded && styles.overviewChevronCircleExpanded,
            ]}
          >
            <HugeiconsIcon
              icon={isOverviewExpanded ? ArrowUp01Icon : ArrowDown01Icon}
              size={18}
              color={isOverviewExpanded ? '#FFFFFF' : '#4F46E5'}
              strokeWidth={2.4}
            />
          </View>
        </TouchableOpacity>

        {/* Dropped-down Quiz Overview & Answer Key Content */}
        {isOverviewExpanded && (
          <View style={styles.overviewDropdownContainer}>
            <View style={styles.reviewDropdownHeaderRow}>
              <Text style={styles.overviewContainerSubtitle}>
                Tap any question number to inspect verified answers & explanations.
              </Text>
              <TouchableOpacity
                style={styles.openModalViewBtn}
                onPress={() => setShowOverviewModal(true)}
                activeOpacity={0.75}
              >
                <HugeiconsIcon icon={Task01Icon} size={14} color="#4F46E5" strokeWidth={2.2} />
                <Text style={styles.openModalViewBtnText}>Full View</Text>
              </TouchableOpacity>
            </View>

            {/* Quick Interactive 3D Stats Row in Review Screen */}
            <View style={[styles.overviewStatsRow, { marginTop: 4, marginBottom: 12 }]}>
              <TouchableOpacity
                style={[
                  styles.overviewStatBadge,
                  styles.overviewStatCorrect,
                  reviewFilter === 'correct' && styles.overviewStatBadgeActiveCorrect,
                ]}
                onPress={() => setReviewFilter(reviewFilter === 'correct' ? 'all' : 'correct')}
                activeOpacity={0.75}
              >
                <View style={styles.statBadgeHeader}>
                  <HugeiconsIcon icon={CheckmarkCircle02Icon} size={14} color="#047857" strokeWidth={2.4} />
                  <Text style={[styles.overviewStatNum, { color: '#047857' }]}>{totalCorrect}</Text>
                </View>
                <Text style={[styles.overviewStatLabel, { color: '#065F46' }]}>Correct</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.overviewStatBadge,
                  styles.overviewStatWrong,
                  reviewFilter === 'wrong' && styles.overviewStatBadgeActiveWrong,
                ]}
                onPress={() => setReviewFilter(reviewFilter === 'wrong' ? 'all' : 'wrong')}
                activeOpacity={0.75}
              >
                <View style={styles.statBadgeHeader}>
                  <HugeiconsIcon icon={Cancel01Icon} size={14} color="#B91C1C" strokeWidth={2.4} />
                  <Text style={[styles.overviewStatNum, { color: '#B91C1C' }]}>
                    {Object.values(userAnswers).filter((a) => !a.isCorrect && !a.isSkipped && a.userAnswer !== '(Time Expired)').length}
                  </Text>
                </View>
                <Text style={[styles.overviewStatLabel, { color: '#991B1B' }]}>Wrong</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.overviewStatBadge,
                  styles.overviewStatPending,
                  reviewFilter === 'skipped' && styles.overviewStatBadgeActivePending,
                ]}
                onPress={() => setReviewFilter(reviewFilter === 'skipped' ? 'all' : 'skipped')}
                activeOpacity={0.75}
              >
                <View style={styles.statBadgeHeader}>
                  <HugeiconsIcon icon={Clock01Icon} size={14} color="#4338CA" strokeWidth={2.4} />
                  <Text style={[styles.overviewStatNum, { color: '#4338CA' }]}>
                    {items.length - (totalCorrect + Object.values(userAnswers).filter((a) => !a.isCorrect && !a.isSkipped && a.userAnswer !== '(Time Expired)').length)}
                  </Text>
                </View>
                <Text style={[styles.overviewStatLabel, { color: '#4F46E5' }]}>Skipped</Text>
              </TouchableOpacity>
            </View>

            {/* Interactive Filter Pills (No Overlapping Scroll) */}
            <View style={{ marginBottom: 12 }}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.overviewFilterRow}
              >
                <TouchableOpacity
                  style={[
                    styles.overviewFilterPill,
                    reviewFilter === 'all' && styles.overviewFilterPillActive,
                  ]}
                  onPress={() => setReviewFilter('all')}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.overviewFilterPillText,
                      reviewFilter === 'all' && styles.overviewFilterPillTextActive,
                    ]}
                  >
                    All ({items.length})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.overviewFilterPill,
                    reviewFilter === 'correct' && styles.overviewFilterPillActive,
                  ]}
                  onPress={() => setReviewFilter('correct')}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.overviewFilterPillText,
                      reviewFilter === 'correct' && styles.overviewFilterPillTextActive,
                    ]}
                  >
                    Correct ({totalCorrect})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.overviewFilterPill,
                    reviewFilter === 'wrong' && styles.overviewFilterPillActive,
                  ]}
                  onPress={() => setReviewFilter('wrong')}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.overviewFilterPillText,
                      reviewFilter === 'wrong' && styles.overviewFilterPillTextActive,
                    ]}
                  >
                    Wrong ({Object.values(userAnswers).filter((a) => !a.isCorrect && !a.isSkipped && a.userAnswer !== '(Time Expired)').length})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.overviewFilterPill,
                    reviewFilter === 'skipped' && styles.overviewFilterPillActive,
                  ]}
                  onPress={() => setReviewFilter('skipped')}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.overviewFilterPillText,
                      reviewFilter === 'skipped' && styles.overviewFilterPillTextActive,
                    ]}
                  >
                    Skipped ({items.length - (totalCorrect + Object.values(userAnswers).filter((a) => !a.isCorrect && !a.isSkipped && a.userAnswer !== '(Time Expired)').length)})
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            </View>

            {/* Question Selector Header & Wrapped 3D Grid */}
            <View style={styles.paginationHeaderRow}>
              <Text style={styles.paginationHeaderLabel}>Browse Questions:</Text>
              <Text style={styles.paginationHeaderCurrent}>
                {selectedReviewIndex !== null ? `Question ${selectedReviewIndex + 1} of ${items.length}` : 'Select a question'}
              </Text>
            </View>

            <View style={styles.overviewGridWrap}>
              {items.map((_, idx) => {
                const uRecord = userAnswers[idx];
                const isTimeout = uRecord?.userAnswer === '(Time Expired)';
                const isCorrect = uRecord?.isCorrect ?? false;
                const isRevealed = uRecord?.wasRevealed ?? false;
                const isSkipped = uRecord?.isSkipped ?? false;
                const isSelected = selectedReviewIndex === idx;
                const isAnswered = Boolean(uRecord && !isSkipped && !isTimeout);

                let btnStyle: StyleProp<ViewStyle> = styles.pageBtnDefault;
                let txtStyle: StyleProp<TextStyle> = styles.pageBtnTextDefault;

                if (isTimeout) {
                  btnStyle = styles.pageBtnTimeout;
                  txtStyle = styles.pageBtnTextTimeout;
                } else if (isRevealed) {
                  btnStyle = styles.pageBtnRevealed;
                  txtStyle = styles.pageBtnTextRevealed;
                } else if (isCorrect) {
                  btnStyle = styles.pageBtnCorrect;
                  txtStyle = styles.pageBtnTextCorrect;
                } else if (isSkipped) {
                  btnStyle = styles.pageBtnSkipped;
                  txtStyle = styles.pageBtnTextSkipped;
                } else if (isAnswered) {
                  btnStyle = styles.pageBtnWrong;
                  txtStyle = styles.pageBtnTextWrong;
                }

                const matchesFilter =
                  reviewFilter === 'all' ||
                  (reviewFilter === 'correct' && isCorrect) ||
                  (reviewFilter === 'wrong' && !isCorrect && !isSkipped && !isTimeout && isAnswered) ||
                  (reviewFilter === 'skipped' && (!uRecord || isSkipped || isTimeout));

                return (
                  <TouchableOpacity
                    key={idx}
                    style={[
                      styles.overviewGridCell,
                      btnStyle,
                      isSelected && styles.overviewGridCellCurrent,
                      !matchesFilter && { opacity: 0.25 },
                    ]}
                    onPress={() => setSelectedReviewIndex(idx)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={`Select question ${idx + 1}`}
                  >
                    <Text
                      style={[
                        styles.overviewGridCellText,
                        txtStyle,
                        isSelected && styles.overviewGridCellTextCurrent,
                      ]}
                    >
                      {idx + 1}
                    </Text>
                    {isSelected && <View style={styles.overviewCurrentDot} />}
                  </TouchableOpacity>
                );
              })}
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
              const isTimeout = userRecord?.userAnswer === '(Time Expired)';
              const isCorrect = userRecord?.isCorrect ?? false;
              const userAnsText = userRecord?.userAnswer || '(Unanswered)';
              const xpGained = userRecord?.xpAwarded ?? 0;

              return (
                <View
                  style={[
                    styles.reviewQuestionCard,
                    isTimeout
                      ? styles.reviewCardTimeoutBorder
                      : userRecord?.wasRevealed
                      ? styles.reviewCardRevealedBorder
                      : isCorrect
                      ? styles.reviewCardCorrectBorder
                      : styles.reviewCardWrongBorder,
                  ]}
                >
                  {/* Question Header: Number, Type, and Status Badge */}
                  <View style={styles.reviewQuestionHeaderRow}>
                    <View style={styles.reviewQuestionNumberCol}>
                      <View style={styles.overviewListNumBadge}>
                        <Text style={styles.overviewListNumBadgeText}>{idx + 1}</Text>
                      </View>
                      <View>
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
                    </View>

                    {/* Status Badge */}
                    <View
                      style={[
                        styles.statusBadge,
                        isTimeout
                          ? styles.badgeTimeout
                          : userRecord?.wasRevealed
                          ? styles.badgeRevealed
                          : isCorrect
                          ? styles.badgeCorrect
                          : styles.badgeWrong,
                      ]}
                    >
                      <HugeiconsIcon
                        icon={
                          isTimeout
                            ? Clock01Icon
                            : userRecord?.wasRevealed
                            ? EyeIcon
                            : isCorrect
                            ? CheckmarkCircle02Icon
                            : Cancel01Icon
                        }
                        size={14}
                        color={
                          isTimeout
                            ? '#334155'
                            : userRecord?.wasRevealed
                            ? '#B45309'
                            : isCorrect
                            ? '#047857'
                            : '#DC2626'
                        }
                        strokeWidth={2.4}
                      />
                      <Text
                        style={[
                          styles.statusBadgeText,
                          isTimeout
                            ? styles.statusTextTimeout
                            : userRecord?.wasRevealed
                            ? styles.statusTextRevealed
                            : isCorrect
                            ? styles.statusTextCorrect
                            : styles.statusTextWrong,
                        ]}
                      >
                        {isTimeout
                          ? 'TIME EXPIRED (+0 XP)'
                          : userRecord?.wasRevealed
                          ? 'REVEALED (+0 XP)'
                          : isCorrect
                          ? `CORRECT (+$` + xpGained + ` XP)`
                          : 'INCORRECT (+0 XP)'}
                      </Text>
                    </View>
                  </View>

                  {/* Question Text */}
                  <Text style={styles.reviewQuestionPrompt}>
                    {sanitizeQuestionText(item.question)}
                  </Text>

                  {/* User Answer Box */}
                  <View
                    style={[
                      styles.userAnswerBox,
                      isTimeout
                        ? styles.userAnswerBoxTimeout
                        : userRecord?.wasRevealed
                        ? styles.userAnswerBoxRevealed
                        : isCorrect
                        ? styles.userAnswerBoxCorrect
                        : styles.userAnswerBoxWrong,
                    ]}
                  >
                    <View style={styles.userAnswerHeaderRow}>
                      <HugeiconsIcon
                        icon={
                          isTimeout
                            ? Clock01Icon
                            : userRecord?.wasRevealed
                            ? EyeIcon
                            : isCorrect
                            ? CheckmarkCircle02Icon
                            : Cancel01Icon
                        }
                        size={14}
                        color={
                          isTimeout
                            ? '#334155'
                            : userRecord?.wasRevealed
                            ? '#B45309'
                            : isCorrect
                            ? '#047857'
                            : '#DC2626'
                        }
                        strokeWidth={2.4}
                      />
                      <Text
                        style={[
                          styles.userAnswerLabel,
                          isTimeout
                            ? styles.userAnswerLabelTimeout
                            : userRecord?.wasRevealed
                            ? styles.userAnswerLabelRevealed
                            : isCorrect
                            ? styles.userAnswerLabelCorrect
                            : styles.userAnswerLabelWrong,
                        ]}
                      >
                        {isTimeout
                          ? 'DID NOT ANSWER (TIMEOUT)'
                          : userRecord?.wasRevealed
                          ? 'ANSWER REVEALED'
                          : isCorrect
                          ? 'YOUR ANSWER (CORRECT)'
                          : 'YOUR ANSWER (INCORRECT)'}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.userAnswerValue,
                        isTimeout
                          ? styles.userAnswerValueTimeout
                          : userRecord?.wasRevealed
                          ? styles.userAnswerValueRevealed
                          : isCorrect
                          ? styles.userAnswerValueCorrect
                          : styles.userAnswerValueWrong,
                      ]}
                    >
                      {isTimeout ? '(No answer submitted - time expired)' : userAnsText}
                    </Text>
                  </View>

                  {/* Correct Answer Reference Box */}
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

                  {/* In-Card Prev / Next Question Navigation */}
                  <View style={styles.reviewCardNavRow}>
                    <TouchableOpacity
                      style={[
                        styles.reviewCardNavBtn,
                        idx === 0 && styles.reviewCardNavBtnDisabled,
                      ]}
                      disabled={idx === 0}
                      onPress={() => setSelectedReviewIndex(idx - 1)}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel="Previous question"
                    >
                      <HugeiconsIcon
                        icon={ArrowLeft01Icon}
                        size={16}
                        color={idx === 0 ? '#94A3B8' : '#4F46E5'}
                        strokeWidth={2.2}
                      />
                      <Text
                        style={[
                          styles.reviewCardNavBtnText,
                          idx === 0 && styles.reviewCardNavBtnTextDisabled,
                        ]}
                      >
                        Previous
                      </Text>
                    </TouchableOpacity>

                    <Text style={styles.reviewCardNavCounter} numberOfLines={1}>
                      Question {idx + 1} of {items.length}
                    </Text>

                    <TouchableOpacity
                      style={[
                        styles.reviewCardNavBtn,
                        idx === items.length - 1 && styles.reviewCardNavBtnDisabled,
                      ]}
                      disabled={idx === items.length - 1}
                      onPress={() => setSelectedReviewIndex(idx + 1)}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel="Next question"
                    >
                      <Text
                        style={[
                          styles.reviewCardNavBtnText,
                          idx === items.length - 1 && styles.reviewCardNavBtnTextDisabled,
                        ]}
                      >
                        Next
                      </Text>
                      <HugeiconsIcon
                        icon={ArrowRight01Icon}
                        size={16}
                        color={idx === items.length - 1 ? '#94A3B8' : '#4F46E5'}
                        strokeWidth={2.2}
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })()}
          </View>
        )}

        {/* Post-Quiz Actions */}
        <View style={styles.reviewActionFooter}>
          <InstagramStoryButton
            onPress={() => setShowStoryModal(true)}
          />

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

        {/* Quiz Overview Modal Rendered on Review Screen */}
        {renderOverviewModal()}

        <AcademicWeaponShareModal
          visible={showStoryModal}
          onClose={() => setShowStoryModal(false)}
          inputData={{
            mode: 'quiz',
            subject: title || 'Quiz Session',
            accuracy: percent,
            correctCount: totalCorrect,
            totalQuestions,
            xpEarned: currentXP,
          }}
        />
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
          <View style={styles.simpleQuestionCountBadge}>
            <Text style={styles.simpleQuestionCountText}>
              {isRevisitingSkipped ? `${revisitQueueIndex + 1}/${skippedQueue.length}` : `${currentIndex + 1}/${items.length}`}
            </Text>
          </View>

          {/* Live Stats Row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {Boolean(timeLimitPerQuestion && timeLimitPerQuestion > 0) && (
              <View style={[styles.timerBadge, timerSeconds <= 5 && styles.timerBadgeUrgent]}>
                <HugeiconsIcon icon={Clock01Icon} size={14} color={timerSeconds <= 5 ? "#DC2626" : "#4F46E5"} strokeWidth={2.4} />
                <Text style={[styles.timerBadgeText, timerSeconds <= 5 && styles.timerBadgeTextUrgent]}>
                  {timerSeconds}s
                </Text>
              </View>
            )}
            <View style={styles.xpBadge}>
              <HugeiconsIcon icon={FavouriteIcon} size={15} color="#EF4444" strokeWidth={2.4} fill="#EF4444" />
              <Text style={[styles.xpBadgeText, { color: "#EF4444" }]}>{hearts}</Text>
            </View>
            <View style={styles.xpBadge}>
              <HugeiconsIcon icon={SparklesIcon} size={15} color="#D97706" strokeWidth={2.4} />
              <Text style={styles.xpBadgeText}>{currentXP} XP</Text>
            </View>
          </View>
        </View>

        {isRevisitingSkipped && (
          <View style={styles.revisitingBanner}>
            <HugeiconsIcon icon={Clock01Icon} size={14} color="#92400E" strokeWidth={2.4} />
            <Text style={styles.revisitingBannerText}>
              Reviewing Skipped Question ({revisitQueueIndex + 1} of {skippedQueue.length})
            </Text>
          </View>
        )}

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

      {/* Progressive Contextual Coachmark */}
      {!hasSeenQuizXpTip && (
        <CoachmarkTooltip
          title="Earn XP & Level Up!"
          description="Every right answer scores you XP! Harder questions give you an even bigger boost. Let's see how high you can score!"
          onDismiss={() => markTipSeen('quizXp')}
          arrowPosition="top"
        />
      )}

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
              <Text style={styles.questionSectionText} numberOfLines={1} adjustsFontSizeToFit={true}>
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
              const isQuestionChecked = Boolean(
                userAnswers[currentIndex] && !userAnswers[currentIndex].isSkipped
              );
              const currentRecord = userAnswers[currentIndex];
              const isCorrectOption = opt.trim().toLowerCase() === currentItem.answer.trim().toLowerCase();

              let cardStyle: StyleProp<ViewStyle> = styles.optionBtn;
              let letterStyle: StyleProp<ViewStyle> = styles.optionLetter;
              let letterTextStyle: StyleProp<TextStyle> = styles.optionLetterText;
              let textStyle: StyleProp<TextStyle> = styles.optionText;

              if (isQuestionChecked) {
                if (isSelected) {
                  if (currentRecord?.isCorrect) {
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
                } else if (!currentRecord?.isCorrect && isCorrectOption) {
                  cardStyle = [styles.optionBtn, styles.optionBtnCorrectOutline];
                  letterStyle = [styles.optionLetter, styles.optionLetterCorrect];
                  letterTextStyle = [styles.optionLetterText, styles.optionLetterTextCorrect];
                  textStyle = [styles.optionText, styles.optionTextCorrect];
                }
              } else if (isSubmittingFeedback && isSelected) {
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
                  onPress={() => handleOptionPress(opt)}
                  disabled={isSubmittingFeedback || isQuestionChecked}
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
                            ? `+${lastAnswerResult.earnedXP} XP${lastAnswerResult.streakBonus ? ' 🔥 x2' : ''}`
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
              {(() => {
                const isIdChecked = Boolean(
                  userAnswers[currentIndex] && !userAnswers[currentIndex].isSkipped
                );
                const idRecord = userAnswers[currentIndex];

                return (
                  <TextInput
                    style={[
                      styles.textInput,
                      ((isSubmittingFeedback && lastAnswerResult) || isIdChecked) && (
                        (lastAnswerResult ? lastAnswerResult.isCorrect : idRecord?.isCorrect)
                          ? styles.textInputCorrect
                          : styles.textInputWrong
                      ),
                    ]}
                    placeholder="Type your answer here..."
                    placeholderTextColor="#94A3B8"
                    value={typedAnswer}
                    onChangeText={setTypedAnswer}
                    editable={!isSubmittingFeedback && !isIdChecked}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                );
              })()}

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
                        ? `+${lastAnswerResult.earnedXP} XP${lastAnswerResult.streakBonus ? ' 🔥 x2' : ''}`
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

        {/* See Explanation Button - strictly ONLY for untimed quizes AFTER answer is checked */}
        {!isTimerSet && Boolean(userAnswers[currentIndex] && !userAnswers[currentIndex].isSkipped) && (
          <View style={styles.explanationActionBox}>
            <TouchableOpacity
              style={[
                styles.seeExplanationBtn,
                showExplanation && styles.seeExplanationBtnActive,
              ]}
              onPress={() => setShowExplanation((prev) => !prev)}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel={showExplanation ? 'Hide explanation' : 'See explanation'}
            >
              <View style={styles.seeExplanationRow}>
                <HugeiconsIcon
                  icon={Idea01Icon}
                  size={15}
                  color={showExplanation ? '#4338CA' : '#4F46E5'}
                  strokeWidth={2.2}
                />
                <Text
                  style={[
                    styles.seeExplanationText,
                    showExplanation && styles.seeExplanationTextActive,
                  ]}
                >
                  {showExplanation ? 'Hide Explanation' : 'See Explanation'}
                </Text>
                <HugeiconsIcon
                  icon={showExplanation ? ArrowUp01Icon : ArrowDown01Icon}
                  size={14}
                  color={showExplanation ? '#4338CA' : '#4F46E5'}
                  strokeWidth={2.2}
                />
              </View>
            </TouchableOpacity>

            {showExplanation && (
              <View style={styles.inlineExplanationCard}>
                <View style={styles.inlineExplanationHeader}>
                  <HugeiconsIcon icon={BookOpen01Icon} size={14} color="#4F46E5" strokeWidth={2.2} />
                  <Text style={styles.inlineExplanationBadgeText}>EXPLANATION & CONCEPT</Text>
                </View>

                <Text style={styles.inlineExplanationBody}>
                  {currentItem.explanation || `The verified answer is "${currentItem.answer}".`}
                </Text>

                {currentItem.source_metadata && (
                  <View style={{ marginTop: 8 }}>
                    <SourceAttribution source={currentItem.source_metadata} defaultExpanded={false} />
                  </View>
                )}
              </View>
            )}
          </View>
        )}
      </View>

      {/* Footer: Previous, Reveal Answer, and Next / Skip Button */}
      <View style={styles.footer}>
        <View style={styles.actionRow}>
          <View style={styles.footerTopRow}>
            {canGoPrev ? (
              <TouchableOpacity
                style={styles.prevQuestionBtn}
                onPress={goToPrevQuestion}
                disabled={isSubmittingFeedback}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel="Previous Question"
              >
                <HugeiconsIcon icon={ArrowLeft01Icon} size={18} color="#4F46E5" strokeWidth={2.2} />
              </TouchableOpacity>
            ) : isTimerSet && hasSkippedInSession ? (
              <TouchableOpacity
                style={[styles.prevQuestionBtn, styles.prevQuestionBtnDisabled]}
                disabled={true}
                activeOpacity={1}
                accessibilityRole="button"
                accessibilityLabel="Previous Question Locked"
              >
                <HugeiconsIcon icon={ArrowLeft01Icon} size={18} color="#CBD5E1" strokeWidth={2.2} />
              </TouchableOpacity>
            ) : null}

            {/* Skip Button: Level side-by-side with Reveal Button */}
            <TouchableOpacity
              style={[
                styles.skipBtn,
                (isSubmittingFeedback || (!isTimerSet && Boolean(userAnswers[currentIndex] && !userAnswers[currentIndex].isSkipped))) && styles.skipBtnDisabled,
              ]}
              disabled={isSubmittingFeedback || (!isTimerSet && Boolean(userAnswers[currentIndex] && !userAnswers[currentIndex].isSkipped))}
              onPress={handleSkipQuestion}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Skip Question"
            >
              
              <Text style={styles.skipBtnText}>Skip</Text>
            </TouchableOpacity>

            {/* Reveal Button: Level side-by-side with Skip Button */}
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
                numberOfLines={1} adjustsFontSizeToFit={true}
              >
                {isCurrentQuestionRevealed ? 'Revealed' : `Reveal • 50`}
              </Text>
            </TouchableOpacity>
          </View>

          {(() => {
            const pendingSkippedCount = isTimerSet
              ? skippedQueue.filter((idx) => userAnswers[idx]?.isSkipped).length
              : 0;

            const isLastQuestionOfPass = !isRevisitingSkipped
              ? currentIndex === items.length - 1
              : revisitQueueIndex === skippedQueue.length - 1;

            const isUntimed = !isTimerSet;
            const isQuestionChecked = Boolean(
              userAnswers[currentIndex] && !userAnswers[currentIndex].isSkipped
            );

            if (isUntimed) {
              if (!hasAnswered) {
                return (
                  <PlatformPressable
                    style={[styles.primaryBtn, styles.disabledBtn]}
                    disabled={true}
                  >
                    <View style={styles.btnContent}>
                      <Text style={[styles.primaryBtnText, styles.disabledBtnText]}>
                        Select an Answer
                      </Text>
                    </View>
                  </PlatformPressable>
                );
              }

              if (!isQuestionChecked) {
                return (
                  <PlatformPressable
                    style={[styles.primaryBtn, isSubmittingFeedback && styles.disabledBtn]}
                    disabled={isSubmittingFeedback}
                    onPress={handleCheckAnswer}
                  >
                    <View style={styles.btnContent}>
                      <Text style={styles.primaryBtnText}>Check Answer</Text>
                      <HugeiconsIcon icon={CheckmarkCircle02Icon} size={18} color="#FFFFFF" strokeWidth={2.4} />
                    </View>
                  </PlatformPressable>
                );
              }

              return (
                <PlatformPressable
                  style={[styles.primaryBtn, isSubmittingFeedback && styles.disabledBtn]}
                  disabled={isSubmittingFeedback}
                  onPress={() => advanceQuestion(userAnswers)}
                >
                  <View style={styles.btnContent}>
                    <Text style={styles.primaryBtnText}>
                      {isLastQuestionOfPass ? 'Complete Quiz' : 'Next Question'}
                    </Text>
                    
                  </View>
                </PlatformPressable>
              );
            }

            // Timed mode: Identification (text input)
            if (options.length === 0) {
              const hasTyped = Boolean(typedAnswer.trim());
              return (
                <PlatformPressable
                  style={[
                    styles.primaryBtn,
                    (!hasTyped || isSubmittingFeedback) && styles.disabledBtn,
                  ]}
                  disabled={!hasTyped || isSubmittingFeedback}
                  onPress={() => handleNextQuestion()}
                >
                  <View style={styles.btnContent}>
                    <Text style={[styles.primaryBtnText, !hasTyped && styles.disabledBtnText]}>
                      Submit Answer
                    </Text>
                    <HugeiconsIcon
                      icon={ArrowRight01Icon}
                      size={18}
                      color={hasTyped ? '#FFFFFF' : '#94A3B8'}
                      strokeWidth={2.4}
                    />
                  </View>
                </PlatformPressable>
              );
            }

            // Timed mode: Multiple Choice / True-False (options tapped directly)
            // If revealed, show Next Question to proceed
            if (isCurrentQuestionRevealed) {
              return (
                <PlatformPressable
                  style={[styles.primaryBtn, isSubmittingFeedback && styles.disabledBtn]}
                  disabled={isSubmittingFeedback}
                  onPress={() => handleNextQuestion()}
                >
                  <View style={styles.btnContent}>
                    <Text style={styles.primaryBtnText}>
                      {isLastQuestionOfPass ? 'Complete Quiz' : 'Next Question'}
                    </Text>
                    
                  </View>
                </PlatformPressable>
              );
            }

            return null;
          })()}
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

      {/* Insufficient Hearts Modal */}
      <Modal
        visible={showNoHeartsModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {}}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <HugeiconsIcon icon={FavouriteIcon} size={64} color="#EF4444" strokeWidth={2} fill="#EF4444" />
            <Text style={styles.modalTitle}>Out of Lives!</Text>
            <Text style={styles.modalDesc}>
              You have run out of lives for today. Lives refresh automatically every 24 hours.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalPurchaseBtn}
                onPress={() => {
                  setShowNoHeartsModal(false);
                  router.replace('/(tabs)/library');
                }}
              >
                <Text style={styles.modalPurchaseText}>Go to Library</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Comprehensive Quiz Overview Modal */}
      {renderOverviewModal()}

    </SmoothScrollView>
  );
});

const isPadDevice = isIpad();

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
    borderRadius: isPadDevice ? 28 : 24,
    padding: isPadDevice ? 32 : 24,
    alignItems: 'center',
    width: '100%',
    maxWidth: isPadDevice ? 520 : 340,
  },
  modalTitle: {
    fontSize: isPadDevice ? 24 : 20,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 16,
    marginBottom: 8,
  },
  modalDesc: {
    fontSize: isPadDevice ? 16 : 14,
    color: '#475569',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: isPadDevice ? 24 : 20,
  },
  modalActions: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 12,
    width: '100%',
  },
  modalCancelBtn: {
    paddingVertical: isPadDevice ? 18 : 14,
    borderRadius: isPadDevice ? 16 : 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    fontSize: isPadDevice ? 17 : 15,
    fontFamily: 'Poppins-Bold',
    color: '#475569',
  },
  modalPurchaseBtn: {
    paddingVertical: isPadDevice ? 18 : 14,
    borderRadius: isPadDevice ? 16 : 14,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalPurchaseText: {
    fontSize: isPadDevice ? 17 : 15,
    fontFamily: 'Poppins-Bold',
    color: '#FFFFFF',
  },
  container: {
    padding: isPadDevice ? spacing[28] : spacing[16],
    flexGrow: 1,
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: 860,
    alignSelf: 'center',
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
    marginBottom: isPadDevice ? 22 : 16,
    position: 'relative',
  },
  topInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  simpleQuestionCountBadge: {
    backgroundColor: '#F8FAFC',
    paddingHorizontal: isPadDevice ? 14 : 10,
    paddingVertical: isPadDevice ? 6 : 4,
    borderRadius: isPadDevice ? 14 : 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  simpleQuestionCountText: {
    fontSize: isPadDevice ? 15 : 13,
    fontWeight: '800',
    color: '#64748B',
    fontVariant: ['tabular-nums'],
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
    paddingHorizontal: isPadDevice ? 14 : 10,
    paddingVertical: isPadDevice ? 6 : 4,
    borderRadius: isPadDevice ? 14 : 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  xpBadgeText: {
    fontSize: isPadDevice ? 15 : 13,
    fontWeight: '800',
    color: '#B45309',
    fontVariant: ['tabular-nums'],
  },
  xpTrackContainer: {
    marginTop: 2,
  },
  xpTrack: {
    height: isPadDevice ? 12 : 8,
    backgroundColor: '#E2E8F0',
    borderRadius: isPadDevice ? 6 : 4,
    overflow: 'hidden',
    marginBottom: 4,
  },
  xpFill: {
    height: '100%',
    backgroundColor: '#F59E0B',
    borderRadius: isPadDevice ? 6 : 4,
  },
  xpLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  xpTrackLabel: {
    fontSize: isPadDevice ? 13 : 11,
    fontWeight: '600',
    color: '#64748B',
  },
  xpTrackLabelBold: {
    fontSize: isPadDevice ? 13 : 11,
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
    borderRadius: isPadDevice ? 28 : 20,
    padding: isPadDevice ? 28 : 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: isPadDevice ? 24 : 20,
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
    paddingHorizontal: isPadDevice ? 12 : 8,
    paddingVertical: isPadDevice ? 5 : 3,
    borderRadius: isPadDevice ? 8 : 6,
  },
  questionTypeTagText: {
    fontSize: isPadDevice ? 12 : 10,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.5,
  },
  questionSectionTag: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: isPadDevice ? 12 : 8,
    paddingVertical: isPadDevice ? 5 : 3,
    borderRadius: isPadDevice ? 8 : 6,
    maxWidth: isPadDevice ? 260 : 160,
  },
  questionSectionText: {
    fontSize: isPadDevice ? 12 : 9.5,
    fontWeight: '700',
    color: '#4F46E5',
    letterSpacing: 0.4,
  },
  questionText: {
    fontSize: isPadDevice ? 25 : 18,
    fontWeight: '700',
    color: '#0F172A',
    lineHeight: isPadDevice ? 35 : 26,
    marginBottom: isPadDevice ? 24 : 20,
    letterSpacing: -0.2,
  },
  optionsList: {
    gap: isPadDevice ? 14 : 10,
  },
  optionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: isPadDevice ? 18 : 12,
    borderRadius: isPadDevice ? 16 : 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  selectedOptionBtn: {
    borderColor: '#4F46E5',
    backgroundColor: '#EEF2FF',
  },
  optionLetter: {
    width: isPadDevice ? 38 : 28,
    height: isPadDevice ? 38 : 28,
    borderRadius: isPadDevice ? 10 : 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: isPadDevice ? 14 : 10,
  },
  selectedOptionLetter: {
    backgroundColor: '#4F46E5',
  },
  optionLetterText: {
    fontSize: isPadDevice ? 15 : 12,
    fontWeight: '700',
    color: '#64748B',
  },
  selectedOptionLetterText: {
    color: '#FFFFFF',
  },
  optionText: {
    fontSize: isPadDevice ? 18 : 15,
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
  optionBtnCorrectOutline: {
    backgroundColor: '#ECFDF5',
    borderColor: '#059669',
    borderWidth: 2,
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
    borderRadius: isPadDevice ? 16 : 12,
    padding: isPadDevice ? 18 : 14,
    fontSize: isPadDevice ? 18 : 15,
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
    borderRadius: isPadDevice ? 16 : 12,
    paddingHorizontal: isPadDevice ? 16 : 12,
    paddingVertical: isPadDevice ? 14 : 10,
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
    fontSize: isPadDevice ? 15 : 12.5,
    fontWeight: '700',
    color: '#92400E',
  },
  hintTriggerTextActive: {
    color: '#78350F',
  },
  hintCard: {
    marginTop: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: isPadDevice ? 16 : 12,
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    padding: isPadDevice ? 18 : 14,
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
    fontSize: isPadDevice ? 18 : 15,
    fontWeight: '800',
    color: '#1E293B',
    letterSpacing: 2,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  hintDetailRow: {
    paddingTop: 2,
  },
  hintDetailText: {
    fontSize: isPadDevice ? 14 : 12,
    color: '#475569',
    lineHeight: isPadDevice ? 20 : 17,
  },

  revealedNoticeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFBEB',
    paddingHorizontal: isPadDevice ? 16 : 12,
    paddingVertical: isPadDevice ? 12 : 9,
    borderRadius: isPadDevice ? 14 : 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginBottom: 14,
  },
  revealedNoticeText: {
    fontSize: isPadDevice ? 15 : 12.5,
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
    gap: isPadDevice ? 14 : 10,
    width: '100%',
  },
  revealBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: isPadDevice ? 58 : 48,
    borderRadius: isPadDevice ? 18 : 14,
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
    fontSize: isPadDevice ? 17 : 14,
    fontFamily: 'Poppins-Bold',
  },
  revealBtnTextActive: {
    color: '#B45309',
  },
  primaryBtn: {
    backgroundColor: '#4F46E5',
    borderRadius: isPadDevice ? 18 : 14,
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
    paddingVertical: isPadDevice ? 18 : 15,
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
    fontSize: isPadDevice ? 18 : 15.5,
    fontFamily: 'Poppins-Bold',
    letterSpacing: -0.2,
  },

  // -------------------------
  // Review Screen Styles
  // -------------------------
  reviewContainer: {
    padding: isPadDevice ? 28 : 16,
    paddingBottom: 40,
    width: '100%',
    maxWidth: isPadDevice ? 860 : undefined,
    alignSelf: 'center',
  },
  reviewHeroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: isPadDevice ? 28 : 24,
    padding: isPadDevice ? 32 : 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 18,
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 16,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  heroBadgeCircle: {
    width: isPadDevice ? 96 : 76,
    height: isPadDevice ? 96 : 76,
    borderRadius: isPadDevice ? 48 : 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 1.5,
  },
  trophyBg: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
  },
  bookBg: {
    backgroundColor: '#EEF2FF',
    borderColor: '#C7D2FE',
  },
  heroTitle: {
    fontSize: isPadDevice ? 28 : 22,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 14,
  },
  xpEarnedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFBEB',
    paddingHorizontal: isPadDevice ? 20 : 16,
    paddingVertical: isPadDevice ? 18 : 14,
    borderRadius: isPadDevice ? 20 : 16,
    borderWidth: 1,
    borderColor: '#FDE68A',
    width: '100%',
    marginBottom: 16,
  },
  xpEarnedIconBox: {
    width: isPadDevice ? 48 : 40,
    height: isPadDevice ? 48 : 40,
    borderRadius: isPadDevice ? 14 : 12,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  xpEarnedTextBox: {
    flex: 1,
  },
  xpEarnedValue: {
    fontSize: isPadDevice ? 22 : 18,
    fontWeight: '900',
    color: '#92400E',
  },
  xpEarnedSub: {
    fontSize: isPadDevice ? 14 : 12,
    fontWeight: '600',
    color: '#B45309',
    marginTop: 1,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    gap: 8,
    paddingTop: 4,
  },
  metricPill: {
    alignItems: 'center',
    flex: 1,
    backgroundColor: '#F8FAFC',
    paddingVertical: isPadDevice ? 14 : 10,
    paddingHorizontal: isPadDevice ? 12 : 8,
    borderRadius: isPadDevice ? 16 : 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  metricValue: {
    fontSize: isPadDevice ? 20 : 16,
    fontWeight: '900',
    color: '#0F172A',
    fontVariant: ['tabular-nums'],
  },
  metricLabel: {
    fontSize: isPadDevice ? 13 : 11,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  masteredColor: {
    color: '#059669',
  },
  practiceColor: {
    color: '#4F46E5',
  },
  metricDivider: {
    display: 'none',
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
    fontSize: isPadDevice ? 20 : 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  reviewSectionSubtitle: {
    fontSize: isPadDevice ? 14.5 : 12.5,
    color: '#64748B',
    lineHeight: isPadDevice ? 22 : 18,
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
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderBottomColor: '#CBD5E1',
  },
  pageBtnRevealed: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
    borderBottomColor: '#D97706',
  },
  pageBtnCorrect: {
    backgroundColor: '#ECFDF5',
    borderColor: '#6EE7B7',
    borderBottomColor: '#10B981',
  },
  pageBtnWrong: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
    borderBottomColor: '#EF4444',
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
    borderRadius: isPadDevice ? 24 : 20,
    padding: isPadDevice ? 24 : 18,
    borderWidth: 1,
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
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: 10,
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
  badgeTimeout: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  statusBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.3,
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
  statusTextTimeout: {
    color: '#F8FAFC',
  },
  statusTextSkipped: {
    color: '#64748B',
  },
  reviewQuestionPrompt: {
    fontSize: 15.5,
    fontWeight: '700',
    color: '#0F172A',
    lineHeight: 22,
    marginBottom: 12,
  },
  reviewCardTimeoutBorder: {
    borderColor: '#E2E8F0',
  },
  userAnswerBox: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
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
  userAnswerBoxTimeout: {
    backgroundColor: '#F8FAFC',
    borderColor: '#CBD5E1',
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
  userAnswerLabelTimeout: {
    color: '#475569',
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
  userAnswerValueTimeout: {
    color: '#1E293B',
  },
  correctAnswerBox: {
    backgroundColor: '#F0FDF4',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
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
    borderRadius: 14,
    padding: 14,
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
  flexStoryBtn: {
    backgroundColor: '#8B5CF6',
    borderRadius: 20,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  flexStoryBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
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
    borderWidth: 1,
    borderColor: '#4338CA',
    ...Platform.select({
      ios: {
        shadowColor: '#4F46E5',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
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
  pageBtnSkipped: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderBottomColor: '#CBD5E1',
  },
  pageBtnTextSkipped: {
    color: '#64748B',
  },
  pageBtnTimeout: {
    backgroundColor: '#F1F5F9',
    borderColor: '#94A3B8',
    borderBottomColor: '#64748B',
  },
  pageBtnTextTimeout: {
    color: '#F8FAFC',
    fontWeight: '800',
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  timerBadgeUrgent: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
  },
  timerBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#4F46E5',
    fontVariant: ['tabular-nums'],
  },
  timerBadgeTextUrgent: {
    color: '#DC2626',
  },
  overviewHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  overviewHeaderBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#4F46E5',
  },
  quizOverviewBar: {
    marginTop: 10,
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  quizPaginationScroll: {
    gap: 8,
    paddingVertical: 2,
    alignItems: 'center',
  },
  quizPill: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  quizPillCurrent: {
    borderWidth: 2.5,
    borderColor: '#4F46E5',
    transform: [{ scale: 1.08 }],
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  quizPillText: {
    fontSize: 14,
    fontWeight: '700',
  },
  quizPillTextCurrent: {
    fontWeight: '900',
  },
  quizPillLocked: {
    opacity: 0.85,
  },
  quizPillTextLocked: {},
  explanationActionBox: {
    marginTop: 14,
  },
  seeExplanationBtn: {
    backgroundColor: '#EEF2FF',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#C7D2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  seeExplanationBtnActive: {
    backgroundColor: '#E0E7FF',
    borderColor: '#818CF8',
  },
  seeExplanationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  seeExplanationText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4F46E5',
  },
  seeExplanationTextActive: {
    color: '#4338CA',
  },
  inlineExplanationCard: {
    marginTop: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  inlineExplanationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  inlineExplanationBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#4F46E5',
    letterSpacing: 0.5,
  },
  inlineExplanationBody: {
    fontSize: 13.5,
    color: '#334155',
    lineHeight: 20,
  },
  footerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  skipBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#EEF2FF',
    borderWidth: 1.5,
    borderColor: '#C7D2FE',
  },
  skipBtnDisabled: {
    opacity: 0.45,
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  skipBtnText: {
    color: '#4F46E5',
    fontSize: 14,
    fontWeight: '700',
  },
  skipBtnTextDisabled: {
    color: '#94A3B8',
  },
  prevQuestionBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  prevQuestionBtnDisabled: {
    opacity: 0.45,
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  revisitingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FCD34D',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 8,
  },
  revisitingBannerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#92400E',
  },
  primaryBtnSkip: {
    backgroundColor: '#F1F5F9',
    borderColor: '#CBD5E1',
    shadowOpacity: 0,
    elevation: 0,
  },
  primaryBtnTextSkip: {
    color: '#475569',
  },
  reviewOverviewActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#EEF2FF',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#C7D2FE',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 14,
    width: '100%',
  },
  reviewOverviewActionText: {
    color: '#4F46E5',
    fontSize: 14,
    fontWeight: '700',
  },
  overviewDropdownBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  overviewDropdownBtnExpanded: {
    borderColor: '#C7D2FE',
    backgroundColor: '#F8FAFC',
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    marginBottom: 0,
  },
  overviewDropdownLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  overviewDropdownIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overviewDropdownIconBoxExpanded: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  overviewDropdownTextBox: {
    flex: 1,
  },
  overviewDropdownTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  overviewDropdownTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  overviewCountBadge: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  overviewCountBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#047857',
  },
  overviewDropdownSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  overviewChevronCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  overviewChevronCircleExpanded: {
    backgroundColor: '#4F46E5',
  },
  overviewDropdownContainer: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
  },
  reviewDropdownHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  openModalViewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  openModalViewBtnText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#4F46E5',
  },
  overviewContainerSubtitle: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 17,
    flex: 1,
  },
  paginationHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    marginTop: 4,
  },
  paginationHeaderLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#334155',
  },
  paginationHeaderCurrent: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4F46E5',
  },
  reviewCardNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  reviewCardNavBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  reviewCardNavBtnDisabled: {
    opacity: 0.4,
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  reviewCardNavBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4F46E5',
  },
  reviewCardNavBtnTextDisabled: {
    color: '#94A3B8',
  },
  reviewCardNavCounter: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    textAlign: 'center',
    flex: 1,
    paddingHorizontal: 4,
  },
  overviewHandleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 12,
  },
  overviewModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 20,
    width: '100%',
    maxHeight: '88%',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 20,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  overviewModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  overviewModalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  overviewIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overviewModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  overviewModalSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 1,
  },
  overviewCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overviewStatsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
    marginBottom: 10,
  },
  overviewStatBadge: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
  },
  overviewStatCorrect: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  overviewStatWrong: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  overviewStatPending: {
    backgroundColor: '#EEF2FF',
    borderColor: '#C7D2FE',
  },

  overviewStatTimeout: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  overviewStatSkipped: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
  },
  overviewLegendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 11.5,
    color: '#64748B',
    fontWeight: '600',
  },
  statusPillCorrect: {
    backgroundColor: '#ECFDF5',
  },
  statusPillWrong: {
    backgroundColor: '#FEF2F2',
  },
  statusPillTimeout: {
    backgroundColor: '#F8FAFC',
  },
  statusPillSkipped: {
    backgroundColor: '#F1F5F9',
  },

  overviewStatBadgeActiveCorrect: {
    borderColor: '#059669',
    backgroundColor: '#D1FAE5',
  },
  overviewStatBadgeActiveWrong: {
    borderColor: '#DC2626',
    backgroundColor: '#FEE2E2',
  },
  overviewStatBadgeActivePending: {
    borderColor: '#4F46E5',
    backgroundColor: '#E0E7FF',
  },
  statBadgeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 2,
  },
  overviewStatNum: {
    fontSize: 16,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  overviewStatLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  overviewFilterRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  overviewFilterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  overviewFilterPillActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#4F46E5',
  },
  overviewFilterPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  overviewFilterPillTextActive: {
    color: '#4F46E5',
    fontWeight: '800',
  },
  overviewGridContainer: {
    flexShrink: 1,
  },
  overviewGridScroll: {
    paddingBottom: 16,
  },
  overviewSectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 8,
  },
  overviewSectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#334155',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  overviewSectionSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
  },
  overviewClearFilterText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4F46E5',
  },
  overviewGridWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  overviewGridCell: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  overviewGridCellCurrent: {
    backgroundColor: '#4F46E5',
    borderColor: '#4338CA',
    borderWidth: 1,
  },
  overviewGridCellText: {
    fontSize: 14,
    fontWeight: '800',
  },
  overviewGridCellTextCurrent: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  overviewCurrentDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
    marginTop: 1,
  },
  overviewGridCellLocked: {
    opacity: 0.6,
  },
  overviewListSection: {
    marginTop: 6,
  },
  overviewEmptyState: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
  },
  overviewEmptyStateText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  overviewListItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  overviewListItemActive: {
    borderColor: '#6366F1',
    backgroundColor: '#FAF5FF',
  },
  overviewListHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  overviewListNumBadge: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  overviewListNumBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  overviewListItemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  currentBadgePill: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  currentBadgePillText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  overviewStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 8,
  },
  overviewStatusPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  overviewListPrompt: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
    marginBottom: 6,
  },
  overviewListAnswersRow: {
    gap: 6,
    marginTop: 4,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  overviewAnswerBox: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    width: '100%',
  },
  overviewAnswerBoxCorrect: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  overviewAnswerBoxWrong: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  overviewAnswerBoxText: {
    fontSize: 12,
  },
  overviewUnansweredBox: {
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 4,
  },
  overviewUnansweredText: {
    fontSize: 11.5,
    color: '#94A3B8',
    fontWeight: '600',
  },
  overviewJumpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  overviewJumpText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#4F46E5',
  },
  overviewResumeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#4F46E5',
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#4338CA',
  },
  overviewResumeBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  overviewListExplanationBox: {
    marginTop: 8,
    padding: 10,
    backgroundColor: '#EEF2FF',
    borderRadius: 10,
    borderLeftWidth: 3.5,
    borderLeftColor: '#4F46E5',
  },
  overviewListExplanationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 3,
  },
  overviewListExplanationTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#4F46E5',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  overviewListExplanationText: {
    fontSize: 12.5,
    color: '#334155',
    lineHeight: 18,
  },
});
