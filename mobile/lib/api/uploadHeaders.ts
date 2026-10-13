/** Only provider upload constraints may come from the signed-upload response. */
export function buildUploadHeaders(mimeType: string, required: Record<string, string> = {}): Record<string, string> {
  if (!mimeType || /[\r\n]/.test(mimeType)) throw new Error('Upload settings are invalid.');
  if (!required || typeof required !== 'object' || Array.isArray(required)) throw new Error('Upload settings are invalid.');
  const headers: Record<string, string> = { 'Content-Type': mimeType };
  for (const [name, value] of Object.entries(required)) {
    switch (name.toLowerCase()) {
      case 'content-type':
        if (value !== mimeType) throw new Error('Upload settings are invalid.');
        break;
      case 'if-none-match':
        if (value !== '*') throw new Error('Upload settings are invalid.');
        headers['If-None-Match'] = '*';
        break;
      case 'x-upsert':
        if (value !== 'false') throw new Error('Upload settings are invalid.');
        headers['x-upsert'] = 'false';
        break;
      default:
        throw new Error('Upload settings are invalid.');
    }
  }
  return headers;
}

/** Development mock upload uses the authenticated API; never attach auth to provider URLs. */
export function withMockUploadAuth(headers: Record<string, string>, uploadUrl: string, token: string | null): Record<string, string> {
  const mockPath = /^\/api\/documents\/mock-upload\/documents\/[0-9a-f-]{36}\/[0-9a-f-]{36}\/original\.(pdf|docx|txt|pptx)$/i;
  if (!mockPath.test(uploadUrl)) return headers;
  if (!token) throw new Error('Please sign in again to upload your document.');
  return { ...headers, Authorization: `Bearer ${token}` };
}
