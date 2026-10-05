import { apiFetch } from './client';
import { collectPages } from './pagination';
import { StudySet, StudyItem } from '../../types';

export async function listStudySets(): Promise<StudySet[]> {
  return collectPages<StudySet>((limit, offset) =>
    apiFetch<StudySet[]>(`/api/study-sets?limit=${limit}&offset=${offset}`)
  );
}

export async function getStudySet(id: string): Promise<StudySet> {
  return apiFetch<StudySet>(`/api/study-sets/${id}`);
}

export async function getStudyItems(studySetId: string): Promise<StudyItem[]> {
  return apiFetch<StudyItem[]>(`/api/study-sets/${studySetId}/items`);
}

export async function deleteStudySet(studySetId: string): Promise<{ deleted: boolean }> {
  return apiFetch(`/api/study-sets/${studySetId}`, { method: 'DELETE' });
}

export async function updateStudySet(
  studySetId: string,
  updates: { title: string; description?: string }
): Promise<StudySet> {
  return apiFetch<StudySet>(`/api/study-sets/${studySetId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}
