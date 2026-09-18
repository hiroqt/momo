import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Platform,
  Alert,
  StyleProp,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  CheckmarkCircle02Icon,
  Cancel01Icon,
  ArrowRight01Icon,
  ArrowDown01Icon,
  ArrowUp01Icon,
  EyeIcon,
  Clock01Icon,
  BookOpen01Icon,
  TrophyIcon,
  Idea01Icon,
} from '@hugeicons/core-free-icons';
import { StudyItem } from '../../types';
import { SourceAttribution } from './SourceAttribution';
import { PlatformPressable } from '../common/PlatformPressable';
import { ConfirmationModal } from '../common/ConfirmationModal';
import { SmoothScrollView } from '../common/SmoothScrollView';
import { syncEngine } from '../../lib/sync/syncEngine';

interface Props {
  items: StudyItem[];
  isExamMode?: boolean;
  onFinish?: (score: { correct: number; total: number }) => void;
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

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

export const QuizRunner: React.FC<Props> = ({ items, isExamMode = false, onFinish }) => {
  const insets = useSafeAreaInsets();
  const isAndroid = Platform.OS === 'android';
  const bottomPadding = Math.max(insets.bottom, isAndroid ? 28 : 16) + 16;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [typedAnswer, setTypedAnswer] = useState<string>('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isAnswerRevealed, setIsAnswerRevealed] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [score, setScore] = useState(0);

  // Timed Exam State
  const initialTime = items ? items.length * 60 : 300; // 60s per question
  const [timeLeft, setTimeLeft] = useState(initialTime);
  const [isExamFinished, setIsExamFinished] = useState(false);
  const [showEndExamModal, setShowEndExamModal] = useState(false);
  const [examAnswers, setExamAnswers] = useState<
    Record<
      number,
      {
        userAnswer: string;
        isCorrect: boolean;
        selectedOption: string | null;
      }
    >
  >({});
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isExamMode || isExamFinished) return;

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          handleFinishExam();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isExamMode, isExamFinished]);

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
  const progressPercent = Math.round(((currentIndex + 1) / items.length) * 100);

  const checkIsCorrect = (userAns: string, item: StudyItem): boolean => {
    if (!userAns.trim()) return false;
    if (item.type === 'multiple_choice' || item.type === 'true_false') {
      return userAns.toLowerCase() === item.answer.toLowerCase();
    }
    return userAns.toLowerCase().includes(item.answer.toLowerCase());
  };

  // Practice Quiz Submit
  const handleSubmit = (revealOnly = false) => {
    const userAnswer = selectedOption || typedAnswer.trim();
    const isCorrect = !revealOnly && checkIsCorrect(userAnswer, currentItem);

    if (isCorrect) {
      setScore((s) => s + 1);
    }

    syncEngine.recordStudyAnswer(
      currentItem.id,
      isCorrect ? 'correct' : 'incorrect',
      userAnswer || '(Answer Revealed)'
    );

    setIsAnswerRevealed(revealOnly);
    setShowExplanation(revealOnly);
    setIsSubmitted(true);
  };

  const handleNext = () => {
    if (isLast) {
      if (onFinish) {
        onFinish({ correct: score, total: items.length });
      }
    } else {
      setCurrentIndex((prev) => prev + 1);
      setSelectedOption(null);
      setTypedAnswer('');
      setIsSubmitted(false);
      setIsAnswerRevealed(false);
      setShowExplanation(false);
      setShowHint(false);
    }
  };

  // Timed Exam: Next question & record answer
  const handleExamNext = () => {
    const userAnswer = selectedOption || typedAnswer.trim();
    const isCorrect = checkIsCorrect(userAnswer, currentItem);

    const updatedAnswers = {
      ...examAnswers,
      [currentIndex]: {
        userAnswer: userAnswer || 'Unanswered',
        isCorrect,
        selectedOption,
      },
    };
    setExamAnswers(updatedAnswers);

    if (isCorrect) {
      setScore((s) => s + 1);
    }

    syncEngine.recordStudyAnswer(
      currentItem.id,
      isCorrect ? 'correct' : 'incorrect',
      userAnswer || 'Unanswered'
    );

    if (isLast) {
      handleFinishExam();
    } else {
      setCurrentIndex((prev) => prev + 1);
      const nextAns = updatedAnswers[currentIndex + 1];
      if (nextAns) {
        setSelectedOption(nextAns.selectedOption);
        setTypedAnswer(nextAns.userAnswer === 'Unanswered' ? '' : nextAns.userAnswer);
      } else {
        setSelectedOption(null);
        setTypedAnswer('');
      }
      setShowHint(false);
    }
  };

  const handleFinishExam = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsExamFinished(true);
  };

  const handleConfirmEndExam = () => {
    setShowEndExamModal(false);
    const userAnswer = selectedOption || typedAnswer.trim();
    if (userAnswer && !examAnswers[currentIndex]) {
      const isCorrect = checkIsCorrect(userAnswer, currentItem);
      if (isCorrect) setScore((s) => s + 1);
      setExamAnswers((prev) => ({
        ...prev,
        [currentIndex]: {
          userAnswer,
          isCorrect,
          selectedOption,
        },
      }));
    }
    handleFinishExam();
  };

  const answeredCount =
    Object.keys(examAnswers).length + (selectedOption || typedAnswer.trim() ? 1 : 0);
  const remainingCount = Math.max(0, items.length - answeredCount);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // ----------------------------------------------------
  // Timed Exam: Post-Exam Review Screen ("Show Answers")
  // ----------------------------------------------------
  if (isExamMode && isExamFinished) {
    const totalQuestions = items.length;
    const finalScore = score;
    const percent = Math.round((finalScore / totalQuestions) * 100);
    const isMastered = percent >= 70;

    return (
      <SmoothScrollView
        contentContainerStyle={[styles.examReviewContainer, { paddingBottom: bottomPadding + 20 }]}
      >
        {/* Score & Mastery Header */}
        <View style={styles.examScoreCard}>
          <View style={[styles.examBadgeCircle, isMastered ? styles.trophyBg : styles.bookBg]}>
            <HugeiconsIcon
              icon={isMastered ? TrophyIcon : BookOpen01Icon}
              size={36}
              color={isMastered ? '#D97706' : '#4F46E5'}
              strokeWidth={2}
            />
          </View>
          <Text style={styles.examResultTitle}>Exam Completed</Text>
          <Text style={styles.examScoreValue}>
            {finalScore} / {totalQuestions} Correct
          </Text>
          <Text style={styles.examPercentValue}>{percent}% Score</Text>

          <View style={styles.examMetricsRow}>
            <View style={styles.examMetricPill}>
              <HugeiconsIcon icon={Clock01Icon} size={14} color="#64748B" strokeWidth={2} />
              <Text style={styles.examMetricText}>
                Time Remaining: {formatTimer(timeLeft)}
              </Text>
            </View>
          </View>
        </View>

        {/* Detailed Show Answers Section Header */}
        <View style={styles.reviewSectionHeader}>
          <View style={styles.reviewHeaderTitleRow}>
            <HugeiconsIcon icon={EyeIcon} size={20} color="#4F46E5" strokeWidth={2.2} />
            <Text style={styles.reviewSectionTitle}>Exam Answers & Explanations</Text>
          </View>
          <Text style={styles.reviewSectionSubtitle}>
            Review the questions, your responses, prominent correct answers, and concept connections.
          </Text>
        </View>

        {/* All Questions with Prominent Show Answers */}
        {items.map((item, idx) => {
          const userRecord = examAnswers[idx];
          const answered = Boolean(userRecord && userRecord.userAnswer !== 'Unanswered');
          const isCorrect = userRecord?.isCorrect ?? false;

          return (
            <View key={idx} style={styles.reviewQuestionCard}>
              <View style={styles.reviewCardTopRow}>
                <Text style={styles.reviewQuestionNumber}>Question {idx + 1}</Text>
                <View
                  style={[
                    styles.reviewStatusBadge,
                    !answered
                      ? styles.badgeUnanswered
                      : isCorrect
                      ? styles.badgeCorrect
                      : styles.badgeWrong,
                  ]}
                >
                  <Text
                    style={[
                      styles.reviewStatusText,
                      !answered
                        ? styles.textUnanswered
                        : isCorrect
                        ? styles.textCorrect
                        : styles.textWrong,
                    ]}
                  >
                    {!answered ? 'UNANSWERED' : isCorrect ? 'CORRECT' : 'INCORRECT'}
                  </Text>
                </View>
              </View>

              {/* Question Text */}
              <Text style={styles.reviewQuestionText}>{item.question}</Text>

              {/* User Answer vs Grounded Correct Answer */}
              <View style={styles.answerComparisonBox}>
                <View style={styles.userChoiceRow}>
                  <Text style={styles.userChoiceLabel}>Your Answer:</Text>
                  <Text
                    style={[
                      styles.userChoiceText,
                      isCorrect ? styles.userChoiceCorrect : styles.userChoiceIncorrect,
                    ]}
                  >
                    {userRecord?.userAnswer || '(No answer provided)'}
                  </Text>
                </View>

                {/* Prominent Correct Answer Box */}
                <View style={styles.prominentCorrectCard}>
                  <View style={styles.correctBadgeRow}>
                    <HugeiconsIcon
                      icon={CheckmarkCircle02Icon}
                      size={14}
                      color="#047857"
                      strokeWidth={2.4}
                    />
                    <Text style={styles.correctBadgeLabel}>CORRECT ANSWER</Text>
                  </View>
                  <Text style={styles.prominentCorrectText}>{item.answer}</Text>
                </View>
              </View>

              {/* Explicit Concept Connection & Explanation */}
              {item.explanation ? (
                <View style={styles.reviewConnectionCard}>
                  <View style={styles.reviewConnectionHeader}>
                    <HugeiconsIcon icon={BookOpen01Icon} size={14} color="#4F46E5" strokeWidth={2} />
                    <Text style={styles.reviewConnectionLabel}>KEY EXPLANATION & RELEVANCE</Text>
                  </View>
                  <Text style={styles.reviewExplanationText}>{item.explanation}</Text>
                </View>
              ) : null}

              {/* Source Grounding */}
              <SourceAttribution source={item.source_metadata} />
            </View>
          );
        })}

        {/* Complete Review Button */}
        <View style={styles.finishExamBtnWrapper}>
          <PlatformPressable
            style={styles.primaryBtn}
            onPress={() => onFinish?.({ correct: score, total: items.length })}
          >
            <View style={styles.btnContent}>
              <Text style={styles.primaryBtnText}>Finish Review</Text>
              <HugeiconsIcon icon={ArrowRight01Icon} size={18} color="#FFFFFF" strokeWidth={2.4} />
            </View>
          </PlatformPressable>
        </View>
      </SmoothScrollView>
    );
  }

  // ----------------------------------------------------
  // Active Question View (Practice Quiz & Timed Exam)
  // ----------------------------------------------------
  return (
    <>
      <SmoothScrollView
        contentContainerStyle={[styles.container, { paddingBottom: bottomPadding }]}
      >
      {/* Header: Timer (Exam) or Score (Quiz) */}
      <View style={styles.header}>
        <View style={styles.progressCol}>
          <Text style={styles.progressText}>
            Question {currentIndex + 1} of {items.length}
          </Text>
          <View style={styles.miniProgressBar}>
            <View style={[styles.miniProgressFill, { width: `${progressPercent}%` }]} />
          </View>
        </View>

        {isExamMode ? (
          <View style={[styles.timerBadge, timeLeft <= 60 && styles.timerBadgeWarning]}>
            <HugeiconsIcon
              icon={Clock01Icon}
              size={15}
              color={timeLeft <= 60 ? '#DC2626' : '#4F46E5'}
              strokeWidth={2.2}
            />
            <Text style={[styles.timerText, timeLeft <= 60 && styles.timerTextWarning]}>
              {formatTimer(timeLeft)}
            </Text>
          </View>
        ) : (
          <View style={styles.scoreBadge}>
            <Text style={styles.scoreLabel}>Score</Text>
            <Text style={styles.scoreText}>{score}</Text>
          </View>
        )}
      </View>

      {/* Question Card */}
      <View style={styles.card}>
        <View style={styles.questionTypeTag}>
          <Text style={styles.questionTypeTagText}>
            {currentItem.type === 'true_false'
              ? 'TRUE / FALSE'
              : currentItem.type === 'multiple_choice'
              ? 'MULTIPLE CHOICE'
              : 'IDENTIFICATION'}
          </Text>
        </View>

        <Text style={styles.questionText}>{currentItem.question}</Text>

        {/* Options for MCQ / True False */}
        {options.length > 0 ? (
          <View style={styles.optionsList}>
            {options.map((opt, idx) => {
              const isSelected = selectedOption === opt;
              const letter = OPTION_LETTERS[idx] || `${idx + 1}`;

              let cardStyle: StyleProp<ViewStyle> = styles.optionBtn;
              let letterStyle: StyleProp<ViewStyle> = styles.optionLetter;
              let letterTextStyle: StyleProp<TextStyle> = styles.optionLetterText;
              let textStyle: StyleProp<TextStyle> = styles.optionText;

              if (!isExamMode && isSubmitted) {
                if (opt.toLowerCase() === currentItem.answer.toLowerCase()) {
                  cardStyle = styles.correctOptionBtn;
                  letterStyle = styles.correctOptionLetter;
                  letterTextStyle = styles.correctOptionLetterText;
                  textStyle = styles.correctOptionText;
                } else if (isSelected) {
                  cardStyle = styles.wrongOptionBtn;
                  letterStyle = styles.wrongOptionLetter;
                  letterTextStyle = styles.wrongOptionLetterText;
                  textStyle = styles.wrongOptionText;
                }
              } else if (isSelected) {
                cardStyle = styles.selectedOptionBtn;
                letterStyle = styles.selectedOptionLetter;
                letterTextStyle = styles.selectedOptionLetterText;
                textStyle = styles.selectedOptionText;
              }

              return (
                <TouchableOpacity
                  key={idx}
                  style={cardStyle}
                  disabled={!isExamMode && isSubmitted}
                  onPress={() => setSelectedOption(opt)}
                  activeOpacity={0.7}
                >
                  <View style={letterStyle}>
                    <Text style={letterTextStyle}>{letter}</Text>
                  </View>
                  <Text style={textStyle}>{opt}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          /* Text input for Identification / Fill in the blank */
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.textInput}
              placeholder="Type your answer here..."
              placeholderTextColor="#94A3B8"
              value={typedAnswer}
              onChangeText={setTypedAnswer}
              editable={isExamMode || !isSubmitted}
              autoCapitalize="none"
              autoCorrect={false}
            />

            {/* Identification Active Recall Hint */}
            <TouchableOpacity
              style={[styles.hintTriggerBtn, showHint && styles.hintTriggerBtnActive]}
              onPress={() => setShowHint((prev) => !prev)}
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
              const detail = currentItem.hint || (currentItem.source_metadata?.section ? `Topic section: ${currentItem.source_metadata.section}` : `First letter starts with "${currentItem.answer.trim()[0]?.toUpperCase()}"`);
              return (
                <View style={styles.hintCard}>
                  <View style={styles.hintCardHeader}>
                    <View style={styles.hintBadge}>
                      <HugeiconsIcon icon={Idea01Icon} size={13} color="#D97706" strokeWidth={2.4} />
                      <Text style={styles.hintBadgeText}>ACTIVE RECALL CLUE</Text>
                    </View>
                    <Text style={styles.hintStructureSummary}>{clue.summary}</Text>
                  </View>

                  {/* Masked Letter Skeleton */}
                  <View style={styles.maskedSkeletonBox}>
                    <Text style={styles.maskedSkeletonText}>{clue.masked}</Text>
                  </View>

                  {/* Conceptual or Section Clue */}
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

        {/* Practice Quiz: Prominent Visible Feedback after Submit or "Show Answer" */}
        {!isExamMode && isSubmitted && (() => {
          const userAnswer = selectedOption || typedAnswer.trim();
          const isCorrect = !isAnswerRevealed && checkIsCorrect(userAnswer, currentItem);

          return (
            <View style={styles.feedbackContainer}>
              {/* Feedback Banner */}
              <View
                style={[
                  styles.feedbackBanner,
                  isCorrect ? styles.bannerCorrect : styles.bannerRevealed,
                ]}
              >
                <HugeiconsIcon
                  icon={isCorrect ? CheckmarkCircle02Icon : isAnswerRevealed ? EyeIcon : Cancel01Icon}
                  size={20}
                  color={isCorrect ? '#059669' : isAnswerRevealed ? '#D97706' : '#DC2626'}
                  strokeWidth={2.4}
                />
                <Text
                  style={[
                    styles.bannerTitle,
                    isCorrect
                      ? styles.bannerTitleCorrect
                      : isAnswerRevealed
                      ? styles.bannerTitleRevealed
                      : styles.bannerTitleWrong,
                  ]}
                >
                  {isCorrect
                    ? 'Correct! Great Work'
                    : isAnswerRevealed
                    ? 'Answer Revealed'
                    : 'Incorrect'}
                </Text>
              </View>

              {/* Trigger Button: Show / Hide Explanation & Grounded Answer */}
              <TouchableOpacity
                style={[
                  styles.explanationTriggerBtn,
                  showExplanation && styles.explanationTriggerBtnActive,
                ]}
                onPress={() => setShowExplanation((prev) => !prev)}
                activeOpacity={0.75}
              >
                <View style={styles.explanationTriggerLeft}>
                  <View style={styles.explanationTriggerIconBox}>
                    <HugeiconsIcon
                      icon={BookOpen01Icon}
                      size={15}
                      color="#4F46E5"
                      strokeWidth={2.2}
                    />
                  </View>
                  <Text style={styles.explanationTriggerText}>
                    {showExplanation
                      ? 'Hide Explanation & Grounded Answer'
                      : 'Show Explanation & Grounded Answer'}
                  </Text>
                </View>
                <HugeiconsIcon
                  icon={showExplanation ? ArrowUp01Icon : ArrowDown01Icon}
                  size={15}
                  color="#4F46E5"
                  strokeWidth={2.4}
                />
              </TouchableOpacity>

              {/* Only revealed when triggered by user */}
              {showExplanation && (
                <View style={styles.revealedSection}>
                  {/* Prominent Correct Answer Card */}
                  <View style={styles.prominentAnswerCard}>
                    <View style={styles.prominentHeader}>
                      <View style={styles.prominentBadge}>
                        <HugeiconsIcon
                          icon={CheckmarkCircle02Icon}
                          size={14}
                          color="#047857"
                          strokeWidth={2.4}
                        />
                        <Text style={styles.prominentBadgeText}>GROUNDED ANSWER</Text>
                      </View>
                    </View>
                    <Text style={styles.prominentAnswerText}>{currentItem.answer}</Text>

                    {!isCorrect && userAnswer ? (
                      <View style={styles.userMistakeRow}>
                        <Text style={styles.userMistakeLabel}>Your selection: </Text>
                        <Text style={styles.userMistakeText}>{userAnswer}</Text>
                      </View>
                    ) : null}
                  </View>

                  {/* Explicit Concept Relevance & Connection */}
                  {currentItem.explanation ? (
                    <View style={styles.connectionCard}>
                      <View style={styles.connectionHeader}>
                        <HugeiconsIcon icon={BookOpen01Icon} size={15} color="#4F46E5" strokeWidth={2} />
                        <Text style={styles.connectionLabel}>KEY EXPLANATION & RELEVANCE</Text>
                      </View>
                      <Text style={styles.connectionExplanationText}>{currentItem.explanation}</Text>
                    </View>
                  ) : null}

                  {/* Source Grounding */}
                  <SourceAttribution source={currentItem.source_metadata} defaultExpanded={true} />
                </View>
              )}
            </View>
          );
        })()}
      </View>

      {/* Action Footer */}
      <View style={styles.footer}>
        {isExamMode ? (() => {
          const hasAnswered = Boolean(selectedOption || typedAnswer.trim());
          return (
            /* Timed Exam mode: Next Question + Compact End Exam button side-by-side */
            <View style={styles.examActionRow}>
              <TouchableOpacity
                style={styles.endExamCompactBtn}
                onPress={() => setShowEndExamModal(true)}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel="End exam early"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <View style={styles.endExamIconCircle}>
                  <HugeiconsIcon icon={Cancel01Icon} size={12} color="#DC2626" strokeWidth={2.8} />
                </View>
                <Text style={styles.endExamCompactText}>End Exam</Text>
              </TouchableOpacity>

              <PlatformPressable
                style={[
                  styles.primaryBtn,
                  styles.examNextBtnFlex,
                  !hasAnswered && styles.disabledBtn,
                ]}
                disabled={!hasAnswered}
                onPress={handleExamNext}
              >
                <View style={styles.btnContent}>
                  <Text style={[styles.primaryBtnText, !hasAnswered && styles.disabledBtnText]}>
                    {isLast ? 'Complete Exam' : 'Next Question'}
                  </Text>
                  <HugeiconsIcon
                    icon={ArrowRight01Icon}
                    size={18}
                    color={hasAnswered ? '#FFFFFF' : '#94A3B8'}
                    strokeWidth={2.4}
                  />
                </View>
              </PlatformPressable>
            </View>
          );
        })() : !isSubmitted ? (
          /* Practice Quiz: Submit or Show Answer */
          <View style={styles.quizActionRow}>
            <TouchableOpacity
              style={styles.showAnswerBtn}
              onPress={() => handleSubmit(true)}
              activeOpacity={0.8}
            >
              <HugeiconsIcon icon={EyeIcon} size={18} color="#4F46E5" strokeWidth={2.2} />
              <Text style={styles.showAnswerBtnText}>Show Answer</Text>
            </TouchableOpacity>

            <PlatformPressable
              style={[
                styles.primaryBtn,
                styles.submitBtnFlex,
                !selectedOption && !typedAnswer.trim() && styles.disabledBtn,
              ]}
              disabled={!selectedOption && !typedAnswer.trim()}
              onPress={() => handleSubmit(false)}
            >
              <View style={styles.btnContent}>
                <Text style={styles.primaryBtnText}>Submit</Text>
              </View>
            </PlatformPressable>
          </View>
        ) : (
          /* Practice Quiz: Next Question */
          <PlatformPressable style={styles.primaryBtn} onPress={handleNext}>
            <View style={styles.btnContent}>
              <Text style={styles.primaryBtnText}>
                {isLast ? 'View Final Results' : 'Next Question'}
              </Text>
              <HugeiconsIcon icon={ArrowRight01Icon} size={18} color="#FFFFFF" strokeWidth={2.4} />
            </View>
          </PlatformPressable>
        )}
      </View>
    </SmoothScrollView>

    {/* End Exam Modal featuring Momo Thinking/Guessing */}
    {isExamMode && (
      <ConfirmationModal
        visible={showEndExamModal}
        icon="thinking"
        title="End Exam Early?"
        message="Momo is wondering if you're ready to submit! Any unanswered questions will be graded as unanswered."
        confirmText="End & Review"
        cancelText="Keep Going"
        isDestructive={true}
        onConfirm={handleConfirmEndExam}
        onCancel={() => setShowEndExamModal(false)}
        extraContent={
          <View style={styles.examModalStatsCard}>
            <View style={styles.examModalStatItem}>
              <Text style={styles.examModalStatVal}>{answeredCount}</Text>
              <Text style={styles.examModalStatLbl}>Answered</Text>
            </View>
            <View style={styles.examModalDivider} />
            <View style={styles.examModalStatItem}>
              <Text
                style={[
                  styles.examModalStatVal,
                  remainingCount > 0 && styles.examModalStatValWarn,
                ]}
              >
                {remainingCount}
              </Text>
              <Text style={styles.examModalStatLbl}>Remaining</Text>
            </View>
            <View style={styles.examModalDivider} />
            <View style={styles.examModalStatItem}>
              <Text style={styles.examModalStatVal}>{formatTimer(timeLeft)}</Text>
              <Text style={styles.examModalStatLbl}>Time Left</Text>
            </View>
          </View>
        }
      />
    )}
  </>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    flexGrow: 1,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  progressCol: {
    flex: 1,
    marginRight: 14,
  },
  progressHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  progressText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  examActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '100%',
  },
  endExamCompactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: '#FEF2F2',
    borderWidth: 1.5,
    borderColor: '#FECACA',
    ...Platform.select({
      ios: {
        shadowColor: '#DC2626',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
      },
      android: {
        elevation: 1.5,
      },
    }),
  },
  endExamIconCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  endExamCompactText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#DC2626',
    letterSpacing: -0.1,
    includeFontPadding: false,
  },
  examNextBtnFlex: {
    flex: 1,
  },
  examModalStatsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    width: '100%',
  },
  examModalStatItem: {
    alignItems: 'center',
    flex: 1,
  },
  examModalStatVal: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    fontVariant: ['tabular-nums'],
  },
  examModalStatValWarn: {
    color: '#D97706',
  },
  examModalStatLbl: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },
  examModalDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E2E8F0',
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
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E7FF',
  },
  timerBadgeWarning: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FECACA',
  },
  timerText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#4F46E5',
    fontVariant: ['tabular-nums'],
  },
  timerTextWarning: {
    color: '#DC2626',
  },
  scoreBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  scoreLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4F46E5',
  },
  scoreText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#4F46E5',
  },
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
  questionTypeTag: {
    alignSelf: 'flex-start',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 12,
  },
  questionTypeTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.5,
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
  optionLetter: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  optionLetterText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  optionText: {
    fontSize: 15,
    color: '#334155',
    fontWeight: '500',
    flex: 1,
  },
  selectedOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#4F46E5',
    backgroundColor: '#EEF2FF',
  },
  selectedOptionLetter: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  selectedOptionLetterText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  selectedOptionText: {
    fontSize: 15,
    color: '#4F46E5',
    fontWeight: '700',
    flex: 1,
  },
  correctOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#059669',
    backgroundColor: '#ECFDF5',
  },
  correctOptionLetter: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  correctOptionLetterText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  correctOptionText: {
    fontSize: 15,
    color: '#065F46',
    fontWeight: '700',
    flex: 1,
  },
  wrongOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#DC2626',
    backgroundColor: '#FEF2F2',
  },
  wrongOptionLetter: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  wrongOptionLetterText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  wrongOptionText: {
    fontSize: 15,
    color: '#991B1B',
    fontWeight: '700',
    flex: 1,
  },
  inputContainer: {
    marginBottom: 12,
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
  feedbackContainer: {
    marginTop: 20,
  },
  feedbackBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
    borderWidth: 1,
  },
  bannerCorrect: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  bannerRevealed: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  bannerTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  bannerTitleCorrect: {
    color: '#065F46',
  },
  bannerTitleRevealed: {
    color: '#B45309',
  },
  bannerTitleWrong: {
    color: '#991B1B',
  },
  explanationTriggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#EEF2FF',
    borderWidth: 1.5,
    borderColor: '#C7D2FE',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  explanationTriggerBtnActive: {
    backgroundColor: '#E0E7FF',
    borderColor: '#818CF8',
  },
  explanationTriggerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  explanationTriggerIconBox: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E0E7FF',
  },
  explanationTriggerText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4338CA',
  },
  revealedSection: {
    marginTop: 4,
  },
  prominentAnswerCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#86EFAC',
    marginBottom: 12,
  },
  prominentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  prominentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  prominentBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#047857',
    letterSpacing: 0.5,
  },
  prominentAnswerText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#064E3B',
    lineHeight: 24,
  },
  userMistakeRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#A7F3D0',
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  userMistakeLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  userMistakeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#DC2626',
  },
  connectionCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 14,
    borderLeftWidth: 3.5,
    borderLeftColor: '#4F46E5',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  connectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  connectionLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#4F46E5',
    letterSpacing: 0.5,
  },
  connectionExplanationText: {
    fontSize: 13.5,
    color: '#334155',
    lineHeight: 20,
  },
  footer: {
    marginBottom: 12,
  },
  quizActionRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  showAnswerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#C7D2FE',
    backgroundColor: '#EEF2FF',
  },
  showAnswerBtnText: {
    color: '#4F46E5',
    fontSize: 15,
    fontWeight: '700',
  },
  submitBtnFlex: {
    flex: 1,
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
    paddingVertical: 14,
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
    fontWeight: '700',
    letterSpacing: -0.2,
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
  // Timed Exam Review Styles
  // -------------------------
  examReviewContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  examScoreCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 24,
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
  examBadgeCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  trophyBg: {
    backgroundColor: '#FEF3C7',
  },
  bookBg: {
    backgroundColor: '#EEF2FF',
  },
  examResultTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  examScoreValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 4,
  },
  examPercentValue: {
    fontSize: 28,
    fontWeight: '900',
    color: '#4F46E5',
    marginBottom: 12,
  },
  examMetricsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  examMetricPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  examMetricText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  reviewSectionHeader: {
    marginBottom: 16,
  },
  reviewHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  reviewSectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  reviewSectionSubtitle: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
  },
  reviewQuestionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
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
  reviewCardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  reviewQuestionNumber: {
    fontSize: 13,
    fontWeight: '800',
    color: '#475569',
  },
  reviewStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeCorrect: {
    backgroundColor: '#D1FAE5',
  },
  badgeWrong: {
    backgroundColor: '#FEE2E2',
  },
  badgeUnanswered: {
    backgroundColor: '#F1F5F9',
  },
  reviewStatusText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  textCorrect: {
    color: '#047857',
  },
  textWrong: {
    color: '#B91C1C',
  },
  textUnanswered: {
    color: '#64748B',
  },
  reviewQuestionText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    lineHeight: 23,
    marginBottom: 14,
  },
  answerComparisonBox: {
    marginBottom: 12,
    gap: 8,
  },
  userChoiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 10,
  },
  userChoiceLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  userChoiceText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  userChoiceCorrect: {
    color: '#047857',
  },
  userChoiceIncorrect: {
    color: '#DC2626',
  },
  prominentCorrectCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#86EFAC',
  },
  correctBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 6,
  },
  correctBadgeLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#047857',
    letterSpacing: 0.5,
  },
  prominentCorrectText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#064E3B',
    lineHeight: 22,
  },
  reviewConnectionCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    borderLeftWidth: 3.5,
    borderLeftColor: '#4F46E5',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10,
  },
  reviewConnectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  reviewConnectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#4F46E5',
    letterSpacing: 0.5,
  },
  reviewExplanationText: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 19,
  },
  finishExamBtnWrapper: {
    marginTop: 8,
    marginBottom: 24,
  },
});
