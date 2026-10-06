/**
 * Account-partitioned record kinds. Every row is keyed by (owner, kind, id); the
 * owner is the backend-verified Supabase user id and never a client-chosen value.
 */
export type RecordKind =
  | 'set'
  | 'items'
  | 'folder'
  | 'event'
  | 'event_hold'
  | 'sync_state'
  | 'mutation'
  | 'id_map'
  | 'session'
  | 'wallet';
export interface StoredRecord { kind: RecordKind; id: string; data: unknown }
export interface RecordChange { kind: RecordKind; id: string; data?: unknown }
export interface AccountStore {
  list(owner: string, kind: RecordKind): Promise<StoredRecord[]>;
  /** Applies every change in one transaction; a failure rolls all of them back. */
  write(owner: string, changes: RecordChange[]): Promise<void>;
}
