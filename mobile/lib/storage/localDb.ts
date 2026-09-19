import { StudySet, StudyItem, SyncEvent, Folder } from '../../types';

class LocalDatabase {
  private sets: Map<string, StudySet> = new Map();
  private items: Map<string, StudyItem[]> = new Map();
  private folders: Map<string, Folder> = new Map();
  private syncQueue: SyncEvent[] = [];

  async init(): Promise<void> {
    // Database initialization (memory / SQLite)
    return Promise.resolve();
  }

  async saveStudySet(set: StudySet, items: StudyItem[]): Promise<void> {
    this.sets.set(set.id, set);
    this.items.set(set.id, items);
  }

  async getStudySet(setId: string): Promise<StudySet | null> {
    return this.sets.get(setId) || null;
  }

  async deleteStudySet(setId: string): Promise<void> {
    this.sets.delete(setId);
    this.items.delete(setId);
  }

  async updateStudySetTitle(setId: string, newTitle: string): Promise<void> {
    const s = this.sets.get(setId);
    if (s) {
      s.title = newTitle;
      s.updated_at = new Date().toISOString();
      this.sets.set(setId, s);
    }
  }

  async updateStudySetFolder(setId: string, folderId?: string | null): Promise<void> {
    const s = this.sets.get(setId);
    if (s) {
      s.folder_id = folderId ?? null;
      s.updated_at = new Date().toISOString();
      this.sets.set(setId, s);
    }
  }

  async deleteDocument(_docId: string): Promise<void> {
    return Promise.resolve();
  }

  async listStudySets(): Promise<StudySet[]> {
    return Array.from(this.sets.values());
  }

  async getStudyItems(setId: string): Promise<StudyItem[]> {
    return this.items.get(setId) || [];
  }

  // Folder local storage operations
  async saveFolder(folder: Folder): Promise<void> {
    this.folders.set(folder.id, folder);
  }

  async listFolders(): Promise<Folder[]> {
    const setsList = Array.from(this.sets.values());
    const counts: Record<string, number> = {};
    for (const s of setsList) {
      if (s.folder_id) {
        counts[s.folder_id] = (counts[s.folder_id] || 0) + 1;
      }
    }

    return Array.from(this.folders.values()).map((f) => ({
      ...f,
      reviewer_count: counts[f.id] || 0,
    }));
  }

  async getFolder(id: string): Promise<Folder | null> {
    const f = this.folders.get(id);
    if (!f) return null;
    const count = Array.from(this.sets.values()).filter((s) => s.folder_id === id).length;
    return { ...f, reviewer_count: count };
  }

  async updateFolder(folderId: string, updates: Partial<Folder>): Promise<void> {
    const f = this.folders.get(folderId);
    if (f) {
      const updated: Folder = {
        ...f,
        ...updates,
        updated_at: new Date().toISOString(),
      };
      this.folders.set(folderId, updated);
    }
  }

  async deleteFolder(folderId: string): Promise<void> {
    this.folders.delete(folderId);
    // Unassign folder_id from sets (preserve sets per AGENTS.md rule 33)
    for (const s of this.sets.values()) {
      if (s.folder_id === folderId) {
        s.folder_id = null;
      }
    }
  }

  async enqueueSyncEvent(event: SyncEvent): Promise<void> {
    this.syncQueue.push(event);
  }

  async getPendingSyncEvents(): Promise<SyncEvent[]> {
    return [...this.syncQueue];
  }

  async removeSyncEvents(eventIds: string[]): Promise<void> {
    const idSet = new Set(eventIds);
    this.syncQueue = this.syncQueue.filter((e) => !idSet.has(e.event_id));
  }
}

export const localDb = new LocalDatabase();
