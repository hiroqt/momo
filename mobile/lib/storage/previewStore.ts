import type { PreviewStore } from './previewStore.types';

// Native builds resolve previewStore.native.ts. Browser/Node use the existing
// in-memory LocalDatabase; no native module is imported by the unit runner.
export const previewStore: PreviewStore = {
  list: async () => [],
  save: async () => {},
  remove: async () => {},
};
