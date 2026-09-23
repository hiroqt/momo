import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { AppText as Text } from './app-text';
import { mutationQueue, MutationQueueState } from '../../lib/sync/mutationQueue';
import { colors, spacing, typography } from '@/constants/theme';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { CheckmarkCircle02Icon, CloudSyncIcon } from '@hugeicons/core-free-icons';

export const SyncStatusPill: React.FC = () => {
  const [queueState, setQueueState] = useState<MutationQueueState>(() => mutationQueue.getState());
  const [visible, setVisible] = useState(false);
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  if (!visible) return null;

  const isSyncing = queueState.isSyncing || queueState.pendingCount > 0;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.pillContainer,
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
            <View style={styles.pulseDot} />
            <Text style={styles.pillText}>
              {queueState.pendingCount > 1
                ? `Syncing ${queueState.pendingCount} changes...`
                : 'Syncing in background...'}
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
    top: 50,
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
    fontSize: 11.5,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
  },
});
