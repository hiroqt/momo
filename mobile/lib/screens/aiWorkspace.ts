export type AssistantMode = 'ask' | 'study' | 'image';

/** Keep the same validated input boundary for button state and submission. */
export function canSubmitAiPrompt(prompt: string, busy: boolean): boolean {
  return prompt.trim().length > 1 && !busy;
}

export function buildChatPrompt(mode: Exclude<AssistantMode, 'image'>, prompt: string): string {
  const clean = prompt.trim();
  return mode === 'study' ? `Create grounded study material from my notes: ${clean}` : clean;
}

/** API failures may include server URLs or diagnostics; only show curated guidance. */
export function getImageErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  if (message.startsWith('[TIMEOUT]')) return 'Momo could not connect. Check your internet connection and try again.';
  if (/^\[(AUTH_REQUIRED|HTTP_401|UNAUTHORIZED)\]/.test(message)) return 'Please sign in before creating an image.';
  if (/^\[(RATE_LIMITED|RATE_LIMIT_EXCEEDED|HTTP_429)\]/.test(message)) return 'You have made several requests. Give Momo a moment, then try again.';
  return 'Momo could not create that image right now. Please try again.';
}
