import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Pressable,
} from 'react-native';
import { AppText as Text } from '@/components/common/app-text';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { Cancel01Icon, SparklesIcon, Share01Icon, Download01Icon } from '@hugeicons/core-free-icons';
import {
  AcademicWeaponData,
  AcademicWeaponInput,
  generateAcademicWeaponReport,
} from '@/utils/academicWeapon';
import { AcademicWeaponStoryCard } from './AcademicWeaponStoryCard';
import { shareToInstagramStory, saveCardToGallery } from '@/utils/shareStory';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOnboarding } from '@/context/OnboardingContext';

export interface AcademicWeaponShareModalProps {
  visible: boolean;
  onClose: () => void;
  inputData: AcademicWeaponInput;
}

export const AcademicWeaponShareModal: React.FC<AcademicWeaponShareModalProps> = ({
  visible,
  onClose,
  inputData,
}) => {
  const insets = useSafeAreaInsets();
  const { firstName } = useOnboarding();
  const cardRef = useRef<View>(null);

  const inputDataWithUser = useMemo(() => ({
    ...inputData,
    userName: inputData.userName || firstName || undefined,
  }), [inputData, firstName]);

  const reportData = useMemo(() => generateAcademicWeaponReport(inputDataWithUser), [inputDataWithUser]);
  const [selectedChallenge, setSelectedChallenge] = useState(reportData.challengeText);
  const [isSharing, setIsSharing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setSelectedChallenge(reportData.challengeText);
      setIsSharing(false);
      setIsSaving(false);
    }
  }, [visible, reportData.challengeText]);

  const activeData: AcademicWeaponData = useMemo(
    () => ({
      ...reportData,
      challengeText: selectedChallenge,
    }),
    [reportData, selectedChallenge]
  );

  const handleShare = async () => {
    if (isSharing || isSaving) return;
    setIsSharing(true);
    try {
      const res = await shareToInstagramStory(cardRef);
      if (res.success) {
        onClose();
      } else if (res.error && res.error !== 'Instagram not installed') {
        Alert.alert('Share Failed', res.error || 'Could not export story to Instagram.');
      }
    } catch (e: any) {
      Alert.alert('Share Failed', e?.message || 'Could not export story.');
    } finally {
      setIsSharing(false);
    }
  };

  const handleSaveImage = async () => {
    if (isSaving || isSharing) return;
    setIsSaving(true);
    try {
      const res = await saveCardToGallery(cardRef);
      if (res.success) {
        Alert.alert('Saved to Photos! 📸', 'Your Academic Weapon story card has been saved to your Photos.');
      } else {
        Alert.alert('Save Failed', res.error || 'Could not save the image to your photos.');
      }
    } catch (e: any) {
      Alert.alert('Save Failed', e?.message || 'Could not save the image.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View
          style={[
            styles.modalContainer,
            { paddingBottom: Math.max(20, insets.bottom + 8) },
          ]}
        >
          {/* Header Row */}
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderLeft}>
              <View style={styles.sparkleIconBox}>
                <HugeiconsIcon icon={SparklesIcon} size={18} color="#8B5CF6" strokeWidth={2.4} />
              </View>
              <Text style={styles.modalTitle}>Share to Instagram Story</Text>
            </View>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <HugeiconsIcon icon={Cancel01Icon} size={18} color="#94A3B8" strokeWidth={2.2} />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Live 9:16 Card Preview */}
            <View style={styles.previewStage}>
              <AcademicWeaponStoryCard ref={cardRef} data={activeData} scale={0.82} />
            </View>

            {/* Prompt Selector Pills */}
            <View style={styles.promptsSection}>
              <Text style={styles.sectionLabel}>CHOOSE YOUR CHALLENGE LINE</Text>
              <View style={styles.promptList}>
                {reportData.alternativeChallenges.map((prompt, idx) => {
                  const isSelected = prompt === selectedChallenge;
                  return (
                    <TouchableOpacity
                      key={idx}
                      style={[
                        styles.promptPill,
                        isSelected && styles.promptPillSelected,
                      ]}
                      onPress={() => setSelectedChallenge(prompt)}
                      activeOpacity={0.75}
                    >
                      <Text
                        style={[
                          styles.promptPillText,
                          isSelected && styles.promptPillTextSelected,
                        ]}
                      >
                        "{prompt}"
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </ScrollView>

          {/* Action Footer */}
          <View style={styles.footerBar}>
            <View style={styles.footerActionRow}>
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleSaveImage}
                disabled={isSaving || isSharing}
                activeOpacity={0.8}
              >
                {isSaving ? (
                  <ActivityIndicator color="#CBD5E1" size="small" />
                ) : (
                  <>
                    <HugeiconsIcon icon={Download01Icon} size={18} color="#CBD5E1" strokeWidth={2.2} />
                    <Text style={styles.saveBtnText}>Save Image</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.shareBtn}
                onPress={handleShare}
                disabled={isSharing || isSaving}
                activeOpacity={0.85}
              >
                {isSharing ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <HugeiconsIcon icon={Share01Icon} size={18} color="#FFFFFF" strokeWidth={2.4} />
                    <Text style={styles.shareBtnText}>Share Story</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '92%',
    paddingTop: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sparkleIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  closeBtn: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    alignItems: 'center',
  },
  previewStage: {
    height: 540,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  promptsSection: {
    width: '100%',
    marginTop: 8,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  promptList: {
    gap: 8,
  },
  promptPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  promptPillSelected: {
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    borderColor: '#8B5CF6',
  },
  promptPillText: {
    fontSize: 13,
    color: '#CBD5E1',
    fontWeight: '600',
  },
  promptPillTextSelected: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  footerBar: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  footerActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  saveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 20,
    paddingVertical: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#E2E8F0',
  },
  shareBtn: {
    flex: 1.35,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#8B5CF6',
    borderRadius: 20,
    paddingVertical: 14,
    gap: 8,
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  shareBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
