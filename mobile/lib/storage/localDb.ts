import { StudySet, StudyItem, SyncEvent } from '../../types';

class LocalDatabase {
  private sets: Map<string, StudySet> = new Map();
  private items: Map<string, StudyItem[]> = new Map();
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

  async deleteDocument(_docId: string): Promise<void> {
    return Promise.resolve();
  }

  async listStudySets(): Promise<StudySet[]> {
    return Array.from(this.sets.values());
  }

  async getStudyItems(setId: string): Promise<StudyItem[]> {
    return this.items.get(setId) || [];
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
