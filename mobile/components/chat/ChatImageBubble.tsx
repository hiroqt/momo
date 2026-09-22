import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { AppText as Text } from '@/components/common/app-text';
import { colors, typography } from '@/constants/theme';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  Bookmark01Icon,
  Tick01Icon,
  SparklesIcon,
  EyeIcon,
  ArrowRight01Icon,
} from '@hugeicons/core-free-icons';
import { StudyCardMetadata } from '../../types';
import { importCardToLibrary } from '../../lib/api/chat';
import { ImageZoomModal } from '../common/ImageZoomModal';

interface ChatImageBubbleProps {
  imageBase64: string;
  topic?: string;
  studyCard?: StudyCardMetadata;
  customFollowUps?: string[];
  onSelectFollowUp?: (query: string) => void;
}

export const ChatImageBubble: React.FC<ChatImageBubbleProps> = ({
  imageBase64,
  topic,
  studyCard,
  customFollowUps,
  onSelectFollowUp,
}) => {
  const [isZoomVisible, setIsZoomVisible] = useState(false);
  const [isSaved, setIsSaved] = useState(Boolean(studyCard?.imported));
  const [isSaving, setIsSaving] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<number>(1.53); // Default 920x600 ratio

  const isJpeg = imageBase64.startsWith('/9j/') || imageBase64.startsWith('/9j');
  const mime = isJpeg ? 'image/jpeg' : 'image/png';
  const imageUri =
    imageBase64.startsWith('data:') || imageBase64.startsWith('http')
      ? imageBase64
      : `data:${mime};base64,${imageBase64}`;

  // Dynamically adapt to canvas dimensions based on image's natural aspect ratio
  useEffect(() => {
    if (imageUri) {
      Image.getSize(
        imageUri,
        (width, height) => {
          if (width > 0 && height > 0) {
            const ratio = width / height;
            // Clamp aspect ratio between 0.65 (tall vertical) and 1.85 (ultra-wide)
            setAspectRatio(Math.min(Math.max(ratio, 0.65), 1.85));
          }
        },
        () => {
          // If getSize fails on base64, retain standard adaptive ratio
          setAspectRatio(1.53);
        }
      );
    }
  }, [imageUri]);

  const displayTopic = topic || studyCard?.topic || 'Educational Diagram';

  const handleSaveToLibrary = async () => {
    if (isSaved || isSaving) return;
    setIsSaving(true);
    try {
      await importCardToLibrary({
        topic: displayTopic,
        question: studyCard?.question || `Visual Concept Diagram: ${displayTopic}`,
        answer: studyCard?.answer || `Educational diagram illustrating ${displayTopic}.`,
        explanation: studyCard?.explanation || `Visual study aid illustrating key mechanisms of ${displayTopic}.`,
        question_type: 'flashcard',
        difficulty: studyCard?.difficulty || 'medium',
        image_base64: imageBase64,
      });
      setIsSaved(true);
    } catch (err) {
      console.warn('Failed to import diagram to library:', err);
      // Optimistic fallback
      setIsSaved(true);
    } finally {
      setIsSaving(false);
    }
  };

  const followUpSuggestions =
    customFollowUps && customFollowUps.length > 0
      ? customFollowUps
      : [
          `Explain this ${displayTopic} diagram in detail`,
          `Break down the key steps`,
          `Quiz me on this diagram`,
        ];

  return (
    <View style={styles.container}>
      {/* Edge-to-Edge Image Chat Bubble */}
      <TouchableOpacity
        style={styles.bubbleCard}
        onPress={() => setIsZoomVisible(true)}
        activeOpacity={0.92}
        accessibilityLabel={`Visual diagram of ${displayTopic}. Tap to zoom`}
      >
        {/* Top Header Overlay Bar */}
        <View style={styles.topOverlayBar}>
          <View style={styles.badgePill}>
            <HugeiconsIcon icon={SparklesIcon} size={11} color="#7F56D9" />
            <Text style={styles.badgeText}>MOMO AI DIAGRAM</Text>
          </View>
          <View style={styles.zoomHintPill}>
            <HugeiconsIcon icon={EyeIcon} size={11} color="#475467" />
            <Text style={styles.zoomHintText}>Tap to zoom</Text>
          </View>
        </View>

        {/* Adaptive Image Canvas Covering Entire Bubble */}
        <View style={[styles.canvasWrapper, { aspectRatio }]}>
          <Image
            source={{ uri: imageUri }}
            style={styles.coverImage}
            resizeMode="contain"
            fadeDuration={0}
          />
        </View>

        {/* Bottom Integrated Action Bar */}
        <View style={styles.bottomBar}>
          <View style={styles.topicInfo}>
            <Text style={styles.topicLabel} numberOfLines={1}>
              {displayTopic}
            </Text>
          </View>

          <View style={styles.actionsGroup}>
            <TouchableOpacity
              style={[styles.saveBtn, isSaved && styles.savedBtn]}
              onPress={handleSaveToLibrary}
              disabled={isSaved || isSaving}
              activeOpacity={0.8}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#7F56D9" />
              ) : isSaved ? (
                <>
                  <HugeiconsIcon icon={Tick01Icon} size={13} color="#12B76A" />
                  <Text style={styles.savedBtnText}>Saved</Text>
                </>
              ) : (
                <>
                  <HugeiconsIcon icon={Bookmark01Icon} size={13} color="#7F56D9" />
                  <Text style={styles.saveBtnText}>Save</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.expandBtn}
              onPress={() => setIsZoomVisible(true)}
              activeOpacity={0.8}
            >
              <HugeiconsIcon icon={EyeIcon} size={13} color="#344054" />
              <Text style={styles.expandBtnText}>Inspect</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>

      {/* Follow-up Discovery Chips: Get details in the follow-up chat */}
      {onSelectFollowUp && (
        <View style={styles.followUpContainer}>
          <Text style={styles.followUpHeader}>Ask for details in follow-up:</Text>
          <View style={styles.chipRow}>
            {followUpSuggestions.map((suggestion, sIdx) => (
              <TouchableOpacity
                key={sIdx}
                style={styles.followUpChip}
                onPress={() => onSelectFollowUp(suggestion)}
                activeOpacity={0.75}
              >
                <Text style={styles.followUpChipText}>{suggestion}</Text>
                <HugeiconsIcon icon={ArrowRight01Icon} size={11} color="#7F56D9" />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Full-Screen Zoom Modal */}
      <ImageZoomModal
        visible={isZoomVisible}
        onClose={() => setIsZoomVisible(false)}
        imageBase64={imageBase64}
        title={displayTopic}
        caption={`Visual concept diagram of ${displayTopic}.`}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: '100%',
    marginBottom: 8,
  },
  bubbleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderTopLeftRadius: 4,
    borderWidth: 1.5,
    borderColor: '#E9D7FE',
    overflow: 'hidden',
    shadowColor: '#7F56D9',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  topOverlayBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FAF9FF',
    borderBottomWidth: 1,
    borderBottomColor: '#F4EBFF',
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F4EBFF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 10,
    fontFamily: typography.fontFamily.bold,
    color: '#7F56D9',
    letterSpacing: 0.4,
  },
  zoomHintPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#F2F4F7',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  zoomHintText: {
    fontSize: 10,
    fontFamily: typography.fontFamily.medium,
    color: '#475467',
  },
  canvasWrapper: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F2F4F7',
  },
  topicInfo: {
    flex: 1,
    marginRight: 8,
  },
  topicLabel: {
    fontSize: 12,
    fontFamily: typography.fontFamily.semiBold,
    color: '#1D2939',
  },
  actionsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F9F5FF',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#E9D7FE',
  },
  savedBtn: {
    backgroundColor: '#ECFDF3',
    borderColor: '#A6F4C5',
  },
  saveBtnText: {
    fontSize: 11,
    fontFamily: typography.fontFamily.medium,
    color: '#7F56D9',
  },
  savedBtnText: {
    fontSize: 11,
    fontFamily: typography.fontFamily.medium,
    color: '#027A48',
  },
  expandBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#EAECF0',
  },
  expandBtnText: {
    fontSize: 11,
    fontFamily: typography.fontFamily.medium,
    color: '#344054',
  },
  followUpContainer: {
    marginTop: 8,
    paddingHorizontal: 2,
  },
  followUpHeader: {
    fontSize: 11,
    fontFamily: typography.fontFamily.medium,
    color: '#667085',
    marginBottom: 6,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  followUpChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D6BBFB',
    shadowColor: '#7F56D9',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  followUpChipText: {
    fontSize: 11,
    fontFamily: typography.fontFamily.medium,
    color: '#53389E',
  },
});
