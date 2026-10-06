import type { Folder, StudySet } from '../../types';
import type { LocalDatabase } from '../storage/localDb';
import type { RecordChange } from '../storage/accountStore.types';
import type { MutationQueue, MutationType } from './mutationQueue';

export class LibraryActionError extends Error {}

/**
 * Offline-first library changes. Each action writes its optimistic local records and
 * its durable server mutation in one transaction, so a restart can never keep one
 * without the other. Guest preview decks change locally only.
 */
export class LibraryActions {
  constructor(private readonly db: LocalDatabase, private readonly queue: MutationQueue,
    private readonly uuid: () => Promise<string> = async () => (await import('expo-crypto')).randomUUID(),
    private readonly now: () => Date = () => new Date()) {}

  private owner(): string {
    const owner = this.db.getActiveAccountId();
    if (!owner) throw new LibraryActionError('Sign in to organize your library.');
    return owner;
  }
  private async accountSet(id: string): Promise<StudySet | null> {
    const rows = await this.db.readRecords('set');
    return (rows.find(row => row.id === id)?.data as StudySet | undefined) ?? null;
  }
  /** Pre-change state of every record an optimistic write touches (delete if absent). */
  private async snapshot(changes: RecordChange[]): Promise<RecordChange[]> {
    const kinds = [...new Set(changes.map(change => change.kind))];
    const current = new Map<string, unknown>();
    for (const kind of kinds) for (const row of await this.db.readRecords(kind)) current.set(`${kind}:${row.id}`, row.data);
    return changes.map(({ kind, id }) => {
      const data = current.get(`${kind}:${id}`);
      return data === undefined ? { kind, id } : { kind, id, data };
    });
  }
  private async enqueue(type: MutationType, payload: unknown, changes: RecordChange[]): Promise<void> {
    await this.queue.enqueue(type, payload, changes, await this.snapshot(changes));
  }
  private async isPreview(id: string): Promise<boolean> {
    return (await this.db.getStudySet(id))?.generation_config?.preview === true;
  }

  /** Creates a folder with a client UUID; replays reconcile to one server folder. */
  async createFolder(name: string, color: string | null = null): Promise<Folder> {
    const owner = this.owner();
    const cleaned = name.trim();
    if (!cleaned || cleaned.length > 50) throw new LibraryActionError('Folder names need 1 to 50 characters.');
    const clientId = await this.uuid();
    const stamp = this.now().toISOString();
    const folder: Folder = { id: clientId, user_id: owner, name: cleaned, color, reviewer_count: 0, created_at: stamp, updated_at: stamp };
    await this.enqueue('CREATE_FOLDER', { clientId, name: cleaned, color }, [{ kind: 'folder', id: clientId, data: folder }]);
    return folder;
  }

  async renameFolder(id: string, name: string): Promise<void> {
    this.owner();
    const cleaned = name.trim();
    if (!cleaned || cleaned.length > 50) throw new LibraryActionError('Folder names need 1 to 50 characters.');
    const folder = (await this.db.readRecords('folder')).find(row => row.id === id)?.data as Folder | undefined;
    const changes: RecordChange[] = folder ? [{ kind: 'folder', id, data: { ...folder, name: cleaned, updated_at: this.now().toISOString() } }] : [];
    await this.enqueue('RENAME_FOLDER', { id, name: cleaned }, changes);
  }

  async deleteFolder(id: string): Promise<void> {
    this.owner();
    const sets = (await this.db.readRecords('set')).map(row => row.data as StudySet);
    const changes: RecordChange[] = [
      { kind: 'folder', id },
      ...sets.filter(set => set.folder_id === id).map(set => ({ kind: 'set' as const, id: set.id, data: { ...set, folder_id: null } })),
    ];
    await this.enqueue('DELETE_FOLDER', { id }, changes);
  }

  async renameStudySet(id: string, title: string): Promise<void> {
    const cleaned = title.trim();
    if (!cleaned) throw new LibraryActionError('Reviewer titles cannot be empty.');
    if (await this.isPreview(id)) { await this.db.updateStudySetTitle(id, cleaned); return; }
    this.owner();
    const set = await this.accountSet(id);
    const changes: RecordChange[] = set ? [{ kind: 'set', id, data: { ...set, title: cleaned, updated_at: this.now().toISOString() } }] : [];
    await this.enqueue('RENAME_STUDY_SET', { id, title: cleaned }, changes);
  }

  async moveStudySet(id: string, folderId: string | null): Promise<void> {
    if (await this.isPreview(id)) { await this.db.updateStudySetFolder(id, folderId); return; }
    this.owner();
    const set = await this.accountSet(id);
    const changes: RecordChange[] = set ? [{ kind: 'set', id, data: { ...set, folder_id: folderId, updated_at: this.now().toISOString() } }] : [];
    await this.enqueue('MOVE_STUDY_SET', { id, folderId }, changes);
  }

  /** Removes the cached set and items locally and queues the server delete. */
  async deleteStudySet(id: string): Promise<void> {
    if (await this.isPreview(id)) { await this.db.deleteStudySet(id); return; }
    this.owner();
    await this.enqueue('DELETE_STUDY_SET', { id }, [{ kind: 'set', id }, { kind: 'items', id }]);
  }
}
