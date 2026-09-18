import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Platform,
  StatusBar as RNStatusBar,
} from 'react-native';
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
} from '@hugeicons/core-free-icons';
import { listStudySets, deleteStudySet, updateStudySet } from '../../lib/api/studySets';
import { localDb } from '../../lib/storage/localDb';
import { PlatformPressable } from '../../components/common/PlatformPressable';
import { ConfirmationModal } from '../../components/common/ConfirmationModal';
import { RenameModal } from '../../components/common/RenameModal';
import { StudyMascotCard } from '../../components/mascot/StudyMascotCard';
import { DashboardFAB } from '../../components/common/DashboardFAB';
import { SmoothScrollView } from '../../components/common/SmoothScrollView';
import { TabTransitionView } from '../../components/common/TabTransitionView';
import { StudySet } from '../../types';

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
  const insets = useSafeAreaInsets();
  const [sets, setSets] = useState<StudySet[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<StudySet | null>(null);
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
      const setsData = await listStudySets().catch(() => localDb.listStudySets());
      setSets(setsData || []);
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

  return (
    <TabTransitionView style={styles.screen}>
      <SmoothScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: Platform.OS === 'android'
              ? Math.max(insets.top, RNStatusBar.currentHeight || 0, 28) + 14
              : Math.max(insets.top, 20),
            paddingBottom: Math.max(insets.bottom, 24) + 88, // Clearance for floating tab bar
          },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#4F46E5"
            colors={['#4F46E5']}
          />
        }
      >
        {/* Header with Greeting & Date */}
        <View style={styles.header}>
          <View style={styles.headerTextCol}>
            <Text style={styles.dateLabel}>{getFormattedDate()}</Text>
            <Text style={styles.greeting}>{getGreeting()}</Text>
            <Text style={styles.subtitle}>Ready to master your study materials?</Text>
          </View>
          <TouchableOpacity
            style={styles.profileBadge}
            onPress={() => router.push('/(tabs)/profile')}
            activeOpacity={0.8}
          >
            <View style={styles.avatarMini}>
              <Text style={styles.avatarMiniText}>ST</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Study Mascot Momo with Daily Tips & Quotes */}
        <StudyMascotCard />

        {/* Enhanced Continue Studying Hero Section */}
        {featured ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Continue Studying</Text>
              <View style={styles.heroLiveBadge}>
                <View style={styles.pulseDot} />
                <Text style={styles.heroLiveText}>ACTIVE REVIEWER</Text>
              </View>
            </View>

            <View style={styles.heroCard}>
              {/* Card Header Tags */}
              <View style={styles.heroCardHeaderRow}>
                <View style={styles.groundedTag}>
                  <HugeiconsIcon icon={CheckmarkCircle02Icon} size={12} color="#A7F3D0" strokeWidth={2.5} />
                  <Text style={styles.groundedTagText}>Grounded in Upload</Text>
                </View>
                <View style={styles.itemsCountBadge}>
                  <Text style={styles.itemsCountText}>{featured.item_count} Items</Text>
                </View>
              </View>

              {/* Title */}
              <Text style={styles.heroTitle} numberOfLines={2}>
                {featured.title}
              </Text>
              {featured.description ? (
                <Text style={styles.heroDesc} numberOfLines={2}>
                  {featured.description}
                </Text>
              ) : null}

              {/* Dual Launch Action Buttons */}
              <View style={styles.heroActionGrid}>
                <PlatformPressable
                  style={styles.heroPrimaryBtn}
                  onPress={() =>
                    router.push({
                      pathname: '/study/[studySetId]',
                      params: { studySetId: featured.id, initialMode: 'flashcard' },
                    })
                  }
                >
                  <View style={styles.heroBtnContent}>
                    <HugeiconsIcon icon={FlashIcon} size={16} color="#312E81" strokeWidth={2.5} />
                    <Text style={styles.heroPrimaryBtnText}>Flashcards</Text>
                  </View>
                </PlatformPressable>

                <PlatformPressable
                  style={styles.heroSecondaryBtn}
                  onPress={() =>
                    router.push({
                      pathname: '/study/[studySetId]',
                      params: { studySetId: featured.id, initialMode: 'quiz' },
                    })
                  }
                >
                  <View style={styles.heroBtnContent}>
                    <HugeiconsIcon icon={HelpCircleIcon} size={16} color="#FFFFFF" strokeWidth={2.2} />
                    <Text style={styles.heroSecondaryBtnText}>Practice Quiz</Text>
                  </View>
                </PlatformPressable>
              </View>
            </View>
          </View>
        ) : null}

        {/* Recent Study Sets / Reviewers */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Reviewers</Text>
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/library')}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.seeAllText}>View All ({sets.length})</Text>
            </TouchableOpacity>
          </View>

          {sets.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconCircle}>
                <HugeiconsIcon icon={BookOpen01Icon} size={28} color="#4F46E5" strokeWidth={1.8} />
              </View>
              <Text style={styles.emptyTitle}>No study sets yet</Text>
              <Text style={styles.emptySubtitle}>
                Tap the action button to upload study material and generate an AI reviewer.
              </Text>
              <TouchableOpacity
                style={styles.emptyActionBtn}
                onPress={() => router.push('/documents/upload')}
                activeOpacity={0.8}
              >
                <HugeiconsIcon icon={Upload01Icon} size={16} color="#FFFFFF" strokeWidth={2.2} />
                <Text style={styles.emptyActionBtnText}>Upload Document</Text>
              </TouchableOpacity>
            </View>
          ) : (
            sets.slice(0, 5).map((s) => (
              <View key={s.id} style={styles.itemCard}>
                <TouchableOpacity
                  style={styles.itemContent}
                  onPress={() => router.push(`/study/${s.id}`)}
                  activeOpacity={0.7}
                >
                  <View style={styles.itemTitleRow}>
                    <Text style={styles.itemTitle} numberOfLines={1}>
                      {s.title}
                    </Text>
                    <View style={styles.countBadge}>
                      <Text style={styles.countBadgeText}>{s.item_count} cards</Text>
                    </View>
                  </View>
                  <Text style={styles.itemMeta}>
                    Created {new Date(s.created_at).toLocaleDateString()}
                  </Text>
                </TouchableOpacity>
                <View style={styles.itemActions}>
                  <TouchableOpacity
                    style={styles.editBtn}
                    onPress={() => setRenameTarget(s)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityLabel="Rename quiz"
                  >
                    <HugeiconsIcon icon={Edit02Icon} size={16} color="#4F46E5" strokeWidth={1.75} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => setDeleteTarget(s)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityLabel="Delete reviewer"
                  >
                    <HugeiconsIcon icon={Delete02Icon} size={16} color="#EF4444" strokeWidth={1.75} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.arrowCircle}
                    onPress={() => router.push(`/study/${s.id}`)}
                    accessibilityLabel="Open reviewer"
                  >
                    <HugeiconsIcon icon={ArrowRight01Icon} size={16} color="#475569" strokeWidth={2.2} />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>
      </SmoothScrollView>

      {/* Floating Action Button (FAB) for Upload Document & Study Sets */}
      <DashboardFAB
        onUpload={() => router.push('/documents/upload')}
        onStudySets={() => router.push('/(tabs)/library')}
        studySetsCount={sets.length}
      />

      {/* Reusable Animated Confirmation Modal */}
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
  screen: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 18,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  headerTextCol: {
    flex: 1,
    marginRight: 12,
  },
  dateLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  greeting: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 2,
  },
  profileBadge: {
    marginTop: 4,
  },
  avatarMini: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EEF2FF',
    borderWidth: 2,
    borderColor: '#C7D2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarMiniText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4F46E5',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  seeAllText: {
    fontSize: 13,
    color: '#4F46E5',
    fontWeight: '600',
  },
  heroLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 5,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  heroLiveText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#059669',
    letterSpacing: 0.5,
  },
  heroCard: {
    backgroundColor: '#1E1B4B',
    borderRadius: 20,
    padding: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#1E1B4B',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.32,
        shadowRadius: 16,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  heroCardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  groundedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(16, 185, 129, 0.18)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  groundedTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#A7F3D0',
  },
  itemsCountBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  itemsCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#E0E7FF',
  },
  heroTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 6,
    lineHeight: 25,
    letterSpacing: -0.3,
  },
  heroDesc: {
    fontSize: 13,
    color: '#C7D2FE',
    lineHeight: 18,
    marginBottom: 16,
  },
  heroActionGrid: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  heroPrimaryBtn: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
  },
  heroSecondaryBtn: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  heroBtnContent: {
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  heroPrimaryBtnText: {
    color: '#312E81',
    fontWeight: '800',
    fontSize: 13,
  },
  heroSecondaryBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  itemCard: {
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 14,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 4,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  itemContent: {
    flex: 1,
    marginRight: 10,
  },
  itemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 3,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
    flex: 1,
  },
  countBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4F46E5',
  },
  itemMeta: {
    fontSize: 12,
    color: '#64748B',
  },
  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    padding: 24,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 14,
    lineHeight: 18,
  },
  emptyActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#4F46E5',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
  },
  emptyActionBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
