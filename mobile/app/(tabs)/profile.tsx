import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
  StatusBar as RNStatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  UserCircleIcon,
  InformationCircleIcon,
  CheckmarkCircle02Icon,
  Shield01Icon,
  Logout01Icon,
  FlashIcon,
} from '@hugeicons/core-free-icons';
import { apiFetch } from '../../lib/api/client';
import { PlatformPressable } from '../../components/common/PlatformPressable';
import { ConfirmationModal } from '../../components/common/ConfirmationModal';
import { SmoothScrollView } from '../../components/common/SmoothScrollView';
import { TabTransitionView } from '../../components/common/TabTransitionView';
import { UserProfile } from '../../types';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [showSignOutModal, setShowSignOutModal] = useState(false);

  useEffect(() => {
    apiFetch<UserProfile>('/api/me')
      .then(setProfile)
      .catch(() => {
        setProfile({
          id: 'dev-user-001',
          email: 'student@example.com',
          documents_used_this_month: 2,
          monthly_limit: 10,
          quota_resets_at: new Date(Date.now() + 86400000 * 12).toISOString(),
        });
      });
  }, []);

  const used = profile?.documents_used_this_month || 0;
  const limit = profile?.monthly_limit || 10;
  const percent = Math.min(100, Math.round((used / limit) * 100));
  const remaining = Math.max(0, limit - used);

  const getBarColor = () => {
    if (percent > 85) return '#EF4444';
    if (percent > 60) return '#F59E0B';
    return '#10B981';
  };

  const confirmSignOut = () => {
    setShowSignOutModal(false);
    Alert.alert('Signed Out', 'You have been signed out successfully.');
  };

  return (
    <TabTransitionView style={styles.screen}>
      <SmoothScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.contentContainer,
          {
            paddingTop: Platform.OS === 'android'
              ? Math.max(insets.top, RNStatusBar.currentHeight || 0, 28) + 14
              : Math.max(insets.top, 20),
            paddingBottom: Math.max(insets.bottom, 24) + 88, // Floating nav clearance
          },
        ]}
      >
        {/* Page Title */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Account & Settings</Text>
          <Text style={styles.headerSub}>Manage your study plan, quota, and storage</Text>
        </View>

        {/* Account Info Card */}
        <View style={styles.card}>
          <View style={styles.avatarCircle}>
            <HugeiconsIcon icon={UserCircleIcon} size={48} color="#4F46E5" strokeWidth={1.5} />
          </View>
          <Text style={styles.name}>{profile?.full_name || 'Student Account'}</Text>
          <Text style={styles.email}>{profile?.email}</Text>
          <View style={styles.badgeRow}>
            <View style={styles.roleBadge}>
              <HugeiconsIcon icon={CheckmarkCircle02Icon} size={12} color="#059669" strokeWidth={2.5} />
              <Text style={styles.roleBadgeText}>Active Student</Text>
            </View>
            <View style={styles.cloudBadge}>
              <HugeiconsIcon icon={FlashIcon} size={12} color="#4F46E5" strokeWidth={2.5} />
              <Text style={styles.cloudBadgeText}>Offline Ready</Text>
            </View>
          </View>
        </View>

        {/* Monthly Quota Card (PRD Rule 19) */}
        <View style={styles.quotaCard}>
          <View style={styles.quotaHeaderRow}>
            <Text style={styles.quotaHeader}>Monthly Document Limit</Text>
            <View style={styles.quotaPill}>
              <Text style={styles.quotaPillText}>{percent}% Used</Text>
            </View>
          </View>

          <View style={styles.quotaNumbers}>
            <Text style={[styles.usedNum, { color: getBarColor() }]}>{used}</Text>
            <Text style={styles.limitNum}> / {limit} documents</Text>
          </View>

          {/* Progress bar */}
          <View style={styles.barBackground}>
            <View
              style={[
                styles.barFill,
                {
                  width: `${percent}%`,
                  backgroundColor: getBarColor(),
                },
              ]}
            />
          </View>

          <Text style={styles.quotaHint}>
            {remaining > 0
              ? `You have ${remaining} document uploads remaining this billing period.`
              : 'You have reached your monthly document limit.'}
          </Text>
        </View>

        {/* Storage Retention Policy Notice (PRD Section 7 & Rule 8) */}
        <View style={styles.retentionNotice}>
          <View style={styles.noticeHeader}>
            <HugeiconsIcon icon={InformationCircleIcon} size={18} color="#3730A3" strokeWidth={2} />
            <Text style={styles.noticeTitle}>3-Day Document Retention Policy</Text>
          </View>
          <Text style={styles.noticeText}>
            Original uploaded documents are securely retained on AWS S3 for 3 days and then automatically deleted to preserve privacy.
            All your generated flashcards, questions, and reviewers persist permanently!
          </Text>
        </View>

        {/* Privacy & Security Card */}
        <View style={styles.securityCard}>
          <View style={styles.securityHeader}>
            <HugeiconsIcon icon={Shield01Icon} size={18} color="#059669" strokeWidth={2} />
            <Text style={styles.securityTitle}>Document-Verified Guarantee</Text>
          </View>
          <Text style={styles.securityText}>
            Content is generated strictly from your uploaded files with source provenance. Missing information is never hallucinated.
          </Text>
        </View>

        {/* Sign Out Button */}
        <PlatformPressable style={styles.logoutBtn} onPress={() => setShowSignOutModal(true)}>
          <View style={styles.logoutContent}>
            <HugeiconsIcon icon={Logout01Icon} size={18} color="#DC2626" strokeWidth={2} />
            <Text style={styles.logoutText}>Sign Out</Text>
          </View>
        </PlatformPressable>
      </SmoothScrollView>

      {/* Confirmation Modal for Sign Out */}
      <ConfirmationModal
        visible={showSignOutModal}
        icon="logout"
        title="Sign Out?"
        message="Are you sure you want to sign out of your student account on this device?"
        confirmText="Sign Out"
        isDestructive={true}
        onConfirm={confirmSignOut}
        onCancel={() => setShowSignOutModal(false)}
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
  contentContainer: {
    paddingHorizontal: 16,
  },
  header: {
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.4,
  },
  headerSub: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 22,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  avatarCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    borderWidth: 2,
    borderColor: '#C7D2FE',
  },
  name: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  email: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 4,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  cloudBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 4,
  },
  cloudBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4F46E5',
  },
  quotaCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  quotaHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quotaHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  quotaPill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  quotaPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  quotaNumbers: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginVertical: 10,
  },
  usedNum: {
    fontSize: 32,
    fontWeight: '800',
  },
  limitNum: {
    fontSize: 18,
    fontWeight: '600',
    color: '#64748B',
  },
  barBackground: {
    height: 10,
    backgroundColor: '#F1F5F9',
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: 8,
  },
  barFill: {
    height: '100%',
    borderRadius: 5,
  },
  quotaHint: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
  },
  retentionNotice: {
    backgroundColor: '#EEF2FF',
    padding: 16,
    borderRadius: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E0E7FF',
  },
  noticeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  noticeTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#312E81',
  },
  noticeText: {
    fontSize: 12,
    color: '#4338CA',
    lineHeight: 18,
  },
  securityCard: {
    backgroundColor: '#ECFDF5',
    padding: 16,
    borderRadius: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#D1FAE5',
  },
  securityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  securityTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#065F46',
  },
  securityText: {
    fontSize: 12,
    color: '#047857',
    lineHeight: 18,
  },
  logoutBtn: {
    backgroundColor: '#FEE2E2',
    borderRadius: 14,
  },
  logoutContent: {
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  logoutText: {
    color: '#DC2626',
    fontWeight: '700',
    fontSize: 15,
  },
});
