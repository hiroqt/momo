import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { MOMO_FRAME_COUNT, MOMO_STEPS } from '../components/onboarding/momoSteps';

const root = join(process.cwd(), '..');
const pack = JSON.parse(readFileSync(join(root, 'design/momo-motion/manifest.json'), 'utf8'));

test('all nine onboarding steps use distinct corrected source-quality animations', () => {
  const steps = Object.values(MOMO_STEPS);
  assert.equal(steps.length, 9);
  assert.equal(new Set(steps.map(step => step.animation)).size, 9);
  for (const step of steps) {
    const meta = pack.animations.find((entry: { id: string }) => entry.id === step.animation);
    assert.ok(meta, `${step.animation} is in the corrected pack`);
    const animation = JSON.parse(readFileSync(join(root, meta.json), 'utf8'));
    assert.equal(animation.op, MOMO_FRAME_COUNT);
    const body = animation.layers.at(-1);
    assert.equal(body.ty, 2);
    assert.equal(body.ks.r.a, 0, 'body never tilts or rotates');
    for (const part of animation.layers.slice(0, -1)) {
      assert.ok(meta.motionParts.some((p: { name: string }) => p.name === part.nm));
      assert.equal(part.refId, body.refId, 'gesture uses original artwork');
      assert.equal(part.ks.r.a, 1, 'feature gestures independently');
    }
    assert.deepEqual(Buffer.from(animation.assets[0].p.split(',')[1], 'base64'), readFileSync(join(root, meta.source)));
    assert.equal(animation.layers[0].ks.p.a, 0, 'no position bounce');
    assert.equal(animation.layers[0].ks.s.a, 0, 'no scaling distortion');
    assert.ok(step.stillFrame >= 0 && step.stillFrame < animation.op);
  }
});

test('superseded animation rigs and sprite playback are absent', () => {
  for (const path of ['assets/animations/momo-rig', 'assets/onboarding/frames', 'components/onboarding/WelcomeMomo.tsx']) {
    assert.equal(existsSync(join(process.cwd(), path)), false, path);
  }
});
