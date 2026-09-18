import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, ActivityIndicator, Image, Alert, ScrollView, Platform } from 'react-native';
import { colors, spacing, typography } from '@/constants/theme';
import { AppText as Text } from '@/components/common/app-text';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { Camera01Icon, ArrowLeft01Icon, SparklesIcon } from '@hugeicons/core-free-icons';
import { PlatformPressable } from '@/components/common/PlatformPressable';
import { PageHeader } from '@/components/common/PageHeader';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000';

export default function MathSolveScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [isSolving, setIsSolving] = useState(false);
  const [result, setResult] = useState<any>(null);

  const solveWithBase64 = async (b64: string) => {
    setIsSolving(true);
    setResult(null);

    try {
      const response = await fetch(`${API_BASE}/api/math/solve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ base64_image: b64 }),
      });

      if (!response.ok) {
        throw new Error('Failed to solve math problem. Ensure backend is running.');
      }

      const data = await response.json();
      setResult(data);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Something went wrong solving the equation.');
    } finally {
      setIsSolving(false);
    }
  };

  const takePicture = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    
    if (permissionResult.granted === false) {
      Alert.alert('Permission needed', 'Camera permission is required to solve math problems.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      setImageUri(asset.uri);
      setImageBase64(asset.base64 || null);
      setResult(null);
      if (asset.base64) {
        solveWithBase64(asset.base64);
      }
    }
  };

  const pickFromGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      setImageUri(asset.uri);
      setImageBase64(asset.base64 || null);
      setResult(null);
      if (asset.base64) {
        solveWithBase64(asset.base64);
      }
    }
  };

  const solveProblem = () => {
    if (imageBase64) {
      solveWithBase64(imageBase64);
    }
  };

  return (
    <View style={styles.screen}>
      <PageHeader
        title="AI Math Solver"
        subtitle="Point camera at a math problem"
        isModal={true}
        onBack={() => router.back()}
      />

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 24) + 20 }]}>
        
        {!imageUri ? (
          <View style={styles.placeholderCard}>
            <TouchableOpacity style={styles.cameraPlaceholder} onPress={takePicture} activeOpacity={0.8}>
              <View style={styles.iconCircle}>
                <HugeiconsIcon icon={Camera01Icon} size={36} color={colors.primary} />
              </View>
              <Text style={styles.placeholderTitle}>Take a picture</Text>
              <Text style={styles.placeholderDesc}>Capture a handwritten or typed math equation</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.galleryBtn} onPress={pickFromGallery} activeOpacity={0.7}>
              <Text style={styles.galleryBtnText}>Choose from Gallery</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.imageContainer}>
            <Image source={{ uri: imageUri }} style={styles.imagePreview} />
            <View style={styles.imageActionsRow}>
              <TouchableOpacity style={styles.retakeBtn} onPress={takePicture}>
                <Text style={styles.retakeBtnText}>Retake Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.gallerySmallBtn} onPress={pickFromGallery}>
                <Text style={styles.gallerySmallBtnText}>Gallery</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {imageUri && !isSolving && !result && (
          <PlatformPressable style={styles.solveBtn} onPress={solveProblem}>
            <HugeiconsIcon icon={SparklesIcon} size={20} color={colors.onPrimary} />
            <Text style={styles.solveBtnText}>Solve Problem</Text>
          </PlatformPressable>
        )}

        {isSolving && (
          <View style={styles.loadingContainer}>
            <Image 
              source={require('../../assets/animations/math_momo.png')} 
              style={{ width: 140, height: 140, marginBottom: 16 }} 
              resizeMode="contain" 
            />
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingTitle}>Analyzing Equation...</Text>
            <Text style={styles.loadingDesc}>Momo is parsing the problem and solving it step-by-step.</Text>
          </View>
        )}

        {result && (
          <View style={styles.resultContainer}>
            <View style={styles.resultCard}>
              <View style={styles.metaRow}>
                {result.category && (
                  <View style={styles.metaBadge}>
                    <Text style={styles.metaBadgeText}>{result.category}</Text>
                  </View>
                )}
                {result.difficulty && (
                  <View style={[styles.metaBadge, { backgroundColor: colors.warningSoft }]}>
                    <Text style={[styles.metaBadgeText, { color: colors.warning }]}>{result.difficulty}</Text>
                  </View>
                )}
              </View>

              <Text style={styles.sectionHeader}>Problem Detected</Text>
              <Text style={styles.problemText}>{result.problem}</Text>
              
              {result.key_concepts && result.key_concepts.length > 0 && (
                <View style={styles.conceptsBox}>
                  <Text style={styles.conceptsHeader}>Key Concepts:</Text>
                  <Text style={styles.conceptsText}>{result.key_concepts.join(' • ')}</Text>
                </View>
              )}
            </View>

            <View style={styles.resultCard}>
              <Text style={styles.sectionHeader}>Step-by-Step Solution</Text>
              {result.steps && result.steps.map((step: string, idx: number) => (
                <View key={idx} style={styles.stepRow}>
                  <View style={styles.stepBadge}>
                    <Text style={styles.stepBadgeText}>{idx + 1}</Text>
                  </View>
                  <Text style={styles.stepText}>{step}</Text>
                </View>
              ))}
            </View>

            <View style={[styles.resultCard, styles.finalAnswerCard]}>
              <Text style={styles.sectionHeader}>Final Answer</Text>
              <Text style={styles.finalAnswerText}>{result.final_answer}</Text>
              
              {result.explanation && (
                <View style={styles.explanationBox}>
                  <Text style={styles.explanationText}>{result.explanation}</Text>
                </View>
              )}
            </View>

            <PlatformPressable 
              style={[styles.solveBtn, styles.solveAnotherBtn]} 
              onPress={takePicture}
            >
              <HugeiconsIcon icon={Camera01Icon} size={20} color={colors.onPrimary} />
              <Text style={styles.solveBtnText}>Solve Another Problem</Text>
            </PlatformPressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing[16],
  },
  cameraPlaceholder: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    borderStyle: 'dashed',
    borderRadius: 16,
    padding: spacing[32],
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing[16],
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[16],
  },
  placeholderTitle: {
    fontSize: typography.fontSize[18],
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
  },
  placeholderDesc: {
    fontSize: typography.fontSize[14],
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing[8],
  },
  imageContainer: {
    marginTop: spacing[16],
    alignItems: 'center',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  imagePreview: {
    width: '100%',
    height: 250,
    backgroundColor: colors.surfaceMuted,
  },
  placeholderCard: {
    gap: spacing[12],
  },
  galleryBtn: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing[12],
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  galleryBtnText: {
    color: colors.text,
    fontSize: typography.fontSize[14],
    fontWeight: typography.fontWeight.semiBold,
  },
  imageActionsRow: {
    position: 'absolute',
    bottom: spacing[12],
    right: spacing[12],
    flexDirection: 'row',
    gap: spacing[8],
  },
  retakeBtn: {
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[8],
    borderRadius: 8,
  },
  retakeBtnText: {
    color: colors.onPrimary,
    fontWeight: typography.fontWeight.bold,
    fontSize: typography.fontSize[13],
  },
  gallerySmallBtn: {
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[8],
    borderRadius: 8,
  },
  gallerySmallBtnText: {
    color: colors.onPrimary,
    fontWeight: typography.fontWeight.bold,
    fontSize: typography.fontSize[13],
  },
  solveBtn: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[16],
    borderRadius: 14,
    marginTop: spacing[24],
    gap: spacing[8],
  },
  solveAnotherBtn: {
    marginTop: spacing[16],
    backgroundColor: colors.primary,
  },
  solveBtnText: {
    color: colors.onPrimary,
    fontSize: typography.fontSize[16],
    fontWeight: typography.fontWeight.bold,
  },
  loadingContainer: {
    marginTop: spacing[32],
    alignItems: 'center',
    padding: spacing[24],
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  loadingTitle: {
    fontSize: typography.fontSize[16],
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
    marginTop: spacing[16],
  },
  loadingDesc: {
    fontSize: typography.fontSize[13],
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing[8],
  },
  resultContainer: {
    marginTop: spacing[24],
    gap: spacing[16],
  },
  resultCard: {
    backgroundColor: colors.surface,
    padding: spacing[16],
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionHeader: {
    fontSize: typography.fontSize[13],
    color: colors.textMuted,
    fontWeight: typography.fontWeight.bold,
    textTransform: 'uppercase',
    marginBottom: spacing[12],
  },
  problemText: {
    fontSize: typography.fontSize[18],
    fontWeight: typography.fontWeight.semiBold,
    color: colors.text,
  },
  metaRow: {
    flexDirection: 'row',
    gap: spacing[8],
    marginBottom: spacing[12],
    flexWrap: 'wrap',
  },
  metaBadge: {
    backgroundColor: colors.infoSoft,
    paddingHorizontal: spacing[10],
    paddingVertical: spacing[4],
    borderRadius: 8,
  },
  metaBadgeText: {
    color: colors.info,
    fontSize: typography.fontSize[11],
    fontWeight: typography.fontWeight.bold,
    textTransform: 'uppercase',
  },
  conceptsBox: {
    marginTop: spacing[12],
    paddingTop: spacing[12],
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  conceptsHeader: {
    fontSize: typography.fontSize[12],
    color: colors.textMuted,
    fontWeight: typography.fontWeight.semiBold,
    marginBottom: spacing[4],
  },
  conceptsText: {
    fontSize: typography.fontSize[13],
    color: colors.primary,
    fontWeight: typography.fontWeight.medium,
  },
  stepRow: {
    flexDirection: 'row',
    marginBottom: spacing[12],
    paddingRight: spacing[16],
  },
  stepBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing[10],
    marginTop: 2,
  },
  stepBadgeText: {
    color: colors.primary,
    fontSize: typography.fontSize[12],
    fontWeight: typography.fontWeight.bold,
  },
  stepText: {
    flex: 1,
    fontSize: typography.fontSize[15],
    color: colors.text,
    lineHeight: typography.lineHeight[22],
  },
  finalAnswerCard: {
    borderColor: colors.successBorder,
    backgroundColor: colors.successSoft,
  },
  finalAnswerText: {
    fontSize: typography.fontSize[24],
    fontWeight: typography.fontWeight.black,
    color: colors.success,
  },
  explanationBox: {
    marginTop: spacing[16],
    paddingTop: spacing[16],
    borderTopWidth: 1,
    borderTopColor: colors.successBorder,
  },
  explanationText: {
    fontSize: typography.fontSize[14],
    color: colors.textSecondary,
    lineHeight: typography.lineHeight[20],
  }
});
