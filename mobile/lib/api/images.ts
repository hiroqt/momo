import { apiFetch } from './client';

export interface GenerateImageResponse {
  image_base64: string;
  provider: string;
  prompt: string;
}

/**
 * Calls the backend to generate a clean 2D educational vector diagram.
 * Protected by backend authentication, rate-limiting (5/min), and guardrails.
 */
export async function generateStudyImage(
  prompt: string,
  topic?: string,
  context?: string
): Promise<GenerateImageResponse> {
  return apiFetch<GenerateImageResponse>('/api/images/generate', {
    method: 'POST',
    body: JSON.stringify({ prompt, topic, context }),
  });
}
