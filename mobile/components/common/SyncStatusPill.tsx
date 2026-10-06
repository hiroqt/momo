import { MomoAnimation } from '@/components/mascot/MomoAnimation';
import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, Animated, Pressable } from 'react-native';
import { AppText as Text } from './app-text';
import { mutationQueue, MutationQueueState } from '../../lib/sync/mutationQueue';
import { colors, typography } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { AlertCircleIcon, CheckmarkCircle02Icon } from '@hugeicons/core-free-icons';
import { useSyncAttention } from '@/hooks/useSyncAttention';
import { SyncAttentionSheet } from './SyncAttentionSheet';

export const SyncStatusPill: React.FC = () => {
  const insets = useSafeAreaInsets();
  const [queueState, setQueueState] = useState<MutationQueueState>(() => mutationQueue.getState());
  const [visible, setVisible] = useState(false);
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { attention, busyId, error, retryAnswers, retryChange, discardChange } = useSyncAttention();
  const [sheetOpen, setSheetOpen] = useState(false);
  const needsAttention = attention.total > 0;
  const attentionRef = useRef(false);
  attentionRef.current = needsAttention;

  useEffect(() => {
    if (!needsAttention) {
      // Resolved: fall back to the normal pill, which hides itself when idle.
      const state = mutationQueue.getState();
      if (!state.isSyncing && state.pendingCount === 0) {
        Animated.timing(opacityAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => setVisible(false));
      }
      return;
    }
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    setVisible(true);
    Animated.timing(opacityAnim, { toValue: 1, duration: 180, useNativeDriver: true }).start();
  }, [needsAttention]);

  useEffect(() => {
    const unsubscribe = mutationQueue.subscribe((state) => {
      setQueueState(state);

      if (state.isSyncing || state.pendingCount > 0) {
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        setVisible(true);
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }).start();
      } else if (attentionRef.current) {
        // Stay visible while something needs the learner's decision.
      } else if (state.lastSuccessTime && Date.now() - state.lastSuccessTime < 2500) {
        // Show success checkmark briefly
        setVisible(true);
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }).start();

        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        hideTimerRef.current = setTimeout(() => {
          Animated.timing(opacityAnim, {
            toValue: 0,
            duration: 250,
            useNativeDriver: true,
          }).start(() => setVisible(false));
        }, 1600);
      }
    });

    return () => {
      unsubscribe();
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  if (needsAttention || sheetOpen) {
    const label = attention.total === 1 ? '1 change needs your attention' : `${attention.total} changes need your attention`;
    return (
      <>
        <Animated.View pointerEvents="box-none" style={[styles.pillContainer, { top: insets.top + 8, opacity: opacityAnim }]}>
          {needsAttention && (
            <Pressable testID="sync-attention-pill" accessibilityRole="button" accessibilityLabel={label}
              accessibilityHint="Shows the changes so you can try again or discard them"
              onPress={() => setSheetOpen(true)} hitSlop={8}
              style={({ pressed }) => [styles.pillCard, styles.pillAttention, pressed && styles.pressed]}>
              <HugeiconsIcon icon={AlertCircleIcon} size={14} color="#B45309" strokeWidth={2.4} />
              <Text style={[styles.pillText, styles.attentionText]}>{label}</Text>
            </Pressable>
          )}
        </Animated.View>
        <SyncAttentionSheet visible={sheetOpen} attention={attention} busyId={busyId} error={error}
          onRetryAnswers={retryAnswers} onRetryChange={retryChange} onDiscardChange={discardChange}
          onClose={() => setSheetOpen(false)} />
      </>
    );
  }

  if (!visible) return null;

  const isSyncing = queueState.isSyncing || queueState.pendingCount > 0;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.pillContainer,
        { top: insets.top + 8 },
        {
          opacity: opacityAnim,
          transform: [
            {
              translateY: opacityAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [-10, 0],
              }),
            },
          ],
        },
      ]}
    >
      <View style={[styles.pillCard, isSyncing ? styles.pillSyncing : styles.pillSuccess]}>
        {isSyncing ? (
          <>
            <MomoAnimation name="sync-working" size={24} screenAware={false} active={queueState.isSyncing} />
            <Text style={styles.pillText}>
              {queueState.pendingCount > 1
                ? `${queueState.isSyncing ? 'Syncing' : 'Waiting to sync'} ${queueState.pendingCount} changes...`
                : queueState.isSyncing ? 'Syncing in background...' : 'Waiting to sync...'}
            </Text>
          </>
        ) : (
          <>
            <HugeiconsIcon icon={CheckmarkCircle02Icon} size={14} color="#047857" strokeWidth={2.4} />
            <Text style={[styles.pillText, { color: '#047857' }]}>Saved & Synced</Text>
          </>
        )}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  pillContainer: {
    position: 'absolute',
    maxWidth: '90%',
    alignSelf: 'center',
    zIndex: 9999,
  },
  pillCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  pillSyncing: {
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  pillAttention: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FCD34D',
    minHeight: 32,
  },
  attentionText: {
    color: '#92400E',
  },
  pressed: {
    opacity: 0.8,
  },
  pillSuccess: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  pulseDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  pillText: {
    flexShrink: 1,
    fontSize: 11.5,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
  },
});
