import React, { useEffect, useState } from 'react';
import {
  colors, spacing, typography } from '@/constants/theme';
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
} from '@hugeicons/core-free-icons';
import { listStudySets, deleteStudySet, updateStudySet } from '../../lib/api/studySets';
import { getStreak } from '../../lib/api/stats';
import { localDb } from '../../lib/storage/localDb';
import { PlatformPressable } from '../../components/common/PlatformPressable';
import { ConfirmationModal } from '../../components/common/ConfirmationModal';
import { RenameModal } from '../../components/common/RenameModal';
import { DashboardFAB } from '../../components/common/DashboardFAB';
import { SmoothScrollView } from '../../components/common/SmoothScrollView';
import { TabTransitionView } from '../../components/common/TabTransitionView';
import { StudySet } from '../../types';
import { DynamicMomoHead } from '../../components/mascot/DynamicMomoHead';
import { getRandomStudyQuote, StudyQuote } from '../../lib/data/studyQuotes';
import { useCredits } from '../../context/CreditsContext';
import { SampleDeckCard } from '../../components/onboarding/SampleDeckCard';

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
  const totalCards = sets.reduce((sum, s) => sum + (s.item_count || 0), 0);

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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <TouchableOpacity
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#FEF3C7',
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: '#FDE68A',
                gap: 6
              }}
              onPress={() => router.push('/shop')}
              activeOpacity={0.8}
            >
              <HugeiconsIcon icon={Coins01Icon} size={18} color="#D97706" />
              <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#B45309' }}>{xp} XP</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Interactive Momo with Chat Bubble */}
        <View style={styles.momoBannerContainer}>
          <TouchableOpacity
            style={styles.momoAvatarBtn}
            activeOpacity={0.7}
            onPress={() => {
              setMomoQuote(getRandomStudyQuote(momoQuote.id));
              setMomoVisible(true);
            }}
          >
            <DynamicMomoHead quote={momoQuote} size={120} />
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
            <Text style={styles.streakTitle}>🔥 {streakData.current_streak} Day Streak</Text>
            <Text style={styles.streakSub}>You're on a roll!</Text>
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
                        size={16}
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

        {/* Resume Study Widget */}
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
                    <HugeiconsIcon icon={FlashIcon} size={16} color={colors.onPrimary} strokeWidth={2.5} />
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
                    <HugeiconsIcon icon={HelpCircleIcon} size={16} color={colors.primaryDark} strokeWidth={2.2} />
                    <Text style={styles.resumeSecondaryBtnText}>Quiz</Text>
                  </View>
                </PlatformPressable>
              </View>
            </View>
          </View>
        ) : null}

        {/* Library Carousel Widget */}
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
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.carouselContainer}
              snapToInterval={280 + spacing[12]}
              decelerationRate="fast"
            >
              {sets.map((s) => (
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
                        <HugeiconsIcon icon={Edit02Icon} size={16} color={colors.textSecondary} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => setDeleteTarget(s)}
                        style={styles.iconBtn}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <HugeiconsIcon icon={Delete02Icon} size={16} color={colors.dangerAccent} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      </SmoothScrollView>

      {/* Floating Action Button */}
      <DashboardFAB
        onUpload={() => router.push('/documents/upload')}
        onStudySets={() => router.push('/(tabs)/library')}
        onMathSolve={() => router.push('/math/solve')}
        studySetsCount={sets.length}
      />

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
    </TabTransitionView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing[18],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[20],
  },
  headerTextCol: {
    flex: 1,
    marginRight: spacing[12],
  },
  dateLabel: {
    fontSize: typography.fontSize[12],
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: typography.letterSpacing[0.6],
    marginBottom: spacing[2],
  },
  greeting: {
    fontSize: typography.fontSize[26],
    fontWeight: typography.fontWeight.extraBold,
    color: colors.text,
    letterSpacing: -0.5,
  },
  profileBadge: {},
  avatarMini: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primarySoft,
    borderWidth: 2,
    borderColor: colors.primaryBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarMiniText: {
    fontSize: typography.fontSize[15],
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
  },
  momoBannerContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 120,
    marginBottom: 0,
    paddingHorizontal: 2,
    zIndex: 1,
    elevation: 1,
  },
  momoAvatarBtn: {
    marginRight: 8,
    marginBottom: 0,
    position: 'relative',
    zIndex: 2,
    elevation: 2,
  },
  chatBubble: {
    flex: 1,
    height: 80,
    marginBottom: 12,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FDE68A',
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 1,
    elevation: 1,
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
    paddingRight: 8,
    justifyContent: 'center',
  },
  momoTipTitle: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#92400E',
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  momoTipDesc: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#78350F',
    lineHeight: 17,
  },
  momoCloseBtn: {
    padding: 6,
    marginLeft: 2,
  },
  momoCloseText: {
    fontSize: 13,
    color: '#B45309',
    fontWeight: 'bold',
  },
  streakTimelineContainer: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing[16],
    marginBottom: spacing[16],
    borderWidth: 1,
    borderColor: colors.border,
    zIndex: 10,
    elevation: 10,
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
  streakHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: spacing[16],
  },
  streakTitle: {
    fontSize: typography.fontSize[16],
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
  },
  streakSub: {
    fontSize: typography.fontSize[13],
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
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakDayActive: {
    backgroundColor: colors.primarySoft,
  },
  streakDayToday: {
    backgroundColor: colors.primary,
  },
  streakDayText: {
    fontSize: typography.fontSize[12],
    fontWeight: typography.fontWeight.bold,
    color: colors.textMuted,
  },
  streakDayLabel: {
    fontSize: typography.fontSize[11],
    fontWeight: typography.fontWeight.medium,
    color: colors.textMuted,
  },
  streakDayLabelActive: {
    color: colors.primary,
    fontWeight: typography.fontWeight.bold,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing[12],
    marginBottom: spacing[24],
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    paddingVertical: spacing[16],
    paddingHorizontal: spacing[12],
    borderRadius: 16,
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
    fontSize: typography.fontSize[24],
    fontWeight: typography.fontWeight.black,
    color: colors.primary,
    marginBottom: spacing[2],
  },
  statLabel: {
    fontSize: typography.fontSize[11],
    fontWeight: typography.fontWeight.semiBold,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  section: {
    marginBottom: spacing[28],
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[12],
  },
  sectionTitle: {
    fontSize: typography.fontSize[19],
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
    letterSpacing: -0.3,
    marginBottom: spacing[12],
  },
  seeAllText: {
    fontSize: typography.fontSize[13],
    color: colors.primary,
    fontWeight: typography.fontWeight.semiBold,
  },
  resumeWidget: {
    backgroundColor: colors.primaryDark,
    borderRadius: 20,
    padding: spacing[20],
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
    fontSize: typography.fontSize[10],
    fontWeight: typography.fontWeight.bold,
    color: colors.successBorder,
    letterSpacing: 0.5,
  },
  resumeCountText: {
    fontSize: typography.fontSize[12],
    fontWeight: typography.fontWeight.semiBold,
    color: colors.primaryBorder,
  },
  resumeTitle: {
    fontSize: typography.fontSize[22],
    fontWeight: typography.fontWeight.extraBold,
    color: colors.onPrimary,
    marginBottom: spacing[20],
    lineHeight: typography.lineHeight[26],
    letterSpacing: -0.3,
  },
  resumeActionGrid: {
    flexDirection: 'row',
    gap: spacing[12],
  },
  resumePrimaryBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 12,
  },
  resumeSecondaryBtn: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 12,
  },
  resumeBtnContent: {
    paddingVertical: spacing[14],
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing[8],
  },
  resumePrimaryBtnText: {
    color: colors.onPrimary,
    fontWeight: typography.fontWeight.bold,
    fontSize: typography.fontSize[14],
  },
  resumeSecondaryBtnText: {
    color: colors.primaryDark,
    fontWeight: typography.fontWeight.bold,
    fontSize: typography.fontSize[14],
  },
  carouselContainer: {
    gap: spacing[12],
    paddingRight: spacing[18],
  },
  carouselCard: {
    width: 280,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing[16],
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'space-between',
    minHeight: 120,
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
    fontSize: typography.fontSize[16],
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
    lineHeight: typography.lineHeight[22],
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
    fontSize: typography.fontSize[13],
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
  emptyState: {
    padding: spacing[32],
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  emptyIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[16],
  },
  emptyTitle: {
    fontSize: typography.fontSize[17],
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
  },
  emptySubtitle: {
    fontSize: typography.fontSize[14],
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing[6],
    lineHeight: typography.lineHeight[20],
  },
});
