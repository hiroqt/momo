import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { StudySessionService } from '../lib/study/studySessionService';
import { WalletService } from '../lib/study/walletService';
import { restoreFlashcardSession, restoreQuizSession } from '../lib/study/sessionResume';
import type { LocalDatabase } from '../lib/storage/localDb';
import type { StudyItem } from '../types';
import { memoryKv, sqliteFixture } from './helpers/sqliteFixture';

function services(db: LocalDatabase, kv = memoryKv()) {
  let queued = 0;
  const wallet = new WalletService(db, kv, () => 1_000_000);
  const sessions = new StudySessionService({ db, wallet, uuid: randomUUID, onEventQueued: () => { queued++; } });
  return { wallet, sessions, queuedCount: () => queued };
}
function items(count: number): StudyItem[] {
  return Array.from({ length: count }, (_, index) => ({
    id: randomUUID(), study_set_id: 'set', type: 'identification', question: `Q${index}`, answer: `A${index}`,
    difficulty: 'medium', source_metadata: {}, order_index: index, created_at: new Date(0).toISOString(),
  }) as StudyItem);
}
const correct = { answer: 'A0', status: 'correct' as const, xp: 25, streak: 1, heartCost: 0 };
const wrong = { answer: 'nope', status: 'incorrect' as const, xp: 0, streak: 0, heartCost: 1 };

test('answers survive process death, resume restores them and rewards are granted exactly once', async () => {
  const f = sqliteFixture();
  try {
    const owner = randomUUID(), setId = randomUUID(), questions = items(3);
    let { db } = f.restart(); db.bindVerifiedAccount(owner);
    let svc = services(db); await svc.wallet.load();
    const { session } = await svc.sessions.begin({ studySetId: setId, mode: 'quiz', itemIds: questions.map(q => q.id), resume: true });
    const first = await svc.sessions.commitAnswer(session.id, 0, correct, { studyItemId: questions[0].id, result: 'correct', userAnswer: 'A0' });
    assert.equal(first.committed, true);
    await svc.sessions.commitAnswer(session.id, 1, wrong, { studyItemId: questions[1].id, result: 'incorrect' });
    await svc.sessions.saveProgress(session.id, { currentIndex: 2, remainingMs: { 2: 4200 } });
    assert.equal(svc.queuedCount(), 2);

    // Simulated kill: brand new database handle and services.
    ({ db } = f.restart()); db.bindVerifiedAccount(owner);
    svc = services(db); const wallet = await svc.wallet.load();
    assert.equal(wallet?.xp, 25);
    assert.equal(wallet?.hearts, 4);
    assert.equal((await db.getPendingSyncEvents()).length, 2);
    const resumed = await svc.sessions.begin({ studySetId: setId, mode: 'quiz', itemIds: [...questions].reverse().map(q => q.id), resume: true });
    assert.equal(resumed.resumed, true);
    const restored = restoreQuizSession(resumed.session, [...questions].reverse());
    assert.deepEqual(restored.items.map(q => q.id), questions.map(q => q.id));
    assert.equal(restored.index, 2);
    assert.equal(restored.remainingMs[2], 4200);
    assert.equal(restored.answers[0].status, 'correct');

    // A repeated tap or replay after resume cannot double-reward or double-queue.
    const again = await svc.sessions.commitAnswer(session.id, 0, correct, { studyItemId: questions[0].id, result: 'correct' });
    assert.deepEqual([again.committed, again.committed ? null : again.reason], [false, 'already_answered']);
    assert.equal(svc.wallet.getState()?.xp, 25);
    assert.equal((await db.getPendingSyncEvents()).length, 2);
  } finally { f.close(); }
});

test('concurrent duplicate commits for one question apply a single reward', async () => {
  const f = sqliteFixture();
  try {
    const owner = randomUUID(), { db } = f.restart(); db.bindVerifiedAccount(owner);
    const svc = services(db); await svc.wallet.load();
    const questions = items(1);
    const { session } = await svc.sessions.begin({ studySetId: 'set', mode: 'quiz', itemIds: [questions[0].id], resume: false });
    const results = await Promise.all([1, 2, 3].map(() => svc.sessions.commitAnswer(session.id, 0, correct, { studyItemId: questions[0].id, result: 'correct' })));
    assert.equal(results.filter(r => r.committed).length, 1);
    assert.equal(svc.wallet.getState()?.xp, 25);
    assert.equal((await db.getPendingSyncEvents()).length, 1);
  } finally { f.close(); }
});

test('a failed transaction rolls back the answer, event and reward together', async () => {
  const f = sqliteFixture();
  try {
    const owner = randomUUID(), { db, sqlite } = f.restart(); db.bindVerifiedAccount(owner);
    const svc = services(db); await svc.wallet.load();
    const questions = items(1);
    const { session } = await svc.sessions.begin({ studySetId: 'set', mode: 'quiz', itemIds: [questions[0].id], resume: false });
    sqlite.exec("CREATE TRIGGER reject_wallet BEFORE INSERT ON account_records WHEN NEW.kind='wallet' BEGIN SELECT RAISE(ABORT,'disk failure simulation'); END;");
    await assert.rejects(svc.sessions.commitAnswer(session.id, 0, correct, { studyItemId: questions[0].id, result: 'correct' }), /disk failure/);
    sqlite.exec('DROP TRIGGER reject_wallet');
    assert.deepEqual(await db.getPendingSyncEvents(), []);
    const reopened = services(db); assert.equal((await reopened.wallet.load())?.xp, 0);
    const retry = await reopened.sessions.commitAnswer(session.id, 0, correct, { studyItemId: questions[0].id, result: 'correct' });
    assert.equal(retry.committed, true);
    assert.equal(reopened.wallet.getState()?.xp, 25);
  } finally { f.close(); }
});

test('out of hearts refuses the answer without a partial commit', async () => {
  const f = sqliteFixture();
  try {
    const owner = randomUUID(), { db } = f.restart(); db.bindVerifiedAccount(owner);
    const svc = services(db); await svc.wallet.load();
    const questions = items(6);
    const { session } = await svc.sessions.begin({ studySetId: 'set', mode: 'quiz', itemIds: questions.map(q => q.id), resume: false });
    for (let index = 0; index < 5; index++) assert.equal((await svc.sessions.commitAnswer(session.id, index, wrong, null)).committed, true);
    const blocked = await svc.sessions.commitAnswer(session.id, 5, wrong, null);
    assert.deepEqual([blocked.committed, blocked.committed ? null : blocked.reason], [false, 'no_hearts']);
    assert.equal(svc.wallet.getState()?.hearts, 0);
  } finally { f.close(); }
});

test('sessions and wallets are account partitioned and restarting abandons the old session', async () => {
  const f = sqliteFixture();
  try {
    const a = randomUUID(), b = randomUUID(), { db } = f.restart();
    const questions = items(2), ids = questions.map(q => q.id);
    db.bindVerifiedAccount(a);
    const svc = services(db); await svc.wallet.load();
    const { session } = await svc.sessions.begin({ studySetId: 'set', mode: 'quiz', itemIds: ids, resume: true });
    await svc.sessions.commitAnswer(session.id, 0, correct, null);
    db.bindVerifiedAccount(b); await svc.wallet.load();
    assert.equal(svc.wallet.getState()?.xp, 0);
    assert.equal((await svc.sessions.begin({ studySetId: 'set', mode: 'quiz', itemIds: ids, resume: true })).resumed, false);
    await assert.rejects(svc.sessions.commitAnswer(session.id, 1, correct, null), /no longer available/);
    db.bindVerifiedAccount(a); await svc.wallet.load();
    assert.equal(svc.wallet.getState()?.xp, 25);
    const fresh = await svc.sessions.begin({ studySetId: 'set', mode: 'quiz', itemIds: ids, resume: false });
    assert.notEqual(fresh.session.id, session.id);
    assert.equal((await svc.sessions.begin({ studySetId: 'set', mode: 'quiz', itemIds: ids, resume: true })).session.id, fresh.session.id);
  } finally { f.close(); }
});

test('paid answer reveal is charged once per question even after resume', async () => {
  const f = sqliteFixture();
  try {
    const owner = randomUUID(), { db } = f.restart(); db.bindVerifiedAccount(owner);
    const svc = services(db); await svc.wallet.load();
    const { session } = await svc.sessions.begin({ studySetId: 'set', mode: 'quiz', itemIds: items(1).map(q => q.id), resume: false });
    assert.equal(await svc.sessions.chargeReveal(session.id, 0, 50), 'revealed');
    assert.equal(await svc.sessions.chargeReveal(session.id, 0, 50), 'revealed');
    assert.equal(svc.wallet.getState()?.credits, 0);
    assert.equal(await svc.sessions.chargeReveal(session.id, 1, 50), 'insufficient');
  } finally { f.close(); }
});

test('a reveal whose charge cannot be stored is not granted and costs nothing', async () => {
  const f = sqliteFixture();
  try {
    const owner = randomUUID(), { db, sqlite } = f.restart(); db.bindVerifiedAccount(owner);
    const svc = services(db); await svc.wallet.load();
    const { session } = await svc.sessions.begin({ studySetId: 'set', mode: 'quiz', itemIds: items(1).map(q => q.id), resume: false });
    sqlite.exec("CREATE TRIGGER reject_wallet BEFORE UPDATE ON account_records WHEN NEW.kind='wallet' BEGIN SELECT RAISE(ABORT,'disk failure simulation'); END;");
    sqlite.exec("CREATE TRIGGER reject_wallet_insert BEFORE INSERT ON account_records WHEN NEW.kind='wallet' BEGIN SELECT RAISE(ABORT,'disk failure simulation'); END;");
    assert.equal(await svc.sessions.chargeReveal(session.id, 0, 50), 'failed');
    sqlite.exec('DROP TRIGGER reject_wallet'); sqlite.exec('DROP TRIGGER reject_wallet_insert');
    assert.equal(svc.wallet.getState()?.credits, 50);
    // The failed charge left no idempotency key behind, so a retry is charged normally.
    assert.equal(await svc.sessions.chargeReveal(session.id, 0, 50), 'revealed');
    assert.equal((await services(db).wallet.load())?.credits, 0);
  } finally { f.close(); }
});

test('flashcard resume starts at the first uncommitted card with its score', async () => {
  const f = sqliteFixture();
  try {
    const owner = randomUUID(), { db } = f.restart(); db.bindVerifiedAccount(owner);
    const svc = services(db); await svc.wallet.load();
    const cards = items(3);
    const { session } = await svc.sessions.begin({ studySetId: 'set', mode: 'flashcards', itemIds: cards.map(c => c.id), resume: true });
    await svc.sessions.commitAnswer(session.id, 0, { answer: '', status: 'correct', xp: 15, streak: 0, heartCost: 0 }, { studyItemId: cards[0].id, result: 'correct' });
    await svc.sessions.commitAnswer(session.id, 1, { answer: '', status: 'review_again', xp: 0, streak: 0, heartCost: 0 }, { studyItemId: cards[1].id, result: 'review_again' });
    const resumed = await svc.sessions.begin({ studySetId: 'set', mode: 'flashcards', itemIds: cards.map(c => c.id), resume: true });
    const restored = restoreFlashcardSession(resumed.session, cards);
    assert.deepEqual([restored.index, restored.finished, restored.score], [2, false, { correct: 1, total: 2, xp: 15 }]);
    assert.deepEqual((await db.getPendingSyncEvents()).map(e => e.result), ['correct', 'review_again']);
  } finally { f.close(); }
});

test('guest preview sessions stay local: no sync events and a separate guest wallet', async () => {
  const f = sqliteFixture();
  try {
    const { db } = f.restart(), kv = memoryKv();
    const svc = services(db, kv); await svc.wallet.load();
    const { session } = await svc.sessions.begin({ studySetId: 'preview', mode: 'quiz', itemIds: items(1).map(q => q.id), resume: true });
    const outcome = await svc.sessions.commitAnswer(session.id, 0, correct, { studyItemId: randomUUID(), result: 'correct' });
    assert.equal(outcome.committed, true);
    assert.equal(outcome.committed && outcome.answer.event_id, null);
    assert.equal(svc.queuedCount(), 0);
    assert.equal(JSON.parse(kv.data.get('@momo/guest_wallet')!).xp, 25);
  } finally { f.close(); }
});
