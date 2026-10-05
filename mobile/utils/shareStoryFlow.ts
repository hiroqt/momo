/** Native handoff is not proof that a story was published or a file was saved. */
export interface ShareStoryResult {
  success: boolean;
  autoOpened: boolean;
  fallbackUsed: boolean;
  cancelled?: boolean;
  error?: string;
}

export interface StoryShareAdapter {
  capture: () => Promise<string>;
  openInstagram?: (uri: string) => Promise<boolean>;
  shareImage: (uri: string) => Promise<'opened' | 'cancelled' | 'unavailable'>;
}

export async function handoffStory(adapter: StoryShareAdapter): Promise<ShareStoryResult> {
  const failed = { success: false, autoOpened: false, fallbackUsed: false };
  try {
    const uri = await adapter.capture();
    if (!uri) return { ...failed, error: 'Your story image is not ready. Please try again.' };
    if (adapter.openInstagram) {
      try {
        if (await adapter.openInstagram(uri)) {
          return { success: true, autoOpened: true, fallbackUsed: false };
        }
      } catch { /* Instagram may be missing. Preserve the attached-image fallback. */ }
    }
    const result = await adapter.shareImage(uri);
    if (result === 'cancelled') return { ...failed, fallbackUsed: true, cancelled: true };
    if (result === 'unavailable') return { ...failed, error: 'Image sharing is unavailable on this device. Try saving your story instead.' };
    return { success: true, autoOpened: false, fallbackUsed: true };
  } catch {
    return { ...failed, error: 'We could not prepare your story image. Please try again.' };
  }
}

export interface SaveGalleryResult { success: boolean; savedDirectly?: boolean; error?: string }

export async function exportStoryImage(adapter: {
  capture: () => Promise<string>;
  saveToPhotos: (uri: string) => Promise<boolean>;
  exportImage: (uri: string) => Promise<boolean>;
}): Promise<SaveGalleryResult> {
  try {
    const uri = await adapter.capture();
    if (!uri) return { success: false, error: 'Your story image is not ready.' };
    if (await adapter.saveToPhotos(uri)) return { success: true, savedDirectly: true };
    if (await adapter.exportImage(uri)) return { success: true, savedDirectly: false };
    return { success: false, error: 'Photo saving is unavailable. Check Photos permissions and try again.' };
  } catch {
    return { success: false, error: 'We could not save your story image. Please try again.' };
  }
}
