import type { StudySet, StudyItem, SyncEvent, Folder } from '../../types';
import { previewStore } from './previewStore';
import type { PreviewStore } from './previewStore.types';
import { accountStore } from './accountStore';
import type { AccountStore, RecordKind, RecordChange } from './accountStore.types';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UUID_REFERENCE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value==='object' && !Array.isArray(value);
}
export function isValidSyncEvent(value: unknown): value is SyncEvent { return validEvent(value); }
function validEvent(value: unknown): value is SyncEvent {
  if (!record(value)) return false;
  return typeof value.event_id==='string' && UUID_V4.test(value.event_id) &&
    ['correct','incorrect','review_again','skipped'].includes(String(value.result)) &&
    typeof value.occurred_at==='string' && /(?:Z|[+-]\d{2}:\d{2})$/.test(value.occurred_at) && Number.isFinite(Date.parse(value.occurred_at)) &&
    ['study_item_id','study_session_id'].every(key=>value[key]===undefined || (typeof value[key]==='string' && UUID_REFERENCE.test(value[key]))) &&
    (value.user_answer===undefined || (typeof value.user_answer==='string' && value.user_answer.length<=10000));
}
function normalizeLegacyItem(value: unknown): unknown {
  return record(value) && value.type==='explanation' ? {...value,type:'topic_explanation'} : value;
}
function validItem(value: unknown, setId: string): value is StudyItem {
  if (!record(value)) return false;
  return typeof value.id==='string' && value.id.length>0 && value.study_set_id===setId &&
    typeof value.question==='string' && value.question.trim().length>0 && typeof value.answer==='string' && value.answer.trim().length>0 &&
    ['flashcard','multiple_choice','true_false','identification','fill_in_the_blank','summary','qa','topic_explanation','glossary','concept_outline','cheat_sheet','compare_contrast','qa_study_sheet','timeline_process'].includes(String(value.type)) &&
    ['easy','medium','hard'].includes(String(value.difficulty)) && record(value.source_metadata) &&
    typeof value.created_at==='string' && Number.isFinite(Date.parse(value.created_at)) &&
    Number.isInteger(value.order_index) && Number(value.order_index)>=0 &&
    (value.options==null || (Array.isArray(value.options) && value.options.every(option=>typeof option==='string'))) &&
    ['explanation','hint','image_base64','diagram_prompt'].every(key=>value[key]==null || typeof value[key]==='string');
}

function validDate(value: unknown): boolean {
  return typeof value==='string' && Number.isFinite(Date.parse(value));
}
function validSet(value: unknown): value is StudySet {
  if (!record(value)) return false;
  return typeof value.id==='string' && value.id.length>0 && typeof value.user_id==='string' && value.user_id.length>0 &&
    typeof value.title==='string' && value.title.trim().length>0 &&
    Number.isInteger(value.item_count) && Number(value.item_count)>=0 && validDate(value.created_at) && validDate(value.updated_at) &&
    ['description','document_id','folder_id'].every(key=>value[key]==null || typeof value[key]==='string') &&
    (value.generation_config==null || record(value.generation_config));
}
function validFolder(value: unknown): value is Folder {
  if (!record(value)) return false;
  return typeof value.id==='string' && value.id.length>0 && typeof value.user_id==='string' && value.user_id.length>0 &&
    typeof value.name==='string' && value.name.trim().length>0 && (value.color==null || typeof value.color==='string') &&
    Number.isInteger(value.reviewer_count) && Number(value.reviewer_count)>=0 && validDate(value.created_at) && validDate(value.updated_at);
}

export interface AccountBinding { owner: string; epoch: number }

export class LocalDatabase {
  constructor(private readonly previews: PreviewStore = previewStore,
    private readonly accounts: AccountStore = accountStore) {}
  private cachedPreviews: Promise<Awaited<ReturnType<PreviewStore["list"]>>> | undefined;
  private previewRows() {
    this.cachedPreviews ??= this.previews.list().catch(error=>{this.cachedPreviews=undefined;throw error;});
    return this.cachedPreviews;
  }
  private async savePreview(set: StudySet, items: StudyItem[]) {
    const rows = await this.previewRows();
    await this.previews.save(set,items);
    this.cachedPreviews = Promise.resolve([...rows.filter(row=>row.set.id!==set.id),{set,items}]);
  }
  private owner: string | null = null;
  private epoch = 0;
  private writes: Promise<unknown> = Promise.resolve();
  private chatMessages = new Map<string, any[]>();
  private accountListeners = new Set<(owner: string | null) => void>();
  bindVerifiedAccount(userId: string | null): void {
    const changed = this.owner !== userId;
    if (changed) { this.epoch++; this.chatMessages.clear(); }
    this.owner = userId;
    if (changed) for (const listener of [...this.accountListeners]) {
      try { listener(userId); } catch { /* listeners must not break account binding */ }
    }
  }
  /** Notified after the verified account binding changes (sign-in, switch, sign-out). */
  onAccountChange(listener: (owner: string | null) => void): () => void {
    this.accountListeners.add(listener);
    return () => { this.accountListeners.delete(listener); };
  }
  getActiveAccountId(): string | null { return this.owner; }
  getAccountEpoch(): number { return this.epoch; }
  private requireOwner(): string {
    if (!this.owner) throw new Error('A verified account is required for study storage.');
    return this.owner;
  }
  private async records<T>(kind: RecordKind): Promise<T[]> {
    const owner = this.requireOwner(), epoch = this.epoch;
    const rows = await this.accounts.list(owner, kind);
    if (this.epoch !== epoch) throw new Error('Account changed during storage access.');
    return rows.map(row => {
      const data = row.data as Record<string, unknown> | null;
      if (!data || typeof data !== 'object' ||
          ((kind === 'set' || kind === 'folder') && (data.user_id !== owner || data.id !== row.id)) ||
          (kind === 'set' && !validSet(data)) || (kind === 'folder' && !validFolder(data)) ||
          (kind === 'event' && (data.event_id !== row.id || !validEvent(data))))
        throw new Error('Stored study data is corrupt.');
      return row.data as T;
    });
  }
  private binding(): AccountBinding { return {owner:this.requireOwner(),epoch:this.epoch}; }
  private assertBinding(binding: AccountBinding): void {
    if (this.owner!==binding.owner || this.epoch!==binding.epoch)
      throw new Error('Account changed during storage access.');
  }
  private mutate(task: (binding: AccountBinding) => Promise<void>, binding = this.binding()): Promise<void> {
    const pending = this.writes.catch(() => {}).then(async () => {
      this.assertBinding(binding);
      await task(binding);
      this.assertBinding(binding);
    });
    this.writes = pending;
    return pending;
  }
  private async write(changes: RecordChange[], binding: AccountBinding): Promise<void> {
    this.assertBinding(binding);
    await this.accounts.write(binding.owner, changes);
    this.assertBinding(binding);
  }
  /** Binding for the active verified account; throws when signed out. */
  currentBinding(): AccountBinding { return this.binding(); }
  /**
   * Raw owner-scoped records for repositories that validate their own kinds
   * (sessions, wallet, mutations, sync state). Ordinary kinds keep their validators.
   */
  async readRecords(kind: RecordKind, binding: AccountBinding = this.binding()): Promise<{ id: string; data: unknown }[]> {
    this.assertBinding(binding);
    if (kind === 'set' || kind === 'folder' || kind === 'event') {
      const rows = await this.records<Record<string, unknown>>(kind);
      this.assertBinding(binding);
      return rows.map(data => ({ id: String(kind === 'event' ? data.event_id : data.id), data }));
    }
    const rows = await this.accounts.list(binding.owner, kind);
    this.assertBinding(binding);
    return rows.map(row => ({ id: row.id, data: row.data }));
  }
  /** Serialized atomic multi-record write bound to one account epoch. */
  async writeRecords(changes: RecordChange[], binding: AccountBinding = this.binding()): Promise<void> {
    for (const change of changes) {
      if (change.kind === 'event' && change.data !== undefined && !validEvent(change.data))
        throw new Error('Study event data is invalid.');
    }
    await this.mutate(active => this.write(changes, active), binding);
  }
  async init(): Promise<void> { await this.previewRows(); }
  async saveStudySet(set: StudySet, items: StudyItem[]): Promise<void> {
    if (set.generation_config?.preview === true) { await this.savePreview(set, items); return; }
    const normalizedItems = items.map(normalizeLegacyItem);
    if (!validSet(set) || set.user_id !== this.requireOwner() || normalizedItems.some(item => !validItem(item,set.id))) throw new Error('Study data does not belong to this account.');
    await this.mutate(binding => this.write([{kind:'set',id:set.id,data:set},{kind:'items',id:set.id,data:normalizedItems}],binding));
  }
  async listStudySets(): Promise<StudySet[]> {
    const epoch = this.epoch;
    const previews = (await this.previewRows()).map(row => row.set);
    const result = this.owner ? [...await this.records<StudySet>('set'), ...previews] : previews;
    if (epoch !== this.epoch) throw new Error('Account changed during storage access.');
    return result;
  }
  async getStudySet(id: string): Promise<StudySet | null> { return (await this.listStudySets()).find(set => set.id === id) ?? null; }
  async getStudyItems(id: string): Promise<StudyItem[]> {
    const preview = (await this.previewRows()).find(row => row.set.id === id);
    if (preview) return preview.items;
    if (!this.owner) return [];
    const owner = this.requireOwner(), epoch = this.epoch;
    const rows = await this.accounts.list(owner,'items');
    if (epoch !== this.epoch) throw new Error('Account changed during storage access.');
    const storedItems = rows.find(row => row.id === id)?.data;
    const items = Array.isArray(storedItems) ? storedItems.map(normalizeLegacyItem) : storedItems;
    if (items === undefined) return [];
    if (!Array.isArray(items) || items.some(item=>!validItem(item,id)))
      throw new Error('Stored study data is corrupt.');
    return items as StudyItem[];
  }
  async deleteStudySet(id: string): Promise<void> {
    const owner=this.owner, epoch=this.epoch;
    if ((await this.previewRows()).some(row => row.set.id === id)) { await this.previews.remove(id); this.cachedPreviews=Promise.resolve((await this.previewRows()).filter(row=>row.set.id!==id)); return; }
    if (!owner) throw new Error('A verified account is required for study storage.');
    const operationBinding={owner,epoch};
    this.assertBinding(operationBinding);
    await this.mutate(binding => this.write([{kind:'set',id},{kind:'items',id}],binding),operationBinding);
  }
  private async updateSet(id: string, updates: Partial<StudySet>): Promise<void> {
    const epoch = this.epoch;
    const owner = this.owner;
    const preview = (await this.previewRows()).find(row => row.set.id === id);
    if (preview) { await this.savePreview({...preview.set,...updates},preview.items); return; }
    if (!owner) throw new Error('A verified account is required for study storage.');
    const operationBinding={owner,epoch};
    this.assertBinding(operationBinding);
    await this.mutate(async binding => {
      const set = (await this.records<StudySet>('set')).find(row => row.id === id);
      if (set) await this.write([{kind:'set',id,data:{...set,...updates,updated_at:new Date().toISOString()}}],binding);
    },operationBinding);
  }
  async updateStudySetTitle(id: string, title: string): Promise<void> { await this.updateSet(id,{title}); }
  async updateStudySetFolder(id: string, folderId?: string | null): Promise<void> { await this.updateSet(id,{folder_id:folderId ?? null}); }
  async deleteDocument(_id: string): Promise<void> {}
  async saveFolder(folder: Folder): Promise<void> {
    if (!validFolder(folder) || folder.user_id !== this.requireOwner()) throw new Error('Folder does not belong to this account.');
    await this.mutate(binding => this.write([{kind:'folder',id:folder.id,data:folder}],binding));
  }
  async listFolders(): Promise<Folder[]> {
    if (!this.owner) return [];
    const epoch = this.epoch;
    const folders = await this.records<Folder>('folder'), sets = await this.records<StudySet>('set');
    if (epoch!==this.epoch) throw new Error('Account changed during storage access.');
    return folders.map(folder => ({...folder,reviewer_count:sets.filter(set=>set.folder_id===folder.id).length}));
  }
  async getFolder(id: string): Promise<Folder | null> { return (await this.listFolders()).find(folder=>folder.id===id) ?? null; }
  async updateFolder(id: string, updates: Partial<Folder>): Promise<void> {
    await this.mutate(async binding => {
      const folder = (await this.records<Folder>('folder')).find(row=>row.id===id);
      if (folder) await this.write([{kind:'folder',id,data:{...folder,...updates,id,user_id:binding.owner}}],binding);
    });
  }
  async deleteFolder(id: string): Promise<void> {
    await this.mutate(async binding => {
      const sets = await this.records<StudySet>('set');
      await this.write([{kind:'folder',id}, ...sets.filter(set=>set.folder_id===id).map(set=>({kind:'set' as const,id:set.id,data:{...set,folder_id:null}}))],binding);
    });
  }
  async enqueueSyncEvent(event: SyncEvent): Promise<void> {
    if (!validEvent(event))
      throw new Error('Study event data is invalid.');
    await this.mutate(binding=>this.write([{kind:'event',id:event.event_id,data:event}],binding));
  }
  async getPendingSyncEvents(): Promise<SyncEvent[]> { return this.owner ? this.records<SyncEvent>('event') : []; }
  async removeSyncEvents(ids: string[], expectedOwner = this.owner, expectedEpoch = this.epoch): Promise<void> {
    if (!expectedOwner || expectedOwner!==this.owner || expectedEpoch!==this.epoch) throw new Error('Account changed during sync.');
    await this.mutate(binding=>this.write(ids.map(id=>({kind:'event',id})),binding));
  }
  async saveChatMessages(id: string, messages: any[]): Promise<void> { this.requireOwner(); this.chatMessages.set(id,messages); }
  async getChatMessages(id: string): Promise<any[]> { return this.owner ? this.chatMessages.get(id) ?? [] : []; }
  async deleteChatMessages(id: string): Promise<void> { this.chatMessages.delete(id); }
}
export const localDb = new LocalDatabase();
