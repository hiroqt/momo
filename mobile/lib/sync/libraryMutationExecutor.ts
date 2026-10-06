import { ApiError } from '../api/errors';
import { updateStudySet, deleteStudySet } from '../api/studySets';
import { createFolder, updateFolder, deleteFolder, setStudySetFolder, listFolders } from '../api/folders';
import { createFolderIdempotently } from './folderIdempotency';
import type { MutationResult } from './mutationQueue';
import type { QueuedMutation } from './mutationStore';

function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

/** Executes one queued library mutation against the REST API. Deletes are idempotent. */
export async function executeLibraryMutation(mutation: QueuedMutation, resolveId: (id: string) => string): Promise<MutationResult | void> {
  const p = mutation.payload;
  switch (mutation.type) {
    case 'RENAME_STUDY_SET':
      await updateStudySet(p.id, { title: p.title });
      return;
    case 'DELETE_STUDY_SET':
      try { await deleteStudySet(p.id); } catch (error) { if (!isNotFound(error)) throw error; }
      return;
    case 'CREATE_FOLDER':
      return createFolderIdempotently(mutation, { create: createFolder, list: listFolders });
    case 'RENAME_FOLDER':
      await updateFolder(resolveId(p.id), { name: p.name });
      return;
    case 'DELETE_FOLDER':
      try { await deleteFolder(resolveId(p.id)); } catch (error) { if (!isNotFound(error)) throw error; }
      return;
    case 'MOVE_STUDY_SET':
      await setStudySetFolder(p.id, p.folderId ? resolveId(p.folderId) : null);
      return;
  }
}
