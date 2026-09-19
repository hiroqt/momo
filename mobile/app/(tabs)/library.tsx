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
  Image,
  Modal,
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
  Folder01Icon,
  FolderAddIcon,
  MoreVerticalIcon,
} from '@hugeicons/core-free-icons';
import { listStudySets, deleteStudySet, updateStudySet } from '../../lib/api/studySets';
import { listDocuments, deleteDocument } from '../../lib/api/documents';
import {
  listFolders,
  createFolder,
  deleteFolder,
  updateFolder as apiUpdateFolder,
  setStudySetFolder,
} from '../../lib/api/folders';
import { localDb } from '../../lib/storage/localDb';
import { PlatformPressable } from '../../components/common/PlatformPressable';
import { ConfirmationModal } from '../../components/common/ConfirmationModal';
import { RenameModal } from '../../components/common/RenameModal';
import { TabTransitionView } from '../../components/common/TabTransitionView';
import { CreateFolderModal } from '../../components/library/CreateFolderModal';
import { MoveToFolderModal } from '../../components/library/MoveToFolderModal';
import { StudySet, DocumentItem, Folder } from '../../types';

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
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [moveToFolderTarget, setMoveToFolderTarget] = useState<StudySet | null>(null);
  const [isMovingToFolder, setIsMovingToFolder] = useState(false);
  const [folderToEdit, setFolderToEdit] = useState<Folder | null>(null);
  const [folderToDelete, setFolderToDelete] = useState<Folder | null>(null);
  const [isDeletingFolder, setIsDeletingFolder] = useState(false);
  const [folderActionTarget, setFolderActionTarget] = useState<Folder | null>(null);

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
      const [setsData, docsData, foldersData] = await Promise.all([
        listStudySets().catch(() => localDb.listStudySets()),
        listDocuments().catch(() => []),
        listFolders().catch(() => localDb.listFolders()),
      ]);
      setSets(setsData || []);
      setDocs(docsData || []);
      setFolders(foldersData || []);
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

  const handleCreateFolder = async (name: string) => {
    setIsCreatingFolder(true);
    try {
      const newFolder = await createFolder(name);
      await localDb.saveFolder(newFolder);
      setFolders((prev) => [...prev, newFolder]);
      setShowCreateFolder(false);
    } catch (err: any) {
      console.warn('Failed to create folder:', err);
      // Offline local fallback
      const offlineFolder: Folder = {
        id: 'local-' + Date.now(),
        user_id: 'local-user',
        name,
        reviewer_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      await localDb.saveFolder(offlineFolder);
      setFolders((prev) => [...prev, offlineFolder]);
      setShowCreateFolder(false);
    } finally {
      setIsCreatingFolder(false);
    }
  };

  const handleSelectFolderForSet = async (folderId: string | null) => {
    if (!moveToFolderTarget) return;
    setIsMovingToFolder(true);
    const setId = moveToFolderTarget.id;
    const oldFolderId = moveToFolderTarget.folder_id;
    try {
      await setStudySetFolder(setId, folderId);
      await localDb.updateStudySetFolder(setId, folderId);
      setSets((prev) =>
        prev.map((s) => (s.id === setId ? { ...s, folder_id: folderId } : s))
      );
      setFolders((prev) =>
        prev.map((f) => {
          let count = f.reviewer_count;
          if (oldFolderId === f.id) count = Math.max(0, count - 1);
          if (folderId === f.id) count += 1;
          return { ...f, reviewer_count: count };
        })
      );
      setMoveToFolderTarget(null);
    } catch (err) {
      console.warn('Failed to move study set:', err);
      await localDb.updateStudySetFolder(setId, folderId);
      setSets((prev) =>
        prev.map((s) => (s.id === setId ? { ...s, folder_id: folderId } : s))
      );
      setMoveToFolderTarget(null);
    } finally {
      setIsMovingToFolder(false);
    }
  };

  const handleDeleteFolder = async () => {
    if (!folderToDelete) return;
    setIsDeletingFolder(true);
    const fId = folderToDelete.id;
    try {
      await deleteFolder(fId);
      await localDb.deleteFolder(fId);
      setFolders((prev) => prev.filter((f) => f.id !== fId));
      setSets((prev) =>
        prev.map((s) => (s.folder_id === fId ? { ...s, folder_id: null } : s))
      );
      if (selectedFolderId === fId) {
        setSelectedFolderId(null);
      }
      setFolderToDelete(null);
    } catch (err) {
      console.warn('Failed to delete folder:', err);
    } finally {
      setIsDeletingFolder(false);
    }
  };

  const handleRenameFolder = async (newName: string) => {
    if (!folderToEdit) return;
    try {
      await apiUpdateFolder(folderToEdit.id, { name: newName });
      await localDb.updateFolder(folderToEdit.id, { name: newName });
      setFolders((prev) =>
        prev.map((f) => (f.id === folderToEdit.id ? { ...f, name: newName } : f))
      );
      setFolderToEdit(null);
    } catch (err) {
      console.warn('Failed to rename folder:', err);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    setIsDeleting(true);
    try {
      if (deleteTarget.type === 'set') {
        const id = deleteTarget.set.id;
        const setItem = deleteTarget.set;
        await deleteStudySet(id);
        await localDb.deleteStudySet(id);
        setSets((prev) => prev.filter((s) => s.id !== id));
        if (setItem.folder_id) {
          setFolders((prev) =>
            prev.map((f) =>
              f.id === setItem.folder_id
                ? { ...f, reviewer_count: Math.max(0, f.reviewer_count - 1) }
                : f
            )
          );
        }
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
    const matchesFolder =
      selectedFolderId === null
        ? true
        : selectedFolderId === 'unorganized'
        ? !s.folder_id
        : s.folder_id === selectedFolderId;
    return matchesSearch && matchesFolder;
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
          {/* Folders Section / Carousel */}
          <View style={styles.foldersSection}>
            <View style={styles.folderSectionHeader}>
              <View style={styles.folderHeaderTitleRow}>
                <HugeiconsIcon icon={Folder01Icon} size={16} color={colors.primary} strokeWidth={2.2} />
                <Text style={styles.folderSectionTitle}>Folders</Text>
                <View style={styles.folderCountBadge}>
                  <Text style={styles.folderCountBadgeText}>
                    {folders.length < 3 ? `${folders.length}/3 Free` : `${folders.length} Folders`}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.addFolderHeaderBtn}
                onPress={() => setShowCreateFolder(true)}
                activeOpacity={0.7}
              >
                <HugeiconsIcon icon={FolderAddIcon} size={14} color={colors.primary} strokeWidth={2.2} />
                <Text style={styles.addFolderHeaderText}>New Folder</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.folderCarouselContent}
              decelerationRate={Platform.OS === 'ios' ? 'normal' : 0.988}
              scrollEventThrottle={16}
              overScrollMode="never"
              bounces={true}
            >
              {/* "All" Card */}
              <TouchableOpacity
                style={[
                  styles.folderCard,
                  selectedFolderId === null && styles.folderCardActive,
                ]}
                onPress={() => setSelectedFolderId(null)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.folderCardIconBox,
                    selectedFolderId === null && styles.folderCardIconBoxActive,
                  ]}
                >
                  <HugeiconsIcon
                    icon={Folder01Icon}
                    size={16}
                    color={selectedFolderId === null ? colors.primary : colors.textMuted}
                    strokeWidth={2}
                  />
                </View>
                <Text
                  style={[
                    styles.folderCardName,
                    selectedFolderId === null && styles.folderCardNameActive,
                  ]}
                  numberOfLines={1}
                >
                  All
                </Text>
                <View style={[styles.folderCardBadge, selectedFolderId === null && styles.folderCardBadgeActive]}>
                  <Text
                    style={[
                      styles.folderCardBadgeText,
                      selectedFolderId === null && styles.folderCardBadgeTextActive,
                    ]}
                  >
                    {sets.length}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* User Folders */}
              {folders.map((folder) => {
                const isSelected = selectedFolderId === folder.id;
                return (
                  <TouchableOpacity
                    key={folder.id}
                    style={[styles.folderCard, isSelected && styles.folderCardActive]}
                    onPress={() => setSelectedFolderId(isSelected ? null : folder.id)}
                    onLongPress={() => setFolderActionTarget(folder)}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.folderCardIconBox,
                        isSelected && styles.folderCardIconBoxActive,
                      ]}
                    >
                      <HugeiconsIcon
                        icon={Folder01Icon}
                        size={16}
                        color={isSelected ? colors.primary : colors.textSecondary}
                        strokeWidth={2}
                      />
                    </View>
                    <Text
                      style={[styles.folderCardName, isSelected && styles.folderCardNameActive]}
                      numberOfLines={1}
                    >
                      {folder.name}
                    </Text>
                    <View style={[styles.folderCardBadge, isSelected && styles.folderCardBadgeActive]}>
                      <Text
                        style={[
                          styles.folderCardBadgeText,
                          isSelected && styles.folderCardBadgeTextActive,
                        ]}
                      >
                        {folder.reviewer_count}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.folderMoreBtn}
                      onPress={(e) => {
                        e.stopPropagation();
                        setFolderActionTarget(folder);
                      }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      accessibilityLabel="Folder options"
                    >
                      <HugeiconsIcon
                        icon={MoreVerticalIcon}
                        size={14}
                        color={isSelected ? colors.primary : colors.textDisabled}
                      />
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              })}

              {/* "+ Add Folder" Card */}
              <TouchableOpacity
                style={styles.addFolderCard}
                onPress={() => setShowCreateFolder(true)}
                activeOpacity={0.7}
              >
                <HugeiconsIcon icon={FolderAddIcon} size={16} color={colors.primary} strokeWidth={2} />
                <Text style={styles.addFolderCardText}>+ Folder</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>

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
            renderItem={({ item }) => {
              const assignedFolder = folders.find((f) => f.id === item.folder_id);
              return (
                <View style={styles.card}>
                  <TouchableOpacity
                    style={styles.cardMain}
                    onPress={() => router.push(`/study/${item.id}`)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.cardHeader}>
                      <View style={styles.cardHeaderLeft}>
                        <Text style={styles.cardTitle} numberOfLines={1}>
                          {item.title}
                        </Text>
                        {assignedFolder ? (
                          <TouchableOpacity
                            style={styles.cardFolderBadge}
                            onPress={() => setMoveToFolderTarget(item)}
                            activeOpacity={0.7}
                          >
                            <HugeiconsIcon icon={Folder01Icon} size={11} color={colors.primary} />
                            <Text style={styles.cardFolderBadgeText} numberOfLines={1}>
                              {assignedFolder.name}
                            </Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
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
                      style={styles.folderBtn}
                      onPress={() => setMoveToFolderTarget(item)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      accessibilityLabel="Move to folder"
                    >
                      <HugeiconsIcon
                        icon={Folder01Icon}
                        size={16}
                        color={item.folder_id ? colors.primary : colors.textMuted}
                        strokeWidth={1.8}
                      />
                    </TouchableOpacity>
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
              );
            }}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Image
                  source={require('@/assets/animations/folder_momo.png')}
                  style={styles.emptyMomoImage}
                  resizeMode="contain"
                />
                <Text style={styles.emptyTitle}>
                  {selectedFolderId
                    ? 'This folder is empty!'
                    : search
                    ? "Momo couldn't find that!"
                    : "No study sets yet!"}
                </Text>
                <Text style={styles.emptyText}>
                  {selectedFolderId
                    ? 'Organize reviewers into this folder by tapping the folder icon on any reviewer card.'
                    : search
                    ? 'No study sets matched your search. Try another keyword!'
                    : 'Upload your notes or slides, and Momo will turn them into flashcards, quizzes, and practice exams!'}
                </Text>
                {selectedFolderId ? (
                  <PlatformPressable
                    style={styles.emptyActionBtn}
                    onPress={() => setSelectedFolderId(null)}
                  >
                    <Text style={styles.emptyActionText}>View All Reviewers</Text>
                  </PlatformPressable>
                ) : !search ? (
                  <PlatformPressable
                    style={styles.emptyActionBtn}
                    onPress={() => router.push('/documents/upload')}
                  >
                    <Text style={styles.emptyActionText}>Upload with Momo</Text>
                  </PlatformPressable>
                ) : null}
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

      {/* Create Folder Modal */}
      <CreateFolderModal
        visible={showCreateFolder}
        currentFolderCount={folders.length}
        isLoading={isCreatingFolder}
        onSave={handleCreateFolder}
        onCancel={() => setShowCreateFolder(false)}
      />

      {/* Move to Folder Modal */}
      <MoveToFolderModal
        visible={moveToFolderTarget !== null}
        studySet={moveToFolderTarget}
        folders={folders}
        isLoading={isMovingToFolder}
        onSelectFolder={handleSelectFolderForSet}
        onCancel={() => setMoveToFolderTarget(null)}
        onCreateNewFolder={() => setShowCreateFolder(true)}
      />

      {/* Folder Action Options Sheet */}
      <Modal
        visible={folderActionTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setFolderActionTarget(null)}
      >
        <TouchableOpacity
          style={styles.actionSheetBackdrop}
          activeOpacity={1}
          onPress={() => setFolderActionTarget(null)}
        >
          <View style={styles.folderActionSheet}>
            <Text style={styles.folderActionTitle} numberOfLines={1}>
              📁 {folderActionTarget?.name}
            </Text>
            <TouchableOpacity
              style={styles.actionSheetItem}
              onPress={() => {
                const target = folderActionTarget;
                setFolderActionTarget(null);
                setFolderToEdit(target);
              }}
            >
              <HugeiconsIcon icon={Edit02Icon} size={18} color={colors.primary} />
              <Text style={styles.actionSheetItemText}>Rename Folder</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionSheetItem, styles.actionSheetItemDestructive]}
              onPress={() => {
                const target = folderActionTarget;
                setFolderActionTarget(null);
                setFolderToDelete(target);
              }}
            >
              <HugeiconsIcon icon={Delete02Icon} size={18} color={colors.dangerAccent} />
              <Text style={[styles.actionSheetItemText, styles.actionSheetItemTextDestructive]}>
                Delete Folder
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionSheetCancelBtn}
              onPress={() => setFolderActionTarget(null)}
            >
              <Text style={styles.actionSheetCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Delete Folder Confirmation Modal */}
      <ConfirmationModal
        visible={folderToDelete !== null}
        title="Delete Folder?"
        message={`Are you sure you want to delete "${folderToDelete?.name}"? All reviewers in this folder will remain safe and be moved to unorganized.`}
        confirmText="Delete Folder"
        isDestructive={true}
        isLoading={isDeletingFolder}
        onConfirm={handleDeleteFolder}
        onCancel={() => setFolderToDelete(null)}
      />

      {/* Rename Folder Modal */}
      <RenameModal
        visible={folderToEdit !== null}
        title="Rename Folder"
        subtitle="Enter a new name for this study folder."
        initialTitle={folderToEdit?.name || ''}
        onSave={handleRenameFolder}
        onCancel={() => setFolderToEdit(null)}
      />

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
  foldersSection: {
    marginBottom: spacing[12],
  },
  folderSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[8],
    paddingHorizontal: spacing[2],
  },
  folderHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[6],
  },
  folderSectionTitle: {
    fontSize: typography.fontSize[14],
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
  },
  folderCountBadge: {
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[2],
    borderRadius: 6,
  },
  folderCountBadgeText: {
    fontSize: typography.fontSize[11],
    fontWeight: typography.fontWeight.semiBold,
    color: colors.textSecondary,
  },
  addFolderHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[8],
    borderRadius: 8,
    backgroundColor: colors.primarySoft,
  },
  addFolderHeaderText: {
    fontSize: typography.fontSize[12],
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
  },
  folderCarouselContent: {
    flexDirection: 'row',
    gap: spacing[8],
    paddingRight: spacing[16],
    paddingVertical: spacing[2],
  },
  folderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingVertical: spacing[8],
    paddingHorizontal: spacing[12],
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing[6],
    ...Platform.select({
      ios: {
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 2,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  folderCardActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  folderCardIconBox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  folderCardIconBoxActive: {
    backgroundColor: colors.surface,
  },
  folderCardName: {
    fontSize: typography.fontSize[13],
    fontWeight: typography.fontWeight.semiBold,
    color: colors.text,
    maxWidth: 120,
  },
  folderCardNameActive: {
    color: colors.primary,
    fontWeight: typography.fontWeight.bold,
  },
  folderCardBadge: {
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[1],
    borderRadius: 10,
  },
  folderCardBadgeActive: {
    backgroundColor: colors.surface,
  },
  folderCardBadgeText: {
    fontSize: typography.fontSize[11],
    fontWeight: typography.fontWeight.bold,
    color: colors.textMuted,
  },
  folderCardBadgeTextActive: {
    color: colors.primary,
  },
  folderMoreBtn: {
    padding: spacing[2],
    marginLeft: spacing[2],
  },
  addFolderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingVertical: spacing[8],
    paddingHorizontal: spacing[12],
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.primaryBorder,
    gap: spacing[4],
  },
  addFolderCardText: {
    fontSize: typography.fontSize[13],
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
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
  cardHeaderLeft: {
    flex: 1,
    marginRight: spacing[8],
  },
  cardFolderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[2],
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: spacing[4],
  },
  cardFolderBadgeText: {
    fontSize: typography.fontSize[11],
    fontWeight: typography.fontWeight.semiBold,
    color: colors.primary,
    maxWidth: 160,
  },
  cardTitle: {
    fontSize: typography.fontSize[16],
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
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
  folderBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
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
  emptyMomoImage: {
    width: 120,
    height: 120,
    marginBottom: spacing[12],
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
  actionSheetBackdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  folderActionSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: spacing[20],
    paddingTop: spacing[20],
    paddingBottom: Platform.OS === 'ios' ? spacing[36] : spacing[24],
    borderCurve: 'continuous',
    gap: spacing[8],
    ...Platform.select({
      ios: {
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 16,
      },
      android: {
        elevation: 16,
      },
    }),
  },
  folderActionTitle: {
    fontSize: typography.fontSize[16],
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing[12],
  },
  actionSheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[12],
    backgroundColor: colors.surfaceMuted,
    paddingVertical: spacing[14],
    paddingHorizontal: spacing[16],
    borderRadius: 12,
  },
  actionSheetItemDestructive: {
    backgroundColor: colors.dangerSoft,
  },
  actionSheetItemText: {
    fontSize: typography.fontSize[14],
    fontWeight: typography.fontWeight.semiBold,
    color: colors.text,
  },
  actionSheetItemTextDestructive: {
    color: colors.dangerAccent,
  },
  actionSheetCancelBtn: {
    paddingVertical: spacing[14],
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
    marginTop: spacing[6],
  },
  actionSheetCancelText: {
    fontSize: typography.fontSize[14],
    fontWeight: typography.fontWeight.bold,
    color: colors.textMuted,
  },
});
