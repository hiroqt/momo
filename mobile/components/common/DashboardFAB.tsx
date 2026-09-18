import React, { useState, useRef } from 'react';
import { colors, spacing, typography } from '@/constants/theme';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Animated,
  Platform,
} from 'react-native';
import { AppText as Text } from '@/components/common/app-text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  Add01Icon,
  Upload01Icon,
  BookOpen01Icon,
} from '@hugeicons/core-free-icons';

interface DashboardFABProps {
  onUpload: () => void;
  onStudySets: () => void;
  studySetsCount?: number;
}

export const DashboardFAB: React.FC<DashboardFABProps> = ({
  onUpload,
  onStudySets,
  studySetsCount = 0,
}) => {
  const insets = useSafeAreaInsets();
  const [isOpen, setIsOpen] = useState(false);

  // Animation values
  const animation = useRef(new Animated.Value(0)).current;

  const toggleOpen = () => {
    const toValue = isOpen ? 0 : 1;
    Animated.spring(animation, {
      toValue,
      friction: 6,
      tension: 45,
      useNativeDriver: true,
    }).start();
    setIsOpen(!isOpen);
  };

  const closeMenu = () => {
    if (!isOpen) return;
    Animated.timing(animation, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
    setIsOpen(false);
  };

  const handleUploadPress = () => {
    closeMenu();
    onUpload();
  };

  const handleStudySetsPress = () => {
    closeMenu();
    onStudySets();
  };

  // Main button rotation (0deg -> 45deg to form an '×')
  const rotation = animation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '45deg'],
  });

  // Action item 1 (Upload Document): slide up and fade in
  const uploadTranslateY = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [20, 0],
  });
  const uploadOpacity = animation.interpolate({
    inputRange: [0, 0.4, 1],
    outputRange: [0, 0, 1],
  });
  const uploadScale = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0.6, 1],
  });

  // Action item 2 (Study Sets): slide up and fade in (higher)
  const studySetsTranslateY = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [30, 0],
  });
  const studySetsOpacity = animation.interpolate({
    inputRange: [0, 0.2, 1],
    outputRange: [0, 0, 1],
  });
  const studySetsScale = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0.6, 1],
  });

  // Backdrop opacity
  const backdropOpacity = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  // Position above the floating dock bar (dock is at insets.bottom + 4, height 58)
  const bottomPosition = Math.max(insets.bottom, spacing[12]) + spacing[76];

  return (
    <>
      {/* Dimmed backdrop when menu is open */}
      {isOpen && (
        <TouchableWithoutFeedback onPress={closeMenu}>
          <Animated.View
            style={[
              styles.backdrop,
              {
                opacity: backdropOpacity,
              },
            ]}
          />
        </TouchableWithoutFeedback>
      )}

      {/* FAB Container */}
      <View
        style={[styles.container, { bottom: bottomPosition }]}
        pointerEvents="box-none"
      >
        {/* Speed-Dial Menu Actions */}
        <View style={styles.actionsContainer} pointerEvents={isOpen ? 'auto' : 'none'}>
          {/* Action 2: Study Sets */}
          <Animated.View
            style={[
              styles.actionItemRow,
              {
                opacity: studySetsOpacity,
                transform: [
                  { translateY: studySetsTranslateY },
                  { scale: studySetsScale },
                ],
              },
            ]}
          >
            <TouchableOpacity
              style={styles.labelPill}
              onPress={handleStudySetsPress}
              activeOpacity={0.8}
            >
              <Text style={styles.labelText}>Study Sets</Text>
              {studySetsCount > 0 && (
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeText}>{studySetsCount}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.miniFab, styles.studySetsMiniFab]}
              onPress={handleStudySetsPress}
              activeOpacity={0.85}
              accessibilityLabel="View Study Sets"
              accessibilityRole="button"
            >
              <HugeiconsIcon icon={BookOpen01Icon} size={20} color={colors.primary} strokeWidth={2.2} />
            </TouchableOpacity>
          </Animated.View>

          {/* Action 1: Upload Document */}
          <Animated.View
            style={[
              styles.actionItemRow,
              {
                opacity: uploadOpacity,
                transform: [
                  { translateY: uploadTranslateY },
                  { scale: uploadScale },
                ],
              },
            ]}
          >
            <TouchableOpacity
              style={styles.labelPill}
              onPress={handleUploadPress}
              activeOpacity={0.8}
            >
              <Text style={styles.labelText}>Upload Document</Text>
              <Text style={styles.labelSubText}>PDF, DOCX, PPTX</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.miniFab, styles.uploadMiniFab]}
              onPress={handleUploadPress}
              activeOpacity={0.85}
              accessibilityLabel="Upload Document"
              accessibilityRole="button"
            >
              <HugeiconsIcon icon={Upload01Icon} size={20} color={colors.success} strokeWidth={2.2} />
            </TouchableOpacity>
          </Animated.View>
        </View>

        {/* Primary FAB Button */}
        <TouchableOpacity
          style={styles.mainFab}
          onPress={toggleOpen}
          activeOpacity={0.9}
          accessibilityLabel={isOpen ? 'Close action menu' : 'Open action menu'}
          accessibilityRole="button"
        >
          <Animated.View style={{ transform: [{ rotate: rotation }] }}>
            <HugeiconsIcon icon={Add01Icon} size={26} color={colors.onPrimary} strokeWidth={2.6} />
          </Animated.View>
        </TouchableOpacity>
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.overlaySoft,
    zIndex: 90,
  },
  container: {
    position: 'absolute',
    right: 20,
    alignItems: 'flex-end',
    zIndex: 100,
  },
  actionsContainer: {
    alignItems: 'flex-end',
    marginBottom: spacing[14],
    gap: spacing[12],
  },
  actionItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing[10],
  },
  labelPill: {
    backgroundColor: colors.surface,
    paddingVertical: spacing[7],
    paddingHorizontal: spacing[12],
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[6],
    ...Platform.select({
      ios: {
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 6,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  labelText: {
    fontSize: typography.fontSize[13],
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
  },
  labelSubText: {
    fontSize: typography.fontSize[11],
    fontWeight: typography.fontWeight.medium,
    color: colors.textMuted,
  },
  countBadge: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[2],
    borderRadius: 6,
  },
  countBadgeText: {
    fontSize: typography.fontSize[11],
    fontWeight: typography.fontWeight.extraBold,
    color: colors.primary,
  },
  miniFab: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    ...Platform.select({
      ios: {
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.14,
        shadowRadius: 6,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  uploadMiniFab: {
    backgroundColor: colors.successSoft,
    borderColor: colors.successBorder,
  },
  studySetsMiniFab: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primaryBorder,
  },
  mainFab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.38,
        shadowRadius: 10,
      },
      android: {
        elevation: 8,
      },
    }),
  },
});
