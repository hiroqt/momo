import type { LocalDatabase } from '../storage/localDb';
import type { RecordChange } from '../storage/accountStore.types';
import type { Folder, StudySet } from '../../types';

export type MutationType =
  | 'RENAME_STUDY_SET'
  | 'DELETE_STUDY_SET'
  | 'CREATE_FOLDER'
  | 'RENAME_FOLDER'
  | 'DELETE_FOLDER'
  | 'MOVE_STUDY_SET';
export const MUTATION_TYPES: readonly MutationType[] = ['RENAME_STUDY_SET', 'DELETE_STUDY_SET', 'CREATE_FOLDER', 'RENAME_FOLDER', 'DELETE_FOLDER', 'MOVE_STUDY_SET'];

export interface QueuedMutation {
  /** Client UUID; also the server idempotency key. */
  id: string;
  type: MutationType;
  payload: any;
  createdAt: number;
  retryCount: number;
  ownerId: string;
  /** `blocked`: the server rejected it; kept for explicit retry or dismissal. */
  status: 'pending' | 'blocked';
  nextAttemptAt: number;
  lastErrorCode: string | null;
  /** Local records as they were before this change's optimistic write; restored on dismissal. */
  revert?: RecordChange[];
}

export interface MutationStore {
  list(owner: string): Promise<QueuedMutation[]>;
  save(owner: string, mutations: QueuedMutation[], extra?: RecordChange[]): Promise<void>;
  remove(owner: string, ids: string[], extra?: RecordChange[]): Promise<void>;
  /** Client-generated ids mapped to the server ids they became. */
  idMap(owner: string): Promise<Record<string, string>>;
  /** Records a client -> server id mapping and re-keys local records, atomically with removal. */
  completeCreate(owner: string, mutationId: string, clientId: string, serverId: string): Promise<void>;
}

export function parseMutation(value: unknown): QueuedMutation | null {
  const v = value as Partial<QueuedMutation> | null;
  if (!v || typeof v.id !== 'string' || !MUTATION_TYPES.includes(v.type as MutationType) || typeof v.ownerId !== 'string' ||
      !v.payload || typeof v.payload !== 'object' || !Number.isFinite(v.createdAt) || !Number.isSafeInteger(v.retryCount)) return null;
  return {
    id: v.id, type: v.type as MutationType, payload: v.payload, createdAt: v.createdAt!, retryCount: v.retryCount!, ownerId: v.ownerId,
    status: v.status === 'blocked' ? 'blocked' : 'pending',
    nextAttemptAt: Number.isFinite(v.nextAttemptAt) ? v.nextAttemptAt! : 0,
    lastErrorCode: typeof v.lastErrorCode === 'string' ? v.lastErrorCode : null,
    ...(Array.isArray(v.revert) ? { revert: parseRevert(v.revert) } : {}),
  };
}

/** Only library record kinds may be restored; anything else is dropped rather than trusted. */
const REVERTIBLE_KINDS: ReadonlySet<string> = new Set(['set', 'items', 'folder']);
function parseRevert(value: unknown[]): RecordChange[] {
  return value.flatMap(entry => {
    const c = entry as Partial<RecordChange> | null;
    if (!c || typeof c.id !== 'string' || !c.id || !REVERTIBLE_KINDS.has(c.kind as string)) return [];
    return [c.data === undefined || c.data === null ? { kind: c.kind!, id: c.id } : { kind: c.kind!, id: c.id, data: c.data }];
  });
}

/** Durable store in the verified account's SQLite partition. */
export function createLocalMutationStore(db: LocalDatabase): MutationStore {
  function binding(owner: string) {
    const current = db.currentBinding();
    if (current.owner !== owner) throw new Error('Account changed during sync.');
    return current;
  }
  return {
    async list(owner) {
      const rows = await db.readRecords('mutation', binding(owner));
      return rows.map(row => {
        const parsed = parseMutation(row.data);
        if (!parsed || parsed.id !== row.id || parsed.ownerId !== owner) throw new Error('Stored study data is corrupt.');
        return parsed;
      });
    },
    async save(owner, mutations, extra = []) {
      await db.writeRecords([...extra, ...mutations.map(m => ({ kind: 'mutation' as const, id: m.id, data: m }))], binding(owner));
    },
    async remove(owner, ids, extra = []) {
      await db.writeRecords([...ids.map(id => ({ kind: 'mutation' as const, id })), ...extra], binding(owner));
    },
    async idMap(owner) {
      const rows = await db.readRecords('id_map', binding(owner));
      const map: Record<string, string> = {};
      for (const row of rows) {
        const serverId = (row.data as { serverId?: unknown } | null)?.serverId;
        if (typeof serverId === 'string') map[row.id] = serverId;
      }
      return map;
    },
    async completeCreate(owner, mutationId, clientId, serverId) {
      const active = binding(owner);
      const changes: RecordChange[] = [
        { kind: 'mutation', id: mutationId },
        { kind: 'id_map', id: clientId, data: { serverId } },
      ];
      if (clientId !== serverId) {
        const folders = await db.readRecords('folder', active);
        const folder = folders.find(row => row.id === clientId)?.data as Folder | undefined;
        if (folder) changes.push({ kind: 'folder', id: clientId }, { kind: 'folder', id: serverId, data: { ...folder, id: serverId } });
        const sets = await db.readRecords('set', active);
        for (const row of sets) {
          const set = row.data as StudySet;
          if (set.folder_id === clientId) changes.push({ kind: 'set', id: set.id, data: { ...set, folder_id: serverId } });
        }
      }
      await db.writeRecords(changes, active);
    },
  };
}

/** Non-durable store for tests and tooling. */
export function createMemoryMutationStore(): MutationStore & { snapshot(owner: string): QueuedMutation[] } {
  const rows = new Map<string, Map<string, QueuedMutation>>();
  const maps = new Map<string, Record<string, string>>();
  const partition = (owner: string) => { if (!rows.has(owner)) rows.set(owner, new Map()); return rows.get(owner)!; };
  return {
    async list(owner) { return [...partition(owner).values()].map(m => ({ ...m })); },
    async save(owner, mutations) { for (const m of mutations) partition(owner).set(m.id, { ...m }); },
    async remove(owner, ids) { for (const id of ids) partition(owner).delete(id); },
    async idMap(owner) { return { ...(maps.get(owner) ?? {}) }; },
    async completeCreate(owner, mutationId, clientId, serverId) {
      partition(owner).delete(mutationId);
      maps.set(owner, { ...(maps.get(owner) ?? {}), [clientId]: serverId });
    },
    snapshot(owner) { return [...partition(owner).values()]; },
  };
}
