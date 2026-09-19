import React from 'react';
import { Platform, 
  View,
  Modal,
  StyleSheet,
  Image,
  TouchableOpacity,
 } from 'react-native';
import { AppText as Text } from '@/components/common/app-text';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  TrophyIcon,
  SparklesIcon,
  CheckmarkCircle02Icon,
  ArrowRight01Icon,
  FlashIcon,
} from '@hugeicons/core-free-icons';
import { colors, spacing, typography } from '@/constants/theme';

interface CelebrationModalProps {
  visible: boolean;
  onDismiss: () => void;
  title?: string;
  subtitle?: string;
  xpEarned?: number;
  itemsCount?: number;
}

export const CelebrationModal: React.FC<CelebrationModalProps> = ({
  visible,
  onDismiss,
  title = "Boom! You're Locked In!",
  subtitle = "Momo is super proud! You just crushed your study session with flying colors.",
  xpEarned = 50,
  itemsCount = 6,
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Momo Mascot Header */}
          <View style={styles.mascotWrapper}>
            <Image
              source={require('@/assets/animations/cheer_momo.png')}
              style={styles.mascotImage}
              resizeMode="contain"
            />
            <View style={styles.badgePill}>
              <HugeiconsIcon icon={TrophyIcon} size={14} color="#B45309" strokeWidth={2.5} />
              <Text style={styles.badgePillText}>First Milestone Unlocked</Text>
            </View>
          </View>

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>

          {/* Stats Highlight Card */}
          <View style={styles.statsCard}>
            <View style={styles.statCol}>
              <View style={styles.statIconBadge}>
                <HugeiconsIcon icon={SparklesIcon} size={16} color={colors.warningAccent} strokeWidth={2.5} />
              </View>
              <Text style={styles.statValue}>+{xpEarned}</Text>
              <Text style={styles.statLabel}>XP Earned</Text>
            </View>

            <View style={styles.statDivider} />

            <View style={styles.statCol}>
              <View style={[styles.statIconBadge, { backgroundColor: colors.successSoft }]}>
                <HugeiconsIcon icon={CheckmarkCircle02Icon} size={16} color={colors.success} strokeWidth={2.5} />
              </View>
              <Text style={styles.statValue}>{itemsCount}</Text>
              <Text style={styles.statLabel}>Cards Studied</Text>
            </View>

            <View style={styles.statDivider} />

            <View style={styles.statCol}>
              <View style={[styles.statIconBadge, { backgroundColor: colors.primarySoft }]}>
                <HugeiconsIcon icon={FlashIcon} size={16} color={colors.primary} strokeWidth={2.5} />
              </View>
              <Text style={styles.statValue}>1 Day</Text>
              <Text style={styles.statLabel}>Streak Started</Text>
            </View>
          </View>

          {/* Offline Sync Reminder */}
          <View style={styles.offlineNotice}>
            <Text style={styles.offlineNoticeText}>
              💡 Your progress is saved right on your phone and will sync whenever you're back online!
            </Text>
          </View>

          {/* Continue Button */}
          <TouchableOpacity
            style={styles.continueBtn}
            onPress={onDismiss}
            accessibilityRole="button"
            accessibilityLabel="Awesome, Let's Keep Going!"
          >
            <Text style={styles.continueBtnText}>Awesome, Let's Keep Going!</Text>
            <HugeiconsIcon icon={ArrowRight01Icon} size={16} color={colors.onPrimary} strokeWidth={2.5} />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing[20],
  },
  container: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    borderCurve: 'continuous',
    padding: spacing[24],
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: colors.shadow || '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  mascotWrapper: {
    alignItems: 'center',
    marginBottom: spacing[12],
  },
  mascotImage: {
    width: 140,
    height: 140,
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[10],
    borderRadius: 20,
    borderCurve: 'continuous',
    gap: 4,
    marginTop: -spacing[10],
  },
  badgePillText: {
    fontSize: typography.fontSize[11],
    fontWeight: typography.fontWeight.bold,
    color: '#92400E',
  },
  title: {
    fontSize: typography.fontSize[20],
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing[6],
  },
  subtitle: {
    fontSize: typography.fontSize[13],
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: spacing[16],
  },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceMuted,
    borderRadius: 16,
    borderCurve: 'continuous',
    paddingVertical: spacing[12],
    paddingHorizontal: spacing[8],
    width: '100%',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: spacing[14],
  },
  statCol: {
    alignItems: 'center',
    flex: 1,
  },
  statIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderCurve: 'continuous',
    backgroundColor: '#FFFBEB',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  statValue: {
    fontSize: typography.fontSize[16],
    fontWeight: typography.fontWeight.bold,
    fontVariant: ['tabular-nums'],
    color: colors.text,
  },
  statLabel: {
    fontSize: typography.fontSize[11],
    color: colors.textMuted,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 36,
    backgroundColor: colors.border,
  },
  offlineNotice: {
    backgroundColor: colors.primarySoft,
    borderRadius: 10,
    borderCurve: 'continuous',
    padding: spacing[10],
    marginBottom: spacing[18],
    width: '100%',
  },
  offlineNoticeText: {
    fontSize: typography.fontSize[11.5],
    color: colors.primaryDark,
    lineHeight: 16,
  },
  continueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: spacing[12],
    paddingHorizontal: spacing[20],
    borderRadius: 14,
    borderCurve: 'continuous',
    width: '100%',
    gap: 8,
  },
  continueBtnText: {
    fontSize: typography.fontSize[14],
    fontWeight: typography.fontWeight.bold,
    color: colors.onPrimary,
  },
});
