import test from 'node:test';
import assert from 'node:assert/strict';
import { storyCaptureSize } from '../utils/storyCapture';

test('story capture produces the same 1080 by 1920 image across native density scales', () => {
  for (const density of [1, 2, 3]) {
    const size = storyCaptureSize('ios', density);
    assert.equal(size.width * density, 1080);
    assert.equal(size.height * density, 1920);
  }
  assert.deepEqual(storyCaptureSize('android', 2.75), { width: 1080, height: 1920 });
  assert.deepEqual(storyCaptureSize('ios', NaN), { width: 1080, height: 1920 });
});
