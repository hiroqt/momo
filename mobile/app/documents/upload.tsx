import { MomoAnimation } from '@/components/mascot/MomoAnimation';
import React, { useState, useRef, useEffect } from 'react';
import { colors, spacing, typography } from '@/constants/theme';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  Image,
  Animated,
  Easing,
} from 'react-native';
import { AppText as Text } from '@/components/common/app-text';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  Upload01Icon,
  File01Icon,
  CheckmarkCircle02Icon,
  SparklesIcon,
  Delete02Icon,
  Shield01Icon,
  BookOpen01Icon,
  Book02Icon,
  Search01Icon,
  Clock01Icon,
  AlertCircleIcon,
  ArrowRight01Icon,
} from '@hugeicons/core-free-icons';
import {
  requestUploadUrl,
  uploadFileToS3,
  registerDocument,
  getDocumentStatus,
} from '../../lib/api/documents';
import { PageHeader } from '../../components/common/PageHeader';
import { PlatformPressable } from '../../components/common/PlatformPressable';
import { SmoothScrollView } from '../../components/common/SmoothScrollView';
import { getRandomStudyQuote, StudyQuote } from '../../lib/data/studyQuotes';
import { isIpad } from '../../utils/device';

interface FormatConfig {
  ext: string;
  name: string;
  badgeBg: string;
  badgeBorder: string;
  textColor: string;
  accentColor: string;
  description: string;
}

const SUPPORTED_FORMATS: FormatConfig[] = [
  {
    ext: 'pdf',
    name: 'PDF',
    badgeBg: colors.dangerSoft,
    badgeBorder: colors.dangerBorder,
    textColor: colors.danger,
    accentColor: colors.dangerAccent,
    description: 'Slides, books & handouts',
  },
  {
    ext: 'docx',
    name: 'DOCX',
    badgeBg: colors.infoSoft,
    badgeBorder: colors.infoBorder,
    textColor: colors.info,
    accentColor: colors.infoAccent,
    description: 'Word docs, essays & notes',
  },
  {
    ext: 'pptx',
    name: 'PPTX',
    badgeBg: colors.warningSoft,
    badgeBorder: colors.warningBorder,
    textColor: colors.warning,
    accentColor: colors.warningAccent,
    description: 'Presentations & slide decks',
  },
  {
    ext: 'txt',
    name: 'TXT',
    badgeBg: colors.surfaceMuted,
    badgeBorder: colors.borderStrong,
    textColor: colors.textSecondary,
    accentColor: colors.textMuted,
    description: 'Text notes & summaries',
  },
];

const PROCESSING_STAGES = [
  { id: 1, title: 'Uploading Notes', description: 'Sending your document safely to create your deck', threshold: 25 },
  { id: 2, title: 'Reading Pages', description: 'Finding sections, slides, and chapters', threshold: 50 },
  { id: 3, title: 'Finding Study Topics', description: 'Discovering key concepts and practice topics', threshold: 80 },
  { id: 4, title: 'Ready to Customize', description: 'Opening your reviewer builder', threshold: 100 },
];

export default function UploadScreen() {
  const router = useRouter();
  const { mode } = useLocalSearchParams<{ mode?: 'reviewer' | 'quiz' }>();
  const insets = useSafeAreaInsets();
  const isQuizMode = mode === 'quiz';
  const isReviewerMode = mode === 'reviewer';

  const [selectedFiles, setSelectedFiles] = useState<DocumentPicker.DocumentPickerAsset[]>([]);
  const selectedFile = selectedFiles[0] || null;
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [currentStageIdx, setCurrentStageIdx] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeQuote, setActiveQuote] = useState<StudyQuote>(() => getRandomStudyQuote());

  // Animations
  const progressAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  // Pulse animation when idle/ready
  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.04,
          duration: 1400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    pulseLoop.start();
    return () => pulseLoop.stop();
  }, [pulseAnim]);

  // Rotate study quotes during processing
  useEffect(() => {
    if (!isProcessing) return;
    const interval = setInterval(() => {
      setActiveQuote(getRandomStudyQuote());
    }, 4500);
    return () => clearInterval(interval);
  }, [isProcessing]);

  const getFileExtension = (name: string): string => {
    const ext = name.split('.').pop()?.toLowerCase() || 'pdf';
    return ext;
  };

  const getFormatDetails = (ext: string): FormatConfig => {
    const found = SUPPORTED_FORMATS.find((f) => f.ext === ext);
    return (
      found || {
        ext,
        name: ext.toUpperCase(),
        badgeBg: colors.primarySoft,
        badgeBorder: colors.primaryBorder,
        textColor: colors.primary,
        accentColor: colors.primaryLight,
        description: 'Document file',
      }
    );
  };

  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return 'Unknown size';
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const totalSizeBytes = selectedFiles.reduce((acc, f) => acc + (f.size || 0), 0);
  const MAX_TOTAL_BYTES = 15 * 1024 * 1024;
  const remainingBytes = Math.max(0, MAX_TOTAL_BYTES - totalSizeBytes);

  const handlePickDocument = async () => {
    try {
      setErrorMsg(null);
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          'text/plain',
        ],
        copyToCacheDirectory: true,
        multiple: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const incoming = result.assets;
        const incomingTotal = incoming.reduce((acc, f) => acc + (f.size || 0), 0);
        if (totalSizeBytes + incomingTotal > MAX_TOTAL_BYTES) {
          Alert.alert(
            'Maximum Size Exceeded',
            `Combined file size cannot exceed 15MB. You have ${formatFileSize(remainingBytes)} remaining.`
          );
          return;
        }
        // Avoid duplicate files by name
        setSelectedFiles((prev) => {
          const existingNames = new Set(prev.map((f) => f.name));
          const fresh = incoming.filter((f) => !existingNames.has(f.name));
          return [...prev, ...fresh];
        });
      }
    } catch (err: any) {
      Alert.alert('Unable to Open File', 'Please try choosing a document again: ' + err.message);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFiles([]);
    setErrorMsg(null);
  };

  const handleRemoveFileAt = (idx: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateProgress = (val: number, stageIdx: number, message: string) => {
    setCurrentStageIdx(stageIdx);
    setStatusMessage(message);
    Animated.timing(progressAnim, {
      toValue: val,
      duration: 400,
      useNativeDriver: false,
    }).start();
  };

  const handleUploadAndProcess = async (targetMode: 'reviewer' | 'quiz' = 'reviewer') => {
    if (selectedFiles.length === 0) return;

    setIsProcessing(true);
    setErrorMsg(null);
    progressAnim.setValue(5);
    updateProgress(
      15,
      0,
      targetMode === 'quiz' ? 'Getting ready to generate quiz...' : 'Getting ready to generate reviewer...'
    );

    try {
      const uploadedDocIds: string[] = [];

      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const stepProgress = 15 + Math.floor(((i + 1) / selectedFiles.length) * 35);
        updateProgress(
          stepProgress,
          0,
          selectedFiles.length > 1
            ? `Uploading document ${i + 1} of ${selectedFiles.length}: ${file.name}...`
            : 'Uploading your notes...'
        );

        const ext = getFileExtension(file.name);
        const uploadData = await requestUploadUrl({
          filename: file.name,
          file_type: ext,
          file_size: file.size || 1024,
          mime_type: file.mimeType || 'application/pdf',
        });

        try {
          await uploadFileToS3(
            uploadData.upload_url,
            file.uri,
            file.mimeType || 'application/pdf'
          );
        } catch (uploadErr) {
          console.warn('Storage upload note:', uploadErr);
        }

        await registerDocument({
          document_id: uploadData.document_id,
          original_filename: file.name,
          file_type: ext,
          mime_type: file.mimeType || 'application/pdf',
          file_size: file.size || 1024,
          s3_object_key: uploadData.s3_object_key,
        });

        uploadedDocIds.push(uploadData.document_id);
      }

      // Poll document status until all documents are ready
      updateProgress(65, 1, 'Reading pages and chapters...');
      for (const dId of uploadedDocIds) {
        let isReady = false;
        for (let i = 0; i < 25; i++) {
          await new Promise((r) => setTimeout(r, 1200));
          const st = await getDocumentStatus(dId);
          if (st.stage) {
            const friendlyStage = st.stage.toLowerCase().includes('topic')
              ? 'Finding key study topics...'
              : st.stage.toLowerCase().includes('chunk') || st.stage.toLowerCase().includes('extract')
              ? 'Reading pages & chapters...'
              : st.stage;
            setStatusMessage(friendlyStage);
          }
          if (st.progress) {
            Animated.timing(progressAnim, {
              toValue: Math.max(65, Math.min(95, st.progress)),
              duration: 300,
              useNativeDriver: false,
            }).start();
          }
          if (st.status === 'READY') {
            isReady = true;
            break;
          }
          if (st.status === 'FAILED') {
            throw new Error('We could not read one of your documents. Please check file format.');
          }
        }
      }

      updateProgress(
        100,
        3,
        mode === 'quiz' ? 'Opening Quiz Builder...' : 'Opening Reviewer Builder...'
      );
      await new Promise((r) => setTimeout(r, 400));

      // Navigate to Configuration with primary ID, secondary IDs, and mode
      const primaryDocId = uploadedDocIds[0];
      const otherDocIds = uploadedDocIds.slice(1).join(',');
      router.replace({
        pathname: `/create/${primaryDocId}`,
        params: {
          ...(otherDocIds ? { otherDocIds } : {}),
          mode: mode || 'reviewer',
        },
      });
    } catch (err: any) {
      setErrorMsg(err.message || 'Something went wrong while preparing your files. Please try again.');
      setIsProcessing(false);
    }
  };

  const fileExt = selectedFile ? getFileExtension(selectedFile.name) : 'pdf';
  const formatConfig = getFormatDetails(fileExt);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.screen}>
      <PageHeader
        title={
          isQuizMode
            ? 'Upload for Quiz'
            : isReviewerMode
            ? 'Upload for Reviewer'
            : 'Upload Material'
        }
        subtitle={
          isQuizMode
            ? 'Turn your notes into practice questions & flashcards'
            : isReviewerMode
            ? 'Turn your notes into study summaries & cheat sheets'
            : 'Turn your notes & slides into study decks'
        }
        isModal={true}
        onBack={() => router.back()}
      />

      <SmoothScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, spacing[24]) + spacing[20] },
        ]}
      >
        {isProcessing ? (
          /* =========================================================================
             PROCESSING STATE: Animated Multi-Stage Progress View
             ========================================================================= */
          <View style={styles.processingCard}>
            {/* Animated Momo Illustration */}
            <View style={styles.processingMascotContainer}>
              <MomoAnimation name="momo-reading" style={styles.processingMascotImage} />
            </View>

            <Text style={styles.processingTitle}>Preparing Your Material</Text>
            <Text style={styles.processingSubtitle}>
              Momo is reading your notes and finding key topics for your study deck...
            </Text>

            {/* Smooth Animated Progress Bar */}
            <View style={styles.progressBarContainer}>
              <Animated.View style={[styles.progressBarFill, { width: progressWidth }]} />
            </View>

            <View style={styles.currentStatusBadge}>
              <MomoAnimation name={currentStageIdx === 0 ? 'document-upload' : currentStageIdx === 1 ? 'document-scan' : 'book-loading'} size={40} replayKey={currentStageIdx} />
              <Text style={styles.currentStatusText}>{statusMessage || 'Preparing your study set...'}</Text>
            </View>

            {/* Step Progression Checklist */}
            <View style={styles.stepsChecklist}>
              {PROCESSING_STAGES.map((stg, idx) => {
                const isCompleted = currentStageIdx > idx;
                const isCurrent = currentStageIdx === idx;

                return (
                  <View key={stg.id} style={styles.stepItemRow}>
                    <View
                      style={[
                        styles.stepIndicatorCircle,
                        isCompleted && styles.stepIndicatorCircleCompleted,
                        isCurrent && styles.stepIndicatorCircleCurrent,
                      ]}
                    >
                      {isCompleted ? (
                        <HugeiconsIcon icon={CheckmarkCircle02Icon} size={16} color={colors.onPrimary} strokeWidth={2.4} />
                      ) : isCurrent ? (
                        <ActivityIndicator size="small" color={colors.onPrimary} />
                      ) : (
                        <Text style={styles.stepNumberText}>{stg.id}</Text>
                      )}
                    </View>
                    <View style={styles.stepContentCol}>
                      <Text
                        style={[
                          styles.stepItemTitle,
                          isCompleted && styles.stepItemTitleCompleted,
                          isCurrent && styles.stepItemTitleCurrent,
                        ]}
                      >
                        {stg.title}
                      </Text>
                      <Text style={styles.stepItemDescription}>{stg.description}</Text>
                    </View>
                  </View>
                );
              })}
            </View>

            {/* Rotating Study Tip / Motivation */}
            <View style={styles.studyTipBox}>
              <View style={styles.studyTipHeader}>
                <HugeiconsIcon icon={SparklesIcon} size={15} color={colors.primary} strokeWidth={2.2} />
                <Text style={styles.studyTipLabel}>STUDY TIP</Text>
              </View>
              <Text style={styles.studyTipQuote}>"{activeQuote.quote}"</Text>
              <Text style={styles.studyTipAuthor}>— {activeQuote.author}</Text>
            </View>
          </View>
        ) : (
          /* =========================================================================
             IDLE / SELECTION STATE: Dropzone, File Preview, Format Cards & Highlights
             ========================================================================= */
          <View style={styles.contentWrapper}>
            {/* Format Selector / Pills Row */}
            <View style={styles.formatSection}>
              <Text style={styles.sectionLabel}>SUPPORTED FORMATS</Text>
              <View style={styles.formatCardsRow}>
                {SUPPORTED_FORMATS.map((fmt) => (
                  <TouchableOpacity
                    key={fmt.ext}
                    style={[
                      styles.formatMiniCard,
                      { backgroundColor: fmt.badgeBg, borderColor: fmt.badgeBorder },
                      selectedFile && fileExt === fmt.ext && styles.formatMiniCardActive,
                    ]}
                    onPress={handlePickDocument}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.formatMiniCardTitle, { color: fmt.textColor }]}>
                      {fmt.name}
                    </Text>
                    <Text style={styles.formatMiniCardSub}>{fmt.ext.toUpperCase()}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Error banner if any */}
            {errorMsg && (
              <View style={styles.errorAlertBox}>
                <HugeiconsIcon icon={AlertCircleIcon} size={18} color={colors.danger} strokeWidth={2.2} />
                <View style={styles.errorAlertContent}>
                  <Text style={styles.errorAlertTitle}>Could Not Open File</Text>
                  <Text style={styles.errorAlertMessage}>{errorMsg}</Text>
                </View>
              </View>
            )}

            {/* Document Dropzone or Selected File Preview */}
            {!selectedFile ? (
              <TouchableOpacity
                style={styles.dropzone}
                onPress={handlePickDocument}
                activeOpacity={0.8}
              >
                <Animated.View
                  style={[
                    styles.dropzoneIconHalo,
                    { transform: [{ scale: pulseAnim }] },
                  ]}
                >
                  <View style={styles.dropzoneIconInner}>
                    <HugeiconsIcon icon={Upload01Icon} size={isPadDevice ? 52 : 36} color={colors.primary} strokeWidth={2} />
                  </View>
                </Animated.View>

                <Text style={styles.dropzoneHeading}>Select your study material</Text>
                <Text style={styles.dropzoneSubheading}>
                  Tap to browse PDF, Word, PPTX, or text notes
                </Text>

                <View style={styles.constraintsBadge}>
                  <HugeiconsIcon icon={Clock01Icon} size={isPadDevice ? 16 : 13} color={colors.textMuted} strokeWidth={2} />
                  <Text style={styles.constraintsText}>Up to 15MB • Max 50 pages</Text>
                </View>

                <View style={styles.browseButtonTrigger}>
                  <HugeiconsIcon icon={BookOpen01Icon} size={isPadDevice ? 20 : 16} color={colors.primary} strokeWidth={2} />
                  <Text style={styles.browseButtonText}>Browse Files</Text>
                </View>
              </TouchableOpacity>
            ) : (
              /* Selected Files List */
              <View style={styles.selectedFileContainer}>
                <View style={styles.selectedFileHeader}>
                  <Text style={styles.sectionLabel}>
                    SELECTED DOCUMENTS ({selectedFiles.length})
                  </Text>
                  <TouchableOpacity
                    onPress={handleRemoveFile}
                    style={styles.removeFileBtn}
                    activeOpacity={0.7}
                  >
                    <HugeiconsIcon icon={Delete02Icon} size={15} color={colors.danger} strokeWidth={2} />
                    <Text style={styles.removeFileText}>Clear all</Text>
                  </TouchableOpacity>
                </View>

                {/* List of picked files */}
                {selectedFiles.map((file, idx) => {
                  const ext = getFileExtension(file.name);
                  const fConf = getFormatDetails(ext);
                  return (
                    <View key={`${file.name}-${idx}`} style={[styles.fileCard, { marginBottom: 8 }]}>
                      <View
                        style={[
                          styles.fileBadgeIconBox,
                          { backgroundColor: fConf.badgeBg, borderColor: fConf.badgeBorder },
                        ]}
                      >
                        <HugeiconsIcon icon={File01Icon} size={24} color={fConf.textColor} strokeWidth={2} />
                        <View style={[styles.fileExtTag, { backgroundColor: fConf.textColor }]}>
                          <Text style={styles.fileExtTagText}>{fConf.name}</Text>
                        </View>
                      </View>

                      <View style={styles.fileCardDetails}>
                        <Text style={styles.fileCardName} numberOfLines={1}>
                          {file.name}
                        </Text>
                        <View style={styles.fileCardMetaRow}>
                          <Text style={styles.fileCardSize}>{formatFileSize(file.size)}</Text>
                          <View style={styles.metaDot} />
                          <View style={styles.readyBadge}>
                            <HugeiconsIcon icon={CheckmarkCircle02Icon} size={12} color={colors.success} strokeWidth={2.5} />
                            <Text style={styles.readyBadgeText}>Included</Text>
                          </View>
                        </View>
                      </View>

                      <TouchableOpacity
                        onPress={() => handleRemoveFileAt(idx)}
                        style={{ padding: 6 }}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <HugeiconsIcon icon={Delete02Icon} size={16} color={colors.textMuted} strokeWidth={2} />
                      </TouchableOpacity>
                    </View>
                  );
                })}

                {/* Total Size & Add More Button */}
                <View style={{ marginTop: 4, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 12, color: colors.textSecondary, fontFamily: typography.fontFamily.medium }}>
                    Total: {formatFileSize(totalSizeBytes)} / 15 MB
                  </Text>
                  {remainingBytes > 100 * 1024 && (
                    <TouchableOpacity
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                      onPress={handlePickDocument}
                      activeOpacity={0.7}
                    >
                      <Text style={{ fontSize: 13, color: colors.primary, fontFamily: typography.fontFamily.semiBold }}>
                        + Add another file
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}

            {/* Dedicated Action Button based on Mode */}
            {selectedFiles.length > 0 && (
              <View style={styles.actionButtonsContainer}>
                {isReviewerMode ? (
                  /* Dedicated Reviewer Button */
                  <PlatformPressable
                    style={styles.reviewerActionButton}
                    onPress={() => handleUploadAndProcess('reviewer')}
                    accessibilityRole="button"
                    accessibilityLabel="Continue to Reviewer Options"
                  >
                    <View style={styles.actionButtonContent}>
                      <View style={styles.actionButtonIconBadgeReviewer}>
                        <HugeiconsIcon icon={Book02Icon} size={22} color="#FFFFFF" strokeWidth={2.4} />
                      </View>
                      <View style={styles.actionButtonTextCol}>
                        <Text style={styles.actionButtonTitle}>Continue to Reviewer Options</Text>
                        <Text style={styles.actionButtonSubtitle}>
                          Next: Choose topic focus, content level & study formats
                        </Text>
                      </View>
                      <HugeiconsIcon icon={ArrowRight01Icon} size={18} color="#FFFFFF" strokeWidth={2.4} />
                    </View>
                  </PlatformPressable>
                ) : isQuizMode ? (
                  /* Dedicated Quiz Button */
                  <PlatformPressable
                    style={styles.reviewerActionButton}
                    onPress={() => handleUploadAndProcess('quiz')}
                    accessibilityRole="button"
                    accessibilityLabel="Continue to Quiz Options"
                  >
                    <View style={styles.actionButtonContent}>
                      <View style={styles.actionButtonIconBadgeReviewer}>
                        <HugeiconsIcon icon={CheckmarkCircle02Icon} size={22} color="#FFFFFF" strokeWidth={2.4} />
                      </View>
                      <View style={styles.actionButtonTextCol}>
                        <Text style={styles.actionButtonTitle}>Continue to Quiz Options</Text>
                        <Text style={styles.actionButtonSubtitle}>
                          Next: Choose topic, question count, difficulty & timer
                        </Text>
                      </View>
                      <HugeiconsIcon icon={ArrowRight01Icon} size={18} color="#FFFFFF" strokeWidth={2.4} />
                    </View>
                  </PlatformPressable>
                ) : (
                  /* Both Options when general upload */
                  <>
                    <PlatformPressable
                      style={styles.reviewerActionButton}
                      onPress={() => handleUploadAndProcess('reviewer')}
                      accessibilityRole="button"
                      accessibilityLabel="Generate Reviewer"
                    >
                      <View style={styles.actionButtonContent}>
                        <View style={styles.actionButtonIconBadgeReviewer}>
                          <HugeiconsIcon icon={Book02Icon} size={22} color="#FFFFFF" strokeWidth={2.4} />
                        </View>
                        <View style={styles.actionButtonTextCol}>
                          <Text style={styles.actionButtonTitle}>Generate Reviewer</Text>
                          <Text style={styles.actionButtonSubtitle}>
                            Summaries, key terms, outlines & cheat sheets
                          </Text>
                        </View>
                        <HugeiconsIcon icon={ArrowRight01Icon} size={18} color="#FFFFFF" strokeWidth={2.4} />
                      </View>
                    </PlatformPressable>

                    <PlatformPressable
                      style={styles.quizActionButton}
                      onPress={() => handleUploadAndProcess('quiz')}
                      accessibilityRole="button"
                      accessibilityLabel="Generate Quiz"
                    >
                      <View style={styles.actionButtonContent}>
                        <View style={styles.actionButtonIconBadgeQuiz}>
                          <HugeiconsIcon icon={CheckmarkCircle02Icon} size={22} color={colors.primary} strokeWidth={2.4} />
                        </View>
                        <View style={styles.actionButtonTextCol}>
                          <Text style={[styles.actionButtonTitle, { color: colors.text }]}>Generate Quiz</Text>
                          <Text style={styles.actionButtonSubtitleQuiz}>
                            Practice questions, flashcards & active recall
                          </Text>
                        </View>
                        <HugeiconsIcon icon={ArrowRight01Icon} size={18} color={colors.primary} strokeWidth={2.4} />
                      </View>
                    </PlatformPressable>
                  </>
                )}
              </View>
            )}

            {/* Trust, Security & Grounding Highlights Card */}
            <View style={styles.featuresCard}>
              <View style={styles.featureRow}>
                <View style={styles.featureIconCircle}>
                  <HugeiconsIcon icon={Shield01Icon} size={18} color={colors.primary} strokeWidth={2} />
                </View>
                <View style={styles.featureTextContent}>
                  <Text style={styles.featureTitle}>Temporary File Storage</Text>
                  <Text style={styles.featureDescription}>
                    Your original document is removed automatically after 3 days. All study sets and flashcards you create stay in your library forever.
                  </Text>
                </View>
              </View>

              <View style={styles.featureDivider} />

              <View style={styles.featureRow}>
                <View style={styles.featureIconCircle}>
                  <HugeiconsIcon icon={CheckmarkCircle02Icon} size={18} color={colors.success} strokeWidth={2} />
                </View>
                <View style={styles.featureTextContent}>
                  <Text style={styles.featureTitle}>Strictly From Your Notes</Text>
                  <Text style={styles.featureDescription}>
                    Every question and flashcard is created directly from your document content—so you only review what is in your course material.
                  </Text>
                </View>
              </View>

              <View style={styles.featureDivider} />

              <View style={styles.featureRow}>
                <View style={styles.featureIconCircle}>
                  <HugeiconsIcon icon={Search01Icon} size={18} color={colors.warning} strokeWidth={2} />
                </View>
                <View style={styles.featureTextContent}>
                  <Text style={styles.featureTitle}>Automatic Topic Discovery</Text>
                  <Text style={styles.featureDescription}>
                    Momo reads your document and discovers the main chapters and topics so you can pick exactly what to study.
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}
      </SmoothScrollView>
    </View>
  );
}

const isPadDevice = isIpad();

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: isPadDevice ? spacing[36] : spacing[20],
    paddingTop: isPadDevice ? spacing[20] : spacing[12],
    maxWidth: isPadDevice ? 860 : undefined,
    width: isPadDevice ? '100%' : undefined,
    alignSelf: isPadDevice ? 'center' : undefined,
  },
  contentWrapper: {
    width: '100%',
    gap: spacing[20],
  },
  sectionLabel: {
    fontSize: isPadDevice ? typography.fontSize[13] : typography.fontSize[11],
    fontWeight: typography.fontWeight.bold,
    color: colors.textMuted,
    letterSpacing: typography.letterSpacing[0.6],
    marginBottom: spacing[10],
  },

  /* Format Cards */
  formatSection: {
    width: '100%',
  },
  formatCardsRow: {
    flexDirection: 'row',
    gap: isPadDevice ? spacing[12] : spacing[8],
  },
  formatMiniCard: {
    flex: 1,
    paddingVertical: isPadDevice ? spacing[16] : spacing[10],
    paddingHorizontal: isPadDevice ? spacing[12] : spacing[8],
    borderRadius: isPadDevice ? 16 : 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formatMiniCardActive: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  formatMiniCardTitle: {
    fontSize: isPadDevice ? typography.fontSize[16] : typography.fontSize[13],
    fontWeight: typography.fontWeight.bold,
  },
  formatMiniCardSub: {
    fontSize: isPadDevice ? typography.fontSize[12] : typography.fontSize[10],
    fontWeight: typography.fontWeight.semiBold,
    color: colors.textMuted,
    marginTop: spacing[2],
  },

  /* Dropzone */
  dropzone: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    borderStyle: 'dashed',
    borderRadius: isPadDevice ? 28 : 22,
    padding: isPadDevice ? spacing[40] : spacing[28],
    minHeight: isPadDevice ? 280 : undefined,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
      },
      android: {
        elevation: 1.5,
      },
    }),
  },
  dropzoneIconHalo: {
    width: isPadDevice ? 96 : 76,
    height: isPadDevice ? 96 : 76,
    borderRadius: isPadDevice ? 48 : 38,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: isPadDevice ? spacing[20] : spacing[16],
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  dropzoneIconInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropzoneHeading: {
    fontSize: isPadDevice ? typography.fontSize[24] : typography.fontSize[17],
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
    textAlign: 'center',
  },
  dropzoneSubheading: {
    fontSize: isPadDevice ? typography.fontSize[16] : typography.fontSize[13.5],
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing[4],
  },
  constraintsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[6],
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: isPadDevice ? spacing[16] : spacing[12],
    paddingVertical: isPadDevice ? spacing[8] : spacing[6],
    borderRadius: 20,
    marginTop: isPadDevice ? spacing[18] : spacing[14],
  },
  constraintsText: {
    fontSize: isPadDevice ? typography.fontSize[14] : typography.fontSize[12],
    fontWeight: typography.fontWeight.medium,
    color: colors.textMuted,
  },
  browseButtonTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[6],
    backgroundColor: colors.primarySoft,
    paddingHorizontal: isPadDevice ? spacing[24] : spacing[18],
    paddingVertical: isPadDevice ? spacing[14] : spacing[10],
    borderRadius: isPadDevice ? 16 : 12,
    marginTop: isPadDevice ? spacing[20] : spacing[16],
  },
  browseButtonText: {
    fontSize: isPadDevice ? typography.fontSize[16] : typography.fontSize[14],
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
  },

  /* Selected File Card */
  selectedFileContainer: {
    width: '100%',
  },
  selectedFileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[8],
  },
  removeFileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    paddingHorizontal: spacing[8],
    paddingVertical: spacing[4],
  },
  removeFileText: {
    fontSize: typography.fontSize[12],
    fontWeight: typography.fontWeight.semiBold,
    color: colors.danger,
  },
  fileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: spacing[16],
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    gap: spacing[14],
    ...Platform.select({
      ios: {
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  fileBadgeIconBox: {
    width: 60,
    height: 60,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  fileExtTag: {
    position: 'absolute',
    bottom: -6,
    paddingHorizontal: spacing[6],
    paddingVertical: 1,
    borderRadius: 5,
  },
  fileExtTagText: {
    fontSize: typography.fontSize[9.5],
    fontWeight: typography.fontWeight.bold,
    color: colors.onPrimary,
  },
  fileCardDetails: {
    flex: 1,
  },
  fileCardName: {
    fontSize: typography.fontSize[15],
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
    lineHeight: typography.lineHeight[20],
  },
  fileCardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing[6],
    gap: spacing[8],
  },
  fileCardSize: {
    fontSize: typography.fontSize[12.5],
    fontWeight: typography.fontWeight.semiBold,
    color: colors.textMuted,
  },
  metaDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
  },
  readyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    backgroundColor: colors.successSoft,
    paddingHorizontal: spacing[8],
    paddingVertical: spacing[2],
    borderRadius: 6,
  },
  readyBadgeText: {
    fontSize: typography.fontSize[11],
    fontWeight: typography.fontWeight.bold,
    color: colors.success,
  },
  changeFileButton: {
    alignSelf: 'center',
    marginTop: spacing[10],
    paddingVertical: spacing[6],
    paddingHorizontal: spacing[12],
  },
  changeFileButtonText: {
    fontSize: typography.fontSize[13],
    fontWeight: typography.fontWeight.semiBold,
    color: colors.primary,
  },

  /* Primary Action CTA Buttons */
  actionButtonsContainer: {
    gap: spacing[12],
    marginVertical: spacing[4],
  },
  reviewerActionButton: {
    backgroundColor: colors.primary,
    borderRadius: isPadDevice ? 20 : 16,
    ...Platform.select({
      ios: {
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.32,
        shadowRadius: 10,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  quizActionButton: {
    backgroundColor: colors.surface,
    borderRadius: isPadDevice ? 20 : 16,
    borderWidth: 1.5,
    borderColor: colors.primaryBorder,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  actionButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: isPadDevice ? spacing[16] : spacing[14],
    paddingHorizontal: spacing[16],
    gap: spacing[12],
  },
  actionButtonIconBadgeReviewer: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonIconBadgeQuiz: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonTextCol: {
    flex: 1,
  },
  actionButtonTitle: {
    fontSize: isPadDevice ? typography.fontSize[17] : typography.fontSize[15],
    fontWeight: typography.fontWeight.bold,
    color: colors.onPrimary,
  },
  actionButtonSubtitle: {
    fontSize: isPadDevice ? typography.fontSize[13] : typography.fontSize[11.5],
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 2,
  },
  actionButtonSubtitleQuiz: {
    fontSize: isPadDevice ? typography.fontSize[13] : typography.fontSize[11.5],
    color: colors.textSecondary,
    marginTop: 2,
  },
  primaryActionButton: {
    backgroundColor: colors.primary,
    borderRadius: isPadDevice ? 20 : 16,
  },

  /* Features & Privacy Card */
  featuresCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: spacing[18],
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing[14],
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[12],
  },
  featureIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  featureTextContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: typography.fontSize[13.5],
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
  },
  featureDescription: {
    fontSize: typography.fontSize[12],
    color: colors.textSecondary,
    lineHeight: typography.lineHeight[17],
    marginTop: spacing[2],
  },
  featureDivider: {
    height: 1,
    backgroundColor: colors.border,
  },

  /* Error Alert */
  errorAlertBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.dangerSoft,
    borderColor: colors.dangerBorder,
    borderWidth: 1,
    borderRadius: 14,
    padding: spacing[14],
    gap: spacing[10],
  },
  errorAlertContent: {
    flex: 1,
  },
  errorAlertTitle: {
    fontSize: typography.fontSize[13.5],
    fontWeight: typography.fontWeight.bold,
    color: colors.danger,
  },
  errorAlertMessage: {
    fontSize: typography.fontSize[12],
    color: colors.danger,
    marginTop: spacing[2],
  },

  /* =========================================================================
     PROCESSING STATE STYLES
     ========================================================================= */
  processingCard: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: spacing[24],
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    ...Platform.select({
      ios: {
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  processingMascotContainer: {
    width: 140,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[12],
  },
  processingMascotImage: {
    width: 130,
    height: 130,
  },
  processingTitle: {
    fontSize: typography.fontSize[20],
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
    textAlign: 'center',
  },
  processingSubtitle: {
    fontSize: typography.fontSize[13.5],
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing[4],
    lineHeight: typography.lineHeight[20],
    paddingHorizontal: spacing[12],
  },
  progressBarContainer: {
    width: '100%',
    height: 8,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: spacing[20],
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  currentStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[8],
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing[14],
    paddingVertical: spacing[8],
    borderRadius: 20,
    marginTop: spacing[14],
    marginBottom: spacing[20],
  },
  currentStatusText: {
    fontSize: typography.fontSize[13],
    fontWeight: typography.fontWeight.semiBold,
    color: colors.primary,
  },
  stepsChecklist: {
    width: '100%',
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: spacing[16],
    gap: spacing[14],
    marginBottom: spacing[20],
  },
  stepItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[12],
  },
  stepIndicatorCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepIndicatorCircleCompleted: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  stepIndicatorCircleCurrent: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  stepNumberText: {
    fontSize: typography.fontSize[12],
    fontWeight: typography.fontWeight.bold,
    color: colors.textMuted,
  },
  stepContentCol: {
    flex: 1,
  },
  stepItemTitle: {
    fontSize: typography.fontSize[13.5],
    fontWeight: typography.fontWeight.semiBold,
    color: colors.textMuted,
  },
  stepItemTitleCompleted: {
    color: colors.text,
    fontWeight: typography.fontWeight.bold,
  },
  stepItemTitleCurrent: {
    color: colors.primary,
    fontWeight: typography.fontWeight.bold,
  },
  stepItemDescription: {
    fontSize: typography.fontSize[11.5],
    color: colors.textMuted,
    marginTop: 1,
  },
  studyTipBox: {
    width: '100%',
    backgroundColor: colors.primarySoft,
    borderRadius: 16,
    padding: spacing[16],
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  studyTipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[6],
    marginBottom: spacing[4],
  },
  studyTipLabel: {
    fontSize: typography.fontSize[10.5],
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
    letterSpacing: typography.letterSpacing[0.6],
  },
  studyTipQuote: {
    fontSize: typography.fontSize[13],
    fontStyle: 'italic',
    color: colors.text,
    lineHeight: typography.lineHeight[19],
  },
  studyTipAuthor: {
    fontSize: typography.fontSize[11],
    fontWeight: typography.fontWeight.semiBold,
    color: colors.primaryDark,
    marginTop: spacing[4],
    textAlign: 'right',
  },
});
