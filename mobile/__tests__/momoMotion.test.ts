import assert from 'node:assert/strict';
import test from 'node:test';
import { MOMO_MOTION, motionPlayback } from '../lib/animations/momoMotion';

const visible = { reducedMotion: false, active: true, focused: true, completed: false, decorativeBurst: false };

test('illustrations pause outside the foreground or current screen', () => {
  assert.equal(motionPlayback(visible), 'playing');
  assert.equal(motionPlayback({ ...visible, active: false }), 'paused');
  assert.equal(motionPlayback({ ...visible, focused: false }), 'paused');
});

test('reduced motion retains the illustrated state and suppresses confetti', () => {
  assert.equal(motionPlayback({ ...visible, reducedMotion: true }), 'still');
  assert.equal(motionPlayback({ ...visible, reducedMotion: true, decorativeBurst: true }), 'hidden');
});

test('finished celebrations stay finished after returning to the screen', () => {
  assert.equal(motionPlayback({ ...visible, completed: true }), 'still');
  for (const name of ['confetti-burst', 'confetti-gentle', 'streak-ignite', 'xp-reward'] as const) {
    assert.equal(MOMO_MOTION[name].loop, false);
  }
});

test('the registry provides a valid still frame and avoids loading all source JSON at import', () => {
  assert.equal(Object.keys(MOMO_MOTION).length, 28);
  for (const asset of Object.values(MOMO_MOTION)) {
    assert.equal(typeof asset.source, 'function');
    assert.ok(asset.stillFrame >= 0 && asset.stillFrame < asset.frames);
  }
});

import { fitMotionSize } from '../lib/animations/motionLayout';

test('illustrations fit compact phones, landscape and tablets while preserving aspect ratio', () => {
  for (const [screenWidth, screenHeight] of [[320, 568], [360, 640], [390, 844], [430, 932], [844, 390], [768, 1024], [1024, 768]]) {
    for (const [width, height] of [[380, 380], [180, 240], [130, 130], [44, 44]]) {
      const result = fitMotionSize(width, height, screenWidth, screenHeight);
      assert.ok(result.width <= screenWidth - 32);
      assert.ok(result.width / result.aspectRatio <= screenHeight * 0.45 + 0.0001);
      assert.equal(result.aspectRatio, width / height);
      assert.ok(result.width <= width, 'requested size is a ceiling, so tablet artwork is not enlarged');
    }
  }
});
