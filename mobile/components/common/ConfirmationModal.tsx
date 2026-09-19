import React, { useEffect, useRef } from 'react';
import { colors, spacing, typography } from '@/constants/theme';
import {
  Modal,
  View,
  StyleSheet,
  Animated,
  ActivityIndicator,
  Platform,
  TouchableWithoutFeedback,
  TouchableOpacity,
} from 'react-native';
import { AppText as Text } from '@/components/common/app-text';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  AlertCircleIcon,
  Logout01Icon,
} from '@hugeicons/core-free-icons';
import { Image } from 'react-native';

export interface ConfirmationModalProps {
  visible: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  isLoading?: boolean;
  icon?: 'delete' | 'warning' | 'logout' | 'thinking';
  extraContent?: React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  visible,
  title,
  message,
  confirmText = 'Delete',
  cancelText = 'Cancel',
  isDestructive = true,
  isLoading = false,
  icon = 'delete',
  extraContent,
  onConfirm,
  onCancel,
}) => {
  const scaleAnim = useRef(new Animated.Value(0.92)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          speed: 20,
          bounciness: 4,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scaleAnim.setValue(0.92);
      opacityAnim.setValue(0);
    }
  }, [visible]);

  if (!visible) return null;

  const renderIcon = () => {
    if (icon === 'delete') {
      return (
        <View style={styles.momoContainer}>
          <Image
            source={require('../../assets/animations/worried_momo.png')}
            style={styles.momoImage}
            resizeMode="contain"
          />
        </View>
      );
    }
    if (icon === 'thinking') {
      return (
        <View style={styles.momoContainer}>
          <Image
            source={require('../../assets/animations/thinking_momo.png')}
            style={styles.momoImageLarge}
            resizeMode="contain"
          />
        </View>
      );
    }
    if (icon === 'logout') {
      return (
        <View style={[styles.iconCircle, styles.destructiveIconBg]}>
          <HugeiconsIcon icon={Logout01Icon} size={28} color={colors.danger} strokeWidth={2} />
        </View>
      );
    }
    return (
      <View style={[styles.iconCircle, styles.warningIconBg]}>
        <HugeiconsIcon icon={AlertCircleIcon} size={28} color={colors.warning} strokeWidth={2} />
      </View>
    );
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <TouchableWithoutFeedback onPress={isLoading ? undefined : onCancel}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback>
            <Animated.View
              style={[
                styles.dialogCard,
                {
                  opacity: opacityAnim,
                  transform: [{ scale: scaleAnim }],
                },
              ]}
            >
              {renderIcon()}

              <Text style={styles.title}>{title}</Text>
              <Text style={styles.message}>{message}</Text>

              {extraContent ? (
                <View style={styles.extraContentWrapper}>{extraContent}</View>
              ) : null}

              {/* Centered Actions Row with Balanced Spacing */}
              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={onCancel}
                  disabled={isLoading}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={cancelText}
                >
                  <Text style={styles.cancelBtnText}>{cancelText}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.confirmBtn,
                    isDestructive ? styles.destructiveBtn : styles.primaryConfirmBtn,
                    isLoading && styles.disabledBtn,
                  ]}
                  onPress={onConfirm}
                  disabled={isLoading}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={confirmText}
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color={colors.onPrimary} />
                  ) : (
                    <Text style={styles.confirmBtnText}>{confirmText}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[20],
  },
  dialogCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.surface,
    borderRadius: 24,
    paddingTop: spacing[28],
    paddingHorizontal: spacing[24],
    paddingBottom: spacing[24],
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    ...Platform.select({
      ios: {
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.2,
        shadowRadius: 24,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  momoContainer: {
    marginTop: spacing[4],
    marginBottom: spacing[16],
    alignItems: 'center',
    justifyContent: 'center',
  },
  momoImage: {
    width: 96,
    height: 96,
  },
  momoImageLarge: {
    width: 104,
    height: 104,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing[4],
    marginBottom: spacing[18],
  },
  destructiveIconBg: {
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
  },
  warningIconBg: {
    backgroundColor: colors.warningSoft,
    borderWidth: 1,
    borderColor: colors.warningBorder,
  },
  title: {
    fontSize: typography.fontSize[20],
    fontWeight: typography.fontWeight.extraBold,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing[8],
    letterSpacing: typography.letterSpacing[-0.3],
    paddingHorizontal: spacing[8],
  },
  message: {
    fontSize: typography.fontSize[14],
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: typography.lineHeight[21.5],
    marginBottom: spacing[24],
    paddingHorizontal: spacing[6],
  },
  extraContentWrapper: {
    width: '100%',
    marginBottom: spacing[20],
    alignItems: 'center',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[12],
    width: '100%',
    marginTop: spacing[4],
  },
  cancelBtn: {
    flex: 1,
    height: 50,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: spacing[12],
  },
  cancelBtnText: {
    fontSize: typography.fontSize[15],
    fontWeight: typography.fontWeight.bold,
    color: colors.textSecondary,
    textAlign: 'center',
    includeFontPadding: false,
  },
  confirmBtn: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[12],
  },
  destructiveBtn: {
    backgroundColor: colors.danger,
    ...Platform.select({
      ios: {
        shadowColor: colors.danger,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  primaryConfirmBtn: {
    backgroundColor: colors.primary,
    ...Platform.select({
      ios: {
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  disabledBtn: {
    opacity: 0.7,
  },
  confirmBtnText: {
    fontSize: typography.fontSize[15],
    fontWeight: typography.fontWeight.bold,
    color: colors.onPrimary,
    textAlign: 'center',
    includeFontPadding: false,
  },
});
