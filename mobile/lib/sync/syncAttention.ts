import type { Folder, StudySet } from '../../types';
import type { RecordChange } from '../storage/accountStore.types';
import type { QueuedMutation } from './mutationStore';

/** One server-refused library change, described for the learner. */
export interface AttentionChange { id: string; label: string; reason: string }
export interface SyncAttention {
  /** Study answers the server refused; they stay on the device until retried. */
  heldAnswers: number;
  changes: AttentionChange[];
  total: number;
}
export const EMPTY_ATTENTION: SyncAttention = { heldAnswers: 0, changes: [], total: 0 };

export interface AttentionSources {
  heldAnswerCount(): Promise<number>;
  listBlocked(): Promise<QueuedMutation[]>;
  /** Locally cached folders and sets, used to name the things a change refers to. */
  folders(): Promise<{ id: string; data: unknown }[]>;
  sets(): Promise<{ id: string; data: unknown }[]>;
  retryAnswers(): Promise<void>;
  retryChange(id: string): Promise<void>;
  discardChange(id: string): Promise<void>;
}

const REASONS: Record<string, string> = {
  INSUFFICIENT_CREDITS: 'You did not have enough credits for this.',
  FOLDER_NAME_EXISTS: 'You already have a folder with this name.',
  FOLDER_NOT_FOUND: 'That folder is no longer in your library.',
  STUDY_SET_NOT_FOUND: 'That reviewer is no longer in your library.',
  INVALID_NAME: 'That name cannot be used.',
  INVALID_TITLE: 'That title cannot be used.',
  VALIDATION_ERROR: 'Some details of this change could not be accepted.',
};
export function attentionReason(code: string | null): string {
  return (code && REASONS[code]) || 'Your account could not accept this change.';
}

const clip = (value: unknown, fallback: string) => {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) return fallback;
  return text.length > 40 ? `${text.slice(0, 39)}…` : text;
};

type Names = { folder(id: unknown): string | null; set(id: unknown): string | null };

/** Plain-language label for a queued change. No ids or technical terms reach the learner. */
export function describeChange(mutation: QueuedMutation, names: Names): string {
  const p = mutation.payload ?? {};
  const folder = (id: unknown) => names.folder(id);
  const set = (id: unknown) => names.set(id);
  switch (mutation.type) {
    case 'CREATE_FOLDER': return `Create folder “${clip(p.name, 'New folder')}”`;
    case 'RENAME_FOLDER': return `Rename folder to “${clip(p.name, 'a new name')}”`;
    case 'DELETE_FOLDER': { const n = folder(p.id); return n ? `Delete folder “${clip(n, '')}”` : 'Delete a folder'; }
    case 'RENAME_STUDY_SET': return `Rename reviewer to “${clip(p.title, 'a new title')}”`;
    case 'DELETE_STUDY_SET': { const n = set(p.id); return n ? `Delete reviewer “${clip(n, '')}”` : 'Delete a reviewer'; }
    case 'MOVE_STUDY_SET': {
      const n = set(p.id), target = p.folderId ? folder(p.folderId) : null;
      const what = n ? `“${clip(n, '')}”` : 'a reviewer';
      if (!p.folderId) return `Remove ${what} from its folder`;
      return target ? `Move ${what} to “${clip(target, '')}”` : `Move ${what} to a folder`;
    }
  }
}

function nameIndex(mutations: QueuedMutation[], folders: { id: string; data: unknown }[], sets: { id: string; data: unknown }[]): Names {
  const folderNames = new Map<string, string>(), setTitles = new Map<string, string>();
  const add = (kind: string, id: string, data: unknown) => {
    if (kind === 'folder' && typeof (data as Folder | null)?.name === 'string') folderNames.set(id, (data as Folder).name);
    if (kind === 'set' && typeof (data as StudySet | null)?.title === 'string') setTitles.set(id, (data as StudySet).title);
  };
  // Pre-change snapshots name things that the change itself removed locally.
  for (const m of mutations) for (const c of (m.revert ?? []) as RecordChange[]) add(c.kind, c.id, c.data);
  for (const row of folders) add('folder', row.id, row.data);
  for (const row of sets) add('set', row.id, row.data);
  for (const m of mutations) if (m.type === 'CREATE_FOLDER' && typeof m.payload?.clientId === 'string') add('folder', m.payload.clientId, { name: m.payload.name });
  return {
    folder: id => (typeof id === 'string' ? folderNames.get(id) ?? null : null),
    set: id => (typeof id === 'string' ? setTitles.get(id) ?? null : null),
  };
}

/**
 * Combines server-refused answers and library changes into one learner-facing view
 * with explicit retry/discard actions. Nothing is dropped without a learner action.
 */
export class SyncAttentionService {
  constructor(private readonly sources: AttentionSources) {}

  async load(): Promise<SyncAttention> {
    const [heldAnswers, blocked, folders, sets] = await Promise.all([
      this.sources.heldAnswerCount(), this.sources.listBlocked(), this.sources.folders(), this.sources.sets(),
    ]);
    const names = nameIndex(blocked, folders, sets);
    const changes = blocked.map(m => ({ id: m.id, label: describeChange(m, names), reason: attentionReason(m.lastErrorCode) }));
    return { heldAnswers, changes, total: heldAnswers + changes.length };
  }

  retryAnswers(): Promise<void> { return this.sources.retryAnswers(); }
  retryChange(id: string): Promise<void> { return this.sources.retryChange(id); }
  /** Discards the change and restores the library as it was before it. */
  discardChange(id: string): Promise<void> { return this.sources.discardChange(id); }
}
