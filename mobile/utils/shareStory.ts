import { Alert, Linking, Platform, Share as RNShare } from 'react-native';

export interface ShareStoryResult {
  success: boolean;
  autoOpened: boolean;
  fallbackUsed: boolean;
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

function getExpoClipboard(): any {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('expo-clipboard');
  } catch (err) {
    console.warn('[shareStory] expo-clipboard not available in binary:', err);
    return null;
  }
}

/**
 * Safely checks whether Instagram or Instagram Stories is installed and queryable.
 */
export async function isInstagramInstalled(): Promise<boolean> {
  try {
    const hasStory = await Linking.canOpenURL('instagram-stories://share');
    if (hasStory) return true;
  } catch {}

  try {
    const hasCamera = await Linking.canOpenURL('instagram://story-camera');
    if (hasCamera) return true;
  } catch {}

  try {
    return await Linking.canOpenURL('instagram://app');
  } catch {
    return false;
  }
}

/**
 * Saves the 9:16 Academic Weapon Card directly to the user's Camera Roll / Photos.
 */
export async function saveCardToGallery(cardRef: React.RefObject<any>): Promise<{ success: boolean; error?: string }> {
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

    const MediaLibrary = getExpoMediaLibrary();
    if (MediaLibrary) {
      if (typeof MediaLibrary.requestPermissionsAsync === 'function') {
        const { status } = await MediaLibrary.requestPermissionsAsync(true);
        if (status !== 'granted') {
          return {
            success: false,
            error: 'Photo access was not granted. Please allow photos permission in Settings to save your card.',
          };
        }
      }

      if (typeof MediaLibrary.saveToLibraryAsync === 'function') {
        await MediaLibrary.saveToLibraryAsync(tmpUri);
        return { success: true };
      } else if (typeof MediaLibrary.createAssetAsync === 'function') {
        await MediaLibrary.createAssetAsync(tmpUri);
        return { success: true };
      }
    }

    // Fallback: If direct media library access is unavailable, open system sharing sheet with Save Image action
    const Sharing = getExpoSharing();
    if (Sharing && typeof Sharing.isAvailableAsync === 'function' && typeof Sharing.shareAsync === 'function') {
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(tmpUri, {
          mimeType: 'image/png',
          dialogTitle: 'Save Academic Weapon Card',
          UTI: 'public.png',
        });
        return { success: true };
      }
    }

    return { success: false, error: 'Could not access photo library on this device.' };
  } catch (err: any) {
    console.error('[saveCardToGallery] Error saving card to gallery:', err);
    return { success: false, error: err?.message || 'Failed to save image to photos.' };
  }
}

/**
 * Shares the 9:16 Academic Weapon Card directly to Instagram Stories on mobile.
 * 1. Captures view as a high-resolution PNG.
 * 2. Saves image to user's photo gallery so it's immediately available in camera roll.
 * 3. Copies image to clipboard for Instagram's "Add Sticker from Clipboard" prompt.
 * 4. Automatically opens Instagram Story (via instagram-stories://share or instagram://story-camera).
 * 5. Falls back seamlessly to Expo Sharing sheet if direct open is not available.
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

    // 2. Also capture base64 for clipboard sticker support
    let base64Data: string | null = null;
    try {
      base64Data = await capture(cardRef, {
        format: 'png',
        quality: 1.0,
        result: 'base64',
      });
    } catch (b64Err) {
      console.warn('[shareStory] base64 capture error (non-critical):', b64Err);
    }

    // 3. Automatically save image to photo gallery so it is directly at the top of recent photos in Instagram
    const MediaLibrary = getExpoMediaLibrary();
    if (MediaLibrary) {
      try {
        if (typeof MediaLibrary.requestPermissionsAsync === 'function') {
          const { status } = await MediaLibrary.requestPermissionsAsync(true);
          if (status === 'granted') {
            if (typeof MediaLibrary.saveToLibraryAsync === 'function') {
              await MediaLibrary.saveToLibraryAsync(tmpUri);
            } else if (typeof MediaLibrary.createAssetAsync === 'function') {
              await MediaLibrary.createAssetAsync(tmpUri);
            }
          }
        }
      } catch (saveErr) {
        console.warn('[shareStory] Auto-saving to gallery failed (non-critical):', saveErr);
      }
    }

    // 4. Copy image to clipboard (on iOS, opening Instagram automatically triggers "Add Sticker from Clipboard")
    if (base64Data) {
      const Clipboard = getExpoClipboard();
      if (Clipboard && typeof Clipboard.setImageAsync === 'function') {
        try {
          await Clipboard.setImageAsync(base64Data);
        } catch (clipErr) {
          console.warn('[shareStory] Clipboard copy failed (non-critical):', clipErr);
        }
      }
    }

    // 5. Check if Instagram is installed and auto-open directly to Instagram Story
    const hasInstagram = await isInstagramInstalled();

    if (hasInstagram) {
      const igStorySchemes = [
        'instagram-stories://share',
        'instagram://story-camera',
        'instagram://app',
      ];

      for (const scheme of igStorySchemes) {
        try {
          const canOpen = await Linking.canOpenURL(scheme);
          if (canOpen) {
            await Linking.openURL(scheme);
            return { success: true, autoOpened: true, fallbackUsed: false };
          }
        } catch (openErr) {
          console.warn(`[shareStory] Failed to open ${scheme}:`, openErr);
        }
      }
    }

    // 6. If direct URL could not be opened or Instagram is not installed, open system share sheet
    const Sharing = getExpoSharing();
    if (Sharing && typeof Sharing.isAvailableAsync === 'function' && typeof Sharing.shareAsync === 'function') {
      try {
        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          await Sharing.shareAsync(tmpUri, {
            mimeType: 'image/png',
            dialogTitle: hasInstagram ? 'Share to Instagram Story' : 'Share Academic Weapon Card',
            UTI: 'public.png',
          });
          return { success: true, autoOpened: false, fallbackUsed: !hasInstagram };
        }
      } catch (expoErr) {
        console.warn('[shareStory] ExpoSharing.shareAsync failed, falling back to RNShare:', expoErr);
      }
    }

    // 7. Core React Native Share fallback
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
