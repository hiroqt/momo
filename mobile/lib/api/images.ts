import { apiFetch } from './client';

export interface GenerateImageResponse {
  image_base64: string;
  provider: string;
  prompt: string;
  mime_type: string;
  mode: ImageGenerationMode;
}

export type ImageGenerationMode = 'image' | 'diagram';
export type ImageAspectRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:4';

export interface GenerateImageRequest {
  prompt: string;
  topic?: string;
  context?: string;
  requirements?: string;
  mode: ImageGenerationMode;
  aspect_ratio?: ImageAspectRatio;
}

export async function generateImage(
  request: GenerateImageRequest
): Promise<GenerateImageResponse> {
  return apiFetch<GenerateImageResponse>('/api/images/generate', {
    method: 'POST',
    body: JSON.stringify(request),
  }, 90000);
}

/** Backward-compatible diagram helper used by study cards and flashcards. */
export async function generateStudyImage(
  prompt: string,
  topic?: string,
  context?: string
): Promise<GenerateImageResponse> {
  return generateImage({
    prompt,
    topic,
    context,
    mode: 'diagram',
  });
}
