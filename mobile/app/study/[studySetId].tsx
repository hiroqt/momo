import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
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
  const [mode, setMode] = useState<'flashcard' | 'quiz' | 'exam'>('flashcard');
  const [formatFilter, setFormatFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [finishedScore, setFinishedScore] = useState<{ correct: number; total: number } | null>(null);

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
        } else if (initialMode === 'exam' && hasQz) {
          setMode('exam');
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
          } else if (initialMode === 'exam' && hasQz) {
            setMode('exam');
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
    setFinishedScore(null);
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4F46E5" />
        <Text style={styles.loadingText}>Loading study reviewer...</Text>
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
            { paddingBottom: Math.max(insets.bottom, Platform.OS === 'android' ? 28 : 24) + 20 },
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
                color={isMastered ? '#D97706' : '#4F46E5'}
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
          </View>
        </SmoothScrollView>
      </View>
    );
  }

  const headerActions = (
    <View style={styles.headerActionRow}>
      <TouchableOpacity
        style={styles.headerShuffleBtn}
        onPress={() => {
          setItems((prev) => randomizeStudyItems(prev));
          Alert.alert('Deck Reshuffled', 'The questions and answer choices have been randomized.');
        }}
        disabled={isRenaming || isDeleting}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityLabel="Reshuffle question set"
      >
        <HugeiconsIcon icon={RefreshIcon} size={17} color="#4F46E5" strokeWidth={2.2} />
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.headerEditBtn}
        onPress={() => setShowRenameModal(true)}
        disabled={isRenaming || isDeleting}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityLabel="Rename quiz"
      >
        <HugeiconsIcon icon={Edit02Icon} size={18} color="#4F46E5" strokeWidth={1.8} />
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.headerDeleteBtn}
        onPress={() => setShowDeleteModal(true)}
        disabled={isDeleting || isRenaming}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityLabel="Delete reviewer"
      >
        <HugeiconsIcon icon={Delete02Icon} size={18} color="#EF4444" strokeWidth={1.8} />
      </TouchableOpacity>
    </View>
  );

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

  const distinctQuizTypes = Array.from(new Set(actualQuizItems.map((i) => i.type)));
  const activeQuizItems = formatFilter === 'all'
    ? actualQuizItems
    : actualQuizItems.filter((i) => i.type === formatFilter);

  const availableModes: { key: 'flashcard' | 'quiz' | 'exam'; label: string; icon: any }[] = [];
  if (hasFlashcards) {
    availableModes.push({ key: 'flashcard', label: 'Flashcards', icon: BookOpen01Icon });
  }
  if (hasQuiz) {
    availableModes.push({ key: 'quiz', label: 'Practice Quiz', icon: CheckmarkCircle02Icon });
    availableModes.push({ key: 'exam', label: 'Timed Exam', icon: Clock01Icon });
  }

  const screenSubtitle = mode === 'flashcard'
    ? `${actualFlashcardItems.length} flashcards`
    : mode === 'exam'
    ? `${actualQuizItems.length} timed questions`
    : `${activeQuizItems.length} quiz questions`;

  return (
    <View style={styles.screen}>
      <PageHeader
        title={studySet?.title || 'Reviewer'}
        subtitle={screenSubtitle}
        rightAction={headerActions}
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
                  color={isActive ? '#4F46E5' : '#64748B'}
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

      {/* Format Filter Bar (Shown when multiple quiz formats are present) */}
      {distinctQuizTypes.length > 1 && mode !== 'flashcard' && (
        <View style={styles.formatFilterRow}>
          <TouchableOpacity
            style={[styles.formatFilterChip, formatFilter === 'all' && styles.activeFormatFilterChip]}
            onPress={() => setFormatFilter('all')}
            activeOpacity={0.7}
          >
            <Text style={[styles.formatFilterChipText, formatFilter === 'all' && styles.activeFormatFilterChipText]}>
              All Selected ({actualQuizItems.length})
            </Text>
          </TouchableOpacity>
          {distinctQuizTypes.map((t) => {
            const countForType = actualQuizItems.filter((i) => i.type === t).length;
            const label = t === 'multiple_choice'
              ? 'Multiple Choice'
              : t === 'true_false'
              ? 'True / False'
              : t === 'identification'
              ? 'Identification'
              : t;
            const isSelected = formatFilter === t;
            return (
              <TouchableOpacity
                key={t}
                style={[styles.formatFilterChip, isSelected && styles.activeFormatFilterChip]}
                onPress={() => setFormatFilter(t)}
                activeOpacity={0.7}
              >
                <Text style={[styles.formatFilterChipText, isSelected && styles.activeFormatFilterChipText]}>
                  {label} ({countForType})
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Content Runner */}
      <View style={styles.contentArea}>
        {mode === 'flashcard' ? (
          <FlashcardDeck
            key={`fc-${actualFlashcardItems.length}`}
            items={actualFlashcardItems}
            onFinish={() => setFinishedScore({ correct: actualFlashcardItems.length, total: actualFlashcardItems.length })}
          />
        ) : (
          <QuizRunner
            key={`quiz-${mode}-${formatFilter}-${activeQuizItems.length}`}
            items={activeQuizItems}
            isExamMode={mode === 'exam'}
            onFinish={(res) => setFinishedScore(res)}
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
    backgroundColor: '#F8FAFC',
  },
  headerActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerShuffleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E0E7FF',
  },
  headerEditBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerDeleteBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeBar: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    padding: 4,
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  formatFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
    flexWrap: 'wrap',
  },
  formatFilterChip: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  activeFormatFilterChip: {
    backgroundColor: '#EEF2FF',
    borderColor: '#4F46E5',
  },
  formatFilterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  activeFormatFilterChipText: {
    color: '#4F46E5',
    fontWeight: '700',
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 9,
  },
  activeModeTab: {
    backgroundColor: '#FFFFFF',
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
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
    fontSize: 12.5,
    fontWeight: '600',
    color: '#64748B',
  },
  activeModeTabText: {
    color: '#4F46E5',
    fontWeight: '700',
  },
  contentArea: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
  },
  finishContainer: {
    flex: 1,
  },
  finishScrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    paddingVertical: 32,
  },
  finishCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
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
    marginBottom: 14,
  },
  trophyBadge: {
    backgroundColor: '#FEF3C7',
    borderWidth: 2,
    borderColor: '#FDE68A',
  },
  bookBadge: {
    backgroundColor: '#EEF2FF',
    borderWidth: 2,
    borderColor: '#E0E7FF',
  },
  finishTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  finishScore: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 8,
  },
  masteryPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
    marginBottom: 24,
  },
  masteryPillHigh: {
    backgroundColor: '#ECFDF5',
  },
  masteryPillLow: {
    backgroundColor: '#EEF2FF',
  },
  masteryPillText: {
    fontSize: 14,
    fontWeight: '800',
  },
  masteryTextHigh: {
    color: '#059669',
  },
  masteryTextLow: {
    color: '#4F46E5',
  },
  finishActionCol: {
    width: '100%',
    gap: 10,
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
