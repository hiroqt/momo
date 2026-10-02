import type { StudyItem, StudySet } from '@/types';

interface StudyContentSources {
  getCachedSet: (id: string) => Promise<StudySet | null>;
  getCachedItems: (id: string) => Promise<StudyItem[]>;
  getRemoteSet: (id: string) => Promise<StudySet>;
  getRemoteItems: (id: string) => Promise<StudyItem[]>;
}

/** Curated onboarding previews are local content, with no server-side record. */
export async function loadStudyContent(id: string, sources: StudyContentSources) {
  const cached = await sources.getCachedSet(id);
  if (cached?.generation_config?.preview === true) {
    return { set: cached, items: await sources.getCachedItems(id) };
  }
  const set = await sources.getRemoteSet(id);
  return { set, items: await sources.getRemoteItems(id) };
}
