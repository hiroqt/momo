import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native';
import { AppText as Text } from '@/components/common/app-text';
import { colors, spacing, typography } from '@/constants/theme';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  Bookmark01Icon,
  Tick01Icon,
  ArrowRight01Icon,
  SparklesIcon,
  EyeIcon,
} from '@hugeicons/core-free-icons';
import { useRouter } from 'expo-router';
import { StudyCardMetadata } from '../../types';
import { importCardToLibrary } from '../../lib/api/chat';
import { generateStudyImage } from '../../lib/api/images';
import { ImageZoomModal } from '../common/ImageZoomModal';

interface ChatStudyCardProps {
  card: StudyCardMetadata;
}

export const ChatStudyCard: React.FC<ChatStudyCardProps> = ({ card }) => {
  const router = useRouter();
  const [isImported, setIsImported] = useState(Boolean(card.imported));
  const [importedSetId, setImportedSetId] = useState<string | null>(card.study_set_id || null);
  const [loading, setLoading] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);

  // Visual diagram state
  const [imageBase64, setImageBase64] = useState<string | null>(card.image_base64 || null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isZoomVisible, setIsZoomVisible] = useState(false);

  const handleGenerateDiagram = async () => {
    if (isGeneratingImage || imageBase64) return;
    setIsGeneratingImage(true);
    try {
      const prompt = card.diagram_prompt || (card.topic ? `${card.topic}: ${card.question}` : card.question);
      const res = await generateStudyImage(prompt, card.topic, card.explanation);
      if (res && res.image_base64) {
        setImageBase64(res.image_base64);
      }
    } catch (err: any) {
      console.warn('Failed to generate diagram:', err);
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleImport = async () => {
    if (isImported || loading) return;

    setLoading(true);
    try {
      const res = await importCardToLibrary({
        topic: card.topic || 'General',
        question: card.question,
        answer: card.answer,
        explanation: card.explanation,
        question_type: card.question_type,
        options: card.options,
        difficulty: card.difficulty,
        image_base64: imageBase64 || undefined,
      });

      setIsImported(true);
      if (res.study_set_id) {
        setImportedSetId(res.study_set_id);
      }
    } catch (e) {
      console.warn('Failed to import card to library:', e);
      // Optimistic fallback: mark as imported locally
      setIsImported(true);
    } finally {
      setLoading(false);
    }
  };

  const handleStudyNow = () => {
    if (importedSetId) {
      router.push(`/study/${importedSetId}` as any);
    } else {
      router.push('/(tabs)/library' as any);
    }
  };

  const formatType = (t: string) => {
    switch (t) {
      case 'flashcard': return 'Flashcard';
      case 'multiple_choice': return 'Multiple Choice';
      case 'true_false': return 'True / False';
      case 'identification': return 'Identification';
      default: return t;
    }
  };

  return (
    <View style={styles.cardWrapper}>
      {/* Header Tag */}
      <View style={styles.headerRow}>
        <View style={styles.tagGroup}>
          <View style={styles.studyCardTag}>
            <HugeiconsIcon icon={SparklesIcon} size={12} color="#7F56D9" />
            <Text style={styles.studyCardTagText}>STUDY CARD</Text>
          </View>
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>{formatType(card.question_type)}</Text>
          </View>
        </View>
        {card.difficulty && (
          <View style={styles.diffBadge}>
            <Text style={styles.diffBadgeText}>{card.difficulty.toUpperCase()}</Text>
          </View>
        )}
      </View>

      {/* Front: Question */}
      <View style={styles.contentBlock}>
        <Text style={styles.labelTitle}>PROMPT / QUESTION</Text>
        <Text style={styles.questionText}>{card.question}</Text>
      </View>

      {/* Back: Answer & Explanation */}
      <TouchableOpacity
        style={styles.answerContainer}
        onPress={() => setIsFlipped(!isFlipped)}
        activeOpacity={0.85}
      >
        <View style={styles.answerHeader}>
          <Text style={styles.labelTitle}>ANSWER</Text>
          <Text style={styles.tapToRevealText}>
            {isFlipped ? 'Tap to collapse' : 'Tap to reveal / expand'}
          </Text>
        </View>

        <Text style={styles.answerText}>{card.answer}</Text>

        {isFlipped && card.explanation && (
          <View style={styles.explanationBox}>
            <Text style={styles.explanationLabel}>High-Yield Insight:</Text>
            <Text style={styles.explanationText}>{card.explanation}</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Multiple Choice Options if applicable */}
      {card.options && card.options.length > 0 && (
        <View style={styles.optionsList}>
          {card.options.map((opt, oIdx) => {
            const isCorrect = opt.trim().toLowerCase() === card.answer.trim().toLowerCase();
            return (
              <View
                key={oIdx}
                style={[
                  styles.optionPill,
                  isFlipped && isCorrect && styles.optionPillCorrect,
                ]}
              >
                <Text style={styles.optionIndex}>{String.fromCharCode(65 + oIdx)}.</Text>
                <Text
                  style={[
                    styles.optionLabel,
                    isFlipped && isCorrect && styles.optionLabelCorrect,
                  ]}
                >
                  {opt}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      {/* Educational Diagram Section */}
      {imageBase64 ? (
        <TouchableOpacity
          style={styles.diagramContainer}
          onPress={() => setIsZoomVisible(true)}
          activeOpacity={0.88}
        >
          <View style={styles.diagramHeader}>
            <View style={styles.diagramBadge}>
              <HugeiconsIcon icon={SparklesIcon} size={11} color="#7F56D9" />
              <Text style={styles.diagramBadgeText}>EDUCATIONAL DIAGRAM</Text>
            </View>
            <View style={styles.expandTag}>
              <HugeiconsIcon icon={EyeIcon} size={11} color="#7F56D9" />
              <Text style={styles.expandTagText}>Tap to zoom</Text>
            </View>
          </View>
          <View style={styles.diagramImageCard}>
            <Image
              source={{
                uri:
                  imageBase64.startsWith('data:') || imageBase64.startsWith('http')
                    ? imageBase64
                    : `data:${imageBase64.startsWith('/9j/') || imageBase64.startsWith('/9j') ? 'image/jpeg' : 'image/png'};base64,${imageBase64}`,
              }}
              style={styles.diagramImage}
              resizeMode="contain"
            />
          </View>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[styles.generateDiagramButton, isGeneratingImage && styles.generateDiagramButtonLoading]}
          onPress={handleGenerateDiagram}
          disabled={isGeneratingImage}
          activeOpacity={0.8}
        >
          {isGeneratingImage ? (
            <>
              <ActivityIndicator size="small" color="#6941C6" />
              <Text style={styles.generateDiagramText}>Creating 2D diagram...</Text>
            </>
          ) : (
            <>
              <HugeiconsIcon icon={SparklesIcon} size={13} color="#6941C6" />
              <Text style={styles.generateDiagramText}>Generate Visual Diagram</Text>
            </>
          )}
        </TouchableOpacity>
      )}

      {/* Action Buttons */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[
            styles.importButton,
            isImported && styles.importButtonSuccess,
            loading && styles.importButtonLoading,
          ]}
          onPress={handleImport}
          disabled={isImported || loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : isImported ? (
            <>
              <HugeiconsIcon icon={Tick01Icon} size={15} color="#FFFFFF" />
              <Text style={styles.importButtonText}>Imported to Library</Text>
            </>
          ) : (
            <>
              <HugeiconsIcon icon={Bookmark01Icon} size={15} color="#FFFFFF" />
              <Text style={styles.importButtonText}>Import to Library</Text>
            </>
          )}
        </TouchableOpacity>

        {isImported && (
          <TouchableOpacity
            style={styles.studyNowButton}
            onPress={handleStudyNow}
            activeOpacity={0.8}
          >
            <Text style={styles.studyNowButtonText}>Study</Text>
            <HugeiconsIcon icon={ArrowRight01Icon} size={14} color="#7F56D9" />
          </TouchableOpacity>
        )}
      </View>

      <ImageZoomModal
        visible={isZoomVisible}
        onClose={() => setIsZoomVisible(false)}
        imageBase64={imageBase64}
        title={card.topic || 'Visual Study Diagram'}
        caption={card.question}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  cardWrapper: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginTop: 10,
    marginBottom: 4,
    borderWidth: 1.5,
    borderColor: '#E9D7FE',
    shadowColor: '#7F56D9',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
    elevation: 3,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  tagGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  studyCardTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F4EBFF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  studyCardTagText: {
    fontSize: 10,
    fontFamily: typography.fontFamily.bold,
    color: '#7F56D9',
    letterSpacing: 0.5,
  },
  typeBadge: {
    backgroundColor: '#F2F4F7',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  typeBadgeText: {
    fontSize: 10,
    fontFamily: typography.fontFamily.medium,
    color: colors.textSecondary,
  },
  diffBadge: {
    backgroundColor: '#FEF3F2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  diffBadgeText: {
    fontSize: 9,
    fontFamily: typography.fontFamily.bold,
    color: '#F04438',
  },
  contentBlock: {
    marginBottom: 10,
  },
  labelTitle: {
    fontSize: 10,
    fontFamily: typography.fontFamily.bold,
    color: '#98A2B3',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  questionText: {
    fontSize: 14,
    fontFamily: typography.fontFamily.bold,
    color: colors.text,
    lineHeight: 20,
  },
  answerContainer: {
    backgroundColor: '#F9F5FF',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E9D7FE',
    marginBottom: 10,
  },
  answerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  tapToRevealText: {
    fontSize: 10,
    fontFamily: typography.fontFamily.medium,
    color: '#7F56D9',
  },
  answerText: {
    fontSize: 13,
    fontFamily: typography.fontFamily.semiBold,
    color: '#6941C6',
    lineHeight: 18,
  },
  explanationBox: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E9D7FE',
  },
  explanationLabel: {
    fontSize: 11,
    fontFamily: typography.fontFamily.bold,
    color: '#6941C6',
    marginBottom: 2,
  },
  explanationText: {
    fontSize: 12,
    fontFamily: typography.fontFamily.regular,
    color: '#475467',
    lineHeight: 17,
  },
  optionsList: {
    marginBottom: 10,
    gap: 5,
  },
  optionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FE',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#EAECF0',
    gap: 6,
  },
  optionPillCorrect: {
    backgroundColor: '#ECFDF3',
    borderColor: '#A6F4C5',
  },
  optionIndex: {
    fontSize: 11,
    fontFamily: typography.fontFamily.bold,
    color: colors.textSecondary,
  },
  optionLabel: {
    fontSize: 12,
    fontFamily: typography.fontFamily.regular,
    color: colors.text,
    flex: 1,
  },
  optionLabelCorrect: {
    color: '#027A48',
    fontFamily: typography.fontFamily.semiBold,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  importButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 9,
    borderRadius: 10,
    gap: 6,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  importButtonSuccess: {
    backgroundColor: '#12B76A',
    shadowColor: '#12B76A',
  },
  importButtonLoading: {
    opacity: 0.85,
  },
  importButtonText: {
    fontSize: 12,
    fontFamily: typography.fontFamily.semiBold,
    color: '#FFFFFF',
  },
  studyNowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F4EBFF',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    gap: 4,
  },
  studyNowButtonText: {
    fontSize: 12,
    fontFamily: typography.fontFamily.semiBold,
    color: colors.primary,
  },
  diagramContainer: {
    backgroundColor: '#FAFAFD',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E9D7FE',
    marginBottom: 10,
  },
  diagramHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  diagramBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F4EBFF',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  diagramBadgeText: {
    fontSize: 9,
    fontFamily: typography.fontFamily.bold,
    color: '#7F56D9',
    letterSpacing: 0.5,
  },
  expandTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  expandTagText: {
    fontSize: 10,
    fontFamily: typography.fontFamily.medium,
    color: '#7F56D9',
  },
  diagramImageCard: {
    width: '100%',
    height: 160,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#EAECF0',
  },
  diagramImage: {
    width: '100%',
    height: '100%',
  },
  generateDiagramButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F4EBFF',
    borderWidth: 1,
    borderColor: '#D6BBFB',
    borderStyle: 'dashed',
    borderRadius: 10,
    paddingVertical: 8,
    gap: 6,
    marginBottom: 10,
  },
  generateDiagramButtonLoading: {
    opacity: 0.8,
  },
  generateDiagramText: {
    fontSize: 11,
    fontFamily: typography.fontFamily.semiBold,
    color: '#6941C6',
  },
});
