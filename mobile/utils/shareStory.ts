import { Alert, Linking, Platform } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';

export interface ShareStoryResult {
  success: boolean;
  fallbackUsed: boolean;
  error?: string;
}

/**
 * Safely checks whether Instagram is installed on the user's device.
 */
export async function isInstagramInstalled(): Promise<boolean> {
  try {
    return await Linking.canOpenURL('instagram://app');
  } catch {
    return false;
  }
}

/**
 * Shares the 9:16 Academic Weapon Card directly to Instagram Stories on mobile.
 * Uses native Expo Sharing with high-resolution image/png payload so the mobile OS
 * routes directly to Instagram Stories, with zero TurboModule crash risks.
 */
export async function shareToInstagramStory(cardRef: React.RefObject<any>): Promise<ShareStoryResult> {
  if (!cardRef || !cardRef.current) {
    return { success: false, fallbackUsed: false, error: 'Card reference is not ready.' };
  }

  try {
    // 1. Capture the story card as a temporary PNG file with 100% quality
    const tmpUri = await captureRef(cardRef, {
      format: 'png',
      quality: 1.0,
      result: 'tmpfile',
    });

    // 2. Check if device can share
    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      Alert.alert(
        'Sharing Unavailable',
        'Sharing is not available on this device.'
      );
      return { success: false, fallbackUsed: false, error: 'Sharing unavailable' };
    }

    // 3. Check if Instagram is installed for contextual dialog title
    const hasInstagram = await isInstagramInstalled();

    // 4. Open native share sheet with image/png MIME type
    await Sharing.shareAsync(tmpUri, {
      mimeType: 'image/png',
      dialogTitle: hasInstagram ? 'Share to Instagram Story' : 'Share Academic Weapon Card',
      UTI: 'public.png',
    });

    return { success: true, fallbackUsed: !hasInstagram };
  } catch (err: any) {
    console.error('[shareStory] Error capturing or sharing story card:', err);
    return { success: false, fallbackUsed: false, error: err?.message || 'Failed to share card' };
  }
}
