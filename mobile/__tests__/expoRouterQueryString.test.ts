import assert from 'node:assert/strict';
import { test } from 'node:test';

const { getStateFromPath } = require('expo-router/build/react-navigation/core/getStateFromPath');

test('Expo Router parses query strings with the patched ESM dependency', () => {
  const state = getStateFromPath('/home?topic=biology&tag=one&tag=two', {
    screens: { Home: 'home' },
  });

  assert.deepEqual(state.routes[0].params, {
    topic: 'biology',
    tag: ['one', 'two'],
  });
});

test('Expo Router safely handles malformed percent-encoded query values', () => {
  const state = getStateFromPath('/home?value=%E0%A4%A', {
    screens: { Home: 'home' },
  });

  assert.equal(state.routes[0].params.value, '%E0%A4%A');
});
