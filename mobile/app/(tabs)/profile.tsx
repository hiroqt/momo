import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View, StatusBar as RNStatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { ArrowRight01Icon, RefreshIcon, Logout01Icon } from '@hugeicons/core-free-icons';
import { AppText as Text } from '@/components/common/app-text';
import { StudyIcon } from '@/components/common/StudyIcon';
import { MomoAnimation } from '@/components/mascot/MomoAnimation';
import { ConfirmationModal } from '@/components/common/ConfirmationModal';
import { SmoothScrollView } from '@/components/common/SmoothScrollView';
import { colors, spacing } from '@/constants/theme';
import { apiFetch } from '@/lib/api/client';
import { formatStudyFormats, formatStudyTrack, getQuotaSummary } from '@/lib/screens/settings';
import { useOnboarding } from '@/context/OnboardingContext';
import type { UserProfile } from '@/types';

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const preferences = useOnboarding();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileState, setProfileState] = useState<'loading' | 'ready' | 'unavailable'>('loading');
  const [retry, setRetry] = useState(0);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showSignOutModal, setShowSignOutModal] = useState(false);

  useEffect(() => {
    let active = true;
    if (preferences.isGuestMode) {
      setProfile(null);
      setProfileState('ready');
      return;
    }
    setProfileState('loading');
    apiFetch<UserProfile>('/api/me')
      .then(value => { if (active) { setProfile(value); setProfileState('ready'); } })
      .catch(() => { if (active) { setProfile(null); setProfileState('unavailable'); } });
    return () => { active = false; };
  }, [retry, preferences.isGuestMode]);

  const quota = getQuotaSummary(profile);
  const name = [preferences.firstName, preferences.lastName].filter(Boolean).join(' ') || profile?.full_name || 'Your study space';
  const studyTrack = formatStudyTrack(preferences.studyTrack, preferences.highSchoolGrade ?? '', preferences.collegeYear ?? '', preferences.collegeCourse ?? '');
  const formats = formatStudyFormats(preferences.preferredFormats ?? [], preferences.preferredFormat ?? '');

  return (
    <View style={styles.screen} testID="settings-screen">
      <SmoothScrollView style={styles.scroll} contentContainerStyle={[
        styles.content,
        { paddingTop: Platform.OS === 'android' ? Math.max(insets.top, RNStatusBar.currentHeight || 0, 28) + 14 : Math.max(insets.top, 20), paddingBottom: Math.max(insets.bottom, 24) + spacing[88] },
      ]}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>MAKE IT YOURS</Text>
          <Text style={styles.title}>Settings</Text>
          <Text style={styles.subtitle}>Your space for a calmer study routine.</Text>
        </View>

        <View style={styles.accountCard}>
          <View style={styles.identity}>
            <Text style={styles.accountName}>{name}</Text>
            <Text style={styles.accountDetail}>{preferences.isGuestMode ? 'Guest preview · stored on this device' : profile?.email || 'Account details unavailable'}</Text>
            <View style={styles.pill}><Text style={styles.pillText}>{preferences.isGuestMode ? 'Exploring with Momo' : 'Learning with Momo'}</Text></View>
          </View>
          <MomoAnimation name="momo-rest" size={96} />
        </View>

        <Text style={styles.sectionTitle}>Your study routine</Text>
        <View style={styles.card}>
          <View style={styles.cardHeading}><StudyIcon name="settings" size={44} /><View style={styles.headingCopy}><Text style={styles.cardTitle}>Study preferences</Text><Text style={styles.cardSubtitle}>A plan that fits your day</Text></View></View>
          <PreferenceRow label="Study track" value={studyTrack} />
          <PreferenceRow label="Study formats" value={formats} />
          <PreferenceRow label="Daily goal" value={`${preferences.dailyGoalMinutes} minutes`} />
          <PreferenceRow label="Reminders" value={preferences.studyRemindersEnabled ? 'Enabled in your preferences' : 'Off'} />
          <Pressable testID="settings-replay-onboarding" accessibilityRole="button" accessibilityLabel="Review your study preferences" onPress={() => setShowResetModal(true)} style={({ pressed }) => [styles.actionRow, pressed && styles.pressed]}>
            <HugeiconsIcon icon={RefreshIcon} size={18} color={colors.primary} /><Text style={styles.actionText}>Review my preferences</Text><HugeiconsIcon icon={ArrowRight01Icon} size={18} color={colors.primary} />
          </Pressable>
          <Text style={styles.footnote}>Reopens the welcome guide and resets helpful tips.</Text>
        </View>

        <Text style={styles.sectionTitle}>Documents & privacy</Text>
        <View style={styles.card} testID="settings-quota">
          <View style={styles.cardHeading}><StudyIcon name="folder" size={44} /><View style={styles.headingCopy}><Text style={styles.cardTitle}>Monthly uploads</Text><Text style={styles.cardSubtitle}>10 accepted documents each month</Text></View></View>
          {quota ? <>
            <View style={styles.quotaNumbers}><Text style={styles.quotaUsed}>{quota.used}</Text><Text style={styles.quotaLimit}> / {quota.limit} used</Text><Text style={styles.quotaRemaining}>{quota.remaining} left</Text></View>
            <View style={styles.track} accessibilityRole="progressbar" accessibilityLabel="Monthly uploads used" accessibilityValue={{ min: 0, max: quota.limit, now: quota.used }}><View style={[styles.fill, { width: `${quota.percent}%` }]} /></View>
            <Text style={styles.footnote}>{quota.remaining ? 'Your next reviewer starts with your notes.' : 'You have reached your monthly upload limit.'}</Text>
          </> : profileState === 'loading' ? <View style={styles.loading} accessibilityLiveRegion="polite"><ActivityIndicator color={colors.primary} /><Text style={styles.cardSubtitle}>Checking your account…</Text></View> : <>
            <Text style={styles.body}>{preferences.isGuestMode ? 'Upload availability is checked on your account when you upload a document.' : 'We could not check your upload usage. Connect and try again.'}</Text>
            {!preferences.isGuestMode && <Pressable testID="settings-retry-profile" accessibilityRole="button" onPress={() => setRetry(value => value + 1)} style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}><Text style={styles.actionText}>Try again</Text></Pressable>}
          </>}
        </View>

        <View style={styles.privacyCard}>
          <View style={styles.cardHeading}><StudyIcon name="shield" size={44} /><View style={styles.headingCopy}><Text style={styles.cardTitle}>Your notes, thoughtfully kept</Text><Text style={styles.cardSubtitle}>Temporary files. Lasting learning.</Text></View></View>
          <Text style={styles.body}>Original files are deleted after 3 days. Your generated reviewers and study progress stay with you.</Text>
          <View style={styles.divider} />
          <Text style={styles.privacyTitle}>Study answers start with your sources</Text>
          <Text style={styles.body}>Momo uses your uploaded material for study content. If the source is missing information, Momo asks for more.</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeading}><StudyIcon name="book" size={44} /><View style={styles.headingCopy}><Text style={styles.cardTitle}>Study anywhere</Text><Text style={styles.cardSubtitle}>Keep a reviewer close</Text></View></View>
          <Text style={styles.body}>Open a downloaded reviewer without a connection. Creating new material needs internet.</Text>
          <Pressable testID="settings-open-library" accessibilityRole="button" onPress={() => router.push('/(tabs)/library')} style={({ pressed }) => [styles.actionRow, pressed && styles.pressed]}><Text style={styles.actionText}>Go to my library</Text><HugeiconsIcon icon={ArrowRight01Icon} size={18} color={colors.primary} /></Pressable>
        </View>

        {!preferences.isGuestMode && <Pressable testID="settings-sign-out" accessibilityRole="button" onPress={() => setShowSignOutModal(true)} style={({ pressed }) => [styles.signOut, pressed && styles.pressed]}><HugeiconsIcon icon={Logout01Icon} size={18} color={colors.textSecondary} /><Text style={styles.signOutText}>Account options</Text></Pressable>}
      </SmoothScrollView>
      <ConfirmationModal visible={showResetModal} icon="thinking" title="Review your preferences?" message="This reopens the welcome guide and resets helpful tips. Your saved study sets stay in your library." confirmText="Open guide" isDestructive={false} onConfirm={async () => { setShowResetModal(false); await preferences.resetOnboarding(); router.replace('/(auth)/welcome'); }} onCancel={() => setShowResetModal(false)} />
      <ConfirmationModal visible={showSignOutModal} icon="logout" title="Account preview" message="Account sign-out is not connected in this preview. Your study materials are kept on this device." confirmText="Got it" isDestructive={false} onConfirm={() => setShowSignOutModal(false)} onCancel={() => setShowSignOutModal(false)} />
    </View>
  );
}

function PreferenceRow({ label, value }: { label: string; value: string }) {
  return <View style={styles.preferenceRow}><Text style={styles.preferenceLabel}>{label}</Text><Text style={styles.preferenceValue}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, width: '100%', maxWidth: 760, alignSelf: 'center' },
  header: { marginBottom: 24 },
  eyebrow: { fontSize: 11, letterSpacing: 1, fontWeight: '700', color: colors.primary, marginBottom: 6 },
  title: { fontSize: 30, fontWeight: '800', letterSpacing: -0.5, color: colors.text },
  subtitle: { fontSize: 13, lineHeight: 20, color: colors.textSecondary, marginTop: 4 },
  accountCard: { padding: 20, borderRadius: 24, borderCurve: 'continuous', backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.primaryBorder, flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 24 },
  identity: { flex: 1 },
  accountName: { fontSize: 20, lineHeight: 28, fontWeight: '700', color: colors.text },
  accountDetail: { fontSize: 12, lineHeight: 18, color: colors.textSecondary, marginTop: 4 },
  pill: { alignSelf: 'flex-start', backgroundColor: colors.surface, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 12, marginTop: 12 },
  pillText: { color: colors.primary, fontSize: 10, fontWeight: '600' },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: 12 },
  card: { backgroundColor: colors.surface, borderRadius: 24, borderCurve: 'continuous', padding: 20, borderWidth: 1, borderColor: colors.border, marginBottom: 16 },
  privacyCard: { backgroundColor: colors.primarySoft, borderRadius: 24, borderCurve: 'continuous', padding: 20, borderWidth: 1, borderColor: colors.primaryBorder, marginBottom: 16 },
  cardHeading: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  headingCopy: { flex: 1 },
  cardTitle: { color: colors.text, fontSize: 15, lineHeight: 21, fontWeight: '700' },
  cardSubtitle: { color: colors.textSecondary, fontSize: 11, lineHeight: 17, marginTop: 2 },
  preferenceRow: { paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  preferenceLabel: { width: '34%', color: colors.textSecondary, fontSize: 12, lineHeight: 18 },
  preferenceValue: { flex: 1, color: colors.text, fontSize: 12, lineHeight: 18, fontWeight: '600', textAlign: 'right' },
  actionRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 8 },
  actionText: { flexShrink: 1, fontSize: 12, color: colors.primary, fontWeight: '700' },
  footnote: { color: colors.textSecondary, fontSize: 11, lineHeight: 17, marginTop: 8 },
  quotaNumbers: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 12 },
  quotaUsed: { color: colors.primary, fontSize: 32, fontWeight: '800', fontVariant: ['tabular-nums'] },
  quotaLimit: { color: colors.textSecondary, fontSize: 13 },
  quotaRemaining: { flex: 1, textAlign: 'right', color: colors.primary, fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] },
  track: { height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: colors.surfaceMuted },
  fill: { height: '100%', backgroundColor: colors.primary, borderRadius: 4 },
  body: { color: colors.textSecondary, fontSize: 12, lineHeight: 19 },
  loading: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 },
  retryButton: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', paddingHorizontal: 16, backgroundColor: colors.primarySoft, borderRadius: 12, marginTop: 12 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.primaryBorder, marginVertical: 16 },
  privacyTitle: { color: colors.text, fontSize: 13, fontWeight: '600', marginBottom: 6 },
  signOut: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  signOutText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  pressed: { opacity: 0.65 },
});
