import React, { useState } from 'react';
import { Platform, 
  View,
  StyleSheet,
  Image,
  TouchableOpacity,
  ActivityIndicator,
 } from 'react-native';
import { AppText as Text } from '@/components/common/app-text';
import { useRouter } from 'expo-router';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  SparklesIcon,
  Upload01Icon,
  BookOpen01Icon,
} from '@hugeicons/core-free-icons';
import { colors, spacing, typography } from '@/constants/theme';
import { seedSampleDeck, buildSampleDeck } from '../../lib/data/sampleDeck';
import { useOnboarding } from '../../context/OnboardingContext';

interface SampleDeckCardProps {
  onDeckSeeded?: () => void;
}

export const SampleDeckCard: React.FC<SampleDeckCardProps> = ({ onDeckSeeded }) => {
  const router = useRouter();
  const { studyTrack, highSchoolGrade, collegeYear, collegeCourse } = useOnboarding();
  const profile = { studyTrack, highSchoolGrade, collegeYear, collegeCourse };
  const preview = buildSampleDeck(profile).set;
  const [loading, setLoading] = useState(false);

  const handleStartSample = async () => {
    setLoading(true);
    try {
      const set = await seedSampleDeck(profile);
      if (onDeckSeeded) {
        onDeckSeeded();
      }
      router.push(`/study/${set.id}`);
    } catch (err) {
      console.error('Failed to seed sample deck:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadOwn = () => {
    router.push('/documents/upload');
  };

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <View style={styles.badge}>
          <HugeiconsIcon icon={SparklesIcon} size={12} color={colors.primary} strokeWidth={2.5} />
          <Text style={styles.badgeText}>Taste Test • Ready to Study</Text>
        </View>
        <Text style={styles.readyText}>Ready in 1 tap</Text>
      </View>

      <View style={styles.bodyRow}>
        <View style={styles.textColumn}>
          <Text style={styles.title}>{preview.title}</Text>
          <Text style={styles.description}>
            Try cards matched to your study path. Upload notes when you want cards grounded in your material.
          </Text>
          <View style={styles.tagRow}>
            <View style={styles.tag}>
              <Text style={styles.tagText}>{preview.item_count} Flashcards</Text>
            </View>
            <View style={styles.tag}>
              <Text style={styles.tagText}>Curated Preview</Text>
            </View>
          </View>
        </View>

        <Image
          source={require('@/assets/animations/folder_momo.png')}
          style={styles.mascotImage}
          resizeMode="contain"
        />
      </View>

      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={handleStartSample}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel={`Study sample deck, ${preview.title}`}
        >
          {loading ? (
            <ActivityIndicator size="small" color={colors.onPrimary} />
          ) : (
            <>
              <HugeiconsIcon icon={BookOpen01Icon} size={15} color={colors.onPrimary} strokeWidth={2.5} />
              <Text style={styles.primaryBtnText}>Study Sample Deck</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={handleUploadOwn}
          accessibilityRole="button"
          accessibilityLabel="Upload your own notes"
        >
          <HugeiconsIcon icon={Upload01Icon} size={14} color={colors.primary} strokeWidth={2.5} />
          <Text style={styles.secondaryBtnText}>Upload Notes</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#EEF2FF',
    borderRadius: 20,
    borderCurve: 'continuous',
    padding: spacing[16],
    marginBottom: spacing[16],
    borderWidth: 1.5,
    borderColor: '#C7D2FE',
    ...Platform.select({
      ios: {
        shadowColor: colors.shadow || '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[10],
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[8],
    borderRadius: 12,
    borderCurve: 'continuous',
    gap: 4,
  },
  badgeText: {
    fontSize: typography.fontSize[11],
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
  },
  readyText: {
    fontSize: typography.fontSize[11],
    color: colors.textMuted,
    fontWeight: typography.fontWeight.medium,
  },
  bodyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[14],
  },
  textColumn: {
    flex: 1,
    paddingRight: spacing[8],
  },
  title: {
    fontSize: typography.fontSize[16],
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
    marginBottom: 4,
  },
  description: {
    fontSize: typography.fontSize[12.5],
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: spacing[8],
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tag: {
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderCurve: 'continuous',
  },
  tagText: {
    fontSize: typography.fontSize[10.5],
    color: colors.primaryDark,
    fontWeight: typography.fontWeight.medium,
  },
  mascotImage: {
    width: 84,
    height: 84,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  primaryBtn: {
    flex: 1.4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: spacing[10],
    paddingHorizontal: spacing[12],
    borderRadius: 12,
    borderCurve: 'continuous',
    gap: 6,
  },
  primaryBtnText: {
    fontSize: typography.fontSize[13],
    fontWeight: typography.fontWeight.bold,
    color: colors.onPrimary,
  },
  secondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingVertical: spacing[10],
    paddingHorizontal: spacing[10],
    borderRadius: 12,
    borderCurve: 'continuous',
    gap: 6,
  },
  secondaryBtnText: {
    fontSize: typography.fontSize[12.5],
    fontWeight: typography.fontWeight.semiBold,
    color: colors.primary,
  },
});
