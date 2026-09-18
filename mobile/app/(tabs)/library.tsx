import React, { useState, useEffect } from 'react';
import { colors, spacing, typography } from '@/constants/theme';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Platform,
  StatusBar as RNStatusBar,
} from 'react-native';
import { AppText as Text, AppTextInput as TextInput } from '@/components/common/app-text';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  Search01Icon,
  BookOpen01Icon,
  Delete02Icon,
  Edit02Icon,
  File01Icon,
  SparklesIcon,
  Cancel01Icon,
  ArrowRight01Icon,
} from '@hugeicons/core-free-icons';
import { listStudySets, deleteStudySet, updateStudySet } from '../../lib/api/studySets';
import { listDocuments, deleteDocument } from '../../lib/api/documents';
import { localDb } from '../../lib/storage/localDb';
import { PlatformPressable } from '../../components/common/PlatformPressable';
import { ConfirmationModal } from '../../components/common/ConfirmationModal';
import { RenameModal } from '../../components/common/RenameModal';
import { TabTransitionView } from '../../components/common/TabTransitionView';
import { StudySet, DocumentItem } from '../../types';

function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 KB';
  const kb = bytes / 1024;
  if (kb < 1024) {
    return `${Math.round(kb)} KB`;
  }
  return `${(kb / 1024).toFixed(1)} MB`;
}

type DeleteTarget =
  | { type: 'set'; set: StudySet }
  | { type: 'doc'; doc: DocumentItem };

export default function LibraryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<'reviewers' | 'documents'>('reviewers');
  const [sets, setSets] = useState<StudySet[]>([]);
  const [docs, setDocs] = useState<DocumentItem[]>([]);
  const [filter, setFilter] = useState<'All' | 'Flashcards' | 'Quiz' | 'Exam'>('All');
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [renameTarget, setRenameTarget] = useState<StudySet | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);

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
      // Local fallback for offline mode
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
      const [setsData, docsData] = await Promise.all([
        listStudySets().catch(() => localDb.listStudySets()),
        listDocuments().catch(() => []),
      ]);
      setSets(setsData || []);
      setDocs(docsData || []);
    } catch (err) {
      console.warn('Failed to load library:', err);
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
      if (deleteTarget.type === 'set') {
        const id = deleteTarget.set.id;
        await deleteStudySet(id);
        await localDb.deleteStudySet(id);
        setSets((prev) => prev.filter((s) => s.id !== id));
      } else {
        const id = deleteTarget.doc.id;
        await deleteDocument(id);
        await localDb.deleteDocument(id);
        setDocs((prev) => prev.filter((d) => d.id !== id));
      }
      setDeleteTarget(null);
    } catch (err) {
      console.warn('Delete failed:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredSets = sets.filter((s) => {
    const matchesSearch = s.title.toLowerCase().includes(search.toLowerCase());
    return matchesSearch;
  });

  const filteredDocs = docs.filter((d) => {
    const matchesSearch = d.original_filename.toLowerCase().includes(search.toLowerCase());
    return matchesSearch;
  });

  const bottomListPadding = Math.max(insets.bottom, spacing[24]) + spacing[88]; // Floating nav clearance

  return (
    <TabTransitionView
      style={[
        styles.container,
        {
          paddingTop: Platform.OS === 'android'
            ? Math.max(insets.top, RNStatusBar.currentHeight || spacing[0], spacing[28]) + spacing[14]
            : Math.max(insets.top, spacing[20]),
        },
      ]}
    >
      {/* Screen Title Bar */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Study Library</Text>
        <Text style={styles.headerSub}>Manage your AI reviewers & source files</Text>
      </View>

      {/* Segmented Switcher */}
      <View style={styles.segmentContainer}>
        <TouchableOpacity
          style={[styles.segmentBtn, activeTab === 'reviewers' && styles.activeSegmentBtn]}
          onPress={() => setActiveTab('reviewers')}
          activeOpacity={0.7}
        >
          <Text style={[styles.segmentText, activeTab === 'reviewers' && styles.activeSegmentText]}>
            Reviewers ({sets.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segmentBtn, activeTab === 'documents' && styles.activeSegmentBtn]}
          onPress={() => setActiveTab('documents')}
          activeOpacity={0.7}
        >
          <Text style={[styles.segmentText, activeTab === 'documents' && styles.activeSegmentText]}>
            Documents ({docs.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search Input */}
      <View style={styles.searchBox}>
        <View style={styles.searchIconWrapper}>
          <HugeiconsIcon icon={Search01Icon} size={18} color={colors.textDisabled} strokeWidth={2} />
        </View>
        <TextInput
          style={styles.searchInput}
          placeholder={activeTab === 'reviewers' ? 'Search study sets...' : 'Search documents...'}
          placeholderTextColor={colors.textDisabled}
          value={search}
          onChangeText={setSearch}
          clearButtonMode="while-editing"
        />
        {search.length > 0 && Platform.OS === 'android' && (
          <TouchableOpacity onPress={() => setSearch('')} style={styles.clearBtn}>
            <HugeiconsIcon icon={Cancel01Icon} size={16} color={colors.textDisabled} strokeWidth={2} />
          </TouchableOpacity>
        )}
      </View>

      {/* Reviewers Tab Content */}
      {activeTab === 'reviewers' ? (
        <>
          {/* Filter Chips */}
          <View style={styles.chipsWrapper}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}
              decelerationRate={Platform.OS === 'ios' ? 'normal' : 0.988}
              scrollEventThrottle={16}
              overScrollMode="never"
              bounces={true}
            >
              {(['All', 'Flashcards', 'Quiz', 'Exam'] as const).map((chip) => (
                <TouchableOpacity
                  key={chip}
                  style={[styles.chip, filter === chip && styles.activeChip]}
                  onPress={() => setFilter(chip)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.chipText, filter === chip && styles.activeChipText]}>
                    {chip}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Study Sets FlatList */}
          <FlatList
            data={filteredSets}
            keyExtractor={(item) => item.id}
            contentContainerStyle={[
              styles.listContent,
              { paddingBottom: bottomListPadding },
            ]}
            showsVerticalScrollIndicator={false}
            decelerationRate={Platform.OS === 'ios' ? 'normal' : 0.988}
            scrollEventThrottle={16}
            overScrollMode="never"
            bounces={true}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.primary}
                colors={[colors.primary]}
              />
            }
            renderItem={({ item }) => (
              <View style={styles.card}>
                <TouchableOpacity
                  style={styles.cardMain}
                  onPress={() => router.push(`/study/${item.id}`)}
                  activeOpacity={0.7}
                >
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{item.item_count} items</Text>
                    </View>
                  </View>
                  {item.description ? (
                    <Text style={styles.cardDesc} numberOfLines={2}>
                      {item.description}
                    </Text>
                  ) : null}
                  <View style={styles.cardFooter}>
                    <Text style={styles.cardDate}>
                      Created {new Date(item.created_at).toLocaleDateString()}
                    </Text>
                    <View style={styles.openHint}>
                      <Text style={styles.openHintText}>Study Now</Text>
                      <HugeiconsIcon icon={ArrowRight01Icon} size={14} color={colors.primary} strokeWidth={2.5} />
                    </View>
                  </View>
                </TouchableOpacity>
                <View style={styles.cardSideActions}>
                  <TouchableOpacity
                    style={styles.editBtn}
                    onPress={() => setRenameTarget(item)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityLabel="Rename quiz"
                  >
                    <HugeiconsIcon icon={Edit02Icon} size={16} color={colors.primary} strokeWidth={1.8} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => setDeleteTarget({ type: 'set', set: item })}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityLabel="Delete reviewer"
                  >
                    <HugeiconsIcon icon={Delete02Icon} size={18} color={colors.dangerAccent} strokeWidth={1.75} />
                  </TouchableOpacity>
                </View>
              </View>
            )}
            ListEmptyComponent={
              <View style={styles.empty}>
                <View style={styles.emptyIconCircle}>
                  <HugeiconsIcon icon={BookOpen01Icon} size={28} color={colors.textDisabled} strokeWidth={1.6} />
                </View>
                <Text style={styles.emptyTitle}>No study sets found</Text>
                <Text style={styles.emptyText}>
                  {search ? 'Try a different search term' : 'Upload a document to generate your first study reviewer'}
                </Text>
                {!search && (
                  <PlatformPressable
                    style={styles.emptyActionBtn}
                    onPress={() => router.push('/documents/upload')}
                  >
                    <Text style={styles.emptyActionText}>Upload Document</Text>
                  </PlatformPressable>
                )}
              </View>
            }
          />
        </>
      ) : (
        /* Documents Tab Content */
        <FlatList
          data={filteredDocs}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: bottomListPadding },
          ]}
          showsVerticalScrollIndicator={false}
          decelerationRate={Platform.OS === 'ios' ? 'normal' : 0.988}
          scrollEventThrottle={16}
          overScrollMode="never"
          bounces={true}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          renderItem={({ item }) => {
            const isReady = item.processing_status === 'READY';
            return (
              <View style={styles.docCard}>
                <View style={styles.docIconBox}>
                  <HugeiconsIcon icon={File01Icon} size={20} color={colors.primary} strokeWidth={1.8} />
                </View>
                <View style={styles.docContent}>
                  <Text style={styles.docTitle} numberOfLines={1}>
                    {item.original_filename}
                  </Text>
                  <View style={styles.docMetaRow}>
                    <Text style={styles.docMeta}>{formatFileSize(item.file_size)}</Text>
                    <Text style={styles.docMetaDot}>•</Text>
                    <View
                      style={[
                        styles.statusBadge,
                        isReady
                          ? styles.readyBadge
                          : item.processing_status === 'FAILED'
                          ? styles.failedBadge
                          : styles.pendingBadge,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          isReady
                            ? styles.readyText
                            : item.processing_status === 'FAILED'
                            ? styles.failedText
                            : styles.pendingText,
                        ]}
                      >
                        {isReady ? 'Ready' : item.processing_status === 'FAILED' ? 'Failed' : 'Processing'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.docDate}>
                    Uploaded {new Date(item.uploaded_at).toLocaleDateString()} • Retained 3 days
                  </Text>
                </View>
                <View style={styles.docActions}>
                  {isReady && (
                    <TouchableOpacity
                      style={styles.studyActionBtn}
                      onPress={() => router.push(`/create/${item.id}`)}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <HugeiconsIcon icon={SparklesIcon} size={14} color={colors.primary} strokeWidth={2} />
                      <Text style={styles.studyActionText}>Study</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => setDeleteTarget({ type: 'doc', doc: item })}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityLabel="Delete document"
                  >
                    <HugeiconsIcon icon={Delete02Icon} size={18} color={colors.dangerAccent} strokeWidth={1.75} />
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={[styles.emptyIconCircle, styles.docEmptyIconCircle]}>
                <HugeiconsIcon icon={File01Icon} size={28} color={colors.success} strokeWidth={1.6} />
              </View>
              <Text style={styles.emptyTitle}>No uploaded documents</Text>
              <Text style={styles.emptyText}>
                {search ? 'No documents match your query' : 'Upload PDF or Word files to start studying'}
              </Text>
              {!search && (
                <PlatformPressable
                  style={styles.emptyActionBtn}
                  onPress={() => router.push('/documents/upload')}
                >
                  <Text style={styles.emptyActionText}>Upload Document</Text>
                </PlatformPressable>
              )}
            </View>
          }
        />
      )}

      {/* Confirmation Modal */}
      <ConfirmationModal
        visible={deleteTarget !== null}
        title={deleteTarget?.type === 'set' ? 'Delete Reviewer?' : 'Delete Document?'}
        message={
          deleteTarget?.type === 'set'
            ? `Are you sure you want to delete "${deleteTarget.set.title}"? All generated flashcards and questions will be permanently deleted.`
            : `Are you sure you want to delete "${deleteTarget?.doc.original_filename}"? This will remove the uploaded document from storage.`
        }
        confirmText={deleteTarget?.type === 'set' ? 'Delete Reviewer' : 'Delete Document'}
        isDestructive={true}
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Rename Modal */}
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
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing[16],
  },
  header: {
    marginBottom: spacing[16],
  },
  headerTitle: {
    fontSize: typography.fontSize[24],
    fontWeight: typography.fontWeight.extraBold,
    color: colors.text,
    letterSpacing: typography.letterSpacing[-0.4],
  },
  headerSub: {
    fontSize: typography.fontSize[13],
    color: colors.textMuted,
    marginTop: spacing[2],
  },
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceMuted,
    borderRadius: 12,
    padding: spacing[3],
    marginBottom: spacing[12],
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: spacing[9],
    alignItems: 'center',
    borderRadius: 9,
  },
  activeSegmentBtn: {
    backgroundColor: colors.surface,
    ...Platform.select({
      ios: {
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 3,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  segmentText: {
    fontSize: typography.fontSize[14],
    fontWeight: typography.fontWeight.semiBold,
    color: colors.textMuted,
  },
  activeSegmentText: {
    color: colors.text,
    fontWeight: typography.fontWeight.bold,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing[12],
    marginBottom: spacing[12],
    ...Platform.select({
      ios: {
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.02,
        shadowRadius: 3,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  searchIconWrapper: {
    marginRight: spacing[8],
  },
  searchInput: {
    flex: 1,
    paddingVertical: Platform.OS === 'ios' ? spacing[12] : spacing[10],
    fontSize: typography.fontSize[14],
    color: colors.text,
  },
  clearBtn: {
    padding: spacing[4],
  },
  chipsWrapper: {
    marginBottom: spacing[12],
  },
  chipRow: {
    flexDirection: 'row',
    gap: spacing[8],
    paddingRight: spacing[16],
  },
  chip: {
    paddingHorizontal: spacing[14],
    paddingVertical: spacing[6],
    borderRadius: 20,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  activeChip: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: typography.fontSize[13],
    fontWeight: typography.fontWeight.semiBold,
    color: colors.textSecondary,
  },
  activeChipText: {
    color: colors.onPrimary,
  },
  listContent: {
    paddingBottom: spacing[24],
  },
  card: {
    backgroundColor: colors.surface,
    padding: spacing[16],
    borderRadius: 14,
    marginBottom: spacing[10],
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 4,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  cardMain: {
    flex: 1,
    marginRight: spacing[10],
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[6],
  },
  cardTitle: {
    fontSize: typography.fontSize[16],
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
    flex: 1,
    marginRight: spacing[8],
    letterSpacing: typography.letterSpacing[-0.2],
  },
  badge: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing[8],
    paddingVertical: spacing[3],
    borderRadius: 6,
  },
  badgeText: {
    fontSize: typography.fontSize[11],
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
  },
  cardDesc: {
    fontSize: typography.fontSize[13],
    color: colors.textMuted,
    marginBottom: spacing[8],
    lineHeight: typography.lineHeight[18],
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardDate: {
    fontSize: typography.fontSize[11],
    color: colors.textDisabled,
  },
  openHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  openHintText: {
    fontSize: typography.fontSize[12],
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
  },
  cardSideActions: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: spacing[8],
  },
  editBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.dangerSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docCard: {
    backgroundColor: colors.surface,
    padding: spacing[14],
    borderRadius: 14,
    marginBottom: spacing[10],
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 4,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  docIconBox: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing[12],
  },
  docContent: {
    flex: 1,
    marginRight: spacing[8],
  },
  docTitle: {
    fontSize: typography.fontSize[14],
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
  },
  docMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing[3],
    gap: spacing[6],
  },
  docMeta: {
    fontSize: typography.fontSize[12],
    color: colors.textMuted,
  },
  docMetaDot: {
    fontSize: typography.fontSize[12],
    color: colors.textDisabled,
  },
  statusBadge: {
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[1],
    borderRadius: 4,
  },
  readyBadge: {
    backgroundColor: colors.successSoft,
  },
  pendingBadge: {
    backgroundColor: colors.warningSoft,
  },
  failedBadge: {
    backgroundColor: colors.dangerSoft,
  },
  statusText: {
    fontSize: typography.fontSize[11],
    fontWeight: typography.fontWeight.bold,
  },
  readyText: {
    color: colors.success,
  },
  pendingText: {
    color: colors.warning,
  },
  failedText: {
    color: colors.danger,
  },
  docDate: {
    fontSize: typography.fontSize[11],
    color: colors.textDisabled,
    marginTop: spacing[4],
  },
  docActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[8],
  },
  studyActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing[10],
    paddingVertical: spacing[7],
    borderRadius: 8,
    gap: spacing[4],
  },
  studyActionText: {
    fontSize: typography.fontSize[12],
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
  },
  empty: {
    padding: spacing[36],
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing[12],
  },
  emptyIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[12],
  },
  docEmptyIconCircle: {
    backgroundColor: colors.successSoft,
  },
  emptyTitle: {
    fontSize: typography.fontSize[16],
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
    marginBottom: spacing[4],
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: typography.fontSize[13],
    textAlign: 'center',
    marginBottom: spacing[16],
  },
  emptyActionBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing[18],
    paddingVertical: spacing[10],
    borderRadius: 10,
  },
  emptyActionText: {
    color: colors.onPrimary,
    fontWeight: typography.fontWeight.bold,
    fontSize: typography.fontSize[13],
  },
});
