import React, { useState, useMemo } from 'react';
import { colors, spacing, typography } from '@/constants/theme';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  Keyboard,
} from 'react-native';
import { AppText as Text, AppTextInput as TextInput } from '@/components/common/app-text';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  Book02Icon,
  Search01Icon,
  Cancel01Icon,
  FlashIcon,
  Layers01Icon,
  HelpCircleIcon,
  ArrowRight01Icon,
  CheckmarkCircle02Icon,
  Task01Icon,
  File01Icon,
  SparklesIcon,
} from '@hugeicons/core-free-icons';
import { StudyItem } from '../../types';
import { SourceAttribution } from './SourceAttribution';
import { PlatformPressable } from '../common/PlatformPressable';
import { isIpad } from '../../utils/device';

interface Props {
  items: StudyItem[];
  title?: string;
  onTakeQuiz?: () => void;
}

type FilterCategory = 'all' | 'glossary' | 'concept_outline' | 'cheat_sheet' | 'compare_contrast' | 'qa_study_sheet' | 'timeline_process';

const FILTER_TABS: { key: FilterCategory; label: string; icon: any }[] = [
  { key: 'all', label: 'All Notes', icon: Book02Icon },
  { key: 'glossary', label: 'Terms & Meanings', icon: File01Icon },
  { key: 'concept_outline', label: 'Outlines', icon: Task01Icon },
  { key: 'cheat_sheet', label: 'Cheat Sheet', icon: FlashIcon },
  { key: 'compare_contrast', label: 'Differences', icon: Layers01Icon },
  { key: 'qa_study_sheet', label: 'Study Q&A', icon: HelpCircleIcon },
  { key: 'timeline_process', label: 'Processes', icon: SparklesIcon },
];

export const ReviewerGuideView: React.FC<Props> = ({ items, title, onTakeQuiz }) => {
  const [activeCategory, setActiveCategory] = useState<FilterCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Item counts per category
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: items.length };
    for (const item of items) {
      c[item.type] = (c[item.type] || 0) + 1;
    }
    return c;
  }, [items]);

  // Filter available tabs to only those present in the study set (plus 'all')
  const visibleTabs = useMemo(() => {
    return FILTER_TABS.filter((t) => t.key === 'all' || (counts[t.key] && counts[t.key] > 0));
  }, [counts]);

  // Filtered items
  const filteredItems = useMemo(() => {
    let result = items;
    if (activeCategory !== 'all') {
      result = result.filter((i) => i.type === activeCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (i) =>
          i.question.toLowerCase().includes(q) ||
          i.answer.toLowerCase().includes(q) ||
          (i.explanation && i.explanation.toLowerCase().includes(q))
      );
    }
    return result;
  }, [items, activeCategory, searchQuery]);

  const renderBadge = (type: string) => {
    switch (type) {
      case 'glossary':
        return (
          <View style={[styles.badge, styles.badgeGlossary]}>
            <HugeiconsIcon icon={File01Icon} size={11} color={colors.primary} strokeWidth={2.4} />
            <Text style={[styles.badgeText, { color: colors.primary }]}>TERM & DEFINITION</Text>
          </View>
        );
      case 'concept_outline':
        return (
          <View style={[styles.badge, styles.badgeOutline]}>
            <HugeiconsIcon icon={Task01Icon} size={11} color={colors.info} strokeWidth={2.4} />
            <Text style={[styles.badgeText, { color: colors.info }]}>CONCEPT OUTLINE</Text>
          </View>
        );
      case 'cheat_sheet':
        return (
          <View style={[styles.badge, styles.badgeCheat]}>
            <HugeiconsIcon icon={FlashIcon} size={11} color={colors.warning} strokeWidth={2.4} />
            <Text style={[styles.badgeText, { color: colors.warning }]}>HIGH-YIELD FACT</Text>
          </View>
        );
      case 'compare_contrast':
        return (
          <View style={[styles.badge, styles.badgeCompare]}>
            <HugeiconsIcon icon={Layers01Icon} size={11} color="#8B5CF6" strokeWidth={2.4} />
            <Text style={[styles.badgeText, { color: '#8B5CF6' }]}>DIFFERENCE / CONTRAST</Text>
          </View>
        );
      case 'qa_study_sheet':
        return (
          <View style={[styles.badge, styles.badgeQA]}>
            <HugeiconsIcon icon={HelpCircleIcon} size={11} color={colors.success} strokeWidth={2.4} />
            <Text style={[styles.badgeText, { color: colors.success }]}>STUDY Q&A</Text>
          </View>
        );
      case 'timeline_process':
        return (
          <View style={[styles.badge, styles.badgeTimeline]}>
            <HugeiconsIcon icon={SparklesIcon} size={11} color={colors.primaryLight} strokeWidth={2.4} />
            <Text style={[styles.badgeText, { color: colors.primaryLight }]}>STEP / PROCESS</Text>
          </View>
        );
      default:
        return (
          <View style={[styles.badge, styles.badgeGlossary]}>
            <Text style={[styles.badgeText, { color: colors.primary }]}>STUDY NOTE</Text>
          </View>
        );
    }
  };

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBox}>
          <HugeiconsIcon icon={Search01Icon} size={16} color={colors.textMuted} strokeWidth={2} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search concepts, terms, or definitions..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            blurOnSubmit={true}
            onSubmitEditing={() => Keyboard.dismiss()}
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                setSearchQuery('');
                Keyboard.dismiss();
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <HugeiconsIcon icon={Cancel01Icon} size={16} color={colors.textMuted} strokeWidth={2} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter Tabs */}
      {visibleTabs.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsScrollContent}
          style={styles.tabsScrollView}
        >
          {visibleTabs.map((tab) => {
            const isActive = activeCategory === tab.key;
            const count = counts[tab.key] || 0;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tabPill, isActive && styles.activeTabPill]}
                onPress={() => setActiveCategory(tab.key)}
                activeOpacity={0.7}
              >
                <HugeiconsIcon
                  icon={tab.icon}
                  size={13}
                  color={isActive ? colors.primary : colors.textMuted}
                  strokeWidth={isActive ? 2.4 : 2}
                />
                <Text
                  style={[styles.tabPillText, isActive && styles.activeTabPillText]}
                  numberOfLines={1}
                >
                  {tab.label}
                </Text>
                <View style={[styles.tabBadge, isActive && styles.activeTabBadge]}>
                  <Text style={[styles.tabBadgeText, isActive && styles.activeTabBadgeText]}>
                    {count}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Reviewer Content List */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {filteredItems.length === 0 ? (
          <View style={styles.emptyContainer}>
            <HugeiconsIcon icon={Book02Icon} size={48} color={colors.textMuted} strokeWidth={1.5} />
            <Text style={styles.emptyTitle}>No Matching Notes Found</Text>
            <Text style={styles.emptySubtitle}>Try changing your search query or switching categories.</Text>
          </View>
        ) : (
          filteredItems.map((item, idx) => (
            <View
              key={item.id || `item-${idx}`}
              style={[
                styles.itemCard,
                item.type === 'cheat_sheet' && styles.itemCardCheat,
                item.type === 'compare_contrast' && styles.itemCardCompare,
              ]}
            >
              {/* Badge & Number */}
              <View style={styles.cardHeader}>
                <View style={styles.badgeRow}>
                  <View style={styles.itemIndexBubble}>
                    <Text style={styles.itemIndexBubbleText}>#{idx + 1}</Text>
                  </View>
                  {renderBadge(item.type)}
                </View>
                {item.difficulty && (
                  <View style={styles.diffBadge}>
                    <Text style={styles.diffText}>{item.difficulty.toUpperCase()}</Text>
                  </View>
                )}
              </View>

              {/* Term / Heading / Question */}
              <Text style={styles.itemTitle}>{item.question}</Text>

              {/* Core Meaning / Explanation */}
              <View style={styles.answerBox}>
                <Text style={styles.itemAnswer}>{item.answer}</Text>
              </View>

              {/* Memory Anchor / Hint / Takeaway */}
              {item.explanation && (
                <View style={styles.explanationBox}>
                  <View style={styles.explanationHeaderRow}>
                    <HugeiconsIcon icon={SparklesIcon} size={13} color={colors.primary} strokeWidth={2.2} />
                    <Text style={styles.explanationLabel}>Key Takeaway & Context</Text>
                  </View>
                  <Text style={styles.explanationText}>{item.explanation}</Text>
                </View>
              )}

              {/* Source Provenance */}
              {item.source_metadata && (
                <View style={styles.sourceWrapper}>
                  <SourceAttribution source={item.source_metadata} defaultExpanded={false} />
                </View>
              )}
            </View>
          ))
        )}

        {/* Take Quiz Callout Card */}
        {onTakeQuiz && (
          <View style={styles.quizCallout}>
            <View style={styles.quizCalloutIconBox}>
              <HugeiconsIcon icon={CheckmarkCircle02Icon} size={28} color={colors.primary} strokeWidth={2.2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.quizCalloutTitle}>Done Reviewing?</Text>
              <Text style={styles.quizCalloutDesc}>
                Test what you memorized with Momo's interactive active-recall practice quiz.
              </Text>
            </View>
            <PlatformPressable style={styles.quizCalloutBtn} onPress={onTakeQuiz}>
              <Text style={styles.quizCalloutBtnText}>Take Quiz</Text>
              <HugeiconsIcon icon={ArrowRight01Icon} size={15} color="#FFFFFF" strokeWidth={2.4} />
            </PlatformPressable>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  searchContainer: {
    paddingHorizontal: spacing[16],
    paddingTop: spacing[8],
    paddingBottom: spacing[12],
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing[16],
    height: 44,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontFamily: typography.fontFamily.regular,
    paddingVertical: 0,
  },
  tabsScrollView: {
    flexGrow: 0,
    marginBottom: spacing[10],
  },
  tabsScrollContent: {
    paddingHorizontal: spacing[16],
    paddingVertical: 5,
    gap: 8,
    alignItems: 'center',
  },
  tabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 11,
    paddingVertical: 6,
    minHeight: 32,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    gap: 6,
    overflow: 'visible',
  },
  activeTabPill: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  tabPillText: {
    fontSize: isIpad() ? 13 : 11,
    color: colors.textMuted,
    fontFamily: typography.fontFamily.medium,
  },
  activeTabPillText: {
    color: colors.primary,
    fontFamily: typography.fontFamily.bold,
  },
  tabBadge: {
    minWidth: 19,
    height: 19,
    paddingHorizontal: 4,
    borderRadius: 10,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  activeTabBadge: {
    backgroundColor: colors.primary,
  },
  tabBadgeText: {
    fontSize: 9.5,
    color: colors.textMuted,
    fontFamily: typography.fontFamily.bold,
    textAlign: 'center',
    includeFontPadding: false,
    ...Platform.select({
      ios: {
        lineHeight: 19,
      },
      android: {
        textAlignVertical: 'center',
      },
    }),
  },
  activeTabBadgeText: {
    color: '#FFFFFF',
  },
  scrollContent: {
    paddingHorizontal: spacing[16],
    paddingTop: spacing[8],
    paddingBottom: spacing[24],
    gap: 14,
  },
  itemCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing[16],
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  itemCardCheat: {
    borderColor: colors.warningBorder || 'rgba(245, 158, 11, 0.4)',
    backgroundColor: colors.surface,
  },
  itemCardCompare: {
    borderColor: 'rgba(139, 92, 246, 0.35)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[12],
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  itemIndexBubble: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemIndexBubbleText: {
    fontSize: 10.5,
    fontFamily: typography.fontFamily.bold,
    color: colors.text,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 4,
  },
  badgeGlossary: {
    backgroundColor: colors.primarySoft,
  },
  badgeOutline: {
    backgroundColor: colors.infoSoft,
  },
  badgeCheat: {
    backgroundColor: colors.warningSoft || 'rgba(245, 158, 11, 0.12)',
  },
  badgeCompare: {
    backgroundColor: 'rgba(139, 92, 246, 0.12)',
  },
  badgeQA: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
  },
  badgeTimeline: {
    backgroundColor: colors.primarySoft,
  },
  badgeText: {
    fontSize: 10,
    fontFamily: typography.fontFamily.bold,
    letterSpacing: 0.5,
  },
  diffBadge: {
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  diffText: {
    fontSize: 9,
    color: colors.textMuted,
    fontFamily: typography.fontFamily.bold,
  },
  itemTitle: {
    fontSize: isIpad() ? 20 : 17,
    fontFamily: typography.fontFamily.bold,
    color: colors.text,
    lineHeight: isIpad() ? 26 : 22,
    marginBottom: spacing[8],
  },
  answerBox: {
    marginTop: spacing[8],
    paddingVertical: 4,
  },
  itemAnswer: {
    fontSize: isIpad() ? 16 : 14.5,
    fontFamily: typography.fontFamily.regular,
    color: colors.textSecondary,
    lineHeight: isIpad() ? 24 : 21,
  },
  explanationBox: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 12,
    padding: spacing[12],
    marginTop: spacing[12],
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  explanationHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 3,
  },
  explanationLabel: {
    fontSize: 11,
    fontFamily: typography.fontFamily.semiBold,
    color: colors.primary,
  },
  explanationText: {
    fontSize: 13,
    fontFamily: typography.fontFamily.regular,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  sourceWrapper: {
    marginTop: spacing[12],
  },
  quizCallout: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: colors.primaryBorder,
    padding: spacing[16],
    marginTop: spacing[12],
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  quizCalloutIconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quizCalloutTitle: {
    fontSize: 15,
    fontFamily: typography.fontFamily.bold,
    color: colors.text,
  },
  quizCalloutDesc: {
    fontSize: 12,
    fontFamily: typography.fontFamily.regular,
    color: colors.textSecondary,
    lineHeight: 16,
    marginTop: 2,
  },
  quizCalloutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 4,
  },
  quizCalloutBtnText: {
    fontSize: 13,
    fontFamily: typography.fontFamily.semiBold,
    color: '#FFFFFF',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 17,
    fontFamily: typography.fontFamily.bold,
    color: colors.text,
  },
  emptySubtitle: {
    fontSize: 13,
    fontFamily: typography.fontFamily.regular,
    color: colors.textMuted,
    textAlign: 'center',
    maxWidth: 260,
  },
});
