import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  Platform,
} from 'react-native';
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
          { paddingBottom: Math.max(insets.bottom, 24) + 20 },
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
                color={selectedFile ? '#059669' : '#4F46E5'}
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
            <HugeiconsIcon icon={CheckmarkCircle02Icon} size={16} color="#059669" strokeWidth={2} />
            <Text style={styles.infoBannerText}>
              Files are stored temporarily for 3 days and used to build your custom study material.
            </Text>
          </View>

          {isProcessing && (
            <View style={styles.processingBox}>
              <ActivityIndicator size="small" color="#4F46E5" />
              <Text style={styles.processingText}>{statusMessage}</Text>
            </View>
          )}

          {selectedFile && !isProcessing && (
            <PlatformPressable
              style={styles.uploadBtn}
              onPress={handleUploadAndProcess}
            >
              <View style={styles.uploadBtnContent}>
                <HugeiconsIcon icon={SparklesIcon} size={18} color="#FFFFFF" strokeWidth={2.2} />
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
    backgroundColor: '#F8FAFC',
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 16,
  },
  cardWrapper: {
    width: '100%',
  },
  formatPillsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 20,
  },
  formatPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  formatPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  pdfPill: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  pdfPillText: {
    color: '#DC2626',
    fontWeight: '700',
    fontSize: 12,
  },
  docxPill: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  docxPillText: {
    color: '#2563EB',
    fontWeight: '700',
    fontSize: 12,
  },
  pptxPill: {
    backgroundColor: '#FFF7ED',
    borderColor: '#FED7AA',
  },
  pptxPillText: {
    color: '#EA580C',
    fontWeight: '700',
    fontSize: 12,
  },
  txtPill: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
  },
  txtPillText: {
    color: '#475569',
    fontWeight: '700',
    fontSize: 12,
  },
  dropzone: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
    borderRadius: 18,
    padding: 28,
    alignItems: 'center',
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
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
    borderColor: '#10B981',
    backgroundColor: '#F0FDF4',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  iconCircleActive: {
    backgroundColor: '#ECFDF5',
  },
  fileInfo: {
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  chooseText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4F46E5',
  },
  chooseSubtext: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 4,
  },
  fileName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
  },
  fileSize: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
  },
  changeBadge: {
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#EEF2FF',
  },
  changeText: {
    fontSize: 12,
    color: '#4F46E5',
    fontWeight: '600',
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
    gap: 8,
    borderWidth: 1,
    borderColor: '#D1FAE5',
  },
  infoBannerText: {
    fontSize: 12,
    color: '#065F46',
    flex: 1,
    lineHeight: 17,
  },
  uploadBtn: {
    backgroundColor: '#4F46E5',
    borderRadius: 14,
    ...Platform.select({
      ios: {
        shadowColor: '#4F46E5',
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
    paddingVertical: 15,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  uploadBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  processingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 16,
    backgroundColor: '#EEF2FF',
    borderRadius: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E0E7FF',
  },
  processingText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4F46E5',
    lineHeight: 20,
  },
});
