import { MomoAnimation } from '@/components/mascot/MomoAnimation';
import React, { useCallback, useState, useRef } from 'react';
import { Platform, RefreshControl, StatusBar as RNStatusBar, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText as Text } from '@/components/common/app-text';
import { SmoothScrollView } from '@/components/common/SmoothScrollView';
import { StudyIcon } from '@/components/common/StudyIcon';
import { dashboardStudyAction, getWeekDate } from '@/lib/screens/dashboardModel';
import { DynamicMomoHead } from '@/components/mascot/DynamicMomoHead';
import { colors, spacing, typography } from '@/constants/theme';
import { useCredits } from '@/context/CreditsContext';
import { getStreak } from '@/lib/api/stats';
import { listStudySets } from '@/lib/api/studySets';
import { getRandomStudyQuote, StudyQuote } from '@/lib/data/studyQuotes';
import { localDb } from '@/lib/storage/localDb';
import { StudySet } from '@/types';
import { isIpad } from '@/utils/device';

const WEEKDAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const LIBRARY_PREVIEW_LIMIT = 4;

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function getFormattedDate(): string {
  return new Date().toLocaleDateString('en-US', {
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
  const [streakData, setStreakData] = useState<{
    active_dates: string[];
    current_streak: number;
  }>({ active_dates: [], current_streak: 0 });
  const previousStreak = useRef<number | null>(null);
  const [ignitingStreak, setIgnitingStreak] = useState(false);
  const [momoVisible, setMomoVisible] = useState(true);
  const [momoQuote, setMomoQuote] = useState<StudyQuote>(() => getRandomStudyQuote());

  const loadData = useCallback(async () => {
    try {
      // Show the onboarding preview immediately, even while the network waits.
      setSets(await localDb.listStudySets());
      const [setsData, streakResponse, localSets] = await Promise.all([
        listStudySets().catch(() => localDb.listStudySets()),
        getStreak().catch(() => ({ active_dates: [], current_streak: 0 })),
        localDb.listStudySets(),
      ]);
      const remoteSets = setsData || [];
      const previews = localSets.filter((set) => set.generation_config?.preview === true);

      setSets([
        ...remoteSets,
        ...previews.filter((preview) => !remoteSets.some((remote) => remote.id === preview.id)),
      ]);
      if (previousStreak.current !== null && streakResponse.current_streak > previousStreak.current) {
        setIgnitingStreak(true);
      }
      previousStreak.current = streakResponse.current_streak;
      setStreakData(streakResponse);
    } catch (error) {
      console.warn('Error loading home data:', error);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void loadData();
  }, [loadData]));

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const visibleSets = sets.filter(set => set.item_count > 0).slice(0, LIBRARY_PREVIEW_LIMIT);
  const studyAction = dashboardStudyAction(sets);

  return (
    <View style={styles.screen} testID="dashboard-screen">
      <SmoothScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop:
              Platform.OS === 'android'
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
        <View style={styles.header}>
          <View style={styles.headerTextColumn}>
            <Text style={styles.dateLabel}>{getFormattedDate()}</Text>
            <Text style={styles.greeting}>{getGreeting()}</Text>
          </View>
          <TouchableOpacity
            style={styles.xpBadge}
            testID="dashboard-shop"
            onPress={() => router.push('/(tabs)/shop')}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel={`${xp} XP, open shop`}
          >
            <StudyIcon name="coin" size={28} />
            <Text style={styles.xpBadgeText}>{xp} XP</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.studyHero}>
          <View style={styles.heroCopy}>
            <Text style={styles.heroEyebrow}>YOUR NEXT STUDY SESSION</Text>
            <Text style={styles.heroTitle}>{visibleSets.length ? 'A little focus.\nA little progress.' : 'Make room for\nyour next big idea.'}</Text>
            <Text style={styles.heroDescription}>{studyAction.description}</Text>
          </View>
          <MomoAnimation name="momo-reading" active={false} size={118} accessibilityLabel="Momo holding a study book" />
          <TouchableOpacity style={styles.heroButton} testID="dashboard-start-study" accessibilityRole="button"
            accessibilityLabel={studyAction.label} onPress={() => router.push(studyAction.route)} activeOpacity={0.8}>
            <StudyIcon name={visibleSets.length ? 'cards' : 'book'} size={28} />
            <Text style={styles.heroButtonText}>{studyAction.label}</Text>
            <Text style={styles.heroArrow}>→</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.quickAction} testID="dashboard-upload" accessibilityRole="button" accessibilityLabel="Upload study notes"
            onPress={() => router.push('/documents/upload')} activeOpacity={0.75}>
            <StudyIcon name="folder" size={40} /><Text style={styles.quickActionText}>Add notes</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAction} testID="dashboard-tutor" accessibilityRole="button" accessibilityLabel="Ask Momo AI tutor"
            onPress={() => router.push('/ai')} activeOpacity={0.75}>
            <StudyIcon name="brain" size={40} /><Text style={styles.quickActionText}>Ask Momo</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.streakSection}>
          <View style={styles.momoRow}>
            <TouchableOpacity
              style={styles.momoButton}
              activeOpacity={0.75}
              onPress={() => {
                setMomoQuote(getRandomStudyQuote(momoQuote.id));
                setMomoVisible(true);
              }}
              accessibilityRole="button"
              accessibilityLabel="Tap Momo for another study tip"
            >
              <DynamicMomoHead quote={momoQuote} size={isPadDevice ? 140 : 105} />
            </TouchableOpacity>

            {momoVisible && (
              <View style={styles.quoteBubble}>
                <View style={styles.quoteBubbleTailBorder} />
                <View style={styles.quoteBubbleTail} />
                <TouchableOpacity
                  style={styles.quoteContent}
                  activeOpacity={0.7}
                  onPress={() => setMomoQuote(getRandomStudyQuote(momoQuote.id))}
                  accessibilityRole="button"
                  accessibilityLabel="Show another study tip"
                >
                  <Text style={styles.quoteCategory} numberOfLines={1}>
                    {momoQuote.categoryLabel}
                  </Text>
                  <Text style={styles.quoteText} numberOfLines={2}>
                    {momoQuote.quote}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.quoteCloseButton}
                  onPress={() => setMomoVisible(false)}
                  accessibilityRole="button"
                  accessibilityLabel="Hide study tip"
                >
                  <Text style={styles.quoteCloseText}>✕</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <View style={styles.streakCard}>
            <Text style={styles.streakEyebrow}>CURRENT STREAK</Text>
            <View style={styles.streakHeading}>
              {streakData.current_streak > 0 && <MomoAnimation name={ignitingStreak ? 'streak-ignite' : 'streak-fire'} size={44} replayKey={streakData.current_streak} onFinish={() => setIgnitingStreak(false)} />}
              <Text style={styles.streakCount}>{streakData.current_streak}</Text>
              <Text style={styles.streakUnit}>
                {streakData.current_streak === 1 ? 'day' : 'days'}
              </Text>
            </View>
            <Text style={styles.streakMessage}>
              {streakData.current_streak > 0 ? 'Keep your learning rhythm going.' : 'Study today to begin your streak.'}
            </Text>

            <View style={styles.streakDays}>
              {WEEKDAY_LABELS.map((label, index) => {
                const { date, isToday } = getWeekDate(index);
                const isActive = streakData.active_dates.includes(date);

                return (
                  <View key={`${label}-${index}`} style={styles.streakDay} accessible accessibilityLabel={`${date}${isToday ? ", today" : ""}, ${isActive ? "studied" : "no study recorded"}`}>
                    <View
                      style={[
                        styles.streakDayCircle,
                        isActive && styles.streakDayCircleActive,
                        isToday && styles.streakDayCircleToday,
                        isActive && isToday && styles.streakDayCircleActiveToday,
                      ]}
                    >
                      <Text
                        style={[
                          styles.streakDayText,
                          isActive && styles.streakDayTextActive,
                          isActive && isToday && styles.streakDayTextActiveToday,
                        ]}
                      >
                        {label}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        </View>

        <View style={styles.librarySection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Ready to review</Text>
            <TouchableOpacity
              testID="dashboard-library"
              onPress={() => router.push('/(tabs)/library')}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel="View your full library"
            >
              <Text style={styles.viewAllText}>View all</Text>
            </TouchableOpacity>
          </View>

          {visibleSets.length > 0 ? (
            <View style={styles.libraryList}>
              {visibleSets.map((studySet, index) => (
                <TouchableOpacity
                  key={studySet.id}
                  testID={`dashboard-study-${studySet.id}`}
                  style={[
                    styles.libraryRow,
                    index < visibleSets.length - 1 && styles.libraryRowDivider,
                  ]}
                  onPress={() => router.push(`/study/${studySet.id}`)}
                  activeOpacity={0.65}
                  accessibilityRole="button"
                  accessibilityLabel={`${studySet.title}, ${studySet.item_count} items`}
                >
                  <StudyIcon name="cards" size={44} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.libraryTitle} numberOfLines={2}>
                      {studySet.title}
                    </Text>
                    <Text style={styles.libraryMeta}>
                      {studySet.item_count} {studySet.item_count === 1 ? 'item' : 'items'}
                    </Text>
                  </View>
                  <Text style={styles.rowArrow}>→</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View style={styles.emptyLibrary}>
              <Text style={styles.emptyLibraryTitle}>Your library is ready</Text>
              <Text style={styles.emptyLibraryText}>
                Study sets you create will appear here.
              </Text>
            </View>
          )}
        </View>
      </SmoothScrollView>
    </View>
  );
}

const isPadDevice = isIpad();

const styles = StyleSheet.create({
  studyHero: { backgroundColor: colors.primarySoft, borderRadius: 28, borderCurve: 'continuous', borderWidth: 1, borderColor: colors.primaryBorder, padding: 20, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 },
  heroCopy: { flex: 1, minWidth: 155 },
  heroEyebrow: { color: colors.primary, fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 8 },
  heroTitle: { color: colors.text, fontSize: 24, lineHeight: 30, fontWeight: '800', letterSpacing: -0.6 },
  heroDescription: { color: colors.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 10 },
  heroButton: { backgroundColor: colors.primary, borderRadius: 16, borderCurve: 'continuous', padding: 12, minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 8, width: '100%', marginTop: 16 },
  heroButtonText: { color: colors.onPrimary, fontSize: 14, fontWeight: '700', flex: 1 },
  heroArrow: { color: colors.onPrimary, fontSize: 22 },
  quickActions: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  quickAction: { flex: 1, minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 18, borderCurve: 'continuous', padding: 12, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 },
  quickActionText: { flex: 1, color: colors.text, fontSize: 13, fontWeight: '700' },
  rowArrow: { color: colors.primary, fontSize: 22 },
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
  },
  content: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    paddingHorizontal: isPadDevice ? spacing[36] : spacing[18],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: isPadDevice ? spacing[20] : spacing[14],
  },
  headerTextColumn: {
    flex: 1,
    marginRight: spacing[12],
  },
  dateLabel: {
    color: colors.primary,
    fontSize: isPadDevice ? typography.fontSize[15] : typography.fontSize[12],
    fontWeight: typography.fontWeight.bold,
    letterSpacing: typography.letterSpacing[0.6],
    textTransform: 'uppercase',
    marginBottom: spacing[2],
  },
  greeting: {
    color: colors.text,
    fontSize: isPadDevice ? typography.fontSize[34] : typography.fontSize[26],
    fontWeight: typography.fontWeight.extraBold,
    letterSpacing: -0.5,
  },
  xpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[6],
    backgroundColor: colors.warningSoft,
    borderWidth: 1,
    borderColor: colors.warningBorder,
    borderRadius: isPadDevice ? 24 : 20,
    borderCurve: 'continuous',
    paddingHorizontal: isPadDevice ? spacing[16] : spacing[12],
    paddingVertical: isPadDevice ? spacing[10] : spacing[8],
  },
  xpBadgeText: {
    color: colors.warning,
    fontSize: isPadDevice ? typography.fontSize[17] : typography.fontSize[14],
    fontWeight: typography.fontWeight.bold,
  },
  streakSection: {
    marginBottom: 0,
  },
  momoRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing[6],
    zIndex: 1,
  },
  momoButton: {
    marginRight: isPadDevice ? spacing[14] : spacing[10],
  },
  quoteBubble: {
    flex: 1,
    minHeight: isPadDevice ? 90 : 72,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warningSoft,
    borderWidth: 1,
    borderColor: colors.warningBorder,
    borderRadius: isPadDevice ? 20 : 16,
    borderCurve: 'continuous',
    paddingHorizontal: isPadDevice ? spacing[16] : spacing[12],
    paddingVertical: isPadDevice ? spacing[12] : spacing[8],
    marginBottom: spacing[8],
    position: 'relative',
  },
  quoteBubbleTailBorder: {
    position: 'absolute',
    left: -8,
    top: '50%',
    marginTop: -7,
    width: 0,
    height: 0,
    borderStyle: 'solid',
    borderTopWidth: 7,
    borderBottomWidth: 7,
    borderRightWidth: 8,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderRightColor: colors.warningBorder,
  },
  quoteBubbleTail: {
    position: 'absolute',
    left: -7,
    top: '50%',
    marginTop: -7,
    width: 0,
    height: 0,
    borderStyle: 'solid',
    borderTopWidth: 7,
    borderBottomWidth: 7,
    borderRightWidth: 8,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderRightColor: colors.warningSoft,
  },
  quoteContent: {
    flex: 1,
    justifyContent: 'center',
    paddingRight: spacing[6],
  },
  quoteCategory: {
    color: colors.warning,
    fontSize: isPadDevice ? typography.fontSize[13] : typography.fontSize[11],
    fontWeight: typography.fontWeight.extraBold,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    marginBottom: spacing[2],
  },
  quoteText: {
    color: colors.textSecondary,
    fontSize: isPadDevice ? typography.fontSize[14] : typography.fontSize[12],
    fontWeight: typography.fontWeight.semiBold,
    lineHeight: isPadDevice ? 20 : 16,
  },
  quoteCloseButton: {
    minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center',
    padding: spacing[6],
    marginLeft: spacing[2],
  },
  quoteCloseText: {
    color: colors.warning,
    fontSize: isPadDevice ? typography.fontSize[15] : typography.fontSize[13],
    fontWeight: typography.fontWeight.bold,
  },
  streakCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: isPadDevice ? 24 : 20,
    borderCurve: 'continuous',
    padding: isPadDevice ? spacing[28] : spacing[20],
  },
  streakEyebrow: {
    color: colors.textMuted,
    fontSize: isPadDevice ? typography.fontSize[13] : typography.fontSize[11],
    fontWeight: typography.fontWeight.bold,
    letterSpacing: typography.letterSpacing[0.6],
    marginBottom: spacing[6],
  },
  streakHeading: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing[6],
  },
  streakCount: {
    color: colors.text,
    fontSize: isPadDevice ? typography.fontSize[40] : typography.fontSize[34],
    fontWeight: typography.fontWeight.extraBold,
    letterSpacing: -1,
  },
  streakUnit: {
    color: colors.textSecondary,
    fontSize: isPadDevice ? typography.fontSize[20] : typography.fontSize[17],
    fontWeight: typography.fontWeight.semiBold,
  },
  streakMessage: {
    color: colors.textSecondary,
    fontSize: isPadDevice ? typography.fontSize[15] : typography.fontSize[13],
    lineHeight: isPadDevice ? 22 : 19,
    marginTop: spacing[2],
    marginBottom: isPadDevice ? spacing[24] : spacing[20],
  },
  streakDays: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  streakDay: {
    alignItems: 'center',
  },
  streakDayCircle: {
    width: isPadDevice ? 46 : 34,
    height: isPadDevice ? 46 : 34,
    borderRadius: isPadDevice ? 23 : 17,
    borderCurve: 'continuous',
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakDayCircleActive: {
    backgroundColor: colors.warningSoft,
  },
  streakDayCircleToday: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  streakDayCircleActiveToday: {
    backgroundColor: colors.warningAccent,
    borderColor: colors.warningAccent,
  },
  streakDayText: {
    color: colors.textMuted,
    fontSize: isPadDevice ? typography.fontSize[15] : typography.fontSize[12],
    fontWeight: typography.fontWeight.bold,
  },
  streakDayTextActive: {
    color: colors.warningAccent,
  },
  streakDayTextActiveToday: {
    color: colors.onPrimary,
  },
  librarySection: {
    marginTop: isPadDevice ? spacing[36] : spacing[28],
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[12],
  },
  sectionTitle: {
    color: colors.text,
    fontSize: isPadDevice ? typography.fontSize[24] : typography.fontSize[20],
    fontWeight: typography.fontWeight.bold,
    letterSpacing: -0.3,
  },
  viewAllText: {
    color: colors.primary,
    fontSize: isPadDevice ? typography.fontSize[15] : typography.fontSize[13],
    fontWeight: typography.fontWeight.semiBold,
  },
  libraryList: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: isPadDevice ? 20 : 16,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  libraryRow: {
    minHeight: isPadDevice ? 88 : 72,
    paddingHorizontal: isPadDevice ? spacing[22] : spacing[16],
    paddingVertical: isPadDevice ? spacing[18] : spacing[14],
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  libraryRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  libraryTitle: {
    color: colors.text,
    fontSize: isPadDevice ? typography.fontSize[18] : typography.fontSize[15],
    fontWeight: typography.fontWeight.semiBold,
    lineHeight: isPadDevice ? 25 : 21,
  },
  libraryMeta: {
    color: colors.textMuted,
    fontSize: isPadDevice ? typography.fontSize[14] : typography.fontSize[12],
    fontWeight: typography.fontWeight.medium,
    marginTop: spacing[4],
  },
  emptyLibrary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: isPadDevice ? 20 : 16,
    borderCurve: 'continuous',
    paddingHorizontal: isPadDevice ? spacing[22] : spacing[18],
    paddingVertical: isPadDevice ? spacing[28] : spacing[24],
  },
  emptyLibraryTitle: {
    color: colors.text,
    fontSize: isPadDevice ? typography.fontSize[18] : typography.fontSize[15],
    fontWeight: typography.fontWeight.semiBold,
  },
  emptyLibraryText: {
    color: colors.textSecondary,
    fontSize: isPadDevice ? typography.fontSize[15] : typography.fontSize[13],
    lineHeight: isPadDevice ? 22 : 19,
    marginTop: spacing[4],
  },
});
