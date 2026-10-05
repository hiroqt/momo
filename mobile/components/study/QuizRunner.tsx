import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { AppState, Image, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useIsFocused, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText as Text, AppTextInput as TextInput } from '@/components/common/app-text';
import { StudyIcon } from '@/components/common/StudyIcon';
import { useOnboardingReducedMotion } from '@/components/onboarding/useOnboardingReducedMotion';
import { MomoAnimation } from '@/components/mascot/MomoAnimation';
import { colors } from '@/constants/theme';
import { useCredits } from '@/context/CreditsContext';
import { syncEngine } from '@/lib/sync/syncEngine';
import { claimQuizReveal, commitQuizAnswer, correctQuizAnswer, feedbackScrollOffset, nextPendingQuestion, quizOptions, summarizeQuiz, type QuizAnswers } from '@/lib/study/quizSession';
import { sanitizeQuestionText } from '@/utils/formatters';
import type { StudyItem } from '@/types';
import { SourceAttribution } from './SourceAttribution';
import { AcademicWeaponShareModal } from '../social/AcademicWeaponShareModal';
import { InstagramStoryButton } from '../social/InstagramStoryButton';
export { getQuestionXP } from '@/lib/study/quizSession';

interface Props {
  items: StudyItem[];
  title?: string;
  isExamMode?: boolean;
  timeLimitPerQuestion?: number;
  onFinish?: (score: { correct: number; total: number; xp: number }) => void;
  onRestart?: () => void;
}
export interface QuizRunnerRef { showOverview: () => void }

export const QuizRunner = forwardRef<QuizRunnerRef, Props>(function QuizRunner({ items, title, isExamMode, timeLimitPerQuestion, onFinish, onRestart }, ref) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const reducedMotion = useOnboardingReducedMotion();
  const mainScrollRef = useRef<ScrollView>(null);
  const scrollYRef = useRef(0);
  const viewportHeightRef = useRef(0);
  const pendingFeedbackRef = useRef<number | null>(null);
  const { hearts, addXP, deductHeart, deductCredits } = useCredits();
  const [index, setIndex] = useState(0);
  const [draft, setDraft] = useState('');
  const [answers, setAnswers] = useState<QuizAnswers>({});
  const answerRef = useRef<QuizAnswers>({});
  const [revealed, setRevealed] = useState(false);
  const revealedRef = useRef(false);
  const [showHint, setShowHint] = useState(false);
  const [finished, setFinished] = useState(false);
  const finishRef = useRef(false);
  const [overview, setOverview] = useState(false);
  const [share, setShare] = useState(false);
  const reviewScrollRef = useRef<ScrollView>(null);
  const reviewPositionsRef = useRef<Record<number, number>>({});
  const [reviewTarget, setReviewTarget] = useState<number | null>(null);
  const [reviewFilter, setReviewFilter] = useState<'all' | 'missed'>('all');
  const [notice, setNotice] = useState('');
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const seconds = Number.isFinite(timeLimitPerQuestion) && (timeLimitPerQuestion ?? 0) > 0 ? Math.ceil(timeLimitPerQuestion!) : 0;
  const remainingRef = useRef<Record<number, number>>({});
  const [remaining, setRemaining] = useState(seconds);
  const item = items[index];
  const record = answers[index];
  const options = item ? quizOptions(item) : [];
  const score = summarizeQuiz(answers, items.length);
  const completion = items.length ? Object.keys(answers).length / items.length : 0;

  useImperativeHandle(ref, () => ({ showOverview: () => setOverview(true) }), []);
  useEffect(() => {
    const listener = AppState.addEventListener('change', state => setForeground(state === 'active'));
    return () => listener.remove();
  }, []);

  useEffect(() => {
    if (reviewTarget === null || !finished || overview) return;
    const frame = requestAnimationFrame(() => reviewScrollRef.current?.scrollTo({ y: reviewPositionsRef.current[reviewTarget] ?? 0, animated: false }));
    return () => cancelAnimationFrame(frame);
  }, [reviewTarget, reviewFilter, finished, overview]);

  useEffect(() => {
    if (finished) return;
    const frame = requestAnimationFrame(() => { mainScrollRef.current?.scrollTo({ y: 0, animated: false }); scrollYRef.current = 0; });
    return () => cancelAnimationFrame(frame);
  }, [index, finished]);

  function commit(answer: string, status?: 'timeout' | 'revealed' | 'skipped') {
    if (!item || finished || answerRef.current[index]) return;
    if (!status && !answer.trim()) return;
    if (hearts <= 0 && status !== 'skipped') { setNotice('You are out of hearts. Visit the shop to refill, or review your checked answers.'); return; }
    const previous = Object.values(answerRef.current).at(-1)?.streak ?? 0;
    const result = commitQuizAnswer(answerRef.current, index, item, answer.trim(), previous, status ?? (revealedRef.current ? 'revealed' : undefined));
    if (!result.committed) return;
    // Lock synchronously before React renders or any side effect runs.
    answerRef.current = result.answers;
    pendingFeedbackRef.current = index;
    Keyboard.dismiss();
    setAnswers(result.answers);
    if (result.record.xp) addXP(result.record.xp);
    if (result.record.heartCost) deductHeart();
    if (status !== 'skipped') {
      void syncEngine.recordStudyAnswer(item.id, result.record.status === 'correct' ? 'correct' : 'incorrect', status === 'timeout' ? '(Time Expired)' : result.record.status === 'revealed' ? `(Answer Revealed: ${item.answer})` : answer.trim()).catch(() => setNotice('This answer could not be saved on your device. Your session result is still shown here.'));
    }
  }

  useEffect(() => {
    if (!seconds || !item || record || finished || !focused || !foreground || overview || hearts <= 0) return;
    remainingRef.current[index] ??= seconds * 1000;
    setRemaining(Math.ceil(remainingRef.current[index] / 1000));
    let lastTick = Date.now();
    const ticker = setInterval(() => {
      const now = Date.now();
      remainingRef.current[index] = Math.max(0, remainingRef.current[index] - (now - lastTick));
      lastTick = now;
      setRemaining(Math.ceil(remainingRef.current[index] / 1000));
      if (remainingRef.current[index] === 0) { clearInterval(ticker); commit('', 'timeout'); }
    }, 200);
    return () => clearInterval(ticker);
  }, [index, seconds, !!record, finished, focused, foreground, overview, hearts]);

  function openQuestion(next: number) {
    if (next < 0 || next >= items.length) return;
    pendingFeedbackRef.current = null;
    mainScrollRef.current?.scrollTo({ y: 0, animated: false });
    scrollYRef.current = 0;
    setIndex(next);
    setDraft(answerRef.current[next]?.answer ?? '');
    revealedRef.current = false;
    setRevealed(false);
    setShowHint(false);
    setRemaining(Math.ceil((remainingRef.current[next] ?? seconds * 1000) / 1000));
    setNotice('');
    setOverview(false);
  }

  function next() {
    if (!answerRef.current[index]) return;
    const pending = nextPendingQuestion(answerRef.current, index, items.length);
    if (pending !== null) { openQuestion(pending); return; }
    if (finishRef.current) return;
    finishRef.current = true;
    setFinished(true);
    onFinish?.(summarizeQuiz(answerRef.current, items.length));
  }

  function revealAnswer() {
    if (!item || answerRef.current[index]) return;
    const claim = claimQuizReveal(revealedRef, () => deductCredits(50));
    if (claim === 'locked') return;
    if (claim === 'insufficient') { setNotice('You need 50 coins to reveal an answer. A hint is free when your reviewer includes one.'); return; }
    setRevealed(true);
    setDraft(correctQuizAnswer(item));
    setNotice('Answer revealed. Checking it earns no XP and costs no heart.');
  }

  function restart() {
    answerRef.current = {};
    pendingFeedbackRef.current = null;
    mainScrollRef.current?.scrollTo({ y: 0, animated: false });
    scrollYRef.current = 0;
    finishRef.current = false;
    remainingRef.current = {};
    setAnswers({}); setIndex(0); setDraft(''); setRevealed(false); setShowHint(false);
    setFinished(false); setRemaining(seconds); setOverview(false); setNotice('');
    onRestart?.();
  }

  if (!items.length) return <View testID="quiz-empty" style={styles.empty}><MomoAnimation name="momo-reading" size={120} /><Text style={styles.title}>No quiz questions yet</Text><Text style={styles.body}>Choose a reviewer with questions, or create a quiz from your notes.</Text><Action label="Back to library" onPress={() => router.replace('/(tabs)/library')} /></View>;

  const overviewModal = <Modal visible={overview} transparent animationType={reducedMotion ? 'none' : 'fade'} onRequestClose={() => setOverview(false)}><View style={styles.overlay}><View style={[styles.modal, { paddingBottom: Math.max(insets.bottom, 20) }]}><Text style={styles.title}>{finished ? 'Session review' : 'Question overview'}</Text><Text style={styles.body}>{Object.keys(answers).length} of {items.length} checked. {seconds ? 'The timer pauses while you review this overview.' : 'Choose a question to review or answer.'}</Text><ScrollView contentContainerStyle={styles.overviewList}>{items.map((question, questionIndex) => { const answer = answers[questionIndex]; const locked = !!seconds && !finished && !answer && questionIndex !== index; return <Pressable key={`${question.id}-${questionIndex}`} testID={`quiz-overview-${questionIndex}`} accessibilityRole="button" accessibilityState={{ disabled: locked }} disabled={locked} onPress={() => { if (finished) { setReviewFilter('all'); setReviewTarget(questionIndex); setOverview(false); } else openQuestion(questionIndex); }} style={({ pressed }) => [styles.overviewRow, pressed && styles.pressed, locked && styles.disabled]}><Text style={styles.overviewNumber}>{questionIndex + 1}</Text><View style={styles.grow}><Text numberOfLines={2} style={styles.optionText}>{sanitizeQuestionText(question.question)}</Text><Text style={styles.caption}>{answer ? statusLabel(answer.status) : locked ? 'Upcoming' : 'Not checked'}</Text></View></Pressable>; })}</ScrollView><Action testID="quiz-close-overview" label="Close overview" onPress={() => setOverview(false)} /></View></View></Modal>;

  if (finished) return <ScrollView ref={reviewScrollRef} testID="quiz-results" contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 16) + 24 }]}>
    <View style={styles.resultHero}><MomoAnimation name={score.correct ? 'momo-proud' : 'momo-reading'} size={130} /><Text style={styles.eyebrow}>SESSION COMPLETE</Text><Text style={styles.title}>{score.correct === score.total ? 'You know your notes.' : 'Every try builds understanding.'}</Text><Text style={styles.body}>{score.correct} of {score.total} correct · {score.xp} XP earned</Text></View>
    <View style={styles.filterRow}>{(['all', 'missed'] as const).map(filter => <Pressable key={filter} testID={`quiz-review-${filter}`} accessibilityRole="button" accessibilityState={{ selected: reviewFilter === filter }} onPress={() => setReviewFilter(filter)} style={[styles.filter, reviewFilter === filter && styles.selectedFilter]}><Text style={styles.filterText}>{filter === 'all' ? 'All questions' : 'Needs practice'}</Text></Pressable>)}</View>
    {items.filter((_, i) => reviewFilter === 'all' || answers[i]?.status !== 'correct').length === 0 && <Text style={styles.body}>Nothing missed. Your careful practice paid off.</Text>}
    {items.map((question, questionIndex) => { const answer = answers[questionIndex]; if (reviewFilter === 'missed' && answer?.status === 'correct') return null; return <View key={`${question.id}-${questionIndex}`} style={styles.card} onLayout={event => { reviewPositionsRef.current[questionIndex] = event.nativeEvent.layout.y; }} testID={`quiz-review-card-${questionIndex}`}><Text style={styles.eyebrow}>QUESTION {questionIndex + 1} · {statusLabel(answer?.status ?? 'skipped')}</Text><Text selectable style={styles.question}>{sanitizeQuestionText(question.question)}</Text><Text style={styles.caption}>Your answer</Text><Text selectable style={styles.body}>{answer?.answer || 'No answer'}</Text><Text style={styles.caption}>Correct answer</Text><Text selectable style={styles.answer}>{correctQuizAnswer(question)}</Text>{!!question.explanation && <Text selectable style={styles.body}>{question.explanation}</Text>}<SourceAttribution source={question.source_metadata} /></View>; })}
    <InstagramStoryButton onPress={() => setShare(true)} />
    <Action testID="quiz-restart" label="Practice again" onPress={restart} secondary />
    <Action testID="quiz-back-library" label="Back to library" onPress={() => router.replace('/(tabs)/library')} />
    <AcademicWeaponShareModal visible={share} onClose={() => setShare(false)} inputData={{ mode: 'quiz', subject: title || 'Quiz session', accuracy: Math.round(score.correct / score.total * 100), correctCount: score.correct, totalQuestions: score.total, xpEarned: score.xp }} />
    {overviewModal}
  </ScrollView>;

  return <KeyboardAvoidingView testID="quiz-screen" style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView ref={mainScrollRef} onLayout={event => { viewportHeightRef.current = event.nativeEvent.layout.height; }} onScroll={event => { scrollYRef.current = event.nativeEvent.contentOffset.y; }} scrollEventThrottle={16} keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 16) + 24 }]}>
      <View style={styles.topRow}><View style={styles.grow}><Text style={styles.eyebrow}>{isExamMode ? 'PRACTICE EXAM' : 'ACTIVE RECALL'}</Text><Text style={styles.counter}>Question {index + 1} of {items.length}</Text></View><Pressable testID="quiz-overview" accessibilityRole="button" onPress={() => setOverview(true)} style={styles.overviewButton}><StudyIcon name="cards" size={32} /><Text style={styles.filterText}>Overview</Text></Pressable></View>
      <View style={styles.progress} accessibilityRole="progressbar" accessibilityLabel="Questions checked" accessibilityValue={{ min: 0, max: items.length, now: Object.keys(answers).length }}><View style={[styles.progressFill, { width: `${completion * 100}%` }]} /></View>
      <View style={styles.statsRow}><Text style={styles.caption}>{score.xp} XP earned</Text><Text style={styles.caption}>{hearts} hearts</Text>{!!seconds && <Text testID="quiz-timer" style={[styles.timer, remaining <= 5 && styles.urgent]}>{record ? 'Timer stopped' : `${remaining}s left`}</Text>}</View>
      <View style={styles.card} testID="quiz-question-card">
        <Text testID={`quiz-type-${item.type}`} style={styles.eyebrow}>{item.type.replace(/_/g, ' ')} · {item.difficulty}</Text>
        <Text testID="quiz-question" selectable style={styles.question}>{sanitizeQuestionText(item.question)}</Text>
        {!!item.image_base64 && <Image source={{ uri: `data:image/png;base64,${item.image_base64}` }} style={styles.questionImage} resizeMode="contain" accessibilityLabel="Question illustration" />}
        {options.length ? <View style={styles.options}>{options.map((option, optionIndex) => { const selected = draft === option; const correct = record && option === correctQuizAnswer(item); const wrong = record && selected && record.status !== 'correct'; return <Pressable key={`${optionIndex}-${option}`} testID={`quiz-option-${optionIndex}`} accessibilityRole="radio" accessibilityLabel={option} accessibilityState={{ selected, disabled: !!record || revealed }} disabled={!!record || revealed} onPress={() => setDraft(option)} style={({ pressed }) => [styles.option, selected && styles.selectedOption, correct && styles.correctOption, wrong && styles.wrongOption, pressed && styles.pressed]}><View style={[styles.optionLetter, selected && styles.selectedLetter]}><Text style={[styles.letter, selected && styles.selectedLetterText]}>{item.type === 'true_false' ? optionIndex === 0 ? 'T' : 'F' : String.fromCharCode(65 + optionIndex)}</Text></View><Text style={styles.optionText}>{option}</Text></Pressable>; })}</View> : <TextInput testID="quiz-answer-input" accessibilityLabel="Your answer" style={styles.input} placeholder="Type your answer" placeholderTextColor={colors.textMuted} value={draft} onChangeText={setDraft} editable={!record && !revealed} autoCorrect={false} multiline />}
        {!record && <View style={styles.helpRow}>{item.hint && <Pressable accessibilityRole="button" testID="quiz-hint" onPress={() => setShowHint(value => !value)} style={styles.helpButton}><Text style={styles.helpText}>{showHint ? 'Hide hint' : 'Show hint'}</Text></Pressable>}<Pressable accessibilityRole="button" testID="quiz-reveal" disabled={revealed} accessibilityState={{ disabled: revealed }} onPress={revealAnswer} style={styles.helpButton}><Text style={styles.helpText}>{revealed ? 'Answer revealed' : `Reveal · 50 coins`}</Text></Pressable></View>}
        {showHint && item.hint && <Text style={styles.hint}>{item.hint}</Text>}
      </View>
      {record && <View testID="quiz-feedback" onLayout={event => {
        if (pendingFeedbackRef.current !== index) return;
        pendingFeedbackRef.current = null;
        const layout = event.nativeEvent.layout;
        const target = feedbackScrollOffset(layout.y, layout.height, scrollYRef.current, viewportHeightRef.current);
        if (target !== null) requestAnimationFrame(() => mainScrollRef.current?.scrollTo({ y: target, animated: !reducedMotion }));
      }} style={[styles.feedback, record.status === 'correct' ? styles.correctFeedback : styles.retryFeedback]} accessibilityLiveRegion="polite"><View style={styles.feedbackHeading}><MomoAnimation name={record.status === 'correct' ? 'answer-correct' : 'answer-retry'} size={60} replayKey={`${index}-${record.status}`} /><View style={styles.grow}><Text style={styles.feedbackTitle}>{statusLabel(record.status)}</Text><Text style={styles.body}>{record.status === 'correct' ? `+${record.xp} XP` : record.status === 'timeout' ? 'Time ran out. Read the answer before moving on.' : 'Take a moment to understand the answer.'}</Text></View></View><Text style={styles.caption}>Correct answer</Text><Text selectable style={styles.answer}>{correctQuizAnswer(item)}</Text>{!!item.explanation && <Text selectable style={styles.body}>{item.explanation}</Text>}<SourceAttribution source={item.source_metadata} /></View>}
      {!!notice && <Text testID="quiz-notice" accessibilityLiveRegion="polite" style={styles.notice}>{notice}</Text>}
      {!record && hearts <= 0 && <View style={styles.card}><Text style={styles.feedbackTitle}>Time for a heart refill</Text><Text style={styles.body}>Your checked answers are still here. Visit the shop when you are ready to continue.</Text><Action label="Open shop" onPress={() => router.push('/shop')} secondary /></View>}
      {record ? <Action testID="quiz-next" label={nextPendingQuestion(answers, index, items.length) === null ? 'See results' : 'Next question'} onPress={next} /> : <><Action testID="quiz-check-answer" label="Check answer" disabled={!draft.trim() || hearts <= 0} onPress={() => commit(draft)} /><Action testID="quiz-skip" label="Skip question" onPress={() => commit('', 'skipped')} secondary /></>}
      {!record && !!seconds && <Text style={styles.timerNote}>Timer pauses when the app is away or the overview is open.</Text>}
      {index > 0 && !seconds && <Action testID="quiz-previous" label="Previous question" onPress={() => openQuestion(index - 1)} secondary />}
    </ScrollView>
    {overviewModal}
  </KeyboardAvoidingView>;
});

function statusLabel(status: string) {
  return ({ correct: 'Correct', incorrect: 'Needs another look', timeout: 'Time expired', revealed: 'Answer revealed', skipped: 'Skipped' } as Record<string, string>)[status] ?? status;
}
function Action({ label, onPress, secondary, disabled, testID }: { label: string; onPress: () => void; secondary?: boolean; disabled?: boolean; testID?: string }) {
  return <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.action, secondary && styles.secondaryAction, disabled && styles.disabled, pressed && styles.pressed]}><Text style={[styles.actionText, secondary && styles.secondaryActionText]}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, content: { padding: 20, gap: 16, width: '100%', maxWidth: 760, alignSelf: 'center' },
  grow: { flex: 1 }, empty: { padding: 24, alignItems: 'center', gap: 16 },
  title: { fontSize: 23, lineHeight: 32, fontWeight: '700', color: colors.text, textAlign: 'center' },
  eyebrow: { fontSize: 10, lineHeight: 16, fontWeight: '700', letterSpacing: 0.7, color: colors.primary, textTransform: 'uppercase' },
  body: { fontSize: 13, lineHeight: 21, color: colors.textSecondary }, caption: { fontSize: 11, lineHeight: 18, color: colors.textSecondary },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12 }, counter: { fontSize: 17, lineHeight: 24, fontWeight: '700', color: colors.text },
  overviewButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 4 },
  progress: { height: 8, borderRadius: 4, backgroundColor: colors.surfaceMuted, overflow: 'hidden' }, progressFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 4 },
  statsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }, timer: { fontSize: 12, color: colors.primary, fontWeight: '700', fontVariant: ['tabular-nums'] }, urgent: { color: colors.danger },
  card: { padding: 20, gap: 12, backgroundColor: colors.surface, borderRadius: 24, borderCurve: 'continuous', borderWidth: 1, borderColor: colors.border },
  question: { fontSize: 19, lineHeight: 29, fontWeight: '600', color: colors.text }, questionImage: { width: '100%', height: 200 },
  options: { gap: 12 }, option: { minHeight: 60, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderCurve: 'continuous', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
  selectedOption: { borderColor: colors.primary, backgroundColor: colors.primarySoft }, correctOption: { borderColor: colors.success, backgroundColor: colors.successSoft }, wrongOption: { borderColor: colors.danger, backgroundColor: colors.dangerSoft },
  optionLetter: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }, selectedLetter: { backgroundColor: colors.primary }, letter: { color: colors.primary, fontWeight: '700', fontSize: 12 }, selectedLetterText: { color: colors.onPrimary }, optionText: { flex: 1, fontSize: 14, lineHeight: 22, color: colors.text },
  input: { minHeight: 64, fontSize: 16, lineHeight: 24, color: colors.text, borderWidth: 1, borderColor: colors.primaryBorder, borderRadius: 16, padding: 16, backgroundColor: colors.background },
  helpRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between' }, helpButton: { minHeight: 44, justifyContent: 'center' }, helpText: { color: colors.primary, fontSize: 12, fontWeight: '600' }, hint: { backgroundColor: colors.primarySoft, borderRadius: 12, padding: 12, color: colors.textSecondary, fontSize: 13, lineHeight: 20 },
  feedback: { padding: 20, borderRadius: 24, borderCurve: 'continuous', gap: 12, borderWidth: 1 }, correctFeedback: { backgroundColor: colors.successSoft, borderColor: colors.successBorder }, retryFeedback: { backgroundColor: colors.primarySoft, borderColor: colors.primaryBorder }, feedbackHeading: { flexDirection: 'row', alignItems: 'center', gap: 12 }, feedbackTitle: { color: colors.text, fontSize: 17, lineHeight: 24, fontWeight: '700' }, answer: { color: colors.text, fontSize: 16, lineHeight: 24, fontWeight: '600' },
  notice: { color: colors.textSecondary, fontSize: 12, lineHeight: 19, padding: 12, backgroundColor: colors.primarySoft, borderRadius: 12 }, timerNote: { color: colors.textSecondary, fontSize: 11, lineHeight: 18, textAlign: 'center' },
  action: { minHeight: 52, borderRadius: 16, backgroundColor: colors.primary, padding: 14, alignItems: 'center', justifyContent: 'center' }, actionText: { color: colors.onPrimary, fontWeight: '700', fontSize: 14 }, secondaryAction: { backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.primaryBorder }, secondaryActionText: { color: colors.primary }, disabled: { opacity: 0.5 }, pressed: { opacity: 0.7 },
  overlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', padding: 20 }, modal: { maxHeight: '88%', backgroundColor: colors.surface, borderRadius: 24, padding: 20, gap: 16 }, overviewList: { gap: 12 }, overviewRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: colors.border, padding: 12, borderRadius: 16 }, overviewNumber: { color: colors.primary, fontSize: 16, fontWeight: '700' },
  resultHero: { padding: 20, backgroundColor: colors.primarySoft, borderRadius: 24, gap: 8, alignItems: 'center' }, filterRow: { flexDirection: 'row', gap: 12 }, filter: { minHeight: 44, flex: 1, padding: 12, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: colors.border }, selectedFilter: { borderColor: colors.primary, backgroundColor: colors.primarySoft }, filterText: { color: colors.primary, fontSize: 12, fontWeight: '600' },
});
