import assert from 'node:assert/strict';
import test from 'node:test';
import { buildUploadHeaders } from '../lib/api/uploadHeaders';

test('immutable signed constraints survive header normalization for both upload transports', () => {
  assert.deepEqual(buildUploadHeaders('text/plain', { 'if-none-match': '*', 'Content-Type': 'text/plain' }),
    { 'Content-Type': 'text/plain', 'If-None-Match': '*' });
  assert.deepEqual(buildUploadHeaders('text/plain', { 'X-Upsert': 'false' }),
    { 'Content-Type': 'text/plain', 'x-upsert': 'false' });
  assert.deepEqual(buildUploadHeaders('text/plain'), { 'Content-Type': 'text/plain' });
});
test('upload response cannot add credentials, overwrite permission or conflicting signed MIME', () => {
  const invalid: Record<string, string>[] = [{ Authorization: 'synthetic-bearer' }, { 'x-upsert': 'true' },
    { 'If-None-Match': 'different' }, { 'Content-Type': 'application/json' }, { Host: 'foreign' }];
  for (const required of invalid)
    assert.throws(() => buildUploadHeaders('text/plain', required), /Upload settings are invalid/);
  assert.throws(() => buildUploadHeaders('text/plain\r\nInjected: true'));
});

test('mock API uploads authenticate while signed provider URLs never receive the session token', async () => {
  const { withMockUploadAuth } = await import('../lib/api/uploadHeaders');
  const headers = { 'Content-Type': 'text/plain' };
  const path = '/api/documents/mock-upload/documents/11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222/original.txt';
  assert.deepEqual(withMockUploadAuth(headers, path, 'synthetic-session'), { ...headers, Authorization: 'Bearer synthetic-session' });
  assert.throws(() => withMockUploadAuth(headers, path, null), /sign in again/);
  for (const target of ['https://storage.example/upload', 'https://api.example'+path, path+'/extra', '/api/other'])
    assert.deepEqual(withMockUploadAuth(headers, target, 'synthetic-session'), headers);
});
