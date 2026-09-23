import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
  ScrollView,
  Platform,
  TextInput,
} from 'react-native';
import { colors, spacing, typography } from '@/constants/theme';
import { AppText as Text } from '@/components/common/app-text';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  Camera01Icon,
  SparklesIcon,
  AlertCircleIcon,
  Edit02Icon,
  Cancel01Icon,
  BookOpen01Icon,
} from '@hugeicons/core-free-icons';
import { PlatformPressable } from '@/components/common/PlatformPressable';
import { PageHeader } from '@/components/common/PageHeader';
import { isIpad } from '@/utils/device';
import { solveMathProblem, MathSolveResponse, BASE_URL } from '@/lib/api/math';

type InputMode = 'camera' | 'text';

const SAMPLE_EQUATIONS = [
  '4x - 8 = 16',
  '3x + 5 = 20',
  'derivative of x^3 + 4x',
  'Pythagorean: a = 3, b = 4',
  '25% of 80',
];

export default function MathSolveScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isPadDevice = isIpad();

  const [mode, setMode] = useState<InputMode>('camera');
  const [typedEquation, setTypedEquation] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [isSolving, setIsSolving] = useState(false);
  const [result, setResult] = useState<MathSolveResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Helper to ensure base64 is available for an image URI
  const extractBase64 = async (asset: ImagePicker.ImagePickerAsset): Promise<string | null> => {
    if (asset.base64 && asset.base64.length > 0) {
      return asset.base64;
    }
    if (asset.uri) {
      try {
        const b64 = await FileSystem.readAsStringAsync(asset.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        return b64;
      } catch (err) {
        console.warn('[MathSolve] FileSystem base64 extraction failed:', err);
      }
    }
    return null;
  };

  const solveProblem = async (b64?: string | null, text?: string | null) => {
    const imgData = b64 !== undefined ? b64 : imageBase64;
    const txtData = text !== undefined ? text : typedEquation;

    if (!imgData && (!txtData || !txtData.trim())) {
      Alert.alert('No Input Provided', 'Please capture a photo or enter a math equation to solve.');
      return;
    }

    setIsSolving(true);
    setErrorMsg(null);
    setResult(null);

    try {
      const data = await solveMathProblem({
        base64_image: imgData || undefined,
        equation_text: txtData?.trim() || undefined,
      });
      setResult(data);
    } catch (err: any) {
      const msg = err.message || 'Something went wrong while solving the equation.';
      setErrorMsg(msg);
      console.warn('[MathSolve] Solve request error:', err);
    } finally {
      setIsSolving(false);
    }
  };

  const takePicture = async () => {
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();

      if (!permissionResult.granted) {
        Alert.alert('Permission Needed', 'Camera permission is required to capture math problems.');
        return;
      }

      const pickerResult = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
        base64: true,
      });

      if (!pickerResult.canceled && pickerResult.assets && pickerResult.assets[0]) {
        const asset = pickerResult.assets[0];
        setImageUri(asset.uri);
        setErrorMsg(null);
        setResult(null);

        const b64 = await extractBase64(asset);
        setImageBase64(b64);
        if (b64) {
          solveProblem(b64, null);
        }
      }
    } catch (err: any) {
      Alert.alert('Camera Error', err.message || 'Could not launch camera.');
    }
  };

  const pickFromGallery = async () => {
    try {
      const pickerResult = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
        base64: true,
      });

      if (!pickerResult.canceled && pickerResult.assets && pickerResult.assets[0]) {
        const asset = pickerResult.assets[0];
        setImageUri(asset.uri);
        setErrorMsg(null);
        setResult(null);

        const b64 = await extractBase64(asset);
        setImageBase64(b64);
        if (b64) {
          solveProblem(b64, null);
        }
      }
    } catch (err: any) {
      Alert.alert('Gallery Error', err.message || 'Could not pick image.');
    }
  };

  const handleReset = () => {
    setImageUri(null);
    setImageBase64(null);
    setTypedEquation('');
    setResult(null);
    setErrorMsg(null);
  };

  const canSolve = (mode === 'camera' && imageUri) || (mode === 'text' && typedEquation.trim().length > 0);

  return (
    <View style={styles.screen}>
      <PageHeader
        title="AI Math Solver"
        subtitle="Snap a photo or type an equation"
        isModal={true}
        onBack={() => router.back()}
      />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, 24) + 24 },
        ]}
      >
        {/* Mode Switcher Tabs */}
        {!result && (
          <View style={styles.modeTabsRow}>
            <TouchableOpacity
              style={[styles.modeTab, mode === 'camera' && styles.modeTabActive]}
              onPress={() => {
                setMode('camera');
                setErrorMsg(null);
              }}
              activeOpacity={0.7}
            >
              <HugeiconsIcon
                icon={Camera01Icon}
                size={18}
                color={mode === 'camera' ? colors.primary : colors.textMuted}
                strokeWidth={2}
              />
              <Text style={[styles.modeTabText, mode === 'camera' && styles.modeTabTextActive]}>
                Scan / Photo
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modeTab, mode === 'text' && styles.modeTabActive]}
              onPress={() => {
                setMode('text');
                setErrorMsg(null);
              }}
              activeOpacity={0.7}
            >
              <HugeiconsIcon
                icon={Edit02Icon}
                size={18}
                color={mode === 'text' ? colors.primary : colors.textMuted}
                strokeWidth={2}
              />
              <Text style={[styles.modeTabText, mode === 'text' && styles.modeTabTextActive]}>
                Type Equation
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Error Banner */}
        {errorMsg && (
          <View style={styles.errorBanner}>
            <HugeiconsIcon icon={AlertCircleIcon} size={20} color={colors.danger} strokeWidth={2.2} />
            <View style={styles.errorContent}>
              <Text style={styles.errorTitle}>Could Not Solve Problem</Text>
              <Text style={styles.errorDesc}>{errorMsg}</Text>
              <Text style={styles.errorHint}>
                Target: {BASE_URL}. Ensure your device and computer are on the same Wi-Fi.
              </Text>
            </View>
          </View>
        )}

        {/* Input Views (Camera or Text) */}
        {!result && mode === 'camera' && (
          <>
            {!imageUri ? (
              <View style={styles.placeholderCard}>
                <TouchableOpacity
                  style={styles.cameraPlaceholder}
                  onPress={takePicture}
                  activeOpacity={0.8}
                >
                  <View style={styles.iconCircle}>
                    <HugeiconsIcon
                      icon={Camera01Icon}
                      size={isPadDevice ? 52 : 36}
                      color={colors.primary}
                    />
                  </View>
                  <Text style={styles.placeholderTitle}>Take a picture</Text>
                  <Text style={styles.placeholderDesc}>
                    Capture a handwritten or typed math equation
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.galleryBtn}
                  onPress={pickFromGallery}
                  activeOpacity={0.7}
                >
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
                  <TouchableOpacity style={styles.removeSmallBtn} onPress={handleReset}>
                    <HugeiconsIcon icon={Cancel01Icon} size={14} color={colors.onPrimary} />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </>
        )}

        {!result && mode === 'text' && (
          <View style={styles.textInputCard}>
            <Text style={styles.inputLabel}>Enter Equation or Math Problem:</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. 4x - 8 = 16 or derivative of x^2 + 5x"
              placeholderTextColor={colors.textMuted}
              value={typedEquation}
              onChangeText={(txt) => {
                setTypedEquation(txt);
                setErrorMsg(null);
              }}
              autoCapitalize="none"
              autoCorrect={false}
              multiline={false}
              returnKeyType="done"
            />

            <Text style={styles.samplesLabel}>Quick Examples:</Text>
            <View style={styles.samplePillsRow}>
              {SAMPLE_EQUATIONS.map((eq) => (
                <TouchableOpacity
                  key={eq}
                  style={styles.samplePill}
                  onPress={() => {
                    setTypedEquation(eq);
                    setErrorMsg(null);
                  }}
                >
                  <Text style={styles.samplePillText}>{eq}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Primary "Solve Problem" Action Button */}
        {canSolve && !isSolving && !result && (
          <PlatformPressable
            style={styles.solveBtn}
            onPress={() => solveProblem()}
            disabled={isSolving}
          >
            <View style={styles.solveBtnInner}>
              <HugeiconsIcon
                icon={SparklesIcon}
                size={isPadDevice ? 24 : 20}
                color={colors.onPrimary}
              />
              <Text style={styles.solveBtnText}>
                {errorMsg ? 'Retry Solving' : 'Solve Problem'}
              </Text>
            </View>
          </PlatformPressable>
        )}

        {/* Loading Spinner / Animation State */}
        {isSolving && (
          <View style={styles.loadingContainer}>
            <Image
              source={require('@/assets/animations/math_momo.png')}
              style={{
                width: isPadDevice ? 180 : 140,
                height: isPadDevice ? 180 : 140,
                marginBottom: 16,
              }}
              resizeMode="contain"
            />
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingTitle}>Analyzing Equation...</Text>
            <Text style={styles.loadingDesc}>
              Momo is parsing the problem and solving it step-by-step.
            </Text>
          </View>
        )}

        {/* Solution Results Card */}
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
                    <Text style={[styles.metaBadgeText, { color: colors.warning }]}>
                      {result.difficulty}
                    </Text>
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
              {result.steps &&
                result.steps.map((step: string, idx: number) => (
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
              style={styles.solveBtn}
              onPress={handleReset}
            >
              <View style={styles.solveBtnInner}>
                <HugeiconsIcon
                  icon={BookOpen01Icon}
                  size={isPadDevice ? 24 : 20}
                  color={colors.onPrimary}
                />
                <Text style={styles.solveBtnText}>Solve Another Problem</Text>
              </View>
            </PlatformPressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const isPadDevice = isIpad();

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: isPadDevice ? spacing[36] : spacing[16],
    maxWidth: isPadDevice ? 860 : undefined,
    width: '100%',
    alignSelf: 'center',
  },
  modeTabsRow: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceMuted,
    padding: 4,
    borderRadius: 14,
    marginBottom: spacing[16],
    gap: 6,
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[10],
    borderRadius: 10,
    gap: spacing[6],
  },
  modeTabActive: {
    backgroundColor: colors.surface,
    ...Platform.select({
      ios: {
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  modeTabText: {
    fontSize: typography.fontSize[14],
    fontWeight: typography.fontWeight.medium,
    color: colors.textMuted,
  },
  modeTabTextActive: {
    color: colors.primary,
    fontWeight: typography.fontWeight.bold,
  },
  errorBanner: {
    flexDirection: 'row',
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    borderRadius: 14,
    padding: spacing[14],
    marginBottom: spacing[16],
    gap: spacing[10],
  },
  errorContent: {
    flex: 1,
  },
  errorTitle: {
    fontSize: typography.fontSize[14],
    fontWeight: typography.fontWeight.bold,
    color: colors.danger,
    marginBottom: 2,
  },
  errorDesc: {
    fontSize: typography.fontSize[13],
    color: colors.text,
    lineHeight: typography.lineHeight[18],
  },
  errorHint: {
    fontSize: typography.fontSize[11],
    color: colors.textMuted,
    marginTop: spacing[4],
  },
  placeholderCard: {
    gap: spacing[12],
  },
  cameraPlaceholder: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    borderStyle: 'dashed',
    borderRadius: isPadDevice ? 24 : 16,
    padding: isPadDevice ? spacing[48] : spacing[32],
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: isPadDevice ? 96 : 72,
    height: isPadDevice ? 96 : 72,
    borderRadius: isPadDevice ? 48 : 36,
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
  galleryBtn: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: isPadDevice ? spacing[16] : spacing[14],
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: isPadDevice ? 16 : 12,
  },
  galleryBtnText: {
    color: colors.text,
    fontSize: typography.fontSize[14],
    fontWeight: typography.fontWeight.semiBold,
  },
  imageContainer: {
    borderRadius: isPadDevice ? 24 : 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  imagePreview: {
    width: '100%',
    height: isPadDevice ? 380 : 250,
  },
  imageActionsRow: {
    position: 'absolute',
    bottom: spacing[12],
    right: spacing[12],
    flexDirection: 'row',
    gap: spacing[8],
  },
  retakeBtn: {
    backgroundColor: 'rgba(0,0,0,0.7)',
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
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[8],
    borderRadius: 8,
  },
  gallerySmallBtnText: {
    color: colors.onPrimary,
    fontWeight: typography.fontWeight.bold,
    fontSize: typography.fontSize[13],
  },
  removeSmallBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.85)',
    paddingHorizontal: spacing[10],
    paddingVertical: spacing[8],
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textInputCard: {
    backgroundColor: colors.surface,
    padding: spacing[16],
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing[12],
  },
  inputLabel: {
    fontSize: typography.fontSize[14],
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
  },
  textInput: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 12,
    paddingHorizontal: spacing[14],
    paddingVertical: spacing[12],
    fontSize: typography.fontSize[16],
    color: colors.text,
  },
  samplesLabel: {
    fontSize: typography.fontSize[12],
    fontWeight: typography.fontWeight.semiBold,
    color: colors.textMuted,
    marginTop: spacing[4],
  },
  samplePillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[8],
  },
  samplePill: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing[10],
    paddingVertical: spacing[6],
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  samplePillText: {
    fontSize: typography.fontSize[12],
    color: colors.primary,
    fontWeight: typography.fontWeight.medium,
  },
  solveBtn: {
    backgroundColor: colors.primary,
    borderRadius: isPadDevice ? 18 : 14,
    marginTop: spacing[20],
    overflow: 'hidden',
  },
  solveBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: isPadDevice ? spacing[18] : spacing[16],
    paddingHorizontal: spacing[20],
    gap: spacing[8],
  },
  solveBtnText: {
    color: colors.onPrimary,
    fontSize: isPadDevice ? typography.fontSize[18] : typography.fontSize[16],
    fontWeight: typography.fontWeight.bold,
  },
  loadingContainer: {
    marginTop: spacing[24],
    alignItems: 'center',
    padding: spacing[24],
    backgroundColor: colors.surface,
    borderRadius: isPadDevice ? 24 : 16,
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
    marginTop: spacing[16],
    gap: spacing[16],
  },
  resultCard: {
    backgroundColor: colors.surface,
    padding: isPadDevice ? spacing[24] : spacing[16],
    borderRadius: isPadDevice ? 22 : 16,
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
    width: isPadDevice ? 32 : 24,
    height: isPadDevice ? 32 : 24,
    borderRadius: isPadDevice ? 16 : 12,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing[10],
    marginTop: 2,
  },
  stepBadgeText: {
    color: colors.primary,
    fontSize: isPadDevice ? typography.fontSize[15] : typography.fontSize[12],
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
  },
});
