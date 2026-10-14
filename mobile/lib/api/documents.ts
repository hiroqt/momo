import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { apiFetch, getBaseUrl, getAuthToken, BASE_URL } from './client';
import { collectPages } from './pagination';
import { DocumentItem } from '../../types';
import { buildUploadHeaders, withMockUploadAuth } from './uploadHeaders';

export interface UploadUrlResponse {
  upload_url: string;
  s3_object_key: string;
  document_id: string;
  expires_in_seconds: number;
  upload_headers?: Record<string, string>;
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
  mimeType: string,
  requiredHeaders?: Record<string, string>
): Promise<void> {
  const headers = withMockUploadAuth(buildUploadHeaders(mimeType, requiredHeaders), uploadUrl, getAuthToken());
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
        headers,
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      });

      if (uploadRes.status >= 200 && uploadRes.status < 300) {
        return;
      }
      throw new Error(`Upload failed with server status ${uploadRes.status}`);
    } catch {
      throw new Error('The upload could not finish. Please try uploading the document again.');
    }
  }

  // Web uploads use the same immutable constraints as native streaming uploads.
  try {
    let body: Blob | string = fileData;
    if (typeof fileData === 'string') {
      const response = await fetch(fileData);
      if (!response.ok) throw new Error('File unavailable');
      body = await response.blob();
    }
    const response = await fetch(targetUrl, { method: 'PUT', headers, body });
    if (!response.ok) throw new Error('Upload rejected');
  } catch {
    throw new Error('The upload could not finish. Please try uploading the document again.');
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
  return collectPages<DocumentItem>((limit, offset) =>
    apiFetch<DocumentItem[]>(`/api/documents?limit=${limit}&offset=${offset}`)
  );
}

export async function getDocumentStatus(documentId: string): Promise<{
  document_id: string;
  status: string;
  stage: string;
  progress: number;
  page_count?: number | null;
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
