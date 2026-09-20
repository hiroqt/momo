import { Alert, Linking, Platform } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import Share, { Social } from 'react-native-share';
import * as Sharing from 'expo-sharing';

export interface ShareStoryResult {
  success: boolean;
  fallbackUsed: boolean;
  error?: string;
}

/**
 * Automatically launches directly into the Instagram Story composer on the user's mobile device
 * with the rendered 9:16 Academic Weapon Card placed as a sticker or background image.
 */
export async function shareToInstagramStory(cardRef: React.RefObject<any>): Promise<ShareStoryResult> {
  if (!cardRef || !cardRef.current) {
    return { success: false, fallbackUsed: false, error: 'Card reference is not ready.' };
  }

  try {
    // 1. Capture the story card as base64 PNG data
    const base64Data = await captureRef(cardRef, {
      format: 'png',
      quality: 1.0,
      result: 'base64',
    });

    const stickerImage = `data:image/png;base64,${base64Data}`;

    // 2. Direct automatic launch into Instagram Stories
    try {
      await Share.shareSingle({
        social: Social.InstagramStories,
        stickerImage,
        backgroundTopColor: '#09071A',
        backgroundBottomColor: '#1A0B2E',
        appId: 'com.aistudy.platform',
        attributionURL: 'https://momo.study',
      });
      return { success: true, fallbackUsed: false };
    } catch (shareSingleErr: any) {
      console.warn('[shareStory] Direct Instagram Stories intent failed or Instagram not found, using fallback:', shareSingleErr);

      // 3. Fallback: Save as temporary file and open native system share sheet
      const tmpUri = await captureRef(cardRef, {
        format: 'png',
        quality: 1.0,
        result: 'tmpfile',
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(tmpUri, {
          mimeType: 'image/png',
          dialogTitle: 'Share Academic Weapon Card',
          UTI: 'public.png',
        });
        return { success: true, fallbackUsed: true };
      } else {
        Alert.alert(
          'Instagram Not Detected',
          'Instagram does not seem to be installed on your device, and system sharing is unavailable.'
        );
        return { success: false, fallbackUsed: false, error: 'Instagram not installed' };
      }
    }
  } catch (err: any) {
    console.error('[shareStory] Error capturing or sharing story card:', err);
    return { success: false, fallbackUsed: false, error: err?.message || 'Failed to share card' };
  }
}
