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
import { useReducedMotion } from 'react-native-reanimated';
import { StudyIcon } from '@/components/common/StudyIcon';
import { MomoAnimation } from '@/components/mascot/MomoAnimation';
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
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const pending = useRef(false);
  const [savedDirectly, setSavedDirectly] = useState(true);
  const { firstName } = useOnboarding();
  const cardRef = useRef<View>(null);
  const safeHeight = windowHeight && windowHeight > 0 ? windowHeight : 800;

  // Responsive scale ensuring the card & challenge section fit comfortably without collapsing
  const previewScale = useMemo(() => {
    return Math.min(safeHeight < 750 ? 0.60 : 0.70, (windowWidth - 64) / 360);
  }, [safeHeight, windowWidth]);

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
    if (pending.current) return;
    pending.current = true;
    setIsSharing(true);
    try {
      const res = await shareToInstagramStory(cardRef);
      if (res.success && res.autoOpened) {
        onClose();
      } else if (res.error && !res.cancelled) {
        Alert.alert('Share Failed', res.error || 'Could not export story to Instagram.');
      }
    } catch (e: any) {
      Alert.alert('Share Failed', 'Could not prepare your story image. Please try again.');
    } finally {
      pending.current = false;
      setIsSharing(false);
    }
  };

  const handleSaveImage = async () => {
    if (pending.current) return;
    pending.current = true;
    setIsSaving(true);
    try {
      const res = await saveCardToGallery(cardRef);
      if (res.success) {
        setSavedDirectly(!!res.savedDirectly);
        setShowSaveSuccess(true);
      } else {
        Alert.alert('Save Failed', res.error || 'Could not save the image.');
      }
    } catch (e: any) {
      Alert.alert('Save Failed', 'Could not save your image. Please try again.');
    } finally {
      pending.current = false;
      setIsSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType={reducedMotion ? "none" : "fade"}
      onRequestClose={() => { if (!pending.current) onClose(); }}
    >
      <View style={styles.modalOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => { if (!pending.current) onClose(); }} />
        <View
          testID="share-story-modal"
          accessibilityViewIsModal
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
                <StudyIcon name="camera" size={36} />
              </View>
              <Text style={styles.modalTitle}>Share your study win</Text>
            </View>
            <TouchableOpacity
              testID="share-story-close"
              accessibilityRole="button" accessibilityLabel="Close story preview"
              disabled={isSharing || isSaving}
              style={styles.closeBtn}
              onPress={() => { if (!pending.current) onClose(); }}
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
              <Text style={styles.sectionLabel}>CHOOSE A CAPTION</Text>
              <View style={styles.promptList}>
                {reportData.alternativeChallenges.map((prompt, idx) => {
                  const isSelected = prompt === selectedChallenge;
                  return (
                    <TouchableOpacity
                      key={idx}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected }}
                      accessibilityLabel={prompt}
                      disabled={isSharing || isSaving}
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

          <Text style={styles.handoffNote}>Choose Instagram from the share options. You review and post your story yourself.</Text>
          {/* Action Footer */}
          <View style={styles.footerBar}>
            <View style={styles.footerActionRow}>
              <TouchableOpacity
                testID="share-story-save"
                accessibilityRole="button" accessibilityLabel="Save study story image"
                accessibilityState={{ disabled: isSaving || isSharing, busy: isSaving }}
                style={styles.saveBtn}
                onPress={handleSaveImage}
                disabled={isSaving || isSharing}
                activeOpacity={0.8}
              >
                {isSaving ? (
                  <ActivityIndicator color="#6D5C81" size="small" />
                ) : (
                  <>
                    <HugeiconsIcon icon={Download01Icon} size={18} color="#6D5C81" strokeWidth={2.2} />
                    <Text style={styles.saveBtnText}>Save Image</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                testID="share-story-instagram"
                accessibilityRole="button" accessibilityLabel="Open Instagram or share sheet with study story"
                accessibilityState={{ disabled: isSaving || isSharing, busy: isSharing }}
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
            <ScrollView style={styles.successScroll} contentContainerStyle={styles.successCard} bounces={false}>
              {/* Ambient Radial Glow */}


              {/* Mascot Image Spotlight */}
              <View style={styles.successMomoWrapper}>

                <MomoAnimation name="momo-cheer" size={130} active={showSaveSuccess} />
              </View>

              {/* Success Badge */}
              <View style={styles.successBadge}>
                <HugeiconsIcon icon={SparklesIcon} size={14} color="#10B981" strokeWidth={2.5} />
                <Text style={styles.successBadgeText}>{savedDirectly ? "SAVED TO PHOTOS" : "EXPORT OPTIONS OPENED"}</Text>
              </View>

              {/* Typography */}
              <Text style={styles.successTitle}>{savedDirectly ? "Your study win is saved" : "Your story is ready"}</Text>
              <Text style={styles.successDescription}>
                {savedDirectly ? "Your story image is in Photos, ready whenever you want to share." : "Use the export options to save or share your image. Saving depends on the option you choose."}
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
            </ScrollView>
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
    backgroundColor: '#FFF8F0',
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
    flex: 1,
  },
  sparkleIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#352452',
    flexShrink: 1,
  },
  closeBtn: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
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
    minHeight: 0,
  },
  promptsSection: {
    width: '100%',
    marginTop: 2,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#6D5C81',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  promptList: {
    gap: 6,
  },
  promptPill: {
    backgroundColor: '#F5EEFF',
    borderRadius: 12,
    minHeight: 44,
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E4D8F3',
  },
  promptPillSelected: {
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    borderColor: '#8B79ED',
  },
  promptPillText: {
    fontSize: 12,
    color: '#6D5C81',
    fontWeight: '600',
    lineHeight: 16,
  },
  promptPillTextSelected: {
    color: '#6D28D9',
    fontWeight: '800',
  },
  handoffNote: { color: "#6D5C81", fontSize: 12, lineHeight: 17, paddingHorizontal: 20, paddingVertical: 8 },
  footerBar: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 4,
    borderTopWidth: 1,
    borderTopColor: '#E4D8F3',
    backgroundColor: '#FFF8F0',
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
    backgroundColor: '#F1E9FF',
    borderRadius: 18,
    paddingVertical: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6D5C81',
  },
  shareBtn: {
    flex: 1.35,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6D5CE7',
    borderRadius: 18,
    paddingVertical: 12,
    gap: 6,
    shadowColor: '#6D5CE7',
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
  successScroll: { width: "100%", maxWidth: 340, maxHeight: "90%", flexGrow: 0, borderRadius: 26 },
  successCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFF8F0',
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
    color: '#352452',
    textAlign: 'center',
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  successDescription: {
    fontSize: 13,
    color: '#6D5C81',
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
    backgroundColor: '#6D5CE7',
    borderRadius: 18,
    paddingVertical: 14,
    gap: 8,
    shadowColor: '#6D5CE7',
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
    borderColor: '#E4D8F3',
  },
  successDoneBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6D5C81',
  },
});
