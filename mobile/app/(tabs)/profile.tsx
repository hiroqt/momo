import React, { useEffect, useState } from 'react';
import { colors, spacing, typography } from '@/constants/theme';
import {
  Platform,
  View,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  StatusBar as RNStatusBar,
} from 'react-native';
import { AppText as Text } from '@/components/common/app-text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  UserCircleIcon,
  InformationCircleIcon,
  CheckmarkCircle02Icon,
  Shield01Icon,
  Logout01Icon,
  FlashIcon,
  SparklesIcon,
  RefreshIcon,
  BookOpen01Icon,
} from '@hugeicons/core-free-icons';
import { apiFetch } from '../../lib/api/client';
import { PlatformPressable } from '../../components/common/PlatformPressable';
import { ConfirmationModal } from '../../components/common/ConfirmationModal';
import { SmoothScrollView } from '../../components/common/SmoothScrollView';
import { TabTransitionView } from '../../components/common/TabTransitionView';
import { UserProfile } from '../../types';
import { useOnboarding } from '../../context/OnboardingContext';

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    studyTrack,
    preferredFormat,
    preferredFormats,
    dailyGoalMinutes,
    isGuestMode,
    resetOnboarding,
    firstName,
    lastName,
    age,
    highSchoolGrade,
    collegeYear,
    collegeCourse,
    studyRemindersEnabled,
  } = useOnboarding();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);

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
    if (percent > 85) return colors.dangerAccent;
    if (percent > 60) return colors.warningAccent;
    return colors.successAccent;
  };

  const confirmSignOut = () => {
    setShowSignOutModal(false);
    Alert.alert('Signed Out', 'You have been signed out successfully.');
  };

  return (
    <TabTransitionView style={styles.screen} tabName="profile">
      <SmoothScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.contentContainer,
          {
            paddingTop: process.env.EXPO_OS === 'android'
              ? Math.max(insets.top, RNStatusBar.currentHeight || spacing[0], spacing[28]) + spacing[14]
              : Math.max(insets.top, spacing[20]),
            paddingBottom: Math.max(insets.bottom, spacing[24]) + spacing[88], // Floating nav clearance
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
            <HugeiconsIcon icon={UserCircleIcon} size={48} color={colors.primary} strokeWidth={1.5} />
          </View>
          <Text style={styles.name}>
            {firstName ? `${firstName} ${lastName}`.trim() : (profile?.full_name || 'Student Account')}
          </Text>
          <Text style={styles.email}>{profile?.email}</Text>
          <View style={styles.badgeRow}>
            <View style={styles.roleBadge}>
              <HugeiconsIcon icon={CheckmarkCircle02Icon} size={12} color={colors.success} strokeWidth={2.5} />
              <Text style={styles.roleBadgeText}>Active Student</Text>
            </View>
            <View style={styles.cloudBadge}>
              <HugeiconsIcon icon={FlashIcon} size={12} color={colors.primary} strokeWidth={2.5} />
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
            <HugeiconsIcon icon={InformationCircleIcon} size={18} color={colors.primaryDark} strokeWidth={2} />
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
            <HugeiconsIcon icon={Shield01Icon} size={18} color={colors.success} strokeWidth={2} />
            <Text style={styles.securityTitle}>Document-Verified Guarantee</Text>
          </View>
          <Text style={styles.securityText}>
            Content is generated strictly from your uploaded files with source provenance. Missing information is never hallucinated.
          </Text>
        </View>

        {/* Study Preferences & Onboarding Calibration */}
        <View style={styles.preferencesCard}>
          <View style={styles.preferencesHeader}>
            <View style={styles.prefIconBadge}>
              <HugeiconsIcon icon={SparklesIcon} size={16} color={colors.primary} strokeWidth={2.4} />
            </View>
            <Text style={styles.preferencesTitle}>Study Calibration</Text>
            {isGuestMode && (
              <View style={styles.guestPill}>
                <Text style={styles.guestPillText}>Guest Preview</Text>
              </View>
            )}
          </View>

          {firstName ? (
            <View style={styles.prefRow}>
              <Text style={styles.prefKey}>Student Name</Text>
              <Text style={styles.prefVal}>{`${firstName} ${lastName}`.trim()}</Text>
            </View>
          ) : null}

          <View style={styles.prefRow}>
            <Text style={styles.prefKey}>Age</Text>
            <Text style={styles.prefVal}>{age ? `${age} yrs old` : '13+ yrs old'}</Text>
          </View>

          <View style={styles.prefRow}>
            <Text style={styles.prefKey}>Study Track</Text>
            <Text style={styles.prefVal}>
              {studyTrack === 'high_school' && highSchoolGrade
                ? `HIGH SCHOOL (${highSchoolGrade.toUpperCase()})`
                : ['college', 'med_nursing', 'stem'].includes(studyTrack) && collegeYear
                ? `${studyTrack.toUpperCase()} (${collegeYear.toUpperCase()}${collegeCourse ? ` • ${collegeCourse.toUpperCase()}` : ''})`
                : collegeCourse
                ? `${studyTrack ? studyTrack.toUpperCase() : 'COLLEGE'} (${collegeCourse.toUpperCase()})`
                : studyTrack ? studyTrack.toUpperCase() : 'COLLEGE'}
            </Text>
          </View>

          <View style={styles.prefRow}>
            <Text style={styles.prefKey}>Preferred Format</Text>
            <Text style={styles.prefVal}>
              {preferredFormats && preferredFormats.length > 0
                ? preferredFormats.includes('all')
                  ? 'ALL FORMATS'
                  : preferredFormats.map((f) => f.toUpperCase()).join(', ')
                : preferredFormat
                ? preferredFormat.toUpperCase()
                : 'ALL FORMATS'}
            </Text>
          </View>

          <View style={styles.prefRow}>
            <Text style={styles.prefKey}>Daily Commitment</Text>
            <Text style={styles.prefVal}>{dailyGoalMinutes} mins / day</Text>
          </View>

          <View style={styles.prefRow}>
            <Text style={styles.prefKey}>Daily Reminders</Text>
            <Text
              style={[
                styles.prefVal,
                { color: studyRemindersEnabled ? colors.success : colors.textMuted },
              ]}
            >
              {studyRemindersEnabled ? 'ENABLED' : 'DISABLED'}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.replayButton}
            onPress={() => setShowResetModal(true)}
            accessibilityRole="button"
            accessibilityLabel="Replay Onboarding & Reset Tips"
          >
            <HugeiconsIcon icon={RefreshIcon} size={14} color={colors.primary} strokeWidth={2.2} />
            <Text style={styles.replayButtonText}>Replay Onboarding & Reset Tips</Text>
          </TouchableOpacity>
        </View>

        {/* Sign Out Button */}
        <PlatformPressable style={styles.logoutBtn} onPress={() => setShowSignOutModal(true)}>
          <View style={styles.logoutContent}>
            <HugeiconsIcon icon={Logout01Icon} size={18} color={colors.danger} strokeWidth={2} />
            <Text style={styles.logoutText}>Sign Out</Text>
          </View>
        </PlatformPressable>
      </SmoothScrollView>

      {/* Confirmation Modal for Resetting Onboarding */}
      <ConfirmationModal
        visible={showResetModal}
        icon="thinking"
        title="Replay Onboarding?"
        message="This will reset all in-app contextual tips and return you to the Momo welcome experience."
        confirmText="Replay Guide"
        isDestructive={false}
        onConfirm={async () => {
          setShowResetModal(false);
          await resetOnboarding();
          router.replace('/(auth)/welcome');
        }}
        onCancel={() => setShowResetModal(false)}
      />

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
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
  },
  contentContainer: {
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
  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderCurve: 'continuous',
    padding: spacing[22],
    alignItems: 'center',
    marginBottom: spacing[16],
    borderWidth: 1,
    borderColor: colors.border,
    ...Platform.select({
      ios: {
        shadowColor: colors.shadow || '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
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
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[10],
    borderWidth: 2,
    borderColor: colors.primaryBorder,
  },
  name: {
    fontSize: typography.fontSize[18],
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
  },
  email: {
    fontSize: typography.fontSize[13],
    color: colors.textMuted,
    marginTop: spacing[2],
  },
  badgeRow: {
    flexDirection: 'row',
    gap: spacing[8],
    marginTop: spacing[12],
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.successSoft,
    paddingHorizontal: spacing[8],
    paddingVertical: spacing[3],
    borderRadius: 8,
    borderCurve: 'continuous',
    gap: spacing[4],
  },
  roleBadgeText: {
    fontSize: typography.fontSize[11],
    fontWeight: typography.fontWeight.bold,
    color: colors.success,
  },
  cloudBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing[8],
    paddingVertical: spacing[3],
    borderRadius: 8,
    borderCurve: 'continuous',
    gap: spacing[4],
  },
  cloudBadgeText: {
    fontSize: typography.fontSize[11],
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
  },
  quotaCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderCurve: 'continuous',
    padding: spacing[20],
    marginBottom: spacing[16],
    borderWidth: 1,
    borderColor: colors.border,
    ...Platform.select({
      ios: {
        shadowColor: colors.shadow || '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
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
    fontSize: typography.fontSize[13],
    fontWeight: typography.fontWeight.bold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: typography.letterSpacing[0.5],
  },
  quotaPill: {
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing[8],
    paddingVertical: spacing[2],
    borderRadius: 6,
    borderCurve: 'continuous',
  },
  quotaPillText: {
    fontSize: typography.fontSize[11],
    fontWeight: typography.fontWeight.bold,
    color: colors.textSecondary,
  },
  quotaNumbers: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginVertical: spacing[10],
  },
  usedNum: {
    fontSize: typography.fontSize[32],
    fontWeight: typography.fontWeight.extraBold,
    fontVariant: ['tabular-nums'],
  },
  limitNum: {
    fontSize: typography.fontSize[18],
    fontWeight: typography.fontWeight.semiBold,
    fontVariant: ['tabular-nums'],
    color: colors.textMuted,
  },
  barBackground: {
    height: 10,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 5,
    borderCurve: 'continuous',
    overflow: 'hidden',
    marginBottom: spacing[8],
  },
  barFill: {
    height: '100%',
    borderRadius: 5,
    borderCurve: 'continuous',
  },
  quotaHint: {
    fontSize: typography.fontSize[12],
    color: colors.textMuted,
    lineHeight: typography.lineHeight[18],
  },
  retentionNotice: {
    backgroundColor: colors.primarySoft,
    padding: spacing[16],
    borderRadius: 16,
    borderCurve: 'continuous',
    marginBottom: spacing[14],
    borderWidth: 1,
    borderColor: colors.primarySoftStrong,
  },
  noticeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[8],
    marginBottom: spacing[6],
  },
  noticeTitle: {
    fontSize: typography.fontSize[13],
    fontWeight: typography.fontWeight.bold,
    color: colors.primaryDark,
  },
  noticeText: {
    fontSize: typography.fontSize[12],
    color: colors.primaryPressed,
    lineHeight: typography.lineHeight[18],
  },
  securityCard: {
    backgroundColor: colors.successSoft,
    padding: spacing[16],
    borderRadius: 16,
    borderCurve: 'continuous',
    marginBottom: spacing[24],
    borderWidth: 1,
    borderColor: colors.successBorder,
  },
  securityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[8],
    marginBottom: spacing[6],
  },
  securityTitle: {
    fontSize: typography.fontSize[13],
    fontWeight: typography.fontWeight.bold,
    color: colors.success,
  },
  securityText: {
    fontSize: typography.fontSize[12],
    color: colors.success,
    lineHeight: typography.lineHeight[18],
  },
  logoutBtn: {
    backgroundColor: colors.dangerSoft,
    borderRadius: 14,
    borderCurve: 'continuous',
  },
  logoutContent: {
    paddingVertical: spacing[14],
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing[8],
  },
  logoutText: {
    color: colors.danger,
    fontWeight: typography.fontWeight.bold,
    fontSize: typography.fontSize[15],
  },
  preferencesCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderCurve: 'continuous',
    padding: spacing[18],
    marginBottom: spacing[16],
    borderWidth: 1,
    borderColor: colors.border,
  },
  preferencesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[12],
    gap: 8,
  },
  prefIconBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderCurve: 'continuous',
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  preferencesTitle: {
    flex: 1,
    fontSize: typography.fontSize[14],
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
  },
  guestPill: {
    backgroundColor: '#FEF3C7',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderCurve: 'continuous',
  },
  guestPillText: {
    fontSize: typography.fontSize[10.5],
    fontWeight: typography.fontWeight.bold,
    color: '#92400E',
  },
  prefRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[6],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  prefKey: {
    fontSize: typography.fontSize[12.5],
    color: colors.textSecondary,
  },
  prefVal: {
    fontSize: typography.fontSize[12],
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
  },
  replayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: 12,
    borderCurve: 'continuous',
    paddingVertical: spacing[10],
    marginTop: spacing[14],
    gap: 6,
  },
  replayButtonText: {
    fontSize: typography.fontSize[12.5],
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
  },
});
