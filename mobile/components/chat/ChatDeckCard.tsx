import React from 'react';
import { View, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { AppText as Text } from '@/components/common/app-text';
import { colors, spacing, typography } from '@/constants/theme';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { FlashIcon, ArrowRight01Icon, BookOpen01Icon } from '@hugeicons/core-free-icons';
import { useRouter } from 'expo-router';
import { CreatedDeckMetadata } from '../../types';

interface ChatDeckCardProps {
  deck: CreatedDeckMetadata;
}

export const ChatDeckCard: React.FC<ChatDeckCardProps> = ({ deck }) => {
  const router = useRouter();

  const handleStudyPress = () => {
    if (deck.study_set_id) {
      router.push(`/study/${deck.study_set_id}` as any);
    }
  };

  const formatType = (t: string) => {
    switch (t) {
      case 'flashcard': return 'Flashcards';
      case 'multiple_choice': return 'Multiple Choice';
      case 'true_false': return 'True / False';
      case 'identification': return 'Identification';
      default: return t;
    }
  };

  return (
    <View style={styles.cardContainer}>
      <View style={styles.cardHeader}>
        <View style={styles.headerLeft}>
          <View style={styles.iconCircle}>
            <HugeiconsIcon icon={FlashIcon} size={16} color="#FFFFFF" />
          </View>
          <Text style={styles.headerTitle}>Study Deck Cooked!</Text>
        </View>
        <Image
          source={require('@/assets/animations/cheer_momo.png')}
          style={styles.mascotImg}
          resizeMode="contain"
        />
      </View>

      <Text style={styles.deckTitle} numberOfLines={2}>
        {deck.title}
      </Text>

      <View style={styles.metaRow}>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{deck.item_count} Items</Text>
        </View>
        {deck.question_types.slice(0, 2).map((type, idx) => (
          <View key={idx} style={styles.typeBadge}>
            <Text style={styles.typeText}>{formatType(type)}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity
        style={styles.actionButton}
        onPress={handleStudyPress}
        activeOpacity={0.8}
      >
        <Text style={styles.actionButtonText}>Start Studying Now</Text>
        <HugeiconsIcon icon={ArrowRight01Icon} size={16} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginTop: 10,
    marginBottom: 4,
    borderWidth: 1.5,
    borderColor: '#7F56D9',
    shadowColor: '#7F56D9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#7F56D9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 12,
    fontFamily: typography.fontFamily.bold,
    color: '#7F56D9',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  mascotImg: {
    width: 38,
    height: 38,
  },
  deckTitle: {
    fontSize: 16,
    fontFamily: typography.fontFamily.bold,
    color: colors.text,
    marginBottom: 10,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginBottom: 14,
    gap: 6,
  },
  countBadge: {
    backgroundColor: '#F4EBFF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  countText: {
    fontSize: 11,
    fontFamily: typography.fontFamily.semiBold,
    color: '#7F56D9',
  },
  typeBadge: {
    backgroundColor: '#F2F4F7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  typeText: {
    fontSize: 11,
    fontFamily: typography.fontFamily.medium,
    color: colors.textSecondary,
  },
  actionButton: {
    backgroundColor: '#7F56D9',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  actionButtonText: {
    fontSize: 13,
    fontFamily: typography.fontFamily.semiBold,
    color: '#FFFFFF',
  },
});
