import assert from 'node:assert/strict';
import test from 'node:test';
import { startGenerationPolling } from '../lib/generation/pollGeneration';
import type { GenerationJob } from '../types';

function job(status: GenerationJob['status']): GenerationJob {
  return { generation_id: 'g', document_id: 'd', status, stage: 'Working', progress: 10, message: '', created_at: '', updated_at: '' };
}
const flush = () => new Promise<void>(resolve => setImmediate(resolve));

test('failed polling stops; explicit retry starts a fresh serial poll for same id', async () => {
  let sent = 0, completed = 0, failed = 0;
  const timers: (() => void)[] = [];
  const options = {
    fetchJob: async () => { sent++; return job(sent === 1 ? 'FAILED' : sent === 2 ? 'PENDING' : 'COMPLETED'); },
    isCurrent: () => true, onJob: () => {}, onCompleted: () => { completed++; }, onFailed: () => { failed++; }, onError: () => {},
    schedule: (task: () => void) => { timers.push(task); return () => {}; },
  };
  startGenerationPolling(options); await flush();
  assert.equal(failed, 1); assert.equal(timers.length, 0);
  startGenerationPolling(options); await flush();
  assert.equal(sent, 2); assert.equal(timers.length, 1);
  timers.shift()!(); await flush(); assert.equal(sent, 3); assert.equal(completed, 1);
});

test('slow status request cannot overlap and cancelled/account-switched responses are ignored', async () => {
  for (const cause of ['stop', 'switch']) {
    let resolve!: (value: GenerationJob) => void;
    let current = true, calls = 0, published = 0, timers = 0;
    const stop = startGenerationPolling({
      fetchJob: () => { calls++; return new Promise<GenerationJob>(done => { resolve = done; }); },
      isCurrent: () => current, onJob: () => { published++; }, onCompleted: () => { published++; }, onFailed: () => {}, onError: () => {},
      schedule: () => { timers++; return () => {}; },
    });
    await flush(); assert.equal(calls, 1); assert.equal(timers, 0);
    if (cause === 'stop') stop(); else current = false;
    resolve(job('COMPLETED')); await flush(); assert.equal(published, 0); assert.equal(timers, 0);
  }
});

test('transient polling error schedules retry; stop cancels the timer', async () => {
  let errors = 0, cancelled = 0;
  const stop = startGenerationPolling({
    fetchJob: async () => { throw new Error('network'); }, isCurrent: () => true,
    onJob: () => {}, onCompleted: () => {}, onFailed: () => {}, onError: () => { errors++; },
    schedule: () => () => { cancelled++; },
  });
  await flush(); assert.equal(errors, 1); stop(); assert.equal(cancelled, 1);
});

test('accepted retry with lost response reconciles existing job through GET without repeating POST', async () => {
  const { retryAndReconcile } = await import('../lib/generation/retryGeneration');
  const { ApiError } = await import('../lib/api/errors');
  let posts = 0, gets = 0, completed = 0;
  let server: GenerationJob['status'] = 'FAILED';
  const timers: (() => void)[] = [];
  await retryAndReconcile({
    retry: async () => { posts++; server = 'PENDING'; throw new ApiError(0, 'TIMEOUT', 'response lost'); },
    isCurrent: () => true, onError: () => {},
    resumePolling: () => { startGenerationPolling({
      fetchJob: async () => { gets++; const value = job(server); server = 'COMPLETED'; return value; },
      isCurrent: () => true, onJob: () => {}, onFailed: () => {}, onError: () => {},
      onCompleted: () => { completed++; }, schedule: task => { timers.push(task); return () => {}; },
    }); },
  });
  await flush(); assert.equal(posts, 1); assert.equal(gets, 1);
  timers.shift()!(); await flush(); assert.equal(posts, 1); assert.equal(gets, 2); assert.equal(completed, 1);
});

test('retry rejection and late account switch cannot restart status or publish data', async () => {
  const { retryAndReconcile } = await import('../lib/generation/retryGeneration');
  const { ApiError } = await import('../lib/api/errors');
  for (const cause of ['rejected', 'switch']) {
    let active = true, resumed = 0, errors = 0;
    await retryAndReconcile({
      retry: async () => { if (cause === 'switch') active = false; throw new ApiError(404, 'GENERATION_NOT_FOUND', 'missing'); },
      isCurrent: () => active, onError: () => { errors++; }, resumePolling: () => { resumed++; },
    });
    assert.equal(resumed, 0); assert.equal(errors, cause === 'rejected' ? 1 : 0);
  }
});

test('permanent missing-job status stops polling', async () => {
  let scheduled = 0;
  startGenerationPolling({ fetchJob: async () => { throw new Error('missing'); }, isCurrent: () => true,
    onJob: () => {}, onCompleted: () => {}, onFailed: () => {}, onError: () => {}, isRetryable: () => false,
    schedule: () => { scheduled++; return () => {}; },
  });
  await flush(); assert.equal(scheduled, 0);
});
