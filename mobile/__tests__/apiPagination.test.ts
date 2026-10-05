import assert from 'node:assert/strict';
import test from 'node:test';

import { collectPages } from '../lib/api/pagination';

test('collects records beyond the server page size', async () => {
  const records = Array.from({ length: 251 }, (_, id) => ({ id }));
  const offsets: number[] = [];
  const result = await collectPages(async (limit, offset) => {
    assert.equal(limit, 100);
    offsets.push(offset);
    return records.slice(offset, offset + limit);
  });
  assert.deepEqual(result, records);
  assert.deepEqual(offsets, [0, 100, 200]);
});

test('stops at an empty page when the total is an exact page multiple', async () => {
  const offsets: number[] = [];
  const result = await collectPages(async (limit, offset) => {
    offsets.push(offset);
    return offset === 0 ? Array.from({ length: limit }, (_, id) => id) : [];
  });
  assert.equal(result.length, 100);
  assert.deepEqual(offsets, [0, 100]);
});

test('failed later pages reject rather than returning incomplete libraries', async () => {
  await assert.rejects(collectPages(async (limit, offset) => {
    if (offset > 0) throw new Error('Network unavailable');
    return Array.from({ length: limit }, (_, id) => id);
  }), /Network unavailable/);
});

test('rejects malformed and oversized pages', async () => {
  await assert.rejects(collectPages(async () => null as unknown as number[]), /invalid page/);
  await assert.rejects(collectPages(async () => Array(101).fill(0)), /invalid page/);
});
