import React, { useRef, useEffect } from 'react';
import { colors, spacing, typography } from '@/constants/theme';
import {
  Modal,
  View,
  StyleSheet,
  Animated,
  Platform,
  TouchableWithoutFeedback,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { AppText as Text } from '@/components/common/app-text';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  Folder01Icon,
  FolderAddIcon,
  Tick02Icon,
  Cancel01Icon,
} from '@hugeicons/core-free-icons';
import { Folder, StudySet } from '@/types';

export interface MoveToFolderModalProps {
  visible: boolean;
  studySet: StudySet | null;
  folders: Folder[];
  isLoading?: boolean;
  onSelectFolder: (folderId: string | null) => void | Promise<void>;
  onCancel: () => void;
  onCreateNewFolder?: () => void;
}

export const MoveToFolderModal: React.FC<MoveToFolderModalProps> = ({
  visible,
  studySet,
  folders,
  isLoading = false,
  onSelectFolder,
  onCancel,
  onCreateNewFolder,
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

  if (!visible || !studySet) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={isLoading ? undefined : onCancel}
      statusBarTranslucent
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
              {/* Header Icon */}
              <View style={styles.headerIcon}>
                <HugeiconsIcon icon={Folder01Icon} size={26} color={colors.primary} strokeWidth={2} />
              </View>

              {/* Title & Target Info */}
              <Text style={styles.dialogTitle}>Move to Folder</Text>
              <Text style={styles.dialogSubtitle} numberOfLines={1}>
                {studySet.title}
              </Text>

              {/* Folders List */}
              <ScrollView
                style={styles.folderList}
                contentContainerStyle={styles.folderListContent}
                showsVerticalScrollIndicator={false}
              >
                {/* Option: Unorganized / Remove from folder */}
                <TouchableOpacity
                  style={[
                    styles.folderOption,
                    !studySet.folder_id && styles.folderOptionActive,
                  ]}
                  onPress={() => onSelectFolder(null)}
                  disabled={isLoading}
                  activeOpacity={0.7}
                >
                  <View style={styles.folderIconBox}>
                    <HugeiconsIcon
                      icon={Cancel01Icon}
                      size={18}
                      color={!studySet.folder_id ? colors.primary : colors.textMuted}
                      strokeWidth={2}
                    />
                  </View>
                  <View style={styles.folderInfo}>
                    <Text
                      style={[
                        styles.folderName,
                        !studySet.folder_id && styles.folderNameActive,
                      ]}
                    >
                      Unorganized (No Folder)
                    </Text>
                    <Text style={styles.folderSub}>Remove from any folder</Text>
                  </View>
                  {!studySet.folder_id && (
                    <HugeiconsIcon icon={Tick02Icon} size={18} color={colors.primary} strokeWidth={2.5} />
                  )}
                </TouchableOpacity>

                {/* User Folders */}
                {folders.map((folder) => {
                  const isSelected = studySet.folder_id === folder.id;
                  return (
                    <TouchableOpacity
                      key={folder.id}
                      style={[styles.folderOption, isSelected && styles.folderOptionActive]}
                      onPress={() => onSelectFolder(folder.id)}
                      disabled={isLoading}
                      activeOpacity={0.7}
                    >
                      <View
                        style={[
                          styles.folderIconBox,
                          isSelected && styles.folderIconBoxActive,
                        ]}
                      >
                        <HugeiconsIcon
                          icon={Folder01Icon}
                          size={18}
                          color={isSelected ? colors.primary : colors.textSecondary}
                          strokeWidth={2}
                        />
                      </View>
                      <View style={styles.folderInfo}>
                        <Text style={[styles.folderName, isSelected && styles.folderNameActive]} numberOfLines={1}>
                          {folder.name}
                        </Text>
                        <Text style={styles.folderSub}>
                          {folder.reviewer_count} {folder.reviewer_count === 1 ? 'reviewer' : 'reviewers'}
                        </Text>
                      </View>
                      {isSelected && (
                        <HugeiconsIcon icon={Tick02Icon} size={18} color={colors.primary} strokeWidth={2.5} />
                      )}
                    </TouchableOpacity>
                  );
                })}

                {/* Shortcut to create new folder */}
                {onCreateNewFolder && (
                  <TouchableOpacity
                    style={styles.newFolderBtn}
                    onPress={() => {
                      onCancel();
                      onCreateNewFolder();
                    }}
                    activeOpacity={0.7}
                  >
                    <HugeiconsIcon icon={FolderAddIcon} size={18} color={colors.primary} strokeWidth={2} />
                    <Text style={styles.newFolderText}>Create New Folder</Text>
                  </TouchableOpacity>
                )}
              </ScrollView>

              {/* Close Action */}
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={onCancel}
                disabled={isLoading}
                activeOpacity={0.7}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color={colors.textSecondary} />
                ) : (
                  <Text style={styles.closeBtnText}>Done</Text>
                )}
              </TouchableOpacity>
            </Animated.View>
          </TouchableWithoutFeedback>
        </Animated.View>
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
    paddingHorizontal: spacing[24],
  },
  dialogCard: {
    width: '100%',
    maxWidth: 380,
    maxHeight: '80%',
    backgroundColor: colors.surface,
    borderRadius: 24,
    paddingHorizontal: spacing[20],
    paddingTop: spacing[22],
    paddingBottom: spacing[18],
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
  headerIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[12],
  },
  dialogTitle: {
    fontSize: typography.fontSize[18],
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing[4],
  },
  dialogSubtitle: {
    fontSize: typography.fontSize[13],
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing[16],
    paddingHorizontal: spacing[10],
  },
  folderList: {
    width: '100%',
  },
  folderListContent: {
    gap: spacing[8],
    paddingBottom: spacing[12],
  },
  folderOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: spacing[12],
  },
  folderOptionActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  folderIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing[12],
  },
  folderIconBoxActive: {
    backgroundColor: colors.surface,
  },
  folderInfo: {
    flex: 1,
  },
  folderName: {
    fontSize: typography.fontSize[14],
    fontWeight: typography.fontWeight.semiBold,
    color: colors.text,
  },
  folderNameActive: {
    color: colors.primary,
    fontWeight: typography.fontWeight.bold,
  },
  folderSub: {
    fontSize: typography.fontSize[12],
    color: colors.textMuted,
    marginTop: spacing[2],
  },
  newFolderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[8],
    paddingVertical: spacing[12],
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.primaryBorder,
    borderRadius: 14,
    marginTop: spacing[4],
    backgroundColor: colors.primarySoft,
  },
  newFolderText: {
    fontSize: typography.fontSize[13],
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
  },
  closeBtn: {
    width: '100%',
    paddingVertical: spacing[12],
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
    marginTop: spacing[10],
  },
  closeBtnText: {
    fontSize: typography.fontSize[14],
    fontWeight: typography.fontWeight.semiBold,
    color: colors.textSecondary,
  },
});
