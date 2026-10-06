import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { applyWalletOperation, defaultWallet, HEART_REFILL_INTERVAL_MS, parseWallet, regenerateHearts } from '../lib/study/wallet';
import { WalletService } from '../lib/study/walletService';
import { MAX_HEARTS } from '../lib/study/heartCapacity';
import { memoryKv, sqliteFixture } from './helpers/sqliteFixture';

test('wallet starts at the PRD five-heart capacity and never exceeds it', () => {
  const wallet = defaultWallet(0);
  assert.equal(wallet.hearts, MAX_HEARTS);
  assert.equal(MAX_HEARTS, 5);
  assert.equal(applyWalletOperation(wallet, { key: 'k', hearts: 1 }, 0).outcome, 'capacity');
  const spent = applyWalletOperation(wallet, { key: 'a', hearts: -5 }, 0).state;
  assert.equal(applyWalletOperation(spent, { key: 'b', hearts: -1 }, 0).outcome, 'insufficient');
});

test('idempotency keys prevent double rewards and invalid amounts are rejected', () => {
  const first = applyWalletOperation(defaultWallet(0), { key: 'session:1:0', xp: 25 }, 0);
  assert.equal(first.outcome, 'applied');
  const replay = applyWalletOperation(first.state, { key: 'session:1:0', xp: 25 }, 0);
  assert.deepEqual([replay.outcome, replay.state.xp], ['duplicate', 25]);
  assert.equal(applyWalletOperation(first.state, { key: 'x', xp: 1.5 }, 0).outcome, 'invalid');
  assert.equal(applyWalletOperation(first.state, { key: '', xp: 1 }, 0).outcome, 'invalid');
  assert.equal(applyWalletOperation(first.state, { key: 'y', credits: -51 }, 0).outcome, 'insufficient');
});

test('hearts refill exactly at the 24 hour boundary, not before', () => {
  const empty = { ...defaultWallet(0), hearts: 0 };
  assert.equal(regenerateHearts(empty, HEART_REFILL_INTERVAL_MS - 1).hearts, 0);
  const refilled = regenerateHearts(empty, HEART_REFILL_INTERVAL_MS);
  assert.deepEqual([refilled.hearts, refilled.heartsResetAt], [5, HEART_REFILL_INTERVAL_MS]);
});

test('stored wallets with invalid balances or legacy fifteen hearts are not trusted', () => {
  assert.equal(parseWallet({ ...defaultWallet(0), hearts: 15 }), null);
  assert.equal(parseWallet({ ...defaultWallet(0), credits: -1 }), null);
  assert.equal(parseWallet({ ...defaultWallet(0), version: 2 }), null);
  assert.ok(parseWallet(defaultWallet(0)));
});

test('rapid synchronous spends cannot overdraw the balance', async () => {
  const f = sqliteFixture();
  try {
    const { db } = f.restart(); db.bindVerifiedAccount(randomUUID());
    const wallet = new WalletService(db, memoryKv(), () => 0);
    await wallet.load();
    const outcomes = [1, 2, 3].map(() => wallet.apply({ key: randomUUID(), credits: -30 }));
    assert.deepEqual(outcomes.map(o => o.outcome), ['applied', 'insufficient', 'insufficient']);
    await Promise.all(outcomes.map(o => o.persisted));
    assert.equal((await new WalletService(db, memoryKv(), () => 0).load())?.credits, 20);
  } finally { f.close(); }
});

test('legacy global preview balances migrate to the guest wallet only, clamped to five hearts', async () => {
  const f = sqliteFixture();
  try {
    const { db } = f.restart();
    const kv = memoryKv({ '@user_credits': '120', '@user_xp': '40', '@user_hearts': '15', '@user_hearts_reset_time': '5' });
    const guest = await new WalletService(db, kv, () => 10).load();
    assert.deepEqual([guest?.credits, guest?.xp, guest?.hearts], [120, 40, 5]);
    db.bindVerifiedAccount(randomUUID());
    const account = await new WalletService(db, kv, () => 10).load();
    assert.deepEqual([account?.credits, account?.xp], [50, 0]);
  } finally { f.close(); }
});

test('corrupt account wallet data fails closed', async () => {
  const f = sqliteFixture();
  try {
    const { db } = f.restart(); db.bindVerifiedAccount(randomUUID());
    await db.writeRecords([{ kind: 'wallet', id: 'local', data: { version: 1, credits: 'lots' } }]);
    await assert.rejects(new WalletService(db, memoryKv()).load(), /corrupt/);
  } finally { f.close(); }
});
