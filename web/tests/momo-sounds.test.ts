import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { MomoSounds } from '../lib/momo-sounds';

function setup(t: TestContext) {
  let now = 0;
  let releaseDecode: (() => void) | undefined;
  let decodeGate = Promise.resolve();
  const sources: Array<{ started: boolean; stopped: boolean }> = [];
  let closed = false;
  class Context {
    state = 'running';
    currentTime = 0;
    destination = {};
    async decodeAudioData() { await decodeGate; return {}; }
    createBufferSource() {
      const state = { started: false, stopped: false };
      sources.push(state);
      return {
        playbackRate: { value: 1 }, connect() {}, disconnect() {},
        start() { state.started = true; }, stop() { state.stopped = true; },
      };
    }
    createGain() {
      return {
        gain: { value: 0, cancelScheduledValues() {}, setValueAtTime() {}, linearRampToValueAtTime() {} },
        connect() {}, disconnect() {},
      };
    }
    async close() { closed = true; }
  }
  for (const [key, value] of Object.entries({ window: { AudioContext: Context }, AudioContext: Context })) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, value });
    t.after(() => {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    });
  }
  t.mock.method(globalThis, 'fetch', async () => new Response(new ArrayBuffer(8)));
  t.mock.method(performance, 'now', () => now);
  const sounds = new MomoSounds();
  t.after(() => sounds.dispose());
  return {
    sounds, sources, isClosed: () => closed,
    advance: () => { now += 300; },
    delayDecode: () => { decodeGate = new Promise<void>((resolve) => { releaseDecode = resolve; }); },
    release: () => releaseDecode?.(),
  };
}

test('muting while a clip loads prevents delayed playback', async (t) => {
  const { sounds, sources, delayDecode, release } = setup(t);
  delayDecode();
  const pending = sounds.play();
  sounds.setEnabled(false);
  release();
  await pending;
  assert.equal(sources.length, 0);
});

test('rapid taps are bounded, subsequent calls replace the voice, and mute stops it', async (t) => {
  const { sounds, sources, advance } = setup(t);
  await sounds.play();
  await sounds.play();
  assert.equal(sources.length, 1);
  advance();
  await sounds.play();
  assert.equal(sources.length, 2);
  assert.equal(sources[0].stopped, true);
  sounds.setEnabled(false);
  assert.equal(sources[1].stopped, true);
  advance();
  await sounds.play();
  assert.equal(sources.length, 2);
});

test('disposing during loading closes audio and cancels pending playback', async (t) => {
  const { sounds, sources, delayDecode, release, isClosed } = setup(t);
  delayDecode();
  const pending = sounds.play();
  sounds.dispose();
  release();
  await pending;
  assert.equal(sources.length, 0);
  assert.equal(isClosed(), true);
});
