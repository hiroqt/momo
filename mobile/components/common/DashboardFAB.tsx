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
import { isIpad } from '@/utils/device';
import {
  Add01Icon,
  Upload01Icon,
  BookOpen01Icon,
  Camera01Icon,
} from '@hugeicons/core-free-icons';
import {
  GlassButton,
  GlassSurface,
  triggerGlassHaptic,
  glassRadius,
} from '@/components/glass';

interface DashboardFABProps {
  onUpload: () => void;
  onStudySets: () => void;
  onMathSolve: () => void;
  studySetsCount?: number;
}

export const DashboardFAB: React.FC<DashboardFABProps> = ({
  onUpload,
  onStudySets,
  onMathSolve,
  studySetsCount = 0,
}) => {
  const insets = useSafeAreaInsets();
  const [isOpen, setIsOpen] = useState(false);

  // Animation values
  const animation = useRef(new Animated.Value(0)).current;

  const toggleOpen = () => {
    const toValue = isOpen ? 0 : 1;
    triggerGlassHaptic(isOpen ? 'light' : 'medium');
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

  const handleMathSolvePress = () => {
    closeMenu();
    onMathSolve();
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

  // Action item 3 (Math Solve): slide up and fade in (highest)
  const mathSolveTranslateY = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [40, 0],
  });
  const mathSolveOpacity = animation.interpolate({
    inputRange: [0, 0.1, 1],
    outputRange: [0, 0, 1],
  });
  const mathSolveScale = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0.6, 1],
  });

  // Backdrop opacity
  const backdropOpacity = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const isTablet = isIpad();
  const bottomPosition = isTablet
    ? insets.bottom + spacing[24] + 82
    : Math.max(insets.bottom, spacing[12]) + spacing[76];

  const mainFabDimension = isTablet ? 68 : 56;
  const miniFabDimension = isTablet ? 56 : 46;

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
          {/* Action 3: Math Solve */}
          <Animated.View
            style={[
              styles.actionItemRow,
              {
                opacity: mathSolveOpacity,
                transform: [
                  { translateY: mathSolveTranslateY },
                  { scale: mathSolveScale },
                ],
              },
            ]}
          >
            <GlassSurface
              variant="regular"
              radius={isTablet ? 14 : 10}
              style={styles.labelPillSurface}
            >
              <TouchableOpacity
                style={styles.labelPill}
                onPress={handleMathSolvePress}
                activeOpacity={0.8}
              >
                <Text style={styles.labelText}>Solve a Problem</Text>
                <View style={[styles.countBadge, { backgroundColor: colors.warningSoft }]}>
                  <Text style={[styles.countBadgeText, { color: colors.warning }]}>AI</Text>
                </View>
              </TouchableOpacity>
            </GlassSurface>

            <GlassButton
              variant="subtle"
              size="icon"
              radius={glassRadius.full}
              haptic="light"
              onPress={handleMathSolvePress}
              accessibilityLabel="Solve a Problem"
              style={[styles.miniFab, styles.mathSolveMiniFab]}
              contentStyle={{ width: miniFabDimension, height: miniFabDimension }}
            >
              <HugeiconsIcon icon={Camera01Icon} size={isTablet ? 24 : 20} color={colors.warning} strokeWidth={2.2} />
            </GlassButton>
          </Animated.View>

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
            <GlassSurface
              variant="regular"
              radius={isTablet ? 14 : 10}
              style={styles.labelPillSurface}
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
            </GlassSurface>

            <GlassButton
              variant="subtle"
              size="icon"
              radius={glassRadius.full}
              haptic="light"
              onPress={handleStudySetsPress}
              accessibilityLabel="View Study Sets"
              style={[styles.miniFab, styles.studySetsMiniFab]}
              contentStyle={{ width: miniFabDimension, height: miniFabDimension }}
            >
              <HugeiconsIcon icon={BookOpen01Icon} size={isTablet ? 24 : 20} color={colors.primary} strokeWidth={2.2} />
            </GlassButton>
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
            <GlassSurface
              variant="regular"
              radius={isTablet ? 14 : 10}
              style={styles.labelPillSurface}
            >
              <TouchableOpacity
                style={styles.labelPill}
                onPress={handleUploadPress}
                activeOpacity={0.8}
              >
                <Text style={styles.labelText}>Upload Document</Text>
                <Text style={styles.labelSubText}>PDF, DOCX, PPTX</Text>
              </TouchableOpacity>
            </GlassSurface>

            <GlassButton
              variant="subtle"
              size="icon"
              radius={glassRadius.full}
              haptic="light"
              onPress={handleUploadPress}
              accessibilityLabel="Upload Document"
              style={[styles.miniFab, styles.uploadMiniFab]}
              contentStyle={{ width: miniFabDimension, height: miniFabDimension }}
            >
              <HugeiconsIcon icon={Upload01Icon} size={isTablet ? 24 : 20} color={colors.success} strokeWidth={2.2} />
            </GlassButton>
          </Animated.View>
        </View>

        {/* Primary Liquid Glass FAB Button */}
        <GlassButton
          variant="primary"
          size="icon"
          radius={glassRadius.full}
          haptic="medium"
          onPress={toggleOpen}
          accessibilityLabel={isOpen ? 'Close action menu' : 'Open action menu'}
          style={styles.mainFab}
          contentStyle={{ width: mainFabDimension, height: mainFabDimension }}
        >
          <Animated.View style={{ transform: [{ rotate: rotation }] }}>
            <HugeiconsIcon icon={Add01Icon} size={isTablet ? 32 : 26} color={colors.onPrimary} strokeWidth={2.6} />
          </Animated.View>
        </GlassButton>
      </View>
    </>
  );
};

const isPadDevice = isIpad();

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.overlaySoft,
    zIndex: 90,
  },
  container: {
    position: 'absolute',
    right: isPadDevice ? 36 : 20,
    alignItems: 'flex-end',
    zIndex: 100,
  },
  actionsContainer: {
    alignItems: 'flex-end',
    marginBottom: isPadDevice ? spacing[18] : spacing[14],
    gap: isPadDevice ? spacing[16] : spacing[12],
  },
  actionItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: isPadDevice ? spacing[14] : spacing[10],
  },
  labelPillSurface: {
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
  labelPill: {
    paddingVertical: isPadDevice ? spacing[10] : spacing[7],
    paddingHorizontal: isPadDevice ? spacing[16] : spacing[12],
    flexDirection: 'row',
    alignItems: 'center',
    gap: isPadDevice ? spacing[8] : spacing[6],
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
    alignItems: 'center',
    justifyContent: 'center',
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
    borderColor: colors.successBorder,
  },
  studySetsMiniFab: {
    borderColor: colors.primaryBorder,
  },
  mathSolveMiniFab: {
    borderColor: colors.warningBorder,
  },
  mainFab: {
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
