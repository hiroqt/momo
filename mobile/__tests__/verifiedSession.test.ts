import assert from 'node:assert/strict';
import test from 'node:test';
import { VerifiedSession } from '../lib/auth/verifiedSession';

const USER_A = '10000000-0000-4000-8000-000000000001';
const USER_B = '10000000-0000-4000-8000-000000000002';

test('session binds only a backend verified account and clears identity on logout', async () => {
  let token: string | null = null;
  let account: string | null = USER_B;
  const session = new VerifiedSession({
    setToken(value) { token = value; },
    bindAccount(value) { account = value; },
    async verify() {
      assert.equal(account, null);
      assert.equal(token, 'synthetic-token');
      return { id: USER_A };
    },
  });
  assert.equal(await session.establish('synthetic-token'), USER_A);
  assert.equal(account, USER_A);
  session.clear();
  assert.equal(account, null);
  assert.equal(token, null);
});

test('failed verification fails closed without leaking provider text', async () => {
  let token: string | null = 'old';
  let account: string | null = USER_A;
  const session = new VerifiedSession({
    setToken(value) { token = value; },
    bindAccount(value) { account = value; },
    async verify() { throw new Error('private-provider-payload'); },
  });
  await assert.rejects(session.establish('invalid'), /Could not verify your session/);
  assert.equal(token, null);
  assert.equal(account, null);
});

test('late verification cannot restore an account after logout', async () => {
  let resolve!: (value: { id: string }) => void;
  let account: string | null = null;
  const session = new VerifiedSession({
    setToken() {},
    bindAccount(value) { account = value; },
    verify: () => new Promise((done) => { resolve = done; }),
  });
  const pending = session.establish('synthetic-token');
  session.clear();
  resolve({ id: USER_A });
  await assert.rejects(pending);
  assert.equal(account, null);
});

test('late account A cannot overwrite or clear newer account B', async () => {
  let account: string | null = null;
  let calls = 0;
  let resolve!: (value: { id: string }) => void;
  const session = new VerifiedSession({
    setToken() {},
    bindAccount(value) { account = value; },
    verify: () => ++calls === 1 ? new Promise((done) => { resolve = done; }) : Promise.resolve({ id: USER_B }),
  });
  const pendingA = session.establish('a');
  await session.establish('b');
  resolve({ id: USER_A });
  await assert.rejects(pendingA);
  assert.equal(account, USER_B);
});
