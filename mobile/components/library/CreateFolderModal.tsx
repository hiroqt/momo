import React, { useEffect, useRef, useState } from 'react';
import { colors, spacing, typography } from '@/constants/theme';
import {
  Modal,
  View,
  TextInput as NativeTextInput,
  StyleSheet,
  Animated,
  ActivityIndicator,
  Platform,
  TouchableWithoutFeedback,
  TouchableOpacity,
  KeyboardAvoidingView,
  Image,
} from 'react-native';
import { AppText as Text, AppTextInput as TextInput } from '@/components/common/app-text';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  Cancel01Icon,
  AlertCircleIcon,
  Coins01Icon,
  ArrowRight01Icon,
} from '@hugeicons/core-free-icons';
import { useRouter } from 'expo-router';
import { useCredits } from '@/context/CreditsContext';

export interface CreateFolderModalProps {
  visible: boolean;
  currentFolderCount: number;
  isLoading?: boolean;
  onSave: (name: string, cost: number) => void | Promise<void>;
  onCancel: () => void;
}

export const CreateFolderModal: React.FC<CreateFolderModalProps> = ({
  visible,
  currentFolderCount,
  isLoading = false,
  onSave,
  onCancel,
}) => {
  const router = useRouter();
  const { credits, deductCredits } = useCredits();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState(false);

  const scaleAnim = useRef(new Animated.Value(0.92)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const inputRef = useRef<NativeTextInput>(null);

  // Free up to 3 folders. Escalating cost formula:
  // 4th folder (index 3) = 50, 5th folder (index 4) = 75, etc.
  const cost = currentFolderCount < 3 ? 0 : 50 + (currentFolderCount - 3) * 25;
  const isFree = cost === 0;
  const hasEnoughCredits = isFree || credits >= cost;

  useEffect(() => {
    if (visible) {
      setName('');
      setError(null);
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
      ]).start(() => {
        setTimeout(() => inputRef.current?.focus(), 50);
      });
    } else {
      scaleAnim.setValue(0.92);
      opacityAnim.setValue(0);
      setIsFocused(false);
    }
  }, [visible]);

  if (!visible) return null;

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Please enter a folder name.');
      return;
    }
    if (trimmed.length > 50) {
      setError('Folder name cannot exceed 50 characters.');
      return;
    }

    if (!isFree && !hasEnoughCredits) {
      setError(`You need ${cost} credits to unlock this folder. You currently have ${credits}.`);
      return;
    }

    // Deduct credits if it's a paid tier
    if (!isFree) {
      const deducted = deductCredits(cost);
      if (!deducted) {
        setError('Credit deduction failed. Please check your balance in the Shop.');
        return;
      }
    }

    setError(null);
    onSave(trimmed, cost);
  };

  const handleGoToShop = () => {
    onCancel();
    router.push('/(tabs)/shop');
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={isLoading ? undefined : onCancel}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableWithoutFeedback onPress={isLoading ? undefined : onCancel}>
          <Animated.View style={[styles.backdrop, { opacity: opacityAnim }]}>
            <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
              <Animated.View
                style={[
                  styles.dialogCard,
                  {
                    transform: [{ scale: scaleAnim }],
                  },
                ]}
              >
                {/* Mascot Illustration */}
                <Image
                  source={
                    isFree
                      ? require('@/assets/animations/folder_momo.png')
                      : hasEnoughCredits
                      ? require('@/assets/animations/wealth_momo.png')
                      : require('@/assets/animations/no_credits_momo.png')
                  }
                  style={styles.mascotImage}
                  resizeMode="contain"
                />

                {/* Title */}
                <Text style={styles.dialogTitle}>Create New Folder</Text>

                {/* Tier & Quota Banner */}
                {isFree ? (
                  <View style={styles.freeBadge}>
                    <Text style={styles.freeBadgeText}>
                      Free Tier • {currentFolderCount}/3 Folders Used
                    </Text>
                  </View>
                ) : (
                  <View
                    style={[
                      styles.creditBadge,
                      !hasEnoughCredits && styles.creditBadgeWarning,
                    ]}
                  >
                    <HugeiconsIcon
                      icon={Coins01Icon}
                      size={14}
                      color={hasEnoughCredits ? '#B45309' : colors.dangerAccent}
                    />
                    <Text
                      style={[
                        styles.creditBadgeText,
                        !hasEnoughCredits && styles.creditBadgeTextWarning,
                      ]}
                    >
                      Cost: {cost} Credits • Balance: {credits}
                    </Text>
                  </View>
                )}

                <Text style={styles.dialogSubtitle}>
                  {isFree
                    ? 'Organize your study sets & quizzes into custom categories.'
                    : hasEnoughCredits
                    ? `Additional folders escalate by +25 credits each. Ready to unlock folder #${currentFolderCount + 1}?`
                    : `You need ${cost} credits to create folder #${currentFolderCount + 1}. Complete quizzes or visit the shop for more.`}
                </Text>

                {/* Input Field (if user has enough credits or free) */}
                {hasEnoughCredits ? (
                  <>
                    <View
                      style={[
                        styles.inputWrapper,
                        isFocused && styles.inputWrapperFocused,
                        !!error && styles.inputWrapperError,
                      ]}
                    >
                      <TextInput
                        ref={inputRef}
                        style={styles.textInput}
                        value={name}
                        onChangeText={(val) => {
                          setName(val);
                          if (error) setError(null);
                        }}
                        placeholder="e.g. Organic Chemistry"
                        placeholderTextColor={colors.textDisabled}
                        maxLength={50}
                        editable={!isLoading}
                        returnKeyType="done"
                        onSubmitEditing={handleSave}
                        onFocus={() => setIsFocused(true)}
                        onBlur={() => setIsFocused(false)}
                      />
                      {name.length > 0 && !isLoading && (
                        <TouchableOpacity
                          onPress={() => setName('')}
                          style={styles.clearBtn}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          accessibilityLabel="Clear text"
                        >
                          <HugeiconsIcon
                            icon={Cancel01Icon}
                            size={16}
                            color={colors.textDisabled}
                            strokeWidth={2}
                          />
                        </TouchableOpacity>
                      )}
                    </View>

                    {/* Char count & Error message */}
                    <View style={styles.helperRow}>
                      {error ? (
                        <View style={styles.errorRow}>
                          <HugeiconsIcon
                            icon={AlertCircleIcon}
                            size={14}
                            color={colors.dangerAccent}
                            strokeWidth={2}
                          />
                          <Text style={styles.errorText} numberOfLines={2}>
                            {error}
                          </Text>
                        </View>
                      ) : (
                        <View />
                      )}
                      <Text style={styles.charCount}>{name.length}/50</Text>
                    </View>

                    {/* Actions */}
                    <View style={styles.actionRow}>
                      <TouchableOpacity
                        style={styles.cancelBtn}
                        onPress={onCancel}
                        disabled={isLoading}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.cancelText}>Cancel</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.saveBtn,
                          (!name.trim() || isLoading) && styles.saveBtnDisabled,
                        ]}
                        onPress={handleSave}
                        disabled={!name.trim() || isLoading}
                        activeOpacity={0.8}
                      >
                        {isLoading ? (
                          <ActivityIndicator size="small" color={colors.onPrimary} />
                        ) : (
                          <Text style={styles.saveText}>
                            {isFree ? 'Create Folder' : `Unlock & Create (${cost} C)`}
                          </Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  /* Insufficient credits flow */
                  <View style={styles.insufficientContainer}>
                    <TouchableOpacity
                      style={styles.shopBtn}
                      onPress={handleGoToShop}
                      activeOpacity={0.8}
                    >
                      <HugeiconsIcon icon={Coins01Icon} size={18} color="#FFFFFF" strokeWidth={2} />
                      <Text style={styles.shopBtnText}>Get Credits in Shop</Text>
                      <HugeiconsIcon icon={ArrowRight01Icon} size={16} color="#FFFFFF" strokeWidth={2.5} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.cancelLink}
                      onPress={onCancel}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.cancelLinkText}>Maybe later</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </Animated.View>
            </TouchableWithoutFeedback>
          </Animated.View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing[24],
  },
  dialogCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.surface,
    borderRadius: 24,
    paddingHorizontal: spacing[24],
    paddingTop: spacing[20],
    paddingBottom: spacing[22],
    alignItems: 'center',
    borderCurve: 'continuous',
    ...Platform.select({
      ios: {
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 16 },
        shadowOpacity: 0.18,
        shadowRadius: 32,
      },
      android: {
        elevation: 12,
      },
    }),
  },
  mascotImage: {
    width: 100,
    height: 100,
    marginBottom: spacing[10],
  },
  dialogTitle: {
    fontSize: typography.fontSize[20],
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing[6],
  },
  freeBadge: {
    backgroundColor: colors.successSoft,
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[4],
    borderRadius: 12,
    marginBottom: spacing[8],
  },
  freeBadgeText: {
    fontSize: typography.fontSize[12],
    fontWeight: typography.fontWeight.bold,
    color: colors.success,
  },
  creditBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[6],
    backgroundColor: '#FEF3C7',
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[4],
    borderRadius: 12,
    marginBottom: spacing[8],
  },
  creditBadgeWarning: {
    backgroundColor: colors.dangerSoft,
  },
  creditBadgeText: {
    fontSize: typography.fontSize[12],
    fontWeight: typography.fontWeight.bold,
    color: '#92400E',
  },
  creditBadgeTextWarning: {
    color: colors.dangerAccent,
  },
  dialogSubtitle: {
    fontSize: typography.fontSize[13],
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: typography.lineHeight[18],
    marginBottom: spacing[16],
    paddingHorizontal: spacing[8],
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    backgroundColor: colors.background,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: spacing[14],
    minHeight: 48,
  },
  inputWrapperFocused: {
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  inputWrapperError: {
    borderColor: colors.dangerAccent,
  },
  textInput: {
    flex: 1,
    fontSize: typography.fontSize[15],
    color: colors.text,
    paddingVertical: spacing[10],
  },
  clearBtn: {
    padding: spacing[4],
    marginLeft: spacing[6],
  },
  helperRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginTop: spacing[6],
    marginBottom: spacing[16],
    minHeight: 18,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    flex: 1,
  },
  errorText: {
    fontSize: typography.fontSize[12],
    color: colors.dangerAccent,
    fontWeight: typography.fontWeight.medium,
  },
  charCount: {
    fontSize: typography.fontSize[12],
    color: colors.textDisabled,
    marginLeft: 'auto',
  },
  actionRow: {
    flexDirection: 'row',
    width: '100%',
    gap: spacing[12],
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: spacing[13],
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  cancelText: {
    fontSize: typography.fontSize[15],
    fontWeight: typography.fontWeight.semiBold,
    color: colors.textSecondary,
  },
  saveBtn: {
    flex: 1.2,
    paddingVertical: spacing[13],
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    ...Platform.select({
      ios: {
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.28,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  saveBtnDisabled: {
    backgroundColor: colors.primaryBorder,
    ...Platform.select({
      ios: { shadowOpacity: 0 },
      android: { elevation: 0 },
    }),
  },
  saveText: {
    fontSize: typography.fontSize[14],
    fontWeight: typography.fontWeight.bold,
    color: colors.onPrimary,
  },
  insufficientContainer: {
    width: '100%',
    alignItems: 'center',
    gap: spacing[12],
    marginTop: spacing[4],
  },
  shopBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[8],
    backgroundColor: '#4F46E5',
    paddingVertical: spacing[14],
    borderRadius: 14,
    ...Platform.select({
      ios: {
        shadowColor: '#4F46E5',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  shopBtnText: {
    fontSize: typography.fontSize[15],
    fontWeight: typography.fontWeight.bold,
    color: '#FFFFFF',
  },
  cancelLink: {
    paddingVertical: spacing[6],
  },
  cancelLinkText: {
    fontSize: typography.fontSize[14],
    color: colors.textMuted,
    fontWeight: typography.fontWeight.medium,
  },
});
