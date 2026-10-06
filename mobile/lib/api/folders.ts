import { apiFetch } from './client';
import { collectPages } from './pagination';
import { Folder, StudySet } from '../../types';

export async function listFolders(): Promise<Folder[]> {
  return collectPages<Folder>((limit, offset) =>
    apiFetch<Folder[]>(`/api/folders?limit=${limit}&offset=${offset}`)
  );
}

export async function createFolder(name: string, color?: string | null, idempotencyKey?: string): Promise<Folder> {
  return apiFetch<Folder>('/api/folders', {
    method: 'POST',
    // Server-side honoring of Idempotency-Key is a pending API-01 contract item.
    headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
    body: JSON.stringify({ name, color }),
  });
}

export async function updateFolder(
  folderId: string,
  updates: { name?: string; color?: string | null }
): Promise<Folder> {
  return apiFetch<Folder>(`/api/folders/${folderId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

export async function deleteFolder(folderId: string): Promise<{ deleted: boolean; folder_id: string }> {
  return apiFetch<{ deleted: boolean; folder_id: string }>(`/api/folders/${folderId}`, {
    method: 'DELETE',
  });
}

export async function setStudySetFolder(
  studySetId: string,
  folderId: string | null
): Promise<StudySet> {
  return apiFetch<StudySet>(`/api/study-sets/${studySetId}`, {
    method: 'PATCH',
    body: JSON.stringify({ folder_id: folderId ?? '' }),
  });
}
