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
  Image,
  useWindowDimensions,
  Platform,
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
import { InstagramIcon } from './InstagramIcon';
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
  const { height: windowHeight } = useWindowDimensions();
  const { firstName } = useOnboarding();
  const cardRef = useRef<View>(null);
  const safeHeight = windowHeight && windowHeight > 0 ? windowHeight : 800;

  // Responsive scale ensuring the card & challenge section fit comfortably without collapsing
  const previewScale = useMemo(() => {
    if (safeHeight < 750) return 0.66;
    if (safeHeight < 850) return 0.70;
    return 0.74;
  }, [safeHeight]);

  const previewStageHeight = useMemo(() => {
    return Math.round(640 * previewScale) + 6;
  }, [previewScale]);

  const inputDataWithUser = useMemo(() => ({
    ...inputData,
    userName: inputData.userName || firstName || undefined,
  }), [inputData, firstName]);

  const reportData = useMemo(() => generateAcademicWeaponReport(inputDataWithUser), [inputDataWithUser]);
  const [selectedChallenge, setSelectedChallenge] = useState(reportData.challengeText);
  const [isSharing, setIsSharing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);

  useEffect(() => {
    if (visible) {
      setSelectedChallenge(reportData.challengeText);
      setIsSharing(false);
      setIsSaving(false);
      setShowSaveSuccess(false);
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
        setShowSaveSuccess(true);
      } else {
        Alert.alert('Save Failed', res.error || 'Could not save the image.');
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
            {
              paddingBottom: Platform.OS === 'android'
                ? Math.max(10, insets.bottom)
                : Math.max(16, insets.bottom + 4),
            },
          ]}
        >
          {/* Header Row */}
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderLeft}>
              <View style={styles.sparkleIconBox}>
                <InstagramIcon size={18} color="#E1306C" strokeWidth={2.2} />
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
            style={styles.scrollView}
            showsVerticalScrollIndicator={true}
            contentContainerStyle={styles.scrollContent}
            bounces={false}
          >
            {/* Live 9:16 Card Preview with responsive stage */}
            <View style={[styles.previewStage, { height: previewStageHeight }]}>
              <AcademicWeaponStoryCard ref={cardRef} data={activeData} scale={previewScale} />
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
                    <InstagramIcon size={18} color="#FFFFFF" strokeWidth={2.2} />
                    <Text style={styles.shareBtnText}>Share Story</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Enhanced Momo Save Celebration Overlay */}
        {showSaveSuccess && (
          <View style={styles.successOverlay}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowSaveSuccess(false)} />
            <View style={styles.successCard}>
              {/* Ambient Radial Glow */}
              <View style={styles.successGlow} />

              {/* Mascot Image Spotlight */}
              <View style={styles.successMomoWrapper}>
                <View style={styles.successMomoCircle} />
                <Image
                  source={require('@/assets/animations/momo_save.png')}
                  style={styles.successMomoImage}
                  resizeMode="contain"
                />
              </View>

              {/* Success Badge */}
              <View style={styles.successBadge}>
                <HugeiconsIcon icon={SparklesIcon} size={14} color="#10B981" strokeWidth={2.5} />
                <Text style={styles.successBadgeText}>SAVED TO PHOTOS</Text>
              </View>

              {/* Typography */}
              <Text style={styles.successTitle}>Academic Weapon Saved!</Text>
              <Text style={styles.successDescription}>
                Your custom 9:16 story card is saved to your camera roll. Ready to flex on Instagram?
              </Text>

              {/* Action Buttons */}
              <View style={styles.successActionsCol}>
                <TouchableOpacity
                  style={styles.successShareBtn}
                  onPress={() => {
                    setShowSaveSuccess(false);
                    handleShare();
                  }}
                  activeOpacity={0.85}
                >
                  <InstagramIcon size={18} color="#FFFFFF" strokeWidth={2.2} />
                  <Text style={styles.successShareBtnText}>Share to Instagram Story</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.successDoneBtn}
                  onPress={() => setShowSaveSuccess(false)}
                  activeOpacity={0.75}
                >
                  <Text style={styles.successDoneBtnText}>Done</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
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
    height: '92%',
    paddingTop: 14,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 10,
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
    backgroundColor: 'rgba(225, 48, 108, 0.15)',
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
  scrollView: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 20,
    alignItems: 'center',
  },
  previewStage: {
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    width: '100%',
    minHeight: 440,
  },
  promptsSection: {
    width: '100%',
    marginTop: 2,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  promptList: {
    gap: 6,
  },
  promptPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  promptPillSelected: {
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    borderColor: '#8B5CF6',
  },
  promptPillText: {
    fontSize: 12,
    color: '#CBD5E1',
    fontWeight: '600',
    lineHeight: 16,
  },
  promptPillTextSelected: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  footerBar: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: '#0F172A',
  },
  footerActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  saveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 18,
    paddingVertical: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#E2E8F0',
  },
  shareBtn: {
    flex: 1.35,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E1306C',
    borderRadius: 18,
    paddingVertical: 12,
    gap: 6,
    shadowColor: '#E1306C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  shareBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  successOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(5, 7, 15, 0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
    padding: 24,
  },
  successCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#0F172A',
    borderRadius: 26,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 12,
  },
  successGlow: {
    position: 'absolute',
    top: -50,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(16, 185, 129, 0.18)',
  },
  successMomoWrapper: {
    width: 140,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    position: 'relative',
  },
  successMomoCircle: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(16, 185, 129, 0.28)',
  },
  successMomoImage: {
    width: 130,
    height: 130,
  },
  successBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    marginBottom: 12,
  },
  successBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#10B981',
    letterSpacing: 0.8,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  successDescription: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  successActionsCol: {
    width: '100%',
    gap: 10,
  },
  successShareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E1306C',
    borderRadius: 18,
    paddingVertical: 14,
    gap: 8,
    shadowColor: '#E1306C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  successShareBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  successDoneBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 18,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  successDoneBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#CBD5E1',
  },
});
