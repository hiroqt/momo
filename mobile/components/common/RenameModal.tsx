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
} from 'react-native';
import { AppText as Text, AppTextInput as TextInput } from '@/components/common/app-text';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { Edit02Icon, Cancel01Icon, AlertCircleIcon } from '@hugeicons/core-free-icons';

export interface RenameModalProps {
  visible: boolean;
  initialTitle: string;
  title?: string;
  subtitle?: string;
  isLoading?: boolean;
  onSave: (newTitle: string) => void | Promise<void>;
  onCancel: () => void;
}

export const RenameModal: React.FC<RenameModalProps> = ({
  visible,
  initialTitle,
  title = 'Rename Quiz',
  subtitle = 'Enter a new title for this reviewer and quiz.',
  isLoading = false,
  onSave,
  onCancel,
}) => {
  const [text, setText] = useState(initialTitle);
  const [error, setError] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState(false);

  const scaleAnim = useRef(new Animated.Value(0.92)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const inputRef = useRef<NativeTextInput>(null);

  useEffect(() => {
    if (visible) {
      setText(initialTitle);
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
  }, [visible, initialTitle]);

  if (!visible) return null;

  const handleSave = () => {
    const trimmed = text.trim();
    if (!trimmed) {
      setError('Please enter a valid title.');
      return;
    }
    if (trimmed.length > 100) {
      setError('Title cannot exceed 100 characters.');
      return;
    }
    setError(null);
    onSave(trimmed);
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
                {/* Icon Header */}
                <View style={styles.iconCircle}>
                  <HugeiconsIcon icon={Edit02Icon} size={26} color={colors.primary} strokeWidth={2} />
                </View>

                {/* Title & Subtitle */}
                <Text style={styles.dialogTitle}>{title}</Text>
                <Text style={styles.dialogSubtitle}>{subtitle}</Text>

                {/* Input Field */}
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
                    value={text}
                    onChangeText={(val) => {
                      setText(val);
                      if (error) setError(null);
                    }}
                    placeholder="e.g. Cardiovascular Reviewer"
                    placeholderTextColor={colors.textDisabled}
                    maxLength={100}
                    editable={!isLoading}
                    selectTextOnFocus
                    returnKeyType="done"
                    onSubmitEditing={handleSave}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                  />
                  {text.length > 0 && !isLoading && (
                    <TouchableOpacity
                      onPress={() => setText('')}
                      style={styles.clearBtn}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      accessibilityLabel="Clear text"
                    >
                      <HugeiconsIcon icon={Cancel01Icon} size={16} color={colors.textDisabled} strokeWidth={2} />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Char count & Error message */}
                <View style={styles.helperRow}>
                  {error ? (
                    <View style={styles.errorRow}>
                      <HugeiconsIcon icon={AlertCircleIcon} size={14} color={colors.dangerAccent} strokeWidth={2} />
                      <Text style={styles.errorText}>{error}</Text>
                    </View>
                  ) : (
                    <View />
                  )}
                  <Text style={styles.charCount}>{text.length}/100</Text>
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
                    style={[styles.saveBtn, (!text.trim() || isLoading) && styles.saveBtnDisabled]}
                    onPress={handleSave}
                    disabled={!text.trim() || isLoading}
                    activeOpacity={0.8}
                  >
                    {isLoading ? (
                      <ActivityIndicator size="small" color={colors.onPrimary} />
                    ) : (
                      <Text style={styles.saveText}>Save Title</Text>
                    )}
                  </TouchableOpacity>
                </View>
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
    paddingTop: spacing[26],
    paddingBottom: spacing[22],
    alignItems: 'center',
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
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[16],
  },
  dialogTitle: {
    fontSize: typography.fontSize[20],
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing[6],
  },
  dialogSubtitle: {
    fontSize: typography.fontSize[14],
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: typography.lineHeight[20],
    marginBottom: spacing[20],
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
    marginBottom: spacing[18],
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
    flex: 1,
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
    fontSize: typography.fontSize[15],
    fontWeight: typography.fontWeight.semiBold,
    color: colors.onPrimary,
  },
});
