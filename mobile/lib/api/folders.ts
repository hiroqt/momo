import { apiFetch } from './client';
import { Folder, StudySet } from '../../types';

export async function listFolders(): Promise<Folder[]> {
  return apiFetch<Folder[]>('/api/folders');
}

export async function createFolder(name: string, color?: string | null): Promise<Folder> {
  return apiFetch<Folder>('/api/folders', {
    method: 'POST',
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
