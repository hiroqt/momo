import React from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText as Text } from './app-text';
import { colors, spacing, typography } from '@/constants/theme';
import type { SyncAttention } from '@/lib/sync/syncAttention';

export interface SyncAttentionSheetProps {
  visible: boolean;
  attention: SyncAttention;
  busyId: string | null;
  error: string | null;
  onRetryAnswers: () => void;
  onRetryChange: (id: string) => void;
  onDiscardChange: (id: string) => void;
  onClose: () => void;
}

function SheetButton({ label, onPress, disabled, busy, tone = 'primary', testID }: {
  label: string; onPress: () => void; disabled?: boolean; busy?: boolean; tone?: 'primary' | 'quiet'; testID?: string;
}) {
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!disabled, busy: !!busy }}
      disabled={disabled} onPress={onPress} hitSlop={6}
      style={({ pressed }) => [styles.button, tone === 'primary' ? styles.primary : styles.quiet, (pressed || disabled) && styles.dimmed]}>
      {busy ? <ActivityIndicator size="small" color={tone === 'primary' ? colors.onPrimary : colors.textSecondary} />
        : <Text style={[styles.buttonText, tone === 'quiet' && styles.quietText]}>{label}</Text>}
    </Pressable>
  );
}

/** Lists server-refused answers and library changes with explicit Try again / Discard. */
export function SyncAttentionSheet({ visible, attention, busyId, error, onRetryAnswers, onRetryChange, onDiscardChange, onClose }: SyncAttentionSheetProps) {
  const insets = useSafeAreaInsets();
  const busy = busyId !== null;
  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable accessible={false} style={styles.backdrop} onPress={busy ? undefined : onClose} />
      <View accessibilityViewIsModal style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing[16]) + spacing[8] }]}>
        <Text accessibilityRole="header" style={styles.title}>Changes that need your attention</Text>
        <Text style={styles.body}>These are saved on this device but your account did not accept them. Try again, or discard a change to put your library back the way it was.</Text>
        {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {attention.heldAnswers > 0 && (
            <View testID="sync-attention-answers" style={styles.row}>
              <Text style={styles.label}>{attention.heldAnswers === 1 ? '1 study answer' : `${attention.heldAnswers} study answers`} could not sync</Text>
              <Text style={styles.reason}>The reviewer they belong to may have changed on your account.</Text>
              <View style={styles.actions}>
                <SheetButton testID="sync-attention-retry-answers" label="Try again" onPress={onRetryAnswers} disabled={busy} busy={busyId === 'answers'} />
              </View>
            </View>
          )}
          {attention.changes.map(change => (
            <View key={change.id} testID={`sync-attention-change-${change.id}`} style={styles.row}>
              <Text style={styles.label}>{change.label}</Text>
              <Text style={styles.reason}>{change.reason}</Text>
              <View style={styles.actions}>
                <SheetButton label="Discard" tone="quiet" onPress={() => onDiscardChange(change.id)} disabled={busy} />
                <SheetButton label="Try again" onPress={() => onRetryChange(change.id)} disabled={busy} busy={busyId === change.id} />
              </View>
            </View>
          ))}
          {attention.total === 0 && <Text style={styles.body}>Everything is synced.</Text>}
        </ScrollView>
        <SheetButton testID="sync-attention-close" label="Close" tone="quiet" onPress={onClose} disabled={busy} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.overlay },
  sheet: {
    backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: spacing[24], paddingHorizontal: spacing[20],
    maxHeight: '80%', gap: spacing[12],
    ...Platform.select({ ios: { shadowColor: colors.shadow, shadowOffset: { width: 0, height: -6 }, shadowOpacity: 0.15, shadowRadius: 16 }, android: { elevation: 12 } }),
  },
  title: { fontSize: typography.fontSize[20], fontWeight: typography.fontWeight.extraBold, color: colors.text },
  body: { fontSize: typography.fontSize[14], lineHeight: typography.lineHeight[21.5], color: colors.textSecondary },
  error: { fontSize: typography.fontSize[14], color: colors.danger, fontWeight: typography.fontWeight.bold },
  list: { flexGrow: 0 },
  listContent: { gap: spacing[12] },
  row: { borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: spacing[16], gap: spacing[6] },
  label: { fontSize: typography.fontSize[15], fontWeight: typography.fontWeight.bold, color: colors.text },
  reason: { fontSize: typography.fontSize[14], color: colors.textSecondary },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing[12], marginTop: spacing[6] },
  button: { minHeight: 44, minWidth: 96, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing[16] },
  primary: { backgroundColor: colors.primary },
  quiet: { backgroundColor: colors.surfaceMuted, borderWidth: 1.5, borderColor: colors.border },
  dimmed: { opacity: 0.7 },
  buttonText: { fontSize: typography.fontSize[15], fontWeight: typography.fontWeight.bold, color: colors.onPrimary },
  quietText: { color: colors.textSecondary },
});
