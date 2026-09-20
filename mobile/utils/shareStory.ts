import { Alert, Linking, Platform, Share as RNShare } from 'react-native';

export interface ShareStoryResult {
  success: boolean;
  autoOpened: boolean;
  fallbackUsed: boolean;
  error?: string;
}

export interface SaveGalleryResult {
  success: boolean;
  savedDirectly?: boolean;
  error?: string;
}

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
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('expo-media-library/legacy');
  } catch {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      return require('expo-media-library');
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
        await MediaLibrary.requestPermissionsAsync(true);
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
  if (!cardRef || !cardRef.current) {
    return { success: false, error: 'Card preview is not ready yet.' };
  }

  try {
    const capture = getCaptureRef();
    if (!capture) {
      return { success: false, error: 'Image generation is not supported on this device.' };
    }

    // Capture card as PNG with 100% fidelity
    const tmpUri = await capture(cardRef, {
      format: 'png',
      quality: 1.0,
      result: 'tmpfile',
    });

    // 1. Save directly to photo library without opening system share sheet
    const saveRes = await saveImageToMediaLibrary(tmpUri);
    if (saveRes.success) {
      return { success: true, savedDirectly: true };
    }

    // 2. Fallback only if MediaLibrary is completely unavailable
    const Sharing = getExpoSharing();
    if (Sharing && typeof Sharing.isAvailableAsync === 'function' && typeof Sharing.shareAsync === 'function') {
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(tmpUri, {
          mimeType: 'image/png',
          dialogTitle: 'Save Academic Weapon Card',
          UTI: 'public.png',
        });
        return { success: true, savedDirectly: false };
      }
    }

    return { success: false, error: 'Could not access photo saving on this device.' };
  } catch (err: any) {
    console.error('[saveCardToGallery] Error saving card to gallery:', err);
    return { success: false, error: err?.message || 'Failed to save image to photos.' };
  }
}

/**
 * Shares the 9:16 Academic Weapon Card directly to Instagram Stories on mobile.
 * 1. Captures view as a high-resolution PNG temporary file.
 * 2. Directly saves the image to device Photos so it is guaranteed in the user's gallery.
 * 3. On Android:
 *    - Tries Meta's official 'com.instagram.share.ADD_TO_STORY' intent with media content URI.
 *    - Falls back to opening Instagram Story Camera / Instagram app directly.
 *    - Avoids the generic system share sheet to prevent unwanted "Copy to clipboard" options.
 * 4. On iOS: Passes PNG file to native share sheet (UIActivityViewController) which directly
 *    loads the image into Instagram Stories with the preview visible.
 */
export async function shareToInstagramStory(cardRef: React.RefObject<any>): Promise<ShareStoryResult> {
  if (!cardRef || !cardRef.current) {
    return { success: false, autoOpened: false, fallbackUsed: false, error: 'Card reference is not ready.' };
  }

  try {
    const capture = getCaptureRef();
    if (!capture) {
      Alert.alert(
        'Feature Unavailable',
        'Story image generation is not supported on this build.'
      );
      return { success: false, autoOpened: false, fallbackUsed: false, error: 'View shot unavailable' };
    }

    // 1. Capture the story card as a temporary PNG file with 100% quality
    const tmpUri = await capture(cardRef, {
      format: 'png',
      quality: 1.0,
      result: 'tmpfile',
    });

    // 2. Directly save card to user's gallery so it's always ready in the device Photos
    const saveRes = await saveImageToMediaLibrary(tmpUri);
    const mediaUri = saveRes.uri || tmpUri;

    // 3. Android: Direct Instagram Launch
    if (Platform.OS === 'android') {
      const IntentLauncher = getExpoIntentLauncher();

      // 3a. Try Meta's official Instagram Story Intent
      if (IntentLauncher && typeof IntentLauncher.startActivityAsync === 'function') {
        const storyContentUri = mediaUri.startsWith('content://') ? mediaUri : await getContentUri(tmpUri);
        try {
          await IntentLauncher.startActivityAsync('com.instagram.share.ADD_TO_STORY', {
            type: 'image/png',
            data: storyContentUri,
            flags: 1, // Intent.FLAG_GRANT_READ_URI_PERMISSION
            extra: {
              interactive_asset_uri: storyContentUri,
              content_url: storyContentUri,
              source_application: 'com.aistudy.platform',
              top_background_color: '#09071A',
              bottom_background_color: '#09071A',
            },
          });
          return { success: true, autoOpened: true, fallbackUsed: false };
        } catch (intentErr) {
          console.warn('[shareStory] ADD_TO_STORY intent threw:', intentErr);
        }
      }

      // 3b. Try Instagram Story Camera deep links directly
      const storyCameraUrls = [
        'intent://story-camera#Intent;package=com.instagram.android;scheme=https;end',
        'instagram://story-camera',
        'instagram://camera',
      ];
      for (const url of storyCameraUrls) {
        try {
          await Linking.openURL(url);
          return { success: true, autoOpened: true, fallbackUsed: false };
        } catch {}
      }

      // 3c. Try launching Instagram application directly
      if (IntentLauncher && typeof IntentLauncher.openApplication === 'function') {
        try {
          IntentLauncher.openApplication('com.instagram.android');
          return { success: true, autoOpened: true, fallbackUsed: false };
        } catch {}
      }

      try {
        await Linking.openURL('instagram://app');
        return { success: true, autoOpened: true, fallbackUsed: false };
      } catch {}
    }

    // 4. iOS: Native Share Sheet with Image File Attached (UIActivityViewController)
    // On iOS, Sharing.shareAsync passes the PNG directly to Instagram Stories
    // so Instagram loads the image with the preview visible.
    const Sharing = getExpoSharing();
    if (Sharing && typeof Sharing.isAvailableAsync === 'function' && typeof Sharing.shareAsync === 'function') {
      try {
        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          await Sharing.shareAsync(tmpUri, {
            mimeType: 'image/png',
            dialogTitle: 'Share to Instagram Story',
            UTI: 'public.png',
          });
          return { success: true, autoOpened: false, fallbackUsed: false };
        }
      } catch (expoErr) {
        console.warn('[shareStory] ExpoSharing failed, falling back to RNShare:', expoErr);
      }
    }

    // 5. Core React Native Share fallback
    await RNShare.share(
      Platform.OS === 'ios'
        ? { url: tmpUri, title: 'Academic Weapon Card' }
        : { message: 'Check out my study session on Momo!', url: tmpUri, title: 'Academic Weapon Card' }
    );

    return { success: true, autoOpened: false, fallbackUsed: true };
  } catch (err: any) {
    console.error('[shareStory] Error capturing or sharing story card:', err);
    return { success: false, autoOpened: false, fallbackUsed: false, error: err?.message || 'Failed to share card' };
  }
}
