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

export async function uploadFileToS3(uploadUrl: string, fileBytes: Blob, mimeType: string): Promise<void> {
  const targetUrl = uploadUrl.startsWith('http') ? uploadUrl : `${BASE_URL}${uploadUrl}`;
  const resp = await fetch(targetUrl, {
    method: 'PUT',
    headers: { 'Content-Type': mimeType },
    body: fileBytes,
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
