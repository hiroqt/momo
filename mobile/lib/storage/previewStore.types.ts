import type { StudyItem, StudySet } from '../../types';

export interface StoredPreview {
  set: StudySet;
  items: StudyItem[];
}

export interface PreviewStore {
  list(): Promise<StoredPreview[]>;
  save(set: StudySet, items: StudyItem[]): Promise<void>;
  remove(id: string): Promise<void>;
}
