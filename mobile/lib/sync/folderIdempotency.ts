import { ApiError } from '../api/errors';
import type { Folder } from '../../types';
import type { QueuedMutation } from './mutationStore';

export interface FolderApi {
  create(name: string, color: string | null, idempotencyKey: string): Promise<Folder>;
  list(): Promise<Folder[]>;
}

/**
 * Folder creation is idempotent: the mutation id is sent as an Idempotency-Key, and a
 * replay after a lost response that hits the server's unique-name rule resolves to
 * the existing folder instead of creating a duplicate or blocking the queue.
 */
export async function createFolderIdempotently(mutation: QueuedMutation, api: FolderApi): Promise<{ createdId: string }> {
  const name = String(mutation.payload.name ?? '').trim();
  try {
    const created = await api.create(name, mutation.payload.color ?? null, mutation.id);
    return { createdId: created.id };
  } catch (error) {
    if (!(error instanceof ApiError) || error.code !== 'FOLDER_NAME_EXISTS') throw error;
    const existing = (await api.list()).find(folder => folder.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase());
    if (!existing) throw error;
    return { createdId: existing.id };
  }
}
