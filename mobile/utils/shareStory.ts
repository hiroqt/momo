import { Platform, PixelRatio, Share as RNShare } from 'react-native';
import { storyCaptureSize } from './storyCapture';
import { handoffStory, exportStoryImage } from './shareStoryFlow';
export type { ShareStoryResult, SaveGalleryResult } from './shareStoryFlow';
import type { ShareStoryResult, SaveGalleryResult } from './shareStoryFlow';

function getCaptureRef(): ((viewRef: any, options?: any) => Promise<string>) | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const viewShot = require('react-native-view-shot');
    return viewShot.captureRef || viewShot.default?.captureRef || null;
  } catch (err) {
    console.warn('[shareStory] react-native-view-shot not available in binary:', err);
    return null;
  }
}

function getExpoSharing(): any {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('expo-sharing');
  } catch (err) {
    console.warn('[shareStory] expo-sharing not available in binary:', err);
    return null;
  }
}

function getExpoMediaLibrary(): any {
  // If running inside Expo Go on Android, skip direct MediaLibrary access because
  // Google Play permission policies in Expo Go prevent full media library access.
  // The app will cleanly use the native expo-sharing fallback without noisy warnings.
  if (Platform.OS === 'android') {
    const isExpoGo = typeof expo !== 'undefined' && (globalThis as any).expo?.modules?.ExpoGo;
    if (isExpoGo) {
      return null;
    }
  }

  try {
    // Prefer modern expo-media-library (Expo SDK 57+)
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('expo-media-library');
  } catch {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      return require('expo-media-library/legacy');
    } catch (err) {
      console.warn('[shareStory] expo-media-library not available in binary:', err);
      return null;
    }
  }
}

function getExpoIntentLauncher(): any {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('expo-intent-launcher');
  } catch (err) {
    console.warn('[shareStory] expo-intent-launcher not available in binary:', err);
    return null;
  }
}

/**
 * Converts a local file:// URI to a secure content:// URI via FileProvider on Android.
 */
async function getContentUri(fileUri: string): Promise<string> {
  if (Platform.OS !== 'android') return fileUri;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const FileSystem = require('expo-file-system/legacy');
    if (FileSystem && typeof FileSystem.getContentUriAsync === 'function') {
      return await FileSystem.getContentUriAsync(fileUri);
    }
  } catch {}

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const FileSystem = require('expo-file-system');
    if (FileSystem && typeof FileSystem.getContentUriAsync === 'function') {
      return await FileSystem.getContentUriAsync(fileUri);
    }
  } catch {}

  return fileUri;
}

/**
 * Directly writes an image file into the user's Photos/Gallery album via MediaLibrary.
 * Works on both Android and iOS without opening system chooser or clipboard.
 */
async function saveImageToMediaLibrary(uri: string): Promise<{ success: boolean; uri?: string }> {
  try {
    const MediaLibrary = getExpoMediaLibrary();
    if (!MediaLibrary) return { success: false };

    // Request permissions (write-only where supported)
    try {
      if (typeof MediaLibrary.requestPermissionsAsync === 'function') {
        const permission = await MediaLibrary.requestPermissionsAsync(true);
        if (!permission.granted) return { success: false };
      }
    } catch (permErr) {
      console.warn('[shareStory] requestPermissionsAsync warning:', permErr);
    }

    let assetUri = uri;

    // 1. Legacy / Expo Go API: createAssetAsync
    if (typeof MediaLibrary.createAssetAsync === 'function') {
      try {
        const asset = await MediaLibrary.createAssetAsync(uri);
        if (asset?.uri) {
          assetUri = asset.uri;
        }
        return { success: true, uri: assetUri };
      } catch (err) {
        console.warn('[shareStory] createAssetAsync error:', err);
      }
    }

    // 2. Legacy / Expo Go API: saveToLibraryAsync
    if (typeof MediaLibrary.saveToLibraryAsync === 'function') {
      try {
        await MediaLibrary.saveToLibraryAsync(uri);
        return { success: true, uri: assetUri };
      } catch (err) {
        console.warn('[shareStory] saveToLibraryAsync error:', err);
      }
    }

    // 3. Modern Expo SDK 57+ API: MediaLibrary.Asset.create(filePath)
    if (MediaLibrary.Asset && typeof MediaLibrary.Asset.create === 'function') {
      try {
        const asset = await MediaLibrary.Asset.create(uri);
        if (asset) {
          if (typeof asset.getUri === 'function') {
            try {
              assetUri = await asset.getUri();
            } catch {}
          } else if (asset.id && asset.id.startsWith('content://')) {
            assetUri = asset.id;
          }
          return { success: true, uri: assetUri };
        }
      } catch (err) {
        console.warn('[shareStory] Asset.create error:', err);
      }
    }
  } catch (outerErr) {
    console.warn('[shareStory] saveImageToMediaLibrary error:', outerErr);
  }

  return { success: false };
}

/**
 * Saves the 9:16 Academic Weapon Card directly to the user's Camera Roll / Photos.
 * Uses MediaLibrary directly so it saves immediately without opening the share sheet.
 */
export async function saveCardToGallery(cardRef: React.RefObject<any>): Promise<SaveGalleryResult> {
  if (!cardRef?.current) return { success: false, error: 'Card preview is not ready yet.' };
  const capture = getCaptureRef();
  if (!capture) return { success: false, error: 'Image generation is not supported on this device.' };
  return exportStoryImage({
    capture: () => capture(cardRef, { format: 'png', quality: 1, result: 'tmpfile', ...storyCaptureSize(Platform.OS, PixelRatio.get()) }),
    saveToPhotos: async uri => (await saveImageToMediaLibrary(uri)).success,
    exportImage: async uri => {
      const sharing = getExpoSharing();
      if (!sharing?.shareAsync || !await sharing.isAvailableAsync()) return false;
      await sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Save your Momo study story', UTI: 'public.png' });
      return true;
    },
  });
}

/** Opens an Instagram draft when supported, otherwise shares the actual PNG.
 * Sharing never requests Photos access or claims the user published a story.
 */
export async function shareToInstagramStory(cardRef: React.RefObject<any>): Promise<ShareStoryResult> {
  if (!cardRef?.current) {
    return { success: false, autoOpened: false, fallbackUsed: false, error: 'Your story preview is not ready yet.' };
  }
  const capture = getCaptureRef();
  if (!capture) {
    return { success: false, autoOpened: false, fallbackUsed: false, error: 'Story images are unavailable in this build.' };
  }
  return handoffStory({
    capture: () => capture(cardRef, { format: 'png', quality: 1, result: 'tmpfile', ...storyCaptureSize(Platform.OS, PixelRatio.get()) }),
    openInstagram: Platform.OS === 'android' ? async (uri) => {
      const launcher = getExpoIntentLauncher();
      if (!launcher?.startActivityAsync) return false;
      const contentUri = await getContentUri(uri);
      // Android receivers need a readable content URI; file URIs cannot safely attach.
      if (!contentUri.startsWith('content://')) return false;
      await launcher.startActivityAsync('com.instagram.share.ADD_TO_STORY', {
        type: 'image/png', data: contentUri, flags: 1,
        packageName: 'com.instagram.android',
        extra: { top_background_color: '#F8F5FF', bottom_background_color: '#FFF8F0' },
      });
      return true;
    } : undefined,
    shareImage: async (uri) => {
      if (Platform.OS === 'ios') {
        const result = await RNShare.share({ url: uri, title: 'My Momo study progress' });
        return result.action === RNShare.dismissedAction ? 'cancelled' : 'opened';
      }
      const sharing = getExpoSharing();
      if (sharing?.shareAsync && await sharing.isAvailableAsync()) {
        await sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share your Momo study story', UTI: 'public.png' });
        // Expo does not expose chooser cancellation. This means handoff only.
        return 'opened';
      }
      return 'unavailable';
    },
  });
}
