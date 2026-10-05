import { StudyIcon } from '@/components/common/StudyIcon';
import { initialStudyMode, selectStudyContent, sessionResult, restartStudySession, randomizeStudyItems, type StudyMode } from '@/utils/studySession';
import type { FlashcardScore } from '@/utils/flashcardScore';
import { MomoAnimation } from '@/components/mascot/MomoAnimation';
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { colors, spacing, typography } from '@/constants/theme';
import {
  Platform,
  View,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
  Image,
  Modal,
} from 'react-native';
import { AppText as Text } from '@/components/common/app-text';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  TrophyIcon,
  BookOpen01Icon,
  Book02Icon,
  Delete02Icon,
  Edit02Icon,
  RefreshIcon,
  Clock01Icon,
  CheckmarkCircle02Icon,
  MoreVerticalIcon,
} from '@hugeicons/core-free-icons';
import { getStudySet, getStudyItems, deleteStudySet, updateStudySet } from '../../lib/api/studySets';
import { localDb } from '../../lib/storage/localDb';
import { loadStudyContent } from '../../lib/data/loadStudyContent';
import { FlashcardDeck } from '../../components/study/FlashcardDeck';
import { QuizRunner, QuizRunnerRef } from '../../components/study/QuizRunner';
import { ReviewerGuideView } from '../../components/study/ReviewerGuideView';
import { PageHeader } from '../../components/common/PageHeader';
import { PlatformPressable } from '../../components/common/PlatformPressable';
import { ConfirmationModal } from '../../components/common/ConfirmationModal';
import { RenameModal } from '../../components/common/RenameModal';
import { SmoothScrollView } from '../../components/common/SmoothScrollView';
import { StudySet, StudyItem } from '../../types';
import { useOnboarding } from '../../context/OnboardingContext';
import { CelebrationModal } from '../../components/onboarding/CelebrationModal';
import { AcademicWeaponShareModal } from '../../components/social/AcademicWeaponShareModal';
import { InstagramStoryButton } from '../../components/social/InstagramStoryButton';
import { MomoLoadingScreen } from '../../components/common/MomoLoadingScreen';
import { isIpad } from '../../utils/device';
import { GlassButton } from '../../components/glass';

export default function StudySessionScreen() {
  const { studySetId, initialMode } = useLocalSearchParams<{
    studySetId: string;
    initialMode?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [studySet, setStudySet] = useState<StudySet | null>(null);
  const [items, setItems] = useState<StudyItem[]>([]);
  const [mode, setMode] = useState<StudyMode>('reviewer');
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const quizRef = useRef<QuizRunnerRef>(null);
  const [finishedScore, setFinishedScore] = useState<FlashcardScore | null>(null);
  const [isQuizCompleted, setIsQuizCompleted] = useState(false);
  const [quizScore, setQuizScore] = useState<{ correct: number; total: number; xp: number } | null>(null);
  const [sessionKey, setSessionKey] = useState(0);
  const [showStoryModal, setShowStoryModal] = useState(false);

  const { hasSeenCelebrationModal, dismissCelebration, markSessionCompleted } = useOnboarding();

  useEffect(() => {
    if (finishedScore || isQuizCompleted) {
      markSessionCompleted();
    }
  }, [finishedScore, isQuizCompleted]);

  const handleShuffleReset = () => {
    handleRestart();
  };

  const handleRename = async (newTitle: string) => {
    setIsRenaming(true);
    try {
      await updateStudySet(studySetId, { title: newTitle });
      await localDb.updateStudySetTitle(studySetId, newTitle);
      setStudySet((prev) => (prev ? { ...prev, title: newTitle } : null));
      setShowRenameModal(false);
    } catch (err: any) {
      // Local fallback for offline mode
      await localDb.updateStudySetTitle(studySetId, newTitle);
      setStudySet((prev) => (prev ? { ...prev, title: newTitle } : null));
      setShowRenameModal(false);
    } finally {
      setIsRenaming(false);
    }
  };

  const [offlineSaved, setOfflineSaved] = useState(false);

  useEffect(() => {
    const load = async () => {
      setOfflineSaved(false);
      setIsLoading(true);
      try {
        const { set: setData, items: itemData } = await loadStudyContent(studySetId, {
          getCachedSet: (id) => localDb.getStudySet(id),
          getCachedItems: (id) => localDb.getStudyItems(id),
          getRemoteSet: getStudySet,
          getRemoteItems: getStudyItems,
        });
        const randomized = randomizeStudyItems(itemData);
        setStudySet(setData);
        setItems(randomized);

        setMode(initialStudyMode(randomized, initialMode));

        // Cache to local database for offline use
        await localDb.saveStudySet(setData, itemData);
        setOfflineSaved(true);
      } catch {
        // Fallback to local offline cache
        const localSet = await localDb.getStudySet(studySetId);
        const localItems = await localDb.getStudyItems(studySetId);
        if (localSet) {
          setOfflineSaved(true);
          const randomized = randomizeStudyItems(localItems);
          setStudySet(localSet);
          setItems(randomized);

          setMode(initialStudyMode(randomized, initialMode));
        }
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [studySetId, initialMode]);

  const confirmDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteStudySet(studySetId);
      await localDb.deleteStudySet(studySetId);
      setShowDeleteModal(false);
      router.replace('/(tabs)/library');
    } catch (err: any) {
      Alert.alert('Could not delete reviewer', 'Connect to the internet and try again. Your study material is still available.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRestart = () => {
    const fresh = restartStudySession(sessionKey);
    setItems((prev) => randomizeStudyItems(prev));
    setSessionKey(fresh.sessionKey);
    setFinishedScore(fresh.finishedScore);
    setIsQuizCompleted(fresh.isQuizCompleted);
    setQuizScore(fresh.quizScore);
    setShowStoryModal(fresh.showStoryModal);
  };

  const changeMode = (next: StudyMode) => {
    if (next === mode) return;
    const start = () => { handleRestart(); setMode(next); };
    if (mode === 'reviewer' || finishedScore || isQuizCompleted) start();
    else Alert.alert('Start a different study mode?', 'Your current session will restart. Saved study answers stay in your history.', [
      { text: 'Keep studying', style: 'cancel' }, { text: 'Switch mode', onPress: start },
    ]);
  };

  if (isLoading) {
    return (
      <MomoLoadingScreen
        title="Opening your reviewer"
        subtitle="Getting your saved study material ready."
        mascotSize={220}
      />
    );
  }

  if (finishedScore && mode === 'flashcard') {
    const result = sessionResult(finishedScore);
    const percent = result.percent;
    const isMastered = percent >= 70;
    return (
      <View testID="study-screen" style={styles.screen}>
        <CelebrationModal
          visible={!hasSeenCelebrationModal}
          onDismiss={dismissCelebration}
          onShareStory={() => setShowStoryModal(true)}
          xpEarned={finishedScore.xp}
          itemsCount={finishedScore.total}
        />
        <PageHeader
          title="Session Complete"
          showBack={true}
          onBack={() => router.replace('/(tabs)/library')}
        />
        <SmoothScrollView
          style={styles.finishContainer}
          contentContainerStyle={[
            styles.finishScrollContent,
            {
              paddingBottom:
                Math.max(
                  insets.bottom,
                  process.env.EXPO_OS === 'android' ? spacing[28] : spacing[24],
                ) + spacing[20],
            },
          ]}
        >
          <View testID="flashcard-results" style={styles.finishCard}>
            <Text style={styles.resultEyebrow}>FLASHCARD SELF-CHECK</Text>
            <MomoAnimation name="momo-bow" size={140} replayKey={sessionKey} />
            {finishedScore.correct > 0 && <MomoAnimation name="xp-reward" size={56} replayKey={studySetId} />}
            <StudyIcon name="cards" size={48} />
            <Text style={styles.finishTitle}>
              {isMastered ? 'Practice is paying off' : 'A little progress today'}
            </Text>
            <Text style={styles.finishScore}>
              {finishedScore.correct} of {finishedScore.total} marked “Got it”
            </Text>
            <View
              style={[
                styles.masteryPill,
                isMastered ? styles.masteryPillHigh : styles.masteryPillLow,
              ]}
            >
              <Text
                style={[
                  styles.masteryPillText,
                  isMastered ? styles.masteryTextHigh : styles.masteryTextLow,
                ]}
              >
                {percent}% Self-check
              </Text>
            </View>

            <Text style={styles.resultHelper}>Based on your own answers, not a graded quiz.</Text>
            <View style={styles.resultStats}>
              <View style={styles.resultStat}><StudyIcon name="book" size={32} /><Text style={styles.resultStatValue}>{result.reviewAgain}</Text><Text style={styles.resultHelper}>Review again</Text></View>
              <View style={styles.resultStat}><StudyIcon name="coin" size={32} /><Text style={styles.resultStatValue}>+{result.xp}</Text><Text style={styles.resultHelper}>Study XP</Text></View>
            </View>
            <View style={styles.finishActionCol}>
              <InstagramStoryButton
                onPress={() => setShowStoryModal(true)}
              />

              {selectStudyContent(items).quiz.length > 0 && <PlatformPressable testID="results-start-quiz" accessibilityRole="button" accessibilityLabel="Start the quiz in this reviewer" style={styles.restartBtn} onPress={() => changeMode('quiz')}>
                <View style={styles.btnRow}><StudyIcon name="brain" size={24} /><Text style={styles.restartBtnText}>Try the quiz</Text></View>
              </PlatformPressable>}
              <PlatformPressable testID="restart-session" accessibilityRole="button" accessibilityLabel="Practice these flashcards again" style={styles.restartBtn} onPress={handleRestart}>
                <View style={styles.btnRow}>
                  <HugeiconsIcon icon={RefreshIcon} size={18} color={colors.primary} strokeWidth={2.2} />
                  <Text style={styles.restartBtnText}>Practice Again</Text>
                </View>
              </PlatformPressable>

              <PlatformPressable
                testID="results-library" accessibilityRole="button" accessibilityLabel="Back to library"
                style={styles.doneBtn}
                onPress={() => router.replace('/(tabs)/library')}
              >
                <View style={styles.btnRow}>
                  <Text style={styles.doneBtnText}>Back to Library</Text>
                </View>
              </PlatformPressable>
            </View>
          </View>
        </SmoothScrollView>

        <AcademicWeaponShareModal
          visible={showStoryModal}
          onClose={() => setShowStoryModal(false)}
          inputData={{
            mode: 'flashcard',
            subject: studySet?.title || 'Flashcards',
            cardsCount: finishedScore.total,
            accuracy: percent,
            correctCount: finishedScore.correct,
            totalQuestions: finishedScore.total,
            xpEarned: finishedScore.xp,
          }}
        />
      </View>
    );
  }

  const content = selectStudyContent(items);
  const actualReviewerItems = content.reviewer;
  const actualFlashcardItems = content.flashcard;
  const actualQuizItems = content.quiz;
  const hasQuiz = actualQuizItems.length > 0;
  const labels: Record<StudyMode, string> = { reviewer: 'Notes', flashcard: 'Cards', quiz: 'Quiz' };
  const availableModes = content.modes.map(key => ({ key, label: labels[key] }));

  const screenSubtitle = mode === 'reviewer'
    ? `${actualReviewerItems.length} study topics & notes`
    : mode === 'flashcard'
    ? `${actualFlashcardItems.length} flashcards`
    : `${actualQuizItems.length} questions`;

  const threeDotsButton = (
    <GlassButton
      variant="subtle"
      size="icon"
      radius={isIpad() ? 23 : 18}
      haptic="light"
      onPress={() => setShowActionMenu(true)}
      testID="study-options"
      accessibilityLabel="Reviewer options: reset, edit, or delete"
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      contentStyle={{
        width: 48,
        height: 48,
      }}
    >
      <HugeiconsIcon icon={MoreVerticalIcon} size={18} color={colors.text} strokeWidth={2.2} />
    </GlassButton>
  );

  return (
    <View testID="study-screen" style={styles.screen}>
      <CelebrationModal
        visible={!hasSeenCelebrationModal && isQuizCompleted}
        onDismiss={dismissCelebration}
        onShareStory={() => setShowStoryModal(true)}
        xpEarned={quizScore?.xp ?? 0}
        itemsCount={quizScore?.total || actualQuizItems.length}
      />
      <PageHeader
        title={isQuizCompleted ? 'Session Complete' : studySet?.title || 'Reviewer'}
        subtitle={isQuizCompleted ? 'Review your results and answer explanations below' : screenSubtitle}
        showBack={true}
        onBack={() => router.replace('/(tabs)/library')}
        rightAction={isQuizCompleted ? undefined : threeDotsButton}
      />

      {offlineSaved && !isQuizCompleted && <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing[20], gap: 6 }}>
        <StudyIcon name="shield" size={28} />
        <Text style={{ color: colors.textMuted, fontSize: 12 }}>Available offline</Text>
      </View>}

      {/* Mode Switcher - Only shown if multiple modes exist and quiz is not completed */}
      {availableModes.length > 1 && !isQuizCompleted && (
        <View style={styles.modeBar} accessibilityRole="tablist">
          {availableModes.map((m) => {
            const isActive = mode === m.key;
            return (
              <TouchableOpacity
                key={m.key}
                testID={`session-mode-${m.key}`}
                accessibilityRole="tab" accessibilityLabel={m.label}
                accessibilityState={{ selected: isActive }}
                style={[styles.modeTab, isActive && styles.activeModeTab]}
                onPress={() => changeMode(m.key)}
                activeOpacity={0.7}
              >
                <StudyIcon name={m.key === 'reviewer' ? 'book' : m.key === 'flashcard' ? 'cards' : 'brain'} size={26} />
                <Text style={[styles.modeTabText, isActive && styles.activeModeTabText]}>
                  {m.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Content Runner */}
      <View style={styles.contentArea}>
        {content.modes.length === 0 ? (
          <View style={styles.noContent}>
            <StudyIcon name="book" size={64} />
            <Text style={styles.finishTitle}>No study items available</Text>
            <Text style={styles.resultHelper}>This reviewer does not contain ready-to-use notes, cards, or quiz questions.</Text>
            <PlatformPressable accessibilityRole="button" accessibilityLabel="Return to library" style={styles.restartBtn} onPress={() => router.replace('/(tabs)/library')}><Text style={styles.restartBtnText}>Back to library</Text></PlatformPressable>
          </View>
        ) : mode === 'reviewer' ? (
          <ReviewerGuideView
            items={actualReviewerItems}
            title={studySet?.title}
            onTakeQuiz={hasQuiz ? () => changeMode('quiz') : undefined}
          />
        ) : mode === 'flashcard' ? (
          <FlashcardDeck
            key={`fc-${sessionKey}-${actualFlashcardItems.length}`}
            items={actualFlashcardItems}
            onFinish={setFinishedScore}
          />
        ) : (
          <QuizRunner ref={quizRef}
            key={`quiz-${sessionKey}-${actualQuizItems.map((i) => i.id).join('-')}`}
            items={actualQuizItems}
            title={studySet?.title}
            timeLimitPerQuestion={studySet?.generation_config?.time_limit_per_question}
            onFinish={(score) => {
              setIsQuizCompleted(true);
              setQuizScore(score);
              markSessionCompleted();
            }}
            onRestart={handleRestart}
          />
        )}
      </View>

      {/* 3-Dots Reviewer Actions Sheet (Reset, Edit, Delete) */}
      <Modal
        visible={showActionMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowActionMenu(false)}
      >
        <TouchableOpacity
          style={styles.actionSheetBackdrop}
          activeOpacity={1}
          onPress={() => setShowActionMenu(false)}
        >
          <View style={styles.reviewerActionSheet}>
            <View style={styles.actionSheetHandle} />
            <Text style={styles.actionSheetTitle} numberOfLines={1}>
              {studySet?.title || 'Reviewer Options'}
            </Text>
            {/* Quiz Overview Option */}
            {!isQuizCompleted && mode === "quiz" && (
              <TouchableOpacity
                style={styles.actionSheetItem}
                onPress={() => {
                  setShowActionMenu(false);
                  setTimeout(() => quizRef.current?.showOverview(), 150);
                }}
                activeOpacity={0.7}
              >
                <View style={[styles.actionIconBadge, { backgroundColor: colors.primarySoft }]}>
                  <HugeiconsIcon icon={BookOpen01Icon} size={18} color={colors.primary} strokeWidth={2.2} />
                </View>
                <View style={styles.actionItemTextCol}>
                  <Text style={styles.actionItemTitle}>Quiz Overview</Text>
                  <Text style={styles.actionItemSubtitle}>View your quiz progress</Text>
                </View>
              </TouchableOpacity>
            )}


            {/* Reset Option */}
            <TouchableOpacity
              style={styles.actionSheetItem}
              onPress={() => {
                setShowActionMenu(false);
                handleShuffleReset();
              }}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Reset and reshuffle question set"
            >
              <View style={[styles.actionIconBadge, { backgroundColor: colors.primarySoft }]}>
                <HugeiconsIcon icon={RefreshIcon} size={18} color={colors.primary} strokeWidth={2.2} />
              </View>
              <View style={styles.actionItemTextCol}>
                <Text style={styles.actionItemTitle}>Reset & Reshuffle</Text>
                <Text style={styles.actionItemSubtitle}>Randomize question order and start over</Text>
              </View>
            </TouchableOpacity>

            {/* Edit Option */}
            <TouchableOpacity
              style={styles.actionSheetItem}
              onPress={() => {
                setShowActionMenu(false);
                setShowRenameModal(true);
              }}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Rename reviewer"
            >
              <View style={[styles.actionIconBadge, { backgroundColor: colors.primarySoft }]}>
                <HugeiconsIcon icon={Edit02Icon} size={18} color={colors.primary} strokeWidth={2} />
              </View>
              <View style={styles.actionItemTextCol}>
                <Text style={styles.actionItemTitle}>Edit Reviewer Title</Text>
                <Text style={styles.actionItemSubtitle}>Rename this study set</Text>
              </View>
            </TouchableOpacity>

            {/* Delete Option */}
            <TouchableOpacity
              style={[styles.actionSheetItem, styles.actionSheetItemDestructive]}
              onPress={() => {
                setShowActionMenu(false);
                setShowDeleteModal(true);
              }}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Delete reviewer"
            >
              <View style={[styles.actionIconBadge, { backgroundColor: colors.dangerSoft }]}>
                <HugeiconsIcon icon={Delete02Icon} size={18} color={colors.dangerAccent} strokeWidth={2} />
              </View>
              <View style={styles.actionItemTextCol}>
                <Text style={[styles.actionItemTitle, styles.actionItemTitleDestructive]}>Delete Reviewer</Text>
                <Text style={styles.actionItemSubtitle}>Permanently remove this study set</Text>
              </View>
            </TouchableOpacity>

            {/* Cancel Button */}
            <TouchableOpacity
              style={styles.actionSheetCancelBtn}
              onPress={() => setShowActionMenu(false)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
            >
              <Text style={styles.actionSheetCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Confirmation Modal */}
      <ConfirmationModal
        visible={showDeleteModal}
        title="Delete Reviewer?"
        message={`Are you sure you want to delete "${studySet?.title || 'this reviewer'}"? All generated flashcards, quiz questions, and study progress will be permanently removed.`}
        confirmText="Delete Reviewer"
        isDestructive={true}
        isLoading={isDeleting}
        onConfirm={confirmDelete}
        onCancel={() => setShowDeleteModal(false)}
      />

      {/* Rename Modal */}
      <RenameModal
        visible={showRenameModal}
        initialTitle={studySet?.title || ''}
        isLoading={isRenaming}
        onSave={handleRename}
        onCancel={() => setShowRenameModal(false)}
      />

      <AcademicWeaponShareModal
        visible={showStoryModal}
        onClose={() => setShowStoryModal(false)}
        inputData={{
          mode: quizScore ? 'quiz' : 'flashcard',
          subject: studySet?.title || 'Study Session',
          accuracy: quizScore && quizScore.total > 0 ? Math.round((quizScore.correct / quizScore.total) * 100) : undefined,
          correctCount: quizScore?.correct,
          totalQuestions: quizScore?.total,
          cardsCount: actualFlashcardItems.length,
          xpEarned: quizScore?.xp ?? 0,
        }}
      />
    </View>
  );
}

const isPadDevice = isIpad();

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  threeDotsBtn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionSheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: isPadDevice ? 'center' : 'flex-end',
    alignItems: isPadDevice ? 'center' : undefined,
    padding: isPadDevice ? spacing[24] : 0,
  },
  reviewerActionSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderRadius: isPadDevice ? 24 : undefined,
    maxWidth: isPadDevice ? 520 : undefined,
    width: '100%',
    borderCurve: 'continuous',
    paddingHorizontal: isPadDevice ? spacing[24] : spacing[20],
    paddingTop: spacing[12],
    paddingBottom: isPadDevice ? spacing[24] : spacing[36],
    gap: spacing[8],
    ...Platform.select({
      ios: {
        shadowColor: colors.shadow || '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  actionSheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    borderCurve: 'continuous',
    backgroundColor: colors.borderStrong,
    alignSelf: 'center',
    marginBottom: spacing[12],
  },
  actionSheetTitle: {
    fontSize: typography.fontSize[15],
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing[8],
  },
  actionSheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[12],
    backgroundColor: colors.surfaceMuted,
    paddingVertical: spacing[12],
    paddingHorizontal: spacing[14],
    borderRadius: 14,
    borderCurve: 'continuous',
  },
  actionSheetItemDestructive: {
    backgroundColor: colors.dangerSoft,
  },
  actionIconBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionItemTextCol: {
    flex: 1,
  },
  actionItemTitle: {
    fontSize: typography.fontSize[13.5],
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
  },
  actionItemTitleDestructive: {
    color: colors.dangerAccent,
  },
  actionItemSubtitle: {
    fontSize: typography.fontSize[11],
    color: colors.textMuted,
    marginTop: 1,
  },
  actionSheetCancelBtn: {
    paddingVertical: spacing[12],
    borderRadius: 12,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
    marginTop: spacing[4],
  },
  actionSheetCancelText: {
    fontSize: typography.fontSize[13.5],
    fontWeight: typography.fontWeight.bold,
    color: colors.textMuted,
  },
  modeBar: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceMuted,
    padding: isPadDevice ? spacing[6] : spacing[4],
    marginHorizontal: isPadDevice ? spacing[36] : spacing[16],
    marginTop: spacing[10],
    marginBottom: spacing[8],
    borderRadius: isPadDevice ? 16 : 12,
    borderWidth: 1,
    borderColor: colors.border,
    maxWidth: isPadDevice ? 860 : undefined,
    width: isPadDevice ? '100%' : undefined,
    alignSelf: isPadDevice ? 'center' : undefined,
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    gap: isPadDevice ? spacing[8] : spacing[6],
    paddingVertical: isPadDevice ? spacing[14] : spacing[9],
    borderRadius: isPadDevice ? 12 : 9,
  },
  activeModeTab: {
    backgroundColor: colors.surface,
    borderCurve: 'continuous',
    ...Platform.select({
      ios: {
        shadowColor: colors.shadow || '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  modeTabText: {
    fontSize: isPadDevice ? typography.fontSize[15] : typography.fontSize[12.5],
    fontWeight: typography.fontWeight.semiBold,
    color: colors.textMuted,
  },
  activeModeTabText: {
    color: colors.primary,
    fontWeight: typography.fontWeight.bold,
  },
  contentArea: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: spacing[12],
    fontSize: typography.fontSize[14],
    color: colors.textMuted,
  },
  resultEyebrow: { fontSize: 11, letterSpacing: 1, fontWeight: '700', color: colors.primary, marginBottom: 8 },
  resultHelper: { fontSize: 12, lineHeight: 18, color: colors.textSecondary, textAlign: 'center' },
  resultStats: { flexDirection: 'row', gap: 12, width: '100%', marginTop: 16, marginBottom: 24 },
  resultStat: { flex: 1, alignItems: 'center', padding: 12, borderRadius: 18, backgroundColor: colors.primarySoft },
  resultStatValue: { fontSize: 22, fontWeight: '800', color: colors.text },
  noContent: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16, padding: 24 },
  finishContainer: {
    flex: 1,
  },
  finishScrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: isPadDevice ? spacing[32] : spacing[20],
    paddingVertical: isPadDevice ? spacing[40] : spacing[32],
  },
  finishCard: {
    backgroundColor: colors.surface,
    borderRadius: isPadDevice ? 32 : 24,
    borderCurve: 'continuous',
    padding: isPadDevice ? spacing[36] : spacing[28],
    alignItems: 'center',
    width: '100%',
    maxWidth: isPadDevice ? 640 : 400,
    borderWidth: 1,
    borderColor: colors.border,
    ...Platform.select({
      ios: {
        shadowColor: colors.shadow || '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  finishBadgeCircle: {
    width: isPadDevice ? 96 : 76,
    height: isPadDevice ? 96 : 76,
    borderRadius: isPadDevice ? 48 : 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: isPadDevice ? spacing[18] : spacing[14],
  },
  trophyBadge: {
    backgroundColor: colors.warningSoft,
    borderWidth: 2,
    borderColor: colors.warningBorder,
  },
  bookBadge: {
    backgroundColor: colors.primarySoft,
    borderWidth: 2,
    borderColor: colors.primarySoftStrong,
  },
  finishTitle: {
    fontSize: isPadDevice ? typography.fontSize[28] : typography.fontSize[22],
    fontWeight: typography.fontWeight.extraBold,
    color: colors.text,
    marginBottom: spacing[6],
    letterSpacing: typography.letterSpacing[-0.3],
  },
  finishScore: {
    fontSize: isPadDevice ? typography.fontSize[20] : typography.fontSize[16],
    fontWeight: typography.fontWeight.semiBold,
    color: colors.textMuted,
    marginBottom: spacing[8],
  },
  masteryPill: {
    paddingHorizontal: isPadDevice ? spacing[16] : spacing[12],
    paddingVertical: isPadDevice ? spacing[6] : spacing[4],
    borderRadius: 16,
    marginBottom: spacing[8],
  },
  masteryPillHigh: {
    backgroundColor: colors.successSoft,
  },
  masteryPillLow: {
    backgroundColor: colors.primarySoft,
  },
  masteryPillText: {
    fontSize: isPadDevice ? typography.fontSize[16] : typography.fontSize[14],
    fontWeight: typography.fontWeight.extraBold,
  },
  masteryTextHigh: {
    color: colors.success,
  },
  masteryTextLow: {
    color: colors.primary,
  },
  finishActionCol: {
    width: '100%',
    gap: isPadDevice ? spacing[14] : spacing[10],
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
    backgroundColor: colors.primarySoft,
    borderRadius: isPadDevice ? 18 : 14,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  restartBtnText: {
    color: colors.primary,
    fontWeight: typography.fontWeight.bold,
    fontSize: isPadDevice ? typography.fontSize[17] : typography.fontSize[15],
  },
  doneBtn: {
    backgroundColor: colors.primary,
    borderRadius: isPadDevice ? 18 : 14,
    borderCurve: 'continuous',
    ...Platform.select({
      ios: {
        shadowColor: colors.shadow || '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  doneBtnText: {
    color: colors.onPrimary,
    fontWeight: typography.fontWeight.bold,
    fontSize: isPadDevice ? typography.fontSize[17] : typography.fontSize[15],
  },
  btnRow: {
    paddingVertical: isPadDevice ? spacing[18] : spacing[14],
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing[8],
  },
});
