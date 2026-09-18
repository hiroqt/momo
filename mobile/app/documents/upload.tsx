import React, { useState } from 'react';
import { colors, spacing, typography } from '@/constants/theme';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  Platform,
} from 'react-native';
import { AppText as Text } from '@/components/common/app-text';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  Upload01Icon,
  File01Icon,
  CheckmarkCircle02Icon,
  SparklesIcon,
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

export default function UploadScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [selectedFile, setSelectedFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          'text/plain',
        ],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        // 15MB limit check (PRD Section 10)
        const maxBytes = 15 * 1024 * 1024;
        if (file.size && file.size > maxBytes) {
          Alert.alert('File Too Large', 'Please select a document under 15MB.');
          return;
        }
        setSelectedFile(file);
      }
    } catch (err: any) {
      Alert.alert('Error', 'Failed to pick document: ' + err.message);
    }
  };

  const handleUploadAndProcess = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setStatusMessage('Requesting secure upload...');

    try {
      const ext = selectedFile.name.split('.').pop() || 'pdf';
      const uploadData = await requestUploadUrl({
        filename: selectedFile.name,
        file_type: ext,
        file_size: selectedFile.size || 1024,
        mime_type: selectedFile.mimeType || 'application/pdf',
      });

      setStatusMessage('Uploading document bytes...');
      try {
        const fileResp = await fetch(selectedFile.uri);
        const fileBlob = await fileResp.blob();
        await uploadFileToS3(
          uploadData.upload_url,
          fileBlob,
          selectedFile.mimeType || 'application/pdf'
        );
      } catch (uploadErr) {
        console.warn('Storage upload note:', uploadErr);
      }

      setStatusMessage('Registering study document...');
      await registerDocument({
        document_id: uploadData.document_id,
        original_filename: selectedFile.name,
        file_type: ext,
        mime_type: selectedFile.mimeType || 'application/pdf',
        file_size: selectedFile.size || 1024,
        s3_object_key: uploadData.s3_object_key,
      });

      // Poll document status until ready
      setStatusMessage('Reading document and analyzing topics...');
      let isReady = false;
      for (let i = 0; i < 20; i++) {
        await new Promise((r) => setTimeout(r, 1200));
        const st = await getDocumentStatus(uploadData.document_id);
        setStatusMessage(st.stage || 'Processing document...');
        if (st.status === 'READY') {
          isReady = true;
          break;
        }
        if (st.status === 'FAILED') {
          throw new Error(st.error || 'Document processing failed.');
        }
      }

      // Navigate to Reviewer Configuration
      router.replace(`/create/${uploadData.document_id}`);
    } catch (err: any) {
      Alert.alert('Upload Failed', err.message);
      setIsProcessing(false);
    }
  };

  return (
    <View style={styles.screen}>
      <PageHeader
        title="Upload Material"
        subtitle="Up to 15MB • Max 50 pages"
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
        <View style={styles.cardWrapper}>
          {/* Format pills */}
          <View style={styles.formatPillsRow}>
            <View style={[styles.formatPill, styles.pdfPill]}>
              <Text style={[styles.formatPillText, styles.pdfPillText]}>PDF</Text>
            </View>
            <View style={[styles.formatPill, styles.docxPill]}>
              <Text style={[styles.formatPillText, styles.docxPillText]}>DOCX</Text>
            </View>
            <View style={[styles.formatPill, styles.pptxPill]}>
              <Text style={[styles.formatPillText, styles.pptxPillText]}>PPTX</Text>
            </View>
            <View style={[styles.formatPill, styles.txtPill]}>
              <Text style={[styles.formatPillText, styles.txtPillText]}>TXT</Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.dropzone, selectedFile && styles.dropzoneActive]}
            onPress={handlePickDocument}
            disabled={isProcessing}
            activeOpacity={0.7}
          >
            <View style={[styles.iconCircle, selectedFile && styles.iconCircleActive]}>
              <HugeiconsIcon
                icon={selectedFile ? File01Icon : Upload01Icon}
                size={34}
                color={selectedFile ? colors.success : colors.primary}
                strokeWidth={1.8}
              />
            </View>
            {selectedFile ? (
              <View style={styles.fileInfo}>
                <Text style={styles.fileName} numberOfLines={2}>
                  {selectedFile.name}
                </Text>
                <Text style={styles.fileSize}>
                  {selectedFile.size ? `${(selectedFile.size / 1024 / 1024).toFixed(2)} MB` : ''}
                </Text>
                <View style={styles.changeBadge}>
                  <Text style={styles.changeText}>Tap to choose a different file</Text>
                </View>
              </View>
            ) : (
              <View style={styles.fileInfo}>
                <Text style={styles.chooseText}>Choose a document</Text>
                <Text style={styles.chooseSubtext}>Tap to browse your device files</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Retention notice card */}
          <View style={styles.infoBanner}>
            <HugeiconsIcon icon={CheckmarkCircle02Icon} size={16} color={colors.success} strokeWidth={2} />
            <Text style={styles.infoBannerText}>
              Files are stored temporarily for 3 days and used to build your custom study material.
            </Text>
          </View>

          {isProcessing && (
            <View style={styles.processingBox}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.processingText}>{statusMessage}</Text>
            </View>
          )}

          {selectedFile && !isProcessing && (
            <PlatformPressable
              style={styles.uploadBtn}
              onPress={handleUploadAndProcess}
            >
              <View style={styles.uploadBtnContent}>
                <HugeiconsIcon icon={SparklesIcon} size={18} color={colors.onPrimary} strokeWidth={2.2} />
                <Text style={styles.uploadBtnText}>Upload & Analyze Material</Text>
              </View>
            </PlatformPressable>
          )}
        </View>
      </SmoothScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing[20],
    paddingTop: spacing[16],
  },
  cardWrapper: {
    width: '100%',
  },
  formatPillsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing[8],
    marginBottom: spacing[20],
  },
  formatPill: {
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[5],
    borderRadius: 8,
    borderWidth: 1,
  },
  formatPillText: {
    fontSize: typography.fontSize[12],
    fontWeight: typography.fontWeight.bold,
  },
  pdfPill: {
    backgroundColor: colors.dangerSoft,
    borderColor: colors.dangerBorder,
  },
  pdfPillText: {
    color: colors.danger,
    fontWeight: typography.fontWeight.bold,
    fontSize: typography.fontSize[12],
  },
  docxPill: {
    backgroundColor: colors.infoSoft,
    borderColor: colors.infoBorder,
  },
  docxPillText: {
    color: colors.info,
    fontWeight: typography.fontWeight.bold,
    fontSize: typography.fontSize[12],
  },
  pptxPill: {
    backgroundColor: colors.warningSoft,
    borderColor: colors.warningBorder,
  },
  pptxPillText: {
    color: colors.primary,
    fontWeight: typography.fontWeight.bold,
    fontSize: typography.fontSize[12],
  },
  txtPill: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
  },
  txtPillText: {
    color: colors.textSecondary,
    fontWeight: typography.fontWeight.bold,
    fontSize: typography.fontSize[12],
  },
  dropzone: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    borderStyle: 'dashed',
    borderRadius: 18,
    padding: spacing[28],
    alignItems: 'center',
    marginBottom: spacing[16],
    ...Platform.select({
      ios: {
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 6,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  dropzoneActive: {
    borderColor: colors.successAccent,
    backgroundColor: colors.successSoft,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[14],
  },
  iconCircleActive: {
    backgroundColor: colors.successSoft,
  },
  fileInfo: {
    alignItems: 'center',
    paddingHorizontal: spacing[8],
  },
  chooseText: {
    fontSize: typography.fontSize[16],
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
  },
  chooseSubtext: {
    fontSize: typography.fontSize[13],
    color: colors.textDisabled,
    marginTop: spacing[4],
  },
  fileName: {
    fontSize: typography.fontSize[15],
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
    textAlign: 'center',
  },
  fileSize: {
    fontSize: typography.fontSize[13],
    color: colors.textMuted,
    marginTop: spacing[4],
  },
  changeBadge: {
    marginTop: spacing[8],
    paddingHorizontal: spacing[10],
    paddingVertical: spacing[4],
    borderRadius: 6,
    backgroundColor: colors.primarySoft,
  },
  changeText: {
    fontSize: typography.fontSize[12],
    color: colors.primary,
    fontWeight: typography.fontWeight.semiBold,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.successSoft,
    padding: spacing[12],
    borderRadius: 12,
    marginBottom: spacing[20],
    gap: spacing[8],
    borderWidth: 1,
    borderColor: colors.successBorder,
  },
  infoBannerText: {
    fontSize: typography.fontSize[12],
    color: colors.success,
    flex: 1,
    lineHeight: typography.lineHeight[17],
  },
  uploadBtn: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    ...Platform.select({
      ios: {
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  uploadBtnContent: {
    paddingVertical: spacing[15],
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing[8],
  },
  uploadBtnText: {
    color: colors.onPrimary,
    fontSize: typography.fontSize[16],
    fontWeight: typography.fontWeight.bold,
    letterSpacing: typography.letterSpacing[-0.2],
  },
  processingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[10],
    padding: spacing[16],
    backgroundColor: colors.primarySoft,
    borderRadius: 14,
    marginBottom: spacing[16],
    borderWidth: 1,
    borderColor: colors.primarySoftStrong,
  },
  processingText: {
    fontSize: typography.fontSize[14],
    fontWeight: typography.fontWeight.semiBold,
    color: colors.primary,
    lineHeight: typography.lineHeight[20],
  },
});
