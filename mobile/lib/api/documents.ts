import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { apiFetch, getBaseUrl, BASE_URL } from './client';
import { DocumentItem } from '../../types';

export interface UploadUrlResponse {
  upload_url: string;
  s3_object_key: string;
  document_id: string;
  expires_in_seconds: number;
}

export async function requestUploadUrl(params: {
  filename: string;
  file_type: string;
  file_size: number;
  mime_type: string;
}): Promise<UploadUrlResponse> {
  return apiFetch<UploadUrlResponse>('/api/documents/upload-url', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function uploadFileToS3(
  uploadUrl: string,
  fileData: Blob | string,
  mimeType: string
): Promise<void> {
  const currentBase = getBaseUrl();
  const targetUrl = uploadUrl.startsWith('http') ? uploadUrl : `${currentBase}${uploadUrl}`;

  // Direct native streaming upload for local file URI on iOS & Android (bypasses JS memory & base64 overhead)
  if (
    Platform.OS !== 'web' &&
    typeof fileData === 'string' &&
    (fileData.startsWith('file:') || fileData.startsWith('content:'))
  ) {
    try {
      const uploadRes = await FileSystem.uploadAsync(targetUrl, fileData, {
        httpMethod: 'PUT',
        headers: { 'Content-Type': mimeType },
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      });

      if (uploadRes.status >= 200 && uploadRes.status < 300) {
        return;
      }
      throw new Error(`Upload failed with server status ${uploadRes.status}`);
    } catch (fsErr: any) {
      console.warn('[uploadFileToS3] Native upload failed:', fsErr);
      throw new Error(fsErr.message || 'Failed to upload document from device storage.');
    }
  }

  // Fallback for Web (where fileData is a Blob or File object)
  let body: any = fileData;
  if (typeof fileData === 'string') {
    const resp = await fetch(fileData);
    body = await resp.blob();
  }

  const resp = await fetch(targetUrl, {
    method: 'PUT',
    headers: { 'Content-Type': mimeType },
    body,
  });
  if (!resp.ok) {
    throw new Error(`Failed to upload document to storage: ${resp.statusText}`);
  }
}

export const uploadDocumentToStorage = uploadFileToS3;

export async function registerDocument(params: {
  document_id: string;
  original_filename: string;
  file_type: string;
  mime_type: string;
  file_size: number;
  s3_object_key: string;
}): Promise<DocumentItem> {
  return apiFetch<DocumentItem>('/api/documents', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function listDocuments(): Promise<DocumentItem[]> {
  return apiFetch<DocumentItem[]>('/api/documents');
}

export async function getDocumentStatus(documentId: string): Promise<{
  document_id: string;
  status: string;
  stage: string;
  progress: number;
  error?: string;
  suggested_topics?: string[];
}> {
  return apiFetch(`/api/documents/${documentId}/status`);
}

export async function getDocument(documentId: string): Promise<DocumentItem & { suggested_topics?: string[] }> {
  return apiFetch(`/api/documents/${documentId}`);
}

export async function deleteDocument(documentId: string): Promise<{ deleted: boolean }> {
  return apiFetch(`/api/documents/${documentId}`, { method: 'DELETE' });
}
