import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SHOP_MOTION } from '../lib/animations/shopMotion';

test('shop assets are self-contained vectors with a visible reduced-motion poster', () => {
  assert.equal(Object.keys(SHOP_MOTION).length, 12);
  for (const [id, entry] of Object.entries(SHOP_MOTION)) {
    const data = JSON.parse(readFileSync(resolve('assets/animations/momo-shop', id + '.json'), 'utf8'));
    assert.equal(data.w, 256); assert.equal(data.h, 256);
    assert.equal(data.fr, 30); assert.ok(entry.stillFrame < data.op);
    assert.equal(entry.loop, false);
    assert.ok(data.layers.length > 0);
    assert.ok(!data.assets?.some((a: {p?: string}) => a.p), 'no external image dependencies');
    for (const layer of data.layers) {
      assert.equal(layer.ks.s.a, 0, 'no whole-object bouncing or scaling');
    }
  }
});

test('heart packs reveal solid color upward through masks instead of fading', () => {
  for (const id of ['shop-heart-single', 'shop-heart-five', 'shop-heart-bowl', 'shop-exchange-hearts']) {
    const data = JSON.parse(readFileSync(resolve('assets/animations/momo-shop', id + '.json'), 'utf8'));
    const fills = data.layers.filter((l: {hasMask?: boolean}) => l.hasMask);
    assert.ok(fills.length > 0);
    for (const layer of fills) {
      assert.equal(layer.ks.o.a, 0); assert.equal(layer.ks.o.k, 100);
      const mask = layer.masksProperties[0];
      assert.equal(mask.pt.a, 1); assert.equal(mask.o.k, 100);
      let top = Infinity;
      for (const key of mask.pt.k) {
        if (!key.s) continue;
        const next = Math.min(...key.s[0].v.map((p: number[]) => p[1]));
        assert.ok(next <= top, 'reveal advances from bottom to top'); top = next;
      }
    }
  }
});
