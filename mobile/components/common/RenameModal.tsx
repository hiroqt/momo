import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  StyleSheet,
  Animated,
  ActivityIndicator,
  Platform,
  TouchableWithoutFeedback,
  TouchableOpacity,
  KeyboardAvoidingView,
} from 'react-native';
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
  const inputRef = useRef<TextInput>(null);

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
                  <HugeiconsIcon icon={Edit02Icon} size={26} color="#4F46E5" strokeWidth={2} />
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
                    placeholderTextColor="#94A3B8"
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
                      <HugeiconsIcon icon={Cancel01Icon} size={16} color="#94A3B8" strokeWidth={2} />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Char count & Error message */}
                <View style={styles.helperRow}>
                  {error ? (
                    <View style={styles.errorRow}>
                      <HugeiconsIcon icon={AlertCircleIcon} size={14} color="#EF4444" strokeWidth={2} />
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
                      <ActivityIndicator size="small" color="#FFFFFF" />
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
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  dialogCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 26,
    paddingBottom: 22,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
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
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  dialogTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 6,
  },
  dialogSubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 14,
    minHeight: 48,
  },
  inputWrapperFocused: {
    borderColor: '#4F46E5',
    backgroundColor: '#FFFFFF',
  },
  inputWrapperError: {
    borderColor: '#EF4444',
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    color: '#0F172A',
    paddingVertical: 10,
  },
  clearBtn: {
    padding: 4,
    marginLeft: 6,
  },
  helperRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginTop: 6,
    marginBottom: 18,
    minHeight: 18,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    fontWeight: '500',
  },
  charCount: {
    fontSize: 12,
    color: '#94A3B8',
    marginLeft: 'auto',
  },
  actionRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#475569',
  },
  saveBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4F46E5',
    ...Platform.select({
      ios: {
        shadowColor: '#4F46E5',
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
    backgroundColor: '#A5B4FC',
    ...Platform.select({
      ios: { shadowOpacity: 0 },
      android: { elevation: 0 },
    }),
  },
  saveText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
