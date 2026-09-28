import React from 'react';
import { Platform, 
  View,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
 } from 'react-native';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';
import { AppText as Text } from '@/components/common/app-text';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { Cancel01Icon } from '@hugeicons/core-free-icons';
import { colors, spacing, typography } from '@/constants/theme';

interface CoachmarkTooltipProps {
  title: string;
  description: string;
  onDismiss: () => void;
  style?: ViewStyle;
  arrowPosition?: 'top' | 'bottom' | 'none';
  actionLabel?: string;
  onAction?: () => void;
}

export const CoachmarkTooltip: React.FC<CoachmarkTooltipProps> = ({
  title,
  description,
  onDismiss,
  style,
  arrowPosition = 'bottom',
  actionLabel = 'Got it',
  onAction,
}) => {
  const handleAction = () => {
    if (onAction) {
      onAction();
    } else {
      onDismiss();
    }
  };

  return (
    <Animated.View
      entering={FadeIn.duration(180).reduceMotion(ReduceMotion.System)}
      renderToHardwareTextureAndroid={true}
      needsOffscreenAlphaCompositing={true}
      style={[styles.container, style]}
    >
      {arrowPosition === 'top' && <View style={styles.arrowTop} />}

      <View style={styles.content}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>{title}</Text>
          <TouchableOpacity
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            onPress={onDismiss}
            style={styles.closeButton}
            accessibilityRole="button"
            accessibilityLabel="Dismiss tip"
          >
            <HugeiconsIcon icon={Cancel01Icon} size={14} color={colors.textMuted} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        <Text style={styles.description}>{description}</Text>

        <View style={styles.footerRow}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={handleAction}
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
          >
            <Text style={styles.actionBtnText}>{actionLabel}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {arrowPosition === 'bottom' && <View style={styles.arrowBottom} />}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: spacing[8],
    zIndex: 100,
  },
  content: {
    backgroundColor: '#1E1B4B', // Deep indigo aura
    borderRadius: 14,
    borderCurve: 'continuous',
    padding: spacing[12],
    borderWidth: 1.5,
    borderColor: '#6366F1',
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[6],
  },
  iconBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing[8],
  },
  title: {
    flex: 1,
    fontSize: typography.fontSize[13],
    fontWeight: typography.fontWeight.bold,
    color: '#F8FAFC',
  },
  closeButton: {
    padding: 2,
  },
  description: {
    fontSize: typography.fontSize[12],
    color: '#C7D2FE',
    lineHeight: 18,
    marginBottom: spacing[10],
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[10],
    borderRadius: 8,
    borderCurve: 'continuous',
    gap: 4,
  },
  actionBtnText: {
    fontSize: typography.fontSize[11.5],
    fontWeight: typography.fontWeight.bold,
    color: colors.onPrimary,
  },
  arrowBottom: {
    alignSelf: 'center',
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#6366F1',
  },
  arrowTop: {
    alignSelf: 'center',
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderBottomWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#6366F1',
  },
});
