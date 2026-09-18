import React, { useEffect, useState } from 'react';
import { colors, spacing, typography } from '@/constants/theme';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
  Platform,
  Image,
} from 'react-native';
import { AppText as Text } from '@/components/common/app-text';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  TrophyIcon,
  BookOpen01Icon,
  Delete02Icon,
  Edit02Icon,
  RefreshIcon,
  Clock01Icon,
  CheckmarkCircle02Icon,
} from '@hugeicons/core-free-icons';
import { getStudySet, getStudyItems, deleteStudySet, updateStudySet } from '../../lib/api/studySets';
import { localDb } from '../../lib/storage/localDb';
import { FlashcardDeck } from '../../components/study/FlashcardDeck';
import { QuizRunner } from '../../components/study/QuizRunner';
import { PageHeader } from '../../components/common/PageHeader';
import { PlatformPressable } from '../../components/common/PlatformPressable';
import { ConfirmationModal } from '../../components/common/ConfirmationModal';
import { RenameModal } from '../../components/common/RenameModal';
import { SmoothScrollView } from '../../components/common/SmoothScrollView';
import { MomoMaker } from '../../components/mascot/MomoMaker';
import { StudySet, StudyItem } from '../../types';

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function randomizeStudyItems(rawItems: StudyItem[]): StudyItem[] {
  // 1. Shuffle question order
  const shuffledQuestions = shuffleArray(rawItems);
  // 2. Shuffle multiple-choice options for each question so correct answer is randomly positioned across A, B, C, D
  return shuffledQuestions.map((item) => {
    if (item.type === 'multiple_choice' && Array.isArray(item.options) && item.options.length > 1) {
      return {
        ...item,
        options: shuffleArray(item.options),
      };
    }
    return item;
  });
}

export default function StudySessionScreen() {
  const { studySetId, initialMode } = useLocalSearchParams<{
    studySetId: string;
    initialMode?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [studySet, setStudySet] = useState<StudySet | null>(null);
  const [items, setItems] = useState<StudyItem[]>([]);
  const [mode, setMode] = useState<'flashcard' | 'quiz'>('flashcard');
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [finishedScore, setFinishedScore] = useState<{ correct: number; total: number } | null>(null);
  const [sessionKey, setSessionKey] = useState(0);

  const handleShuffleReset = () => {
    setItems((prev) => randomizeStudyItems(prev));
    setSessionKey((prev) => prev + 1);
    Alert.alert('Quiz Reset', 'The questions and answer choices have been randomized.');
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

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        // Try network
        const setData = await getStudySet(studySetId);
        const itemData = await getStudyItems(studySetId);
        const randomized = randomizeStudyItems(itemData);
        setStudySet(setData);
        setItems(randomized);

        // Intelligently set initial mode based on available study formats
        const qTypes = setData?.generation_config?.question_types || [];
        const hasFc = qTypes.includes('flashcard') || randomized.some((i) => i.type === 'flashcard');
        const hasQz = randomized.some((i) => i.type !== 'flashcard') || qTypes.some((f: string) => f !== 'flashcard');

        if (initialMode === 'quiz' && hasQz) {
          setMode('quiz');
        } else if (hasFc) {
          setMode('flashcard');
        } else if (hasQz) {
          setMode('quiz');
        }

        // Cache to local database for offline use
        await localDb.saveStudySet(setData, itemData);
      } catch {
        // Fallback to local offline cache
        const localSet = await localDb.getStudySet(studySetId);
        const localItems = await localDb.getStudyItems(studySetId);
        if (localSet) {
          const randomized = randomizeStudyItems(localItems);
          setStudySet(localSet);
          setItems(randomized);

          const qTypes = localSet?.generation_config?.question_types || [];
          const hasFc = qTypes.includes('flashcard') || randomized.some((i) => i.type === 'flashcard');
          const hasQz = randomized.some((i) => i.type !== 'flashcard') || qTypes.some((f: string) => f !== 'flashcard');

          if (initialMode === 'quiz' && hasQz) {
            setMode('quiz');
          } else if (hasFc) {
            setMode('flashcard');
          } else if (hasQz) {
            setMode('quiz');
          }
        }
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [studySetId]);

  const confirmDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteStudySet(studySetId);
      await localDb.deleteStudySet(studySetId);
      setShowDeleteModal(false);
      router.replace('/(tabs)/library');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to delete study set.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRestart = () => {
    setItems((prev) => randomizeStudyItems(prev));
    setSessionKey((prev) => prev + 1);
    setFinishedScore(null);
  };

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: '#FFFFFF' }]}>
        <Image 
          source={require('@/assets/animations/thinking_momo.png')} 
          style={{ width: '100%', height: '100%', position: 'absolute' }} 
          resizeMode="cover" 
        />
        <ActivityIndicator size="large" color="#4F46E5" style={{ marginTop: 200 }} />
        <Text style={[styles.loadingText, { 
          color: '#000', 
          backgroundColor: 'rgba(255,255,255,0.85)', 
          paddingHorizontal: 16, 
          paddingVertical: 8, 
          borderRadius: 12,
          fontWeight: 'bold',
          marginTop: 12
        }]}>
          Loading study reviewer...
        </Text>
      </View>
    );
  }

  if (finishedScore) {
    const percent = Math.round((finishedScore.correct / finishedScore.total) * 100);
    const isMastered = percent >= 70;
    return (
      <View style={styles.screen}>
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
                  Platform.OS === 'android' ? spacing[28] : spacing[24],
                ) + spacing[20],
            },
          ]}
        >
          <View style={styles.finishCard}>
            <View
              style={[
                styles.finishBadgeCircle,
                isMastered ? styles.trophyBadge : styles.bookBadge,
              ]}
            >
              <HugeiconsIcon
                icon={isMastered ? TrophyIcon : BookOpen01Icon}
                size={42}
                color={isMastered ? colors.warning : colors.primary}
                strokeWidth={1.8}
              />
            </View>
            <Text style={styles.finishTitle}>
              {isMastered ? 'Excellent Work!' : 'Session Complete!'}
            </Text>
            <Text style={styles.finishScore}>
              {finishedScore.correct} of {finishedScore.total} Correct
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
                {percent}% Mastery
              </Text>
            </View>

            <View style={styles.finishActionCol}>
              <PlatformPressable style={styles.restartBtn} onPress={handleRestart}>
                <View style={styles.btnRow}>
                  <HugeiconsIcon icon={RefreshIcon} size={18} color={colors.primary} strokeWidth={2.2} />
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
          </View>
        </SmoothScrollView>
      </View>
    );
  }

  const configuredTypes: string[] = studySet?.generation_config?.question_types || [];
  const flashcardSpecificItems = items.filter((i) => i.type === 'flashcard');
  const otherQuestionItems = items.filter((i) => i.type !== 'flashcard');
  // Combine all items so that in Flashcard mode, users have as many flashcards as possible covering every question in the set
  const actualFlashcardItems = items.length > 0
    ? [...flashcardSpecificItems, ...otherQuestionItems]
    : [];
  const hasFlashcards = items.length > 0;

  const quizItems = otherQuestionItems.length > 0 ? otherQuestionItems : items;
  const hasQuiz = otherQuestionItems.length > 0 || configuredTypes.some((f) => f !== 'flashcard');
  const actualQuizItems = otherQuestionItems.length > 0 ? otherQuestionItems : items;

  const availableModes: { key: 'flashcard' | 'quiz'; label: string; icon: any }[] = [];
  if (hasFlashcards) {
    availableModes.push({ key: 'flashcard', label: 'Flashcards', icon: BookOpen01Icon });
  }
  if (hasQuiz) {
    availableModes.push({ key: 'quiz', label: 'Quiz', icon: CheckmarkCircle02Icon });
  }

  const screenSubtitle = mode === 'flashcard'
    ? `${actualFlashcardItems.length} flashcards`
    : `${actualQuizItems.length} questions`;

  return (
    <View style={styles.screen}>
      <PageHeader
        title={studySet?.title || 'Reviewer'}
        subtitle={screenSubtitle}
      />

      {/* Mode Switcher - Only shown if multiple modes exist */}
      {availableModes.length > 1 && (
        <View style={styles.modeBar}>
          {availableModes.map((m) => {
            const isActive = mode === m.key;
            return (
              <TouchableOpacity
                key={m.key}
                style={[styles.modeTab, isActive && styles.activeModeTab]}
                onPress={() => setMode(m.key)}
                activeOpacity={0.7}
              >
                <HugeiconsIcon
                  icon={m.icon}
                  size={14}
                  color={isActive ? colors.primary : colors.textMuted}
                  strokeWidth={isActive ? 2.4 : 2}
                />
                <Text style={[styles.modeTabText, isActive && styles.activeModeTabText]}>
                  {m.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Reviewer Action Bar (Reset, Edit, Delete) - cleanly separated in its own container so nothing overlaps */}
      <View style={styles.actionToolbar}>
        <TouchableOpacity
          style={styles.toolbarBtn}
          onPress={handleShuffleReset}
          disabled={isRenaming || isDeleting}
          activeOpacity={0.7}
          accessibilityLabel="Reset and reshuffle question set"
        >
          <HugeiconsIcon icon={RefreshIcon} size={15} color="#4F46E5" strokeWidth={2.2} />
          <Text style={styles.toolbarBtnText}>Reset</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.toolbarBtn}
          onPress={() => setShowRenameModal(true)}
          disabled={isRenaming || isDeleting}
          activeOpacity={0.7}
          accessibilityLabel="Rename reviewer"
        >
          <HugeiconsIcon icon={Edit02Icon} size={15} color="#4F46E5" strokeWidth={2} />
          <Text style={styles.toolbarBtnText}>Edit</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.toolbarBtn, styles.toolbarDeleteBtn]}
          onPress={() => setShowDeleteModal(true)}
          disabled={isDeleting || isRenaming}
          activeOpacity={0.7}
          accessibilityLabel="Delete reviewer"
        >
          <HugeiconsIcon icon={Delete02Icon} size={15} color="#DC2626" strokeWidth={2} />
          <Text style={[styles.toolbarBtnText, styles.toolbarDeleteText]}>Delete</Text>
        </TouchableOpacity>
      </View>

      {/* Content Runner */}
      <View style={styles.contentArea}>
        {mode === 'flashcard' ? (
          <FlashcardDeck
            key={`fc-${sessionKey}-${actualFlashcardItems.length}`}
            items={actualFlashcardItems}
            onFinish={() => setFinishedScore({ correct: actualFlashcardItems.length, total: actualFlashcardItems.length })}
          />
        ) : (
          <QuizRunner
            key={`quiz-${sessionKey}-${actualQuizItems.map((i) => i.id).join('-')}`}
            items={actualQuizItems}
            onRestart={handleRestart}
          />
        )}
      </View>

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
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  actionToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    marginHorizontal: spacing[16],
    marginTop: spacing[4],
    marginBottom: spacing[8],
    paddingVertical: spacing[6],
    paddingHorizontal: spacing[8],
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing[8],
    ...Platform.select({
      ios: {
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
      },
      android: {
        elevation: 1.5,
      },
    }),
  },
  toolbarBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[6],
    paddingVertical: spacing[8],
    paddingHorizontal: spacing[6],
    borderRadius: 8,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toolbarBtnText: {
    fontSize: typography.fontSize[12],
    fontWeight: typography.fontWeight.bold,
    color: colors.textSecondary,
  },
  toolbarDeleteBtn: {
    backgroundColor: colors.dangerSoft,
    borderColor: colors.dangerBorder,
  },
  toolbarDeleteText: {
    color: colors.danger,
    fontWeight: typography.fontWeight.bold,
  },
  modeBar: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceMuted,
    padding: spacing[4],
    marginHorizontal: spacing[16],
    marginTop: spacing[10],
    marginBottom: spacing[8],
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[6],
    paddingVertical: spacing[9],
    borderRadius: 9,
  },
  activeModeTab: {
    backgroundColor: colors.surface,
    ...Platform.select({
      ios: {
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  modeTabText: {
    fontSize: typography.fontSize[12.5],
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
  finishContainer: {
    flex: 1,
  },
  finishScrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[20],
    paddingVertical: spacing[32],
  },
  finishCard: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: spacing[28],
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: colors.border,
    ...Platform.select({
      ios: {
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  finishBadgeCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[14],
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
    fontSize: typography.fontSize[22],
    fontWeight: typography.fontWeight.extraBold,
    color: colors.text,
    marginBottom: spacing[6],
    letterSpacing: typography.letterSpacing[-0.3],
  },
  finishScore: {
    fontSize: typography.fontSize[16],
    fontWeight: typography.fontWeight.semiBold,
    color: colors.textMuted,
    marginBottom: spacing[8],
  },
  masteryPill: {
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[4],
    borderRadius: 16,
    marginBottom: spacing[24],
  },
  masteryPillHigh: {
    backgroundColor: colors.successSoft,
  },
  masteryPillLow: {
    backgroundColor: colors.primarySoft,
  },
  masteryPillText: {
    fontSize: typography.fontSize[14],
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
    gap: spacing[10],
  },
  restartBtn: {
    backgroundColor: colors.primarySoft,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  restartBtnText: {
    color: colors.primary,
    fontWeight: typography.fontWeight.bold,
    fontSize: typography.fontSize[15],
  },
  doneBtn: {
    backgroundColor: colors.primary,
    borderRadius: 14,
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
  doneBtnText: {
    color: colors.onPrimary,
    fontWeight: typography.fontWeight.bold,
    fontSize: typography.fontSize[15],
  },
  btnRow: {
    paddingVertical: spacing[14],
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing[8],
  },
});
