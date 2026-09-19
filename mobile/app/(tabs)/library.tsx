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
  Upload01Icon,
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

  const [studySetActionTarget, setStudySetActionTarget] = useState<StudySet | null>(null);
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
          {/* Folders Section / Carousel (shown when user has folders or study sets) */}
          {(folders.length > 0 || sets.length > 0) && (
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
                      {isSelected && (
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
                            color={colors.primary}
                          />
                        </TouchableOpacity>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

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
                          <View style={styles.cardFolderBadge}>
                            <HugeiconsIcon icon={Folder01Icon} size={11} color={colors.primary} />
                            <Text style={styles.cardFolderBadgeText} numberOfLines={1}>
                              {assignedFolder.name}
                            </Text>
                          </View>
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
                  <TouchableOpacity
                    style={styles.moreOptionsBtn}
                    onPress={() => setStudySetActionTarget(item)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    accessibilityLabel="Study set options"
                  >
                    <HugeiconsIcon icon={MoreVerticalIcon} size={18} color={colors.textSecondary} strokeWidth={2} />
                  </TouchableOpacity>
                </View>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                {selectedFolderId ? (
                  // Empty Folder
                  <View style={styles.emptyBox}>
                    <View style={styles.emptyFolderIconCircle}>
                      <HugeiconsIcon icon={Folder01Icon} size={30} color={colors.primary} strokeWidth={1.8} />
                    </View>
                    <Text style={styles.emptyHeroTitle}>This Folder is Empty</Text>
                    <Text style={styles.emptyHeroText}>
                      {`There are no reviewers saved in "${folders.find((f) => f.id === selectedFolderId)?.name || 'this folder'}". You can organize existing reviewers here via the (⋮) menu, or upload new files.`}
                    </Text>
                    <View style={styles.emptyButtonRow}>
                      <TouchableOpacity
                        style={styles.emptySecondaryBtn}
                        onPress={() => setSelectedFolderId(null)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.emptySecondaryBtnText}>View All Reviewers</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.emptyHeroActionBtn}
                        onPress={() => router.push('/documents/upload')}
                        activeOpacity={0.8}
                      >
                        <HugeiconsIcon icon={Upload01Icon} size={16} color={colors.onPrimary} strokeWidth={2.2} />
                        <Text style={styles.emptyHeroActionText}>Upload Notes</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : search ? (
                  // Search No Results
                  <View style={styles.emptyBox}>
                    <View style={styles.emptyIconCircle}>
                      <HugeiconsIcon icon={Search01Icon} size={28} color={colors.textDisabled} strokeWidth={2} />
                    </View>
                    <Text style={styles.emptyHeroTitle}>No matching reviewers</Text>
                    <Text style={styles.emptyHeroText}>
                      We couldn't find any study sets matching &quot;{search}&quot;. Try a different keyword or check your spelling.
                    </Text>
                    <TouchableOpacity
                      style={styles.emptySecondaryBtn}
                      onPress={() => setSearch('')}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.emptySecondaryBtnText}>Clear Search</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  // Completely Empty Study Library
                  <View style={styles.emptyBox}>
                    <Image
                      source={require('@/assets/animations/folder_momo.png')}
                      style={styles.emptyMomoImage}
                      resizeMode="contain"
                    />
                    <Text style={styles.emptyHeroTitle}>Your Study Library is Empty</Text>
                    <Text style={styles.emptyHeroText}>
                      Upload your lecture notes, slides, or study documents. Momo will turn them into flashcards, quizzes, and practice exams!
                    </Text>
                    <TouchableOpacity
                      style={styles.emptyHeroActionBtn}
                      onPress={() => router.push('/documents/upload')}
                      activeOpacity={0.8}
                    >
                      <HugeiconsIcon icon={Upload01Icon} size={18} color={colors.onPrimary} strokeWidth={2.2} />
                      <Text style={styles.emptyHeroActionText}>Upload Notes to Begin</Text>
                    </TouchableOpacity>

                    {/* Feature highlights */}
                    <View style={styles.emptyFeatureList}>
                      <View style={styles.emptyFeatureItem}>
                        <View style={styles.emptyFeatureIconDot} />
                        <Text style={styles.emptyFeatureText}>Instant Flashcards, Quizzes & Practice Exams</Text>
                      </View>
                      <View style={styles.emptyFeatureItem}>
                        <View style={styles.emptyFeatureIconDot} />
                        <Text style={styles.emptyFeatureText}>100% grounded in your uploaded documents</Text>
                      </View>
                      <View style={styles.emptyFeatureItem}>
                        <View style={styles.emptyFeatureIconDot} />
                        <Text style={styles.emptyFeatureText}>Organize with folders & study offline anytime</Text>
                      </View>
                    </View>
                  </View>
                )}
              </View>
            }
          />
        </>
      ) : (
        /* Documents Tab Content */
        <>
          <View style={styles.docSectionHeader}>
            <View style={styles.docHeaderTitleRow}>
              <HugeiconsIcon icon={File01Icon} size={16} color={colors.primary} strokeWidth={2.2} />
              <Text style={styles.docSectionTitle} numberOfLines={1}>
                Documents
              </Text>
              <View style={styles.docCountBadge}>
                <Text style={styles.docCountBadgeText}>
                  {docs.length} {docs.length === 1 ? 'File' : 'Files'}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.addDocHeaderBtn}
              onPress={() => router.push('/documents/upload')}
              activeOpacity={0.7}
              accessibilityLabel="Upload document"
            >
              <HugeiconsIcon icon={Upload01Icon} size={14} color={colors.primary} strokeWidth={2.2} />
              <Text style={styles.addDocHeaderText}>Upload</Text>
            </TouchableOpacity>
          </View>

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
                <TouchableOpacity
                  style={styles.docCard}
                  onPress={() => {
                    if (isReady) {
                      router.push(`/create/${item.id}`);
                    }
                  }}
                  activeOpacity={isReady ? 0.7 : 1}
                >
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
                      <View style={styles.studyActionBadge}>
                        <HugeiconsIcon icon={SparklesIcon} size={13} color={colors.primary} strokeWidth={2} />
                        <Text style={styles.studyActionBadgeText}>Study</Text>
                      </View>
                    )}
                    <TouchableOpacity
                      style={styles.docDeleteBtn}
                      onPress={(e) => {
                        e.stopPropagation();
                        setDeleteTarget({ type: 'doc', doc: item });
                      }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      accessibilityLabel="Delete document"
                    >
                      <HugeiconsIcon icon={Delete02Icon} size={17} color={colors.dangerAccent} strokeWidth={1.75} />
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                {search ? (
                  <View style={styles.emptyBox}>
                    <View style={styles.emptyIconCircle}>
                      <HugeiconsIcon icon={Search01Icon} size={28} color={colors.textDisabled} strokeWidth={2} />
                    </View>
                    <Text style={styles.emptyHeroTitle}>No matching documents</Text>
                    <Text style={styles.emptyHeroText}>
                      No documents match &quot;{search}&quot;. Try another keyword.
                    </Text>
                    <TouchableOpacity
                      style={styles.emptySecondaryBtn}
                      onPress={() => setSearch('')}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.emptySecondaryBtnText}>Clear Search</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.emptyBox}>
                    <View style={[styles.emptyIconCircle, styles.docEmptyIconCircle]}>
                      <HugeiconsIcon icon={File01Icon} size={28} color={colors.primary} strokeWidth={1.8} />
                    </View>
                    <Text style={styles.emptyHeroTitle}>No documents uploaded yet</Text>
                    <Text style={styles.emptyHeroText}>
                      Upload your PDF, DOCX, or TXT documents to generate AI reviewers. Original files are retained for 3 days, while generated study sets persist forever.
                    </Text>
                    <TouchableOpacity
                      style={styles.emptyHeroActionBtn}
                      onPress={() => router.push('/documents/upload')}
                      activeOpacity={0.8}
                    >
                      <HugeiconsIcon icon={Upload01Icon} size={18} color={colors.onPrimary} strokeWidth={2.2} />
                      <Text style={styles.emptyHeroActionText}>Upload Document</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            }
          />
        </>
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

      {/* Study Set Action Options Sheet */}
      <Modal
        visible={studySetActionTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setStudySetActionTarget(null)}
      >
        <TouchableOpacity
          style={styles.actionSheetBackdrop}
          activeOpacity={1}
          onPress={() => setStudySetActionTarget(null)}
        >
          <View style={styles.folderActionSheet}>
            <Text style={styles.folderActionTitle} numberOfLines={1}>
              {studySetActionTarget?.title}
            </Text>

            <TouchableOpacity
              style={styles.actionSheetItem}
              onPress={() => {
                const target = studySetActionTarget;
                setStudySetActionTarget(null);
                setMoveToFolderTarget(target);
              }}
            >
              <HugeiconsIcon icon={Folder01Icon} size={18} color={colors.primary} />
              <Text style={styles.actionSheetItemText}>
                {studySetActionTarget?.folder_id ? 'Change / Remove Folder' : 'Move to Folder'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionSheetItem}
              onPress={() => {
                const target = studySetActionTarget;
                setStudySetActionTarget(null);
                setRenameTarget(target);
              }}
            >
              <HugeiconsIcon icon={Edit02Icon} size={18} color={colors.primary} />
              <Text style={styles.actionSheetItemText}>Rename Reviewer</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionSheetItem, styles.actionSheetItemDestructive]}
              onPress={() => {
                const target = studySetActionTarget;
                setStudySetActionTarget(null);
                if (target) {
                  setDeleteTarget({ type: 'set', set: target });
                }
              }}
            >
              <HugeiconsIcon icon={Delete02Icon} size={18} color={colors.dangerAccent} />
              <Text style={[styles.actionSheetItemText, styles.actionSheetItemTextDestructive]}>
                Delete Reviewer
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionSheetCancelBtn}
              onPress={() => setStudySetActionTarget(null)}
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
  moreOptionsBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceMuted,
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
  studyActionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing[8],
    paddingVertical: spacing[5],
    borderRadius: 6,
  },
  studyActionBadgeText: {
    fontSize: typography.fontSize[11],
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
  },
  docDeleteBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.dangerSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    paddingTop: spacing[8],
  },
  emptyBox: {
    padding: spacing[24],
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing[8],
    ...Platform.select({
      ios: {
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  emptyMomoImage: {
    width: 130,
    height: 130,
    marginBottom: spacing[14],
  },
  emptyFolderIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[14],
  },
  emptyIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[12],
  },
  docEmptyIconCircle: {
    backgroundColor: colors.primarySoft,
  },
  emptyHeroTitle: {
    fontSize: typography.fontSize[18],
    fontWeight: typography.fontWeight.extraBold,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing[8],
    letterSpacing: typography.letterSpacing[-0.3],
  },
  emptyHeroText: {
    color: colors.textMuted,
    fontSize: typography.fontSize[13],
    textAlign: 'center',
    lineHeight: typography.lineHeight[20],
    marginBottom: spacing[20],
    maxWidth: 320,
  },
  docSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[12],
    paddingHorizontal: spacing[2],
    gap: spacing[8],
  },
  docHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[6],
    flex: 1,
    marginRight: spacing[8],
  },
  docSectionTitle: {
    fontSize: typography.fontSize[14],
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
  },
  docCountBadge: {
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[2],
    borderRadius: 6,
  },
  docCountBadgeText: {
    fontSize: typography.fontSize[11],
    fontWeight: typography.fontWeight.semiBold,
    color: colors.textSecondary,
  },
  addDocHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    paddingVertical: spacing[5],
    paddingHorizontal: spacing[10],
    borderRadius: 8,
    backgroundColor: colors.primarySoft,
    flexShrink: 0,
  },
  addDocHeaderText: {
    fontSize: typography.fontSize[12],
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
  },
  emptyHeroActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[8],
    backgroundColor: colors.primary,
    paddingHorizontal: spacing[22],
    paddingVertical: spacing[13],
    borderRadius: 12,
    ...Platform.select({
      ios: {
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  emptyHeroActionText: {
    color: colors.onPrimary,
    fontWeight: typography.fontWeight.bold,
    fontSize: typography.fontSize[14],
  },
  emptyFeatureList: {
    width: '100%',
    marginTop: spacing[24],
    paddingTop: spacing[18],
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing[10],
  },
  emptyFeatureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[10],
  },
  emptyFeatureIconDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  emptyFeatureText: {
    fontSize: typography.fontSize[12],
    color: colors.textSecondary,
    fontWeight: typography.fontWeight.medium,
  },
  emptyButtonRow: {
    flexDirection: 'row',
    gap: spacing[10],
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginTop: spacing[4],
  },
  emptySecondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[12],
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptySecondaryBtnText: {
    fontSize: typography.fontSize[13],
    fontWeight: typography.fontWeight.semiBold,
    color: colors.textSecondary,
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
