import assert from 'node:assert/strict';
import test from 'node:test';
import { formatBalance, tradeEligibility } from '../utils/shopRules';

test('study wallet remains readable for empty, ordinary and large balances', () => {
  assert.equal(formatBalance(0), '0');
  assert.equal(formatBalance(1250), '1,250');
  assert.equal(formatBalance(10000), '10k');
  assert.equal(formatBalance(12500), '12.5k');
  assert.equal(formatBalance(1000000), '1m');
  assert.equal(formatBalance(NaN), '0');
});

test('XP trade requires the full cost, including the exact affordability boundary', () => {
  assert.deepEqual(tradeEligibility(499, 500), { eligible: false, missingXp: 1 });
  assert.deepEqual(tradeEligibility(500, 500), { eligible: true, missingXp: 0 });
  assert.deepEqual(tradeEligibility(501, 500), { eligible: true, missingXp: 0 });
  assert.equal(tradeEligibility(NaN, 500).eligible, false);
  assert.equal(tradeEligibility(-1, 500).eligible, false);
  assert.equal(tradeEligibility(500, 0).eligible, false);
});
