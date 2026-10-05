import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  AiChat02Icon,
  AiImage01Icon,
  ArrowLeft02Icon,
  BookOpen01Icon,
  SentIcon,
  SparklesIcon,
} from '@hugeicons/core-free-icons';

import { AppText as Text, AppTextInput as TextInput } from '@/components/common/app-text';
import { ImageZoomModal } from '@/components/common/ImageZoomModal';
import { StudyIcon } from '@/components/common/StudyIcon';
import { MomoAnimation } from '@/components/mascot/MomoAnimation';
import { canSubmitAiPrompt, buildChatPrompt, getImageErrorMessage, type AssistantMode } from '@/lib/screens/aiWorkspace';
import { GlassButton } from '@/components/glass';
import { colors, spacing, typography } from '@/constants/theme';
import {
  generateImage,
  GenerateImageResponse,
  ImageAspectRatio,
  ImageGenerationMode,
} from '@/lib/api/images';

const MOMO_AVATAR = require('@/assets/animations/happy_momo.png');

const MODES: Array<{
  id: AssistantMode;
  label: string;
  icon: typeof AiChat02Icon;
  placeholder: string;
}> = [
  {
    id: 'ask',
    label: 'Ask Momo',
    icon: AiChat02Icon,
    placeholder: 'Ask anything about your studies...',
  },
  {
    id: 'study',
    label: 'Review',
    icon: BookOpen01Icon,
    placeholder: 'Describe the study material you want...',
  },
  {
    id: 'image',
    label: 'Visuals',
    icon: AiImage01Icon,
    placeholder: 'Describe the image you want to create...',
  },
];

const IMAGE_RATIOS: Array<{ value: ImageAspectRatio; label: string }> = [
  { value: '1:1', label: 'Square' },
  { value: '16:9', label: 'Wide' },
  { value: '9:16', label: 'Portrait' },
];

export default function AiScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<AssistantMode>('ask');
  const [prompt, setPrompt] = useState('');
  const [imageMode, setImageMode] = useState<ImageGenerationMode>('image');
  const [aspectRatio, setAspectRatio] = useState<ImageAspectRatio>('1:1');
  const [resultRatio, setResultRatio] = useState(1);
  const [generatedImage, setGeneratedImage] = useState<GenerateImageResponse | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showImagePreview, setShowImagePreview] = useState(false);

  const selectedMode = useMemo(() => MODES.find((item) => item.id === mode) ?? MODES[0], [mode]);
  const canSubmit = canSubmitAiPrompt(prompt, isGenerating);

  const chooseMode = (nextMode: AssistantMode) => {
    if (isGenerating) return;
    setMode(nextMode);
    setErrorMessage(null);
    if (nextMode !== 'image') setGeneratedImage(null);
  };

  const handleSubmit = async () => {
    const cleanPrompt = prompt.trim();
    if (!canSubmitAiPrompt(cleanPrompt, isGenerating)) return;

    if (mode === 'ask') {
      router.push({ pathname: '/chat', params: { initialPrompt: buildChatPrompt('ask', cleanPrompt) } });
      return;
    }

    if (mode === 'study') {
      router.push({
        pathname: '/chat',
        params: { initialPrompt: buildChatPrompt('study', cleanPrompt) },
      });
      return;
    }

    setIsGenerating(true);
    setErrorMessage(null);
    try {
      const result = await generateImage({
        prompt: cleanPrompt,
        mode: imageMode,
        aspect_ratio: aspectRatio,
      });
      const [width, height] = aspectRatio.split(':').map(Number);
      setResultRatio(width / height);
      setGeneratedImage(result);
    } catch (error) {
      setErrorMessage(getImageErrorMessage(error));
    } finally {
      setIsGenerating(false);
    }
  };

  const useSuggestion = (nextMode: AssistantMode, value: string) => {
    chooseMode(nextMode);
    setPrompt(value);
  };

  const imageUri = generatedImage
    ? `data:${generatedImage.mime_type || 'image/png'};base64,${generatedImage.image_base64}`
    : null;

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      testID="ai-screen"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.header, { paddingTop: insets.top + spacing[8] }]}>
        <GlassButton
          variant="subtle"
          size="icon"
          radius={18}
          haptic="light"
          onPress={() => router.back()}
          accessibilityLabel="Go back"
          contentStyle={styles.headerButtonContent}
        >
          <HugeiconsIcon icon={ArrowLeft02Icon} size={20} color={colors.text} />
        </GlassButton>

        <View style={styles.headerIdentity}>
          <View style={styles.avatarWrap}>
            <Image source={MOMO_AVATAR} style={styles.avatar} resizeMode="contain" />
          </View>
          <View>
            <Text style={styles.headerTitle}>Momo AI</Text>
            <Text style={styles.headerSubtitle}>Your study companion</Text>
          </View>
        </View>

        <View style={styles.aiBadge}>
          <HugeiconsIcon icon={SparklesIcon} size={13} color={colors.primary} />
          <Text style={styles.aiBadgeText}>AI</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, spacing[16]) + 132 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.intro}>
          <View style={styles.heroTop}>
            <View style={styles.heroCopy}>
          <Text style={styles.eyebrow}>STUDY WITH MOMO</Text>
          <Text style={styles.heroTitle}>{'A little help.\nA lot more clarity.'}</Text>
          <Text style={styles.heroSubtitle}>
            Understand your notes, practice recall, and work through tricky problems.
          </Text>
            </View>
            <MomoAnimation name={isGenerating ? 'momo-thinking' : mode === 'study' ? 'momo-reading' : 'momo-listen'} size={112} />
          </View>
          <View style={styles.sourcePill}><HugeiconsIcon icon={BookOpen01Icon} size={14} color={colors.primary} /><Text style={styles.sourcePillText}>Your notes lead the way</Text></View>
        </View>

        <View style={styles.modeTabs}>
          {MODES.map((item) => {
            const selected = item.id === mode;
            return (
              <Pressable
                key={item.id}
                testID={`ai-mode-${item.id}`}
                style={({ pressed }) => [
                  styles.modeTab,
                  selected && styles.modeTabSelected,
                  pressed && styles.pressed,
                ]}
                onPress={() => chooseMode(item.id)}
                disabled={isGenerating}
                accessibilityRole="button"
                accessibilityState={{ selected, disabled: isGenerating }}
              >
                <HugeiconsIcon
                  icon={item.icon}
                  size={18}
                  color={selected ? colors.onPrimary : colors.textSecondary}
                />
                <Text style={[styles.modeTabText, selected && styles.modeTabTextSelected]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {mode === 'image' ? (
          <View style={styles.imageControls}>
            <View style={styles.segmentedControl}>
              {(['image', 'diagram'] as ImageGenerationMode[]).map((item) => {
                const selected = imageMode === item;
                return (
                  <TouchableOpacity
                    key={item}
                    style={[styles.segment, selected && styles.segmentSelected]}
                    onPress={() => setImageMode(item)}
                    disabled={isGenerating}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                  >
                    <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>
                      {item === 'image' ? 'Original image' : 'Study diagram'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.ratioRow}>
              {IMAGE_RATIOS.map((ratio) => {
                const selected = aspectRatio === ratio.value;
                return (
                  <TouchableOpacity
                    key={ratio.value}
                    style={[styles.ratioChip, selected && styles.ratioChipSelected]}
                    onPress={() => setAspectRatio(ratio.value)}
                    disabled={isGenerating}
                    accessibilityRole="button" accessibilityState={{ selected }} accessibilityLabel={`${ratio.label} ${ratio.value}`}
                  >
                    <Text style={[styles.ratioText, selected && styles.ratioTextSelected]}>
                      {ratio.label} · {ratio.value}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        {generatedImage && imageUri ? (
          <View style={styles.resultSection}>
            <View style={styles.resultHeader}>
              <View>
                <Text style={styles.resultEyebrow}>CREATED BY MOMO</Text>
                <Text style={styles.resultTitle}>
                  {generatedImage.mode === 'image' ? 'Your image' : 'Your study diagram'}
                </Text>
              </View>
              <TouchableOpacity style={styles.clearResultButton} accessibilityRole="button" accessibilityLabel="Clear generated image" onPress={() => setGeneratedImage(null)}>
                <Text style={styles.clearResultText}>Clear</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[styles.imageCard, { aspectRatio: resultRatio }]}
              onPress={() => setShowImagePreview(true)}
              activeOpacity={0.9}
              accessibilityRole="imagebutton"
              accessibilityLabel="Open generated image preview"
            >
              <Image source={{ uri: imageUri }} style={styles.generatedImage} resizeMode="contain" />
            </TouchableOpacity>
            <Text style={styles.resultHint}>Tap the image to view it full screen.</Text>
          </View>
        ) : (
          <View style={styles.suggestionSection}>
            <Text style={styles.suggestionHeading}>Choose a starting point</Text>
            <View style={styles.suggestionList}>
              <SuggestionRow
                icon="brain"
                testID="ai-suggestion-explain"
                title="Explain a difficult concept"
                detail="Get a clear answer grounded in your notes"
                onPress={() => useSuggestion('ask', 'Explain the hardest concept in my uploaded notes in simple terms.')}
              />
              <SuggestionRow
                icon="cards"
                testID="ai-suggestion-review"
                title="Build a focused reviewer"
                detail="Turn source material into active recall"
                onPress={() => useSuggestion('study', 'Make a concise reviewer for my next exam.')}
              />
              <SuggestionRow
                icon="camera"
                testID="ai-suggestion-solve"
                title="Solve a problem"
                detail="Scan or type a problem for step-by-step help"
                onPress={() => router.push('/math/solve')}
              />
              <SuggestionRow
                icon="book"
                testID="ai-suggestion-image"
                title="Generate an original image"
                detail="Make a visual for your study space"
                onPress={() => useSuggestion('image', 'A calm futuristic library designed for focused studying')}
              />
            </View>
          </View>
        )}

        {errorMessage ? (
          <View style={styles.errorBanner} accessibilityLiveRegion="polite">
            <Text style={styles.errorTitle}>Image generation unavailable</Text>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}
      </ScrollView>

      <View
        style={[
          styles.composerArea,
          { paddingBottom: Math.max(insets.bottom, spacing[12]) },
        ]}
      >
        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            testID="ai-prompt"
            value={prompt}
            onChangeText={setPrompt}
            placeholder={selectedMode.placeholder}
            placeholderTextColor={colors.textDisabled}
            multiline
            maxLength={1000}
            editable={!isGenerating}
            textAlignVertical="top"
            accessibilityLabel={selectedMode.placeholder}
          />
          <GlassButton
            testID="ai-submit"
            variant={canSubmit ? 'primary' : 'subtle'}
            size="icon"
            radius={20}
            haptic={canSubmit ? 'medium' : false}
            onPress={handleSubmit}
            disabled={!canSubmit}
            accessibilityLabel={mode === 'image' ? 'Generate image' : 'Continue with Momo AI'}
            contentStyle={styles.sendButtonContent}
          >
            {isGenerating ? (
              <ActivityIndicator size="small" color={colors.onPrimary} />
            ) : (
              <HugeiconsIcon
                icon={mode === 'image' ? SparklesIcon : SentIcon}
                size={18}
                color={canSubmit ? colors.onPrimary : colors.textDisabled}
              />
            )}
          </GlassButton>
        </View>
        <Text style={styles.composerNote}>
          {mode === 'image'
            ? imageMode === 'image'
              ? 'Creates a new AI-generated image from your description.'
              : 'Creates a structured educational diagram.'
            : 'Study answers stay grounded in the sources you choose in chat.'}
        </Text>
      </View>

      <ImageZoomModal
        visible={showImagePreview}
        onClose={() => setShowImagePreview(false)}
        imageBase64={generatedImage?.image_base64}
        title={generatedImage?.mode === 'image' ? 'Generated image' : 'Study diagram'}
        caption={prompt}
      />
    </KeyboardAvoidingView>
  );
}

function SuggestionRow({
  icon,
  title,
  detail,
  testID,
  onPress,
}: {
  icon: 'brain' | 'cards' | 'camera' | 'book';
  title: string;
  detail: string;
  testID: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.suggestionRow, pressed && styles.pressed]}
      onPress={onPress}
      testID={testID}
      accessibilityLabel={`${title}. ${detail}`}
      accessibilityRole="button"
    >
      <View style={styles.suggestionIcon}>
        <StudyIcon name={icon} size={48} />
      </View>
      <View style={styles.suggestionTextColumn}>
        <Text style={styles.suggestionTitle}>{title}</Text>
        <Text style={styles.suggestionDetail}>{detail}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    minHeight: 72,
    paddingHorizontal: spacing[16],
    paddingBottom: spacing[10],
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerButtonContent: { width: 44, height: 44 },
  headerIdentity: { flex: 1, flexDirection: 'row', alignItems: 'center', marginLeft: spacing[10] },
  avatarWrap: { width: 42, height: 42, marginRight: spacing[10], position: 'relative' },
  avatar: { width: 42, height: 42 },
  headerTitle: { fontSize: typography.fontSize[17], fontWeight: typography.fontWeight.bold, color: colors.text },
  headerSubtitle: { fontSize: typography.fontSize[11], color: colors.textSecondary, marginTop: spacing[1] },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    backgroundColor: colors.primarySoft,
    borderRadius: 12,
    paddingHorizontal: spacing[8],
    paddingVertical: spacing[5],
  },
  aiBadgeText: { fontSize: typography.fontSize[11], fontWeight: typography.fontWeight.bold, color: colors.primary },
  scroll: { flex: 1 },
  scrollContent: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: spacing[18] },
  intro: { padding: spacing[20], marginTop: spacing[24], marginBottom: spacing[20], backgroundColor: colors.primarySoft, borderRadius: 24, borderCurve: 'continuous', borderWidth: 1, borderColor: colors.primaryBorder },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroCopy: { flex: 1 },
  sourcePill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 16 },
  sourcePillText: { fontSize: 11, fontWeight: '600', color: colors.primary },
  eyebrow: {
    fontSize: typography.fontSize[11],
    fontWeight: typography.fontWeight.bold,
    letterSpacing: typography.letterSpacing[0.6],
    color: colors.primary,
    marginBottom: spacing[6],
  },
  heroTitle: { fontSize: typography.fontSize[24], fontWeight: typography.fontWeight.extraBold, color: colors.text, letterSpacing: -0.5 },
  heroSubtitle: { fontSize: typography.fontSize[14], lineHeight: 21, color: colors.textSecondary, marginTop: spacing[8] },
  modeTabs: { flexDirection: 'row', gap: spacing[8], marginBottom: spacing[16] },
  modeTab: {
    flex: 1,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[6],
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
  },
  modeTabSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  modeTabText: { fontSize: typography.fontSize[13], fontWeight: typography.fontWeight.semiBold, color: colors.textSecondary },
  modeTabTextSelected: { color: colors.onPrimary },
  pressed: { opacity: 0.7 },
  imageControls: { gap: spacing[12], marginBottom: spacing[20] },
  segmentedControl: { flexDirection: 'row', backgroundColor: colors.surfaceMuted, borderRadius: 12, padding: spacing[4] },
  segment: { minHeight: 44, justifyContent: 'center', flex: 1, alignItems: 'center', paddingVertical: spacing[8], borderRadius: 9 },
  segmentSelected: { backgroundColor: colors.surface },
  segmentText: { fontSize: typography.fontSize[12], fontWeight: typography.fontWeight.semiBold, color: colors.textMuted },
  segmentTextSelected: { color: colors.text },
  ratioRow: { gap: spacing[8] },
  ratioChip: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing[12], paddingVertical: spacing[7], borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  ratioChipSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  ratioText: { fontSize: typography.fontSize[11], color: colors.textSecondary },
  ratioTextSelected: { color: colors.primary, fontWeight: typography.fontWeight.semiBold },
  suggestionSection: { marginTop: spacing[8] },
  suggestionHeading: { fontSize: typography.fontSize[14], fontWeight: typography.fontWeight.bold, color: colors.text, marginBottom: spacing[10] },
  suggestionList: { gap: spacing[10] },
  suggestionRow: { backgroundColor: colors.surface, borderRadius: 20, borderCurve: 'continuous', borderWidth: 1, borderColor: colors.border, minHeight: 92, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing[16], paddingVertical: spacing[12], },
  suggestionIcon: { width: 52, height: 52, borderRadius: 16, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginRight: spacing[12] },
  suggestionTextColumn: { flex: 1 },
  suggestionTitle: { fontSize: typography.fontSize[14], fontWeight: typography.fontWeight.semiBold, color: colors.text },
  suggestionDetail: { fontSize: typography.fontSize[12], lineHeight: 17, color: colors.textSecondary, marginTop: spacing[2] },
  resultSection: { marginTop: spacing[8] },
  resultHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing[12] },
  resultEyebrow: { fontSize: typography.fontSize[10], fontWeight: typography.fontWeight.bold, color: colors.primary, letterSpacing: typography.letterSpacing[0.6] },
  resultTitle: { fontSize: typography.fontSize[20], fontWeight: typography.fontWeight.bold, color: colors.text, marginTop: spacing[2] },
  clearResultButton: { minHeight: 44, minWidth: 44, justifyContent: 'center' },
  clearResultText: { fontSize: typography.fontSize[13], fontWeight: typography.fontWeight.semiBold, color: colors.primary },
  imageCard: { width: '100%', aspectRatio: 1, borderRadius: 18, overflow: 'hidden', backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border },
  generatedImage: { width: '100%', height: '100%' },
  resultHint: { fontSize: typography.fontSize[11], color: colors.textMuted, textAlign: 'center', marginTop: spacing[8] },
  errorBanner: { marginTop: spacing[16], padding: spacing[14], backgroundColor: colors.dangerSoft, borderWidth: 1, borderColor: colors.dangerBorder, borderRadius: 14 },
  errorTitle: { fontSize: typography.fontSize[13], fontWeight: typography.fontWeight.bold, color: colors.danger },
  errorText: { fontSize: typography.fontSize[12], lineHeight: 17, color: colors.danger, marginTop: spacing[3] },
  composerArea: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingHorizontal: spacing[16], paddingTop: spacing[10] },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing[8], backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, borderRadius: 22, paddingLeft: spacing[14], paddingRight: spacing[6], paddingVertical: spacing[6] },
  input: { flex: 1, minHeight: 40, maxHeight: 110, paddingTop: spacing[9], paddingBottom: spacing[8], fontSize: typography.fontSize[14], color: colors.text },
  sendButtonContent: { width: 40, height: 40 },
  composerNote: { fontSize: typography.fontSize[10], color: colors.textMuted, textAlign: 'center', marginTop: spacing[6] },
});
