import assert from 'node:assert/strict';
import test from 'node:test';
import { canRefillHearts, heartPackGrant, normalizeHearts } from '../lib/study/heartCapacity';

test('legacy balances and corrupt values obey the five-heart limit', () => {
  assert.equal(normalizeHearts('15'), 5);
  assert.equal(normalizeHearts('-1'), 0);
  assert.equal(normalizeHearts('broken'), 5);
});

test('refill pack tops up any missing hearts; fixed packs must fit under the cap', () => {
  const refill = { amount: 5, refill: true }, three = { amount: 3 };
  assert.deepEqual([0, 1, 2, 4, 5].map(h => heartPackGrant(h, refill)), [5, 4, 3, 1, 0]);
  assert.deepEqual([0, 2, 3, 5].map(h => heartPackGrant(h, three)), [3, 3, 0, 0]);
  assert.equal(heartPackGrant(-1, refill), 0);
  assert.equal(heartPackGrant(NaN, three), 0);
});
test('full and overflow refills cannot spend currency for missing rewards', () => {
  assert.equal(canRefillHearts(5, 1), false);
  assert.equal(canRefillHearts(4, 5), false);
  assert.equal(canRefillHearts(0, 5), true);
  assert.equal(canRefillHearts(4, 1), true);
  assert.equal(canRefillHearts(0, -1), false);
  assert.equal(canRefillHearts(0, NaN), false);
});
