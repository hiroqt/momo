import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { MOMO_FRAME_COUNT, MOMO_STEPS } from '../components/onboarding/momoSteps';

const RIG_DIR = join(process.cwd(), 'assets/animations/momo-rig');
const BODY_PARTS = [
  'head', 'earL', 'earR', 'eyeL', 'eyeR', 'cap', 'torso',
  'armL_up', 'armL_lo', 'armR_up', 'armR_lo', 'legL', 'legR', 'tailBase', 'tailTip',
];

type Keyframe = { t: number; s: number[] };
type Prop = { a: 0 | 1; k: unknown };
type Layer = { nm: string; ty: number; ks: Record<string, Prop> };
type Lottie = { fr: number; op: number; w: number; h: number; assets: unknown[]; layers: Layer[] };

const load = (name: string): Lottie => JSON.parse(readFileSync(join(RIG_DIR, `${name}.json`), 'utf8'));
const movingParts = (lottie: Lottie) =>
  lottie.layers.filter((l) => ['r', 'p', 's'].some((k) => l.ks[k]?.a === 1)).map((l) => l.nm);

test('every onboarding screen gets its own Momo act', () => {
  const steps = Object.entries(MOMO_STEPS);
  assert.equal(steps.length, 9);
  const animations = steps.map(([, step]) => step.animation);
  assert.equal(new Set(animations).size, animations.length, 'acts must not repeat');
  for (const [stage, step] of steps) {
    assert.ok(step.label.trim().length > 0 && step.label.length <= 48, `stage ${stage} has a short label`);
    assert.ok(step.stillFrame >= 0 && step.stillFrame < MOMO_FRAME_COUNT, `stage ${stage} still frame is in range`);
    assert.ok(existsSync(join(RIG_DIR, `${step.animation}.json`)), `stage ${stage} animation file exists`);
  }
});

test('each act is a vector rig where the whole body moves', () => {
  for (const { animation } of Object.values(MOMO_STEPS)) {
    const lottie = load(animation);
    assert.equal(lottie.op, MOMO_FRAME_COUNT, `${animation} frame count`);
    assert.equal(lottie.assets.length, 0, `${animation} embeds no raster images`);
    assert.ok(lottie.layers.every((l) => l.ty === 4 || l.ty === 3), `${animation} uses only shape and null layers`);
    const names = lottie.layers.map((l) => l.nm);
    for (const part of BODY_PARTS) assert.ok(names.includes(part), `${animation} has a ${part} layer`);
    const moving = movingParts(lottie);
    assert.ok(moving.length >= 12, `${animation} animates at least 12 parts (got ${moving.length})`);
    for (const part of ['head', 'armL_up', 'armR_up', 'tailBase', 'tailTip', 'cap']) {
      assert.ok(moving.includes(part), `${animation} moves ${part}`);
    }
  }
});

test('each act loops seamlessly', () => {
  for (const { animation } of Object.values(MOMO_STEPS)) {
    for (const layer of load(animation).layers) {
      for (const [key, prop] of Object.entries(layer.ks)) {
        if (prop.a !== 1) continue;
        const keys = prop.k as Keyframe[];
        const first = keys[0];
        const last = keys[keys.length - 1];
        assert.equal(first.t, 0, `${animation}/${layer.nm}.${key} starts at 0`);
        assert.equal(last.t, MOMO_FRAME_COUNT, `${animation}/${layer.nm}.${key} ends at the loop point`);
        first.s.forEach((v, i) => {
          assert.ok(Math.abs(v - last.s[i]) < 0.5, `${animation}/${layer.nm}.${key} matches at the loop point`);
        });
      }
    }
  }
});
