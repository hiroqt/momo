import React, { useEffect, useState } from 'react';
import { colors, spacing, typography } from '@/constants/theme';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Platform,
  StatusBar as RNStatusBar,
} from 'react-native';
import { AppText as Text } from '@/components/common/app-text';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  BookOpen01Icon,
  ArrowRight01Icon,
  Delete02Icon,
  Edit02Icon,
  FlashIcon,
  CheckmarkCircle02Icon,
  HelpCircleIcon,
  Upload01Icon,
  Coins01Icon,
  Share01Icon,
  AiChat02Icon,
  Camera01Icon,
  Add01Icon,
} from '@hugeicons/core-free-icons';
import { listStudySets, deleteStudySet, updateStudySet } from '../../lib/api/studySets';
import { getStreak } from '../../lib/api/stats';
import { localDb } from '../../lib/storage/localDb';
import { PlatformPressable } from '../../components/common/PlatformPressable';
import { ConfirmationModal } from '../../components/common/ConfirmationModal';
import { RenameModal } from '../../components/common/RenameModal';
import { AcademicWeaponShareModal } from '../../components/social/AcademicWeaponShareModal';
import { SmoothScrollView } from '../../components/common/SmoothScrollView';
import { TabTransitionView } from '../../components/common/TabTransitionView';
import { StudySet } from '../../types';
import { DynamicMomoHead } from '../../components/mascot/DynamicMomoHead';
import { getRandomStudyQuote, StudyQuote } from '../../lib/data/studyQuotes';
import { useCredits } from '../../context/CreditsContext';
import { SampleDeckCard } from '../../components/onboarding/SampleDeckCard';
import { isIpad } from '@/utils/device';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function getFormattedDate(): string {
  const now = new Date();
  return now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

const PROMPT_SHORTCUTS = [
  { label: 'Quiz me on notes', prompt: 'Quiz me on my uploaded notes with multiple choice questions', emoji: '🎯' },
  { label: 'Explain key concepts', prompt: 'Explain the core concepts from my study materials simply', emoji: '💡' },
  { label: 'Solve math problem', prompt: 'Help me solve and understand a math problem step-by-step', emoji: '📐' },
  { label: 'Make 10 flashcards', prompt: 'Build a quick 10-card study deck from my notes', emoji: '⚡' },
];

export default function HomeScreen() {
  const router = useRouter();
  const { xp } = useCredits();
  const insets = useSafeAreaInsets();
  const [sets, setSets] = useState<StudySet[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<StudySet | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [renameTarget, setRenameTarget] = useState<StudySet | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [streakData, setStreakData] = useState<{ active_dates: string[]; current_streak: number }>({ active_dates: [], current_streak: 0 });
  const [showStreakStoryModal, setShowStreakStoryModal] = useState(false);

  const [momoVisible, setMomoVisible] = useState(true);
  const [momoQuote, setMomoQuote] = useState<StudyQuote>(() => getRandomStudyQuote());

  const handleConfirmRename = async (newTitle: string) => {
    if (!renameTarget) return;

    setIsRenaming(true);
    try {
      await updateStudySet(renameTarget.id, { title: newTitle });
      await localDb.updateStudySetTitle(renameTarget.id, newTitle);
      setSets((prev) =>
        prev.map((s) => (s.id === renameTarget.id ? { ...s, title: newTitle } : s))
      );
      setRenameTarget(null);
    } catch {
      await localDb.updateStudySetTitle(renameTarget.id, newTitle);
      setSets((prev) =>
        prev.map((s) => (s.id === renameTarget.id ? { ...s, title: newTitle } : s))
      );
      setRenameTarget(null);
    } finally {
      setIsRenaming(false);
    }
  };

  const loadData = async () => {
    try {
      const [setsData, streakRes] = await Promise.all([
        listStudySets().catch(() => localDb.listStudySets()),
        getStreak().catch(() => ({ active_dates: [], current_streak: 0 }))
      ]);
      setSets(setsData || []);
      if (streakRes) {
        setStreakData(streakRes);
      }
    } catch (err) {
      console.warn('Error loading home data:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    setIsDeleting(true);
    try {
      const id = deleteTarget.id;
      await deleteStudySet(id);
      await localDb.deleteStudySet(id);
      setSets((prev) => prev.filter((s) => s.id !== id));
      setDeleteTarget(null);
    } catch (err) {
      console.warn('Delete failed:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const featured = sets.length > 0 ? sets[0] : null;
  // Eliminate card redundancy: Library carousel only renders non-featured sets
  const otherSets = sets.slice(1);
  const totalCards = sets.reduce((sum, s) => sum + (s.item_count || 0), 0);

  const isTablet = isIpad();

  return (
    <TabTransitionView style={styles.screen} tabName="index">
      <SmoothScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: Platform.OS === 'android'
              ? Math.max(insets.top, RNStatusBar.currentHeight || spacing[0], spacing[28]) + spacing[14]
              : Math.max(insets.top, spacing[20]),
            paddingBottom: Math.max(insets.bottom, spacing[24]) + spacing[88],
          },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* Modular Header */}
        <View style={styles.header}>
          <View style={styles.headerTextCol}>
            <Text style={styles.dateLabel}>{getFormattedDate()}</Text>
            <Text style={styles.greeting}>{getGreeting()}</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.headerXpBadge}
              onPress={() => router.push('/shop')}
              activeOpacity={0.8}
              accessibilityLabel={`${xp} XP`}
              accessibilityRole="button"
            >
              <HugeiconsIcon icon={Coins01Icon} size={isTablet ? 24 : 18} color="#D97706" />
              <Text style={styles.headerXpBadgeText}>{xp} XP</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Day Streak Section - Momo Mascot Caps the Top of the Streak Card */}
        <View style={styles.streakSection}>
          {/* Momo Mascot Header Anchor (Capping the Streak Card, Zero Gap, Non-Overlapping) */}
          <View style={styles.momoMascotAnchorRow}>
            <TouchableOpacity
              style={styles.momoAvatarBtn}
              activeOpacity={0.75}
              onPress={() => {
                setMomoQuote(getRandomStudyQuote(momoQuote.id));
                setMomoVisible(true);
              }}
              accessibilityLabel="Tap Momo for study tip"
            >
              <DynamicMomoHead quote={momoQuote} size={isTablet ? 140 : 105} />
            </TouchableOpacity>

            {momoVisible && (
              <View style={styles.chatBubble}>
                <View style={styles.chatBubbleTailOuter} />
                <View style={styles.chatBubbleTail} />
                <TouchableOpacity
                  style={styles.chatBubbleContent}
                  activeOpacity={0.7}
                  onPress={() => setMomoQuote(getRandomStudyQuote(momoQuote.id))}
                >
                  <Text style={styles.momoTipTitle} numberOfLines={1}>{momoQuote.categoryLabel}</Text>
                  <Text style={styles.momoTipDesc} numberOfLines={2}>{momoQuote.quote}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.momoCloseBtn} onPress={() => setMomoVisible(false)}>
                  <Text style={styles.momoCloseText}>✕</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Horizontal Streak Timeline */}
          <View style={styles.streakTimelineContainer}>
            <View style={styles.streakHeader}>
              <View>
                <Text style={styles.streakTitle}>
                  🔥 {streakData.current_streak} {streakData.current_streak === 1 ? 'Day' : 'Days'} Streak
                </Text>
                <Text style={styles.streakSub}>You're on a roll!</Text>
              </View>
              <TouchableOpacity
                style={styles.streakShareBtn}
                onPress={() => setShowStreakStoryModal(true)}
                activeOpacity={0.75}
              >
                <HugeiconsIcon icon={Share01Icon} size={14} color="#EF4444" strokeWidth={2.4} />
                <Text style={styles.streakShareText}>Share</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.streakDays}>
              {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, idx) => {
                const today = new Date();
                const currentDayOfWeek = today.getDay() === 0 ? 6 : today.getDay() - 1;
                const dateForDay = new Date(today);
                dateForDay.setDate(today.getDate() - currentDayOfWeek + idx);
                
                const yyyy = dateForDay.getFullYear();
                const mm = String(dateForDay.getMonth() + 1).padStart(2, '0');
                const dd = String(dateForDay.getDate()).padStart(2, '0');
                const dateStr = `${yyyy}-${mm}-${dd}`;
                
                const isActive = streakData.active_dates.includes(dateStr);
                const isToday = idx === currentDayOfWeek;
                
                return (
                  <View key={idx} style={styles.streakDayWrapper}>
                    <View style={[
                      styles.streakDayCircle,
                      isActive && !isToday && { backgroundColor: colors.warningSoft },
                      isToday && { backgroundColor: isActive ? colors.warningAccent : colors.surfaceMuted },
                      isToday && !isActive && { borderWidth: 1, borderColor: colors.borderStrong }
                    ]}>
                      {isActive ? (
                        <HugeiconsIcon
                          icon={CheckmarkCircle02Icon}
                          size={isTablet ? 22 : 16}
                          color={isToday ? colors.onPrimary : colors.warningAccent}
                        />
                      ) : (
                        <Text style={[
                          styles.streakDayText,
                          isToday && { color: colors.text, fontWeight: typography.fontWeight.black }
                        ]}>{day}</Text>
                      )}
                    </View>
                    <Text style={[
                      styles.streakDayLabel,
                      isActive && { color: colors.warningAccent, fontWeight: typography.fontWeight.bold }
                    ]}>{day}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        </View>

        {/* Momo AI Tutor Suite */}
        <View style={styles.momoTutorSection}>
          {/* Momo AI Tutor Card */}
          <View style={styles.momoAiWidgetCard}>
            <TouchableOpacity
              style={styles.momoAiWidgetHeader}
              onPress={() => router.push('/chat' as any)}
              activeOpacity={0.85}
              accessibilityLabel="Open Momo AI chat"
              accessibilityRole="button"
            >
              <View style={styles.momoAiWidgetTextCol}>
                <View style={styles.momoAiTagRow}>
                  <Text style={styles.momoAiWidgetTitle}>Momo AI Tutor</Text>
                  {/* Clean Grounded AI Badge WITHOUT Sparkle Icon */}
                  <View style={styles.momoAiGroundedPill}>
                    <Text style={styles.momoAiGroundedText}>Grounded AI</Text>
                  </View>
                </View>
                <Text style={styles.momoAiWidgetDesc}>
                  Ask questions from your study materials, generate diagrams, or get instant review help.
                </Text>
              </View>
            </TouchableOpacity>

            {/* Quick Prompt Shortcut Grid (Non-scrolling 2x2 grid) */}
            <View style={styles.momoPromptGrid}>
              {PROMPT_SHORTCUTS.map((chip, i) => (
                <TouchableOpacity
                  key={i}
                  style={styles.momoPromptGridItem}
                  onPress={() => router.push({ pathname: '/chat', params: { initialPrompt: chip.prompt } } as any)}
                  activeOpacity={0.75}
                >
                  <Text style={styles.momoPromptChipEmoji}>{chip.emoji}</Text>
                  <Text style={styles.momoPromptChipText} numberOfLines={1}>
                    {chip.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Bottom Action Bar */}
            <TouchableOpacity
              style={styles.momoChatCtaBtn}
              onPress={() => router.push('/chat' as any)}
              activeOpacity={0.85}
            >
              <View style={styles.momoChatCtaLeft}>
                <HugeiconsIcon icon={AiChat02Icon} size={18} color="#FFFFFF" strokeWidth={2.2} />
                <Text style={styles.momoChatCtaText}>Start Chat with Momo</Text>
              </View>
              <View style={styles.momoChatCtaArrow}>
                <HugeiconsIcon icon={ArrowRight01Icon} size={14} color={colors.primary} strokeWidth={2.4} />
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Prominent AI Study Tools Suite */}
        <View style={styles.aiCardsSection}>
          <View style={styles.aiCardsSectionHeader}>
            <Text style={styles.sectionTitle}>AI Study Tools</Text>
            {/* Clean AI Powered Badge WITHOUT Sparkle Icon */}
            <View style={styles.aiSectionBadge}>
              <Text style={styles.aiSectionBadgeText}>AI Powered</Text>
            </View>
          </View>

          <View style={styles.aiCardsGrid}>
            {/* Card 1: AI Math & Problem Solver */}
            <TouchableOpacity
              style={[styles.aiFeatureCard, styles.aiMathCard]}
              onPress={() => router.push('/math/solve')}
              activeOpacity={0.82}
            >
              <View style={styles.aiCardTopRow}>
                <View style={styles.aiMathIconWrap}>
                  <HugeiconsIcon icon={Camera01Icon} size={20} color="#D97706" strokeWidth={2.4} />
                </View>
                <View style={[styles.aiPillBadge, { backgroundColor: '#FEF3C7' }]}>
                  <Text style={[styles.aiPillText, { color: '#B45309' }]}>Vision AI</Text>
                </View>
              </View>
              <Text style={styles.aiCardTitle}>Solve a Problem</Text>
              <Text style={styles.aiCardSub}>Snap photo or enter equation for instant breakdown</Text>
              <View style={styles.aiCardFooter}>
                <Text style={[styles.aiCardActionText, { color: '#D97706' }]}>Scan now</Text>
                <HugeiconsIcon icon={ArrowRight01Icon} size={14} color="#D97706" />
              </View>
            </TouchableOpacity>

            {/* Card 2: AI Document Reviewer */}
            <TouchableOpacity
              style={[styles.aiFeatureCard, styles.aiUploadCard]}
              onPress={() => router.push('/documents/upload')}
              activeOpacity={0.82}
            >
              <View style={styles.aiCardTopRow}>
                <View style={styles.aiUploadIconWrap}>
                  <HugeiconsIcon icon={Upload01Icon} size={20} color="#059669" strokeWidth={2.4} />
                </View>
                <View style={[styles.aiPillBadge, { backgroundColor: '#D1FAE5' }]}>
                  <Text style={[styles.aiPillText, { color: '#047857' }]}>Doc → Decks</Text>
                </View>
              </View>
              <Text style={styles.aiCardTitle}>Generate Reviewer</Text>
              <Text style={styles.aiCardSub}>Upload PDF, DOCX, PPTX for instant flashcards & quiz</Text>
              <View style={styles.aiCardFooter}>
                <Text style={[styles.aiCardActionText, { color: '#059669' }]}>Upload file</Text>
                <HugeiconsIcon icon={ArrowRight01Icon} size={14} color="#059669" />
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Study Stats Widget (2 Cards) */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{totalCards}</Text>
            <Text style={styles.statLabel}>Total Cards</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{sets.length}</Text>
            <Text style={styles.statLabel}>Study Sets</Text>
          </View>
        </View>

        {/* Resume Study Widget - Active Deck */}
        {featured ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Resume Study</Text>

            <View style={styles.resumeWidget}>
              <View style={styles.resumeHeader}>
                <View style={styles.resumeActiveBadge}>
                  <View style={styles.pulseDot} />
                  <Text style={styles.resumeActiveText}>ACTIVE</Text>
                </View>
                <Text style={styles.resumeCountText}>{featured.item_count} Items</Text>
              </View>

              <Text style={styles.resumeTitle} numberOfLines={2}>{featured.title}</Text>

              <View style={styles.resumeActionGrid}>
                <PlatformPressable
                  style={styles.resumePrimaryBtn}
                  onPress={() =>
                    router.push({
                      pathname: '/study/[studySetId]',
                      params: { studySetId: featured.id, initialMode: 'flashcard' },
                    })
                  }
                >
                  <View style={styles.resumeBtnContent}>
                    <HugeiconsIcon icon={FlashIcon} size={isTablet ? 22 : 16} color={colors.onPrimary} strokeWidth={2.5} />
                    <Text style={styles.resumePrimaryBtnText}>Flashcards</Text>
                  </View>
                </PlatformPressable>

                <PlatformPressable
                  style={styles.resumeSecondaryBtn}
                  onPress={() =>
                    router.push({
                      pathname: '/study/[studySetId]',
                      params: { studySetId: featured.id, initialMode: 'quiz' },
                    })
                  }
                >
                  <View style={styles.resumeBtnContent}>
                    <HugeiconsIcon icon={HelpCircleIcon} size={isTablet ? 22 : 16} color={colors.primaryDark} strokeWidth={2.2} />
                    <Text style={styles.resumeSecondaryBtnText}>Quiz</Text>
                  </View>
                </PlatformPressable>
              </View>
            </View>
          </View>
        ) : null}

        {/* Library Carousel Widget - Non-Redundant (Shows other decks or invite card) */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Your Library</Text>
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/library')}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.seeAllText}>View All ({sets.length})</Text>
            </TouchableOpacity>
          </View>

          {sets.length === 0 ? (
            <SampleDeckCard onDeckSeeded={loadData} />
          ) : otherSets.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.carouselContainer}
              snapToInterval={(isTablet ? 420 : 280) + spacing[12]}
              decelerationRate="fast"
            >
              {otherSets.map((s) => (
                <TouchableOpacity
                  key={s.id}
                  style={styles.carouselCard}
                  onPress={() => router.push(`/study/${s.id}`)}
                  activeOpacity={0.8}
                >
                  <View style={styles.carouselCardTop}>
                    <Text style={styles.carouselTitle} numberOfLines={2}>
                      {s.title}
                    </Text>
                  </View>
                  <View style={styles.carouselCardBottom}>
                    <Text style={styles.carouselMeta}>{s.item_count} items</Text>
                    <View style={styles.carouselActions}>
                      <TouchableOpacity
                        onPress={() => setRenameTarget(s)}
                        style={styles.iconBtn}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <HugeiconsIcon icon={Edit02Icon} size={isTablet ? 20 : 16} color={colors.textSecondary} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => setDeleteTarget(s)}
                        style={styles.iconBtn}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <HugeiconsIcon icon={Delete02Icon} size={isTablet ? 20 : 16} color={colors.dangerAccent} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : (
            <TouchableOpacity
              style={styles.createDeckPromptCard}
              onPress={() => router.push('/documents/upload')}
              activeOpacity={0.8}
            >
              <View style={styles.createDeckPromptLeft}>
                <View style={styles.createDeckPromptIconCircle}>
                  <HugeiconsIcon icon={Add01Icon} size={20} color={colors.primary} />
                </View>
                <View style={styles.createDeckPromptTextCol}>
                  <Text style={styles.createDeckPromptTitle}>Add Another Reviewer</Text>
                  <Text style={styles.createDeckPromptSub}>
                    Upload more study notes to grow your revision library
                  </Text>
                </View>
              </View>
              <View style={styles.createDeckPromptArrow}>
                <HugeiconsIcon icon={ArrowRight01Icon} size={16} color={colors.primary} />
              </View>
            </TouchableOpacity>
          )}
        </View>
      </SmoothScrollView>

      {/* Modals */}
      <ConfirmationModal
        visible={deleteTarget !== null}
        title="Delete Reviewer?"
        message={`Are you sure you want to delete "${deleteTarget?.title}"? All generated flashcards and questions will be permanently deleted.`}
        confirmText="Delete Reviewer"
        isDestructive={true}
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <RenameModal
        visible={renameTarget !== null}
        initialTitle={renameTarget?.title || ''}
        isLoading={isRenaming}
        onSave={handleConfirmRename}
        onCancel={() => setRenameTarget(null)}
      />

      <AcademicWeaponShareModal
        visible={showStreakStoryModal}
        onClose={() => setShowStreakStoryModal(false)}
        inputData={{
          mode: 'streak',
          streak: streakData.current_streak,
        }}
      />
    </TabTransitionView>
  );
}

const isPadDevice = isIpad();

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: isPadDevice ? spacing[36] : spacing[18],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: isPadDevice ? spacing[20] : spacing[14],
  },
  headerTextCol: {
    flex: 1,
    marginRight: spacing[12],
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[8],
  },
  headerXpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: isPadDevice ? spacing[16] : spacing[12],
    paddingVertical: isPadDevice ? spacing[10] : spacing[8],
    borderRadius: isPadDevice ? 24 : 20,
    borderWidth: 1,
    borderColor: '#FDE68A',
    gap: spacing[6],
  },
  headerXpBadgeText: {
    fontSize: isPadDevice ? typography.fontSize[17] : typography.fontSize[14],
    fontWeight: typography.fontWeight.bold,
    color: '#B45309',
  },
  dateLabel: {
    fontSize: isPadDevice ? typography.fontSize[15] : typography.fontSize[12],
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: typography.letterSpacing[0.6],
    marginBottom: spacing[2],
  },
  greeting: {
    fontSize: isPadDevice ? typography.fontSize[34] : typography.fontSize[26],
    fontWeight: typography.fontWeight.extraBold,
    color: colors.text,
    letterSpacing: -0.5,
  },

  // Momo AI Tutor Suite (Anchored by Momo Mascot at the top, non-overlapping)
  momoTutorSection: {
    marginBottom: 20,
  },
  momoMascotAnchorRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: -1,
    paddingHorizontal: 6,
    zIndex: 10,
  },
  momoAvatarBtn: {
    marginRight: isPadDevice ? 14 : 10,
    marginBottom: 0,
    position: 'relative',
    zIndex: 2,
  },
  chatBubble: {
    flex: 1,
    minHeight: isPadDevice ? 90 : 72,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: isPadDevice ? 16 : 12,
    paddingVertical: isPadDevice ? 12 : 8,
    borderRadius: isPadDevice ? 20 : 16,
    borderWidth: 1,
    borderColor: '#FDE68A',
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#B45309',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  chatBubbleTailOuter: {
    position: 'absolute',
    left: -8,
    top: '50%',
    marginTop: -7,
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderTopWidth: 7,
    borderBottomWidth: 7,
    borderRightWidth: 8,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderRightColor: '#FDE68A',
    zIndex: 1,
  },
  chatBubbleTail: {
    position: 'absolute',
    left: -7,
    top: '50%',
    marginTop: -7,
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderTopWidth: 7,
    borderBottomWidth: 7,
    borderRightWidth: 8,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderRightColor: '#FEF3C7',
    zIndex: 2,
  },
  chatBubbleContent: {
    flex: 1,
    paddingRight: 6,
    justifyContent: 'center',
  },
  momoTipTitle: {
    fontSize: isPadDevice ? 13 : 11,
    fontWeight: '800',
    color: '#92400E',
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  momoTipDesc: {
    fontSize: isPadDevice ? 14.5 : 12,
    fontWeight: '600',
    color: '#78350F',
    lineHeight: isPadDevice ? 20 : 16,
  },
  momoCloseBtn: {
    padding: 6,
    marginLeft: 2,
  },
  momoCloseText: {
    fontSize: isPadDevice ? 15 : 13,
    color: '#B45309',
    fontWeight: 'bold',
  },

  // Momo AI Tutor Card (Sitting cleanly below the anchor, non-overlapping)
  momoAiWidgetCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: isPadDevice ? 26 : 20,
    paddingHorizontal: isPadDevice ? 22 : 16,
    paddingTop: isPadDevice ? 20 : 18,
    paddingBottom: isPadDevice ? 20 : 16,
    borderWidth: 1.5,
    borderColor: '#E9D7FE',
    marginTop: 0,
    ...Platform.select({
      ios: {
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  momoAiWidgetHeader: {
    marginBottom: 12,
  },
  momoAiWidgetTextCol: {
    width: '100%',
  },
  momoAiTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  momoAiWidgetTitle: {
    fontSize: isPadDevice ? 19 : 16.5,
    fontFamily: typography.fontFamily.bold,
    color: colors.text,
  },
  momoAiGroundedPill: {
    backgroundColor: '#F4EBFF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: '#D6BBFB',
  },
  momoAiGroundedText: {
    fontSize: 10.5,
    fontFamily: typography.fontFamily.bold,
    color: colors.primary,
  },
  momoAiWidgetDesc: {
    fontSize: isPadDevice ? 13.5 : 12,
    fontFamily: typography.fontFamily.regular,
    color: colors.textSecondary,
    lineHeight: 17,
  },
  momoPromptGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 14,
  },
  momoPromptGridItem: {
    width: '48.5%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#EAECF0',
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 12,
    gap: 6,
  },
  momoPromptChipEmoji: {
    fontSize: 13,
  },
  momoPromptChipText: {
    fontSize: isPadDevice ? 13 : 11.5,
    fontFamily: typography.fontFamily.medium,
    color: colors.text,
    flex: 1,
  },
  momoChatCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  momoChatCtaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  momoChatCtaText: {
    fontSize: 14,
    fontFamily: typography.fontFamily.bold,
    color: '#FFFFFF',
  },
  momoChatCtaArrow: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // AI Study Tools Grid
  aiCardsSection: {
    marginBottom: 20,
  },
  aiCardsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  aiSectionBadge: {
    backgroundColor: '#F4EBFF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: '#D6BBFB',
  },
  aiSectionBadgeText: {
    fontSize: 11,
    fontFamily: typography.fontFamily.bold,
    color: colors.primary,
  },
  aiCardsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  aiFeatureCard: {
    flex: 1,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    justifyContent: 'space-between',
    minHeight: 136,
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  aiMathCard: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
    ...Platform.select({
      ios: { shadowColor: '#D97706' },
    }),
  },
  aiUploadCard: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    ...Platform.select({
      ios: { shadowColor: '#059669' },
    }),
  },
  aiCardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  aiMathIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiUploadIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiPillBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  aiPillText: {
    fontSize: 10,
    fontFamily: typography.fontFamily.bold,
  },
  aiCardTitle: {
    fontSize: 14.5,
    fontFamily: typography.fontFamily.bold,
    color: colors.text,
    marginBottom: 3,
  },
  aiCardSub: {
    fontSize: 11,
    fontFamily: typography.fontFamily.regular,
    color: colors.textSecondary,
    lineHeight: 15,
    marginBottom: 8,
  },
  aiCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  aiCardActionText: {
    fontSize: 11.5,
    fontFamily: typography.fontFamily.bold,
  },

  // Streak Section with Momo Mascot Capping the Top
  streakSection: {
    marginBottom: 20,
  },
  streakTimelineContainer: {
    backgroundColor: colors.surface,
    borderRadius: isPadDevice ? 22 : 18,
    paddingHorizontal: isPadDevice ? spacing[22] : spacing[16],
    paddingTop: isPadDevice ? spacing[20] : 16,
    paddingBottom: isPadDevice ? spacing[20] : 16,
    marginBottom: 0,
    marginTop: 0,
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    ...Platform.select({
      ios: {
        shadowColor: '#D97706',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.06,
        shadowRadius: 10,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  streakHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: isPadDevice ? spacing[20] : spacing[16],
  },
  streakShareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  streakShareText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#EF4444',
  },
  streakTitle: {
    fontSize: isPadDevice ? typography.fontSize[20] : typography.fontSize[16],
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
  },
  streakSub: {
    fontSize: isPadDevice ? typography.fontSize[15] : typography.fontSize[13],
    color: colors.primary,
    fontWeight: typography.fontWeight.medium,
  },
  streakDays: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  streakDayWrapper: {
    alignItems: 'center',
    gap: spacing[6],
  },
  streakDayCircle: {
    width: isPadDevice ? 46 : 32,
    height: isPadDevice ? 46 : 32,
    borderRadius: isPadDevice ? 23 : 16,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakDayText: {
    fontSize: isPadDevice ? typography.fontSize[15] : typography.fontSize[12],
    fontWeight: typography.fontWeight.bold,
    color: colors.textMuted,
  },
  streakDayLabel: {
    fontSize: isPadDevice ? typography.fontSize[13] : typography.fontSize[11],
    fontWeight: typography.fontWeight.medium,
    color: colors.textMuted,
  },

  // Stats Row
  statsRow: {
    flexDirection: 'row',
    gap: isPadDevice ? spacing[16] : spacing[12],
    marginBottom: isPadDevice ? spacing[28] : spacing[20],
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    paddingVertical: isPadDevice ? spacing[20] : spacing[14],
    paddingHorizontal: isPadDevice ? spacing[18] : spacing[12],
    borderRadius: isPadDevice ? 20 : 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    ...Platform.select({
      ios: {
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  statValue: {
    fontSize: isPadDevice ? typography.fontSize[34] : typography.fontSize[24],
    fontWeight: typography.fontWeight.black,
    color: colors.primary,
    marginBottom: spacing[2],
  },
  statLabel: {
    fontSize: isPadDevice ? typography.fontSize[13] : typography.fontSize[11],
    fontWeight: typography.fontWeight.semiBold,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },

  // Section Styles
  section: {
    marginBottom: isPadDevice ? spacing[32] : spacing[24],
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[12],
  },
  sectionTitle: {
    fontSize: isPadDevice ? typography.fontSize[24] : typography.fontSize[19],
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
    letterSpacing: -0.3,
  },
  seeAllText: {
    fontSize: isPadDevice ? typography.fontSize[15] : typography.fontSize[13],
    color: colors.primary,
    fontWeight: typography.fontWeight.semiBold,
  },

  // Resume Widget
  resumeWidget: {
    backgroundColor: colors.primaryDark,
    borderRadius: isPadDevice ? 24 : 20,
    padding: isPadDevice ? spacing[28] : spacing[20],
    ...Platform.select({
      ios: {
        shadowColor: colors.primaryDark,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  resumeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[12],
  },
  resumeActiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: spacing[8],
    paddingVertical: spacing[4],
    borderRadius: 8,
    gap: spacing[6],
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.successAccent,
  },
  resumeActiveText: {
    fontSize: isPadDevice ? typography.fontSize[12] : typography.fontSize[10],
    fontWeight: typography.fontWeight.bold,
    color: colors.successBorder,
    letterSpacing: 0.5,
  },
  resumeCountText: {
    fontSize: isPadDevice ? typography.fontSize[14] : typography.fontSize[12],
    fontWeight: typography.fontWeight.semiBold,
    color: colors.primaryBorder,
  },
  resumeTitle: {
    fontSize: isPadDevice ? typography.fontSize[28] : typography.fontSize[22],
    fontWeight: typography.fontWeight.extraBold,
    color: colors.onPrimary,
    marginBottom: spacing[20],
    lineHeight: isPadDevice ? 36 : typography.lineHeight[26],
    letterSpacing: -0.3,
  },
  resumeActionGrid: {
    flexDirection: 'row',
    gap: spacing[12],
  },
  resumePrimaryBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: isPadDevice ? 16 : 12,
  },
  resumeSecondaryBtn: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: isPadDevice ? 16 : 12,
  },
  resumeBtnContent: {
    paddingVertical: isPadDevice ? spacing[18] : spacing[14],
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing[8],
  },
  resumePrimaryBtnText: {
    color: colors.onPrimary,
    fontWeight: typography.fontWeight.bold,
    fontSize: isPadDevice ? typography.fontSize[16] : typography.fontSize[14],
  },
  resumeSecondaryBtnText: {
    color: colors.primaryDark,
    fontWeight: typography.fontWeight.bold,
    fontSize: isPadDevice ? typography.fontSize[16] : typography.fontSize[14],
  },

  // Carousel
  carouselContainer: {
    gap: isPadDevice ? spacing[16] : spacing[12],
    paddingRight: isPadDevice ? spacing[36] : spacing[18],
  },
  carouselCard: {
    width: isPadDevice ? 420 : 280,
    backgroundColor: colors.surface,
    borderRadius: isPadDevice ? 20 : 16,
    padding: isPadDevice ? spacing[22] : spacing[16],
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'space-between',
    minHeight: isPadDevice ? 160 : 120,
    ...Platform.select({
      ios: {
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  carouselCardTop: {
    marginBottom: spacing[12],
  },
  carouselTitle: {
    fontSize: isPadDevice ? typography.fontSize[20] : typography.fontSize[16],
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
    lineHeight: isPadDevice ? 28 : typography.lineHeight[22],
  },
  carouselCardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing[12],
  },
  carouselMeta: {
    fontSize: isPadDevice ? typography.fontSize[15] : typography.fontSize[13],
    fontWeight: typography.fontWeight.medium,
    color: colors.textMuted,
  },
  carouselActions: {
    flexDirection: 'row',
    gap: spacing[12],
  },
  iconBtn: {
    padding: spacing[2],
  },

  // Create another deck card (Non-redundant state when 1 deck exists)
  createDeckPromptCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#E9D7FE',
    borderStyle: 'dashed',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  createDeckPromptLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  createDeckPromptIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  createDeckPromptTextCol: {
    flex: 1,
  },
  createDeckPromptTitle: {
    fontSize: 14.5,
    fontFamily: typography.fontFamily.bold,
    color: colors.text,
    marginBottom: 2,
  },
  createDeckPromptSub: {
    fontSize: 11.5,
    fontFamily: typography.fontFamily.regular,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  createDeckPromptArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
