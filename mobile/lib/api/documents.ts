import { Platform } from 'react-native';
import { File, UploadType } from 'expo-file-system';
import { apiFetch, BASE_URL } from './client';
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
  const targetUrl = uploadUrl.startsWith('http') ? uploadUrl : `${BASE_URL}${uploadUrl}`;

  // Direct native streaming upload if given a local file URI on native (bypasses JS memory & base64 overhead)
  if (
    Platform.OS !== 'web' &&
    typeof fileData === 'string' &&
    (fileData.startsWith('file:') || fileData.startsWith('content:'))
  ) {
    try {
      const file = new File(fileData);
      const uploadRes = await file.upload(targetUrl, {
        httpMethod: 'PUT',
        headers: { 'Content-Type': mimeType },
        uploadType: UploadType.BINARY_CONTENT,
      });

      if (uploadRes.status >= 200 && uploadRes.status < 300) {
        return;
      }
      console.warn(`[uploadFileToS3] file.upload returned status ${uploadRes.status}, falling back to fetch`);
    } catch (fsErr) {
      console.warn('[uploadFileToS3] File upload error, falling back to fetch:', fsErr);
    }
  }

  // Fallback to fetch with Blob (web, or if native upload failed)
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
