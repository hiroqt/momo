import assert from 'node:assert/strict';
import test from 'node:test';
import { validateApiDestination } from '../lib/api/environment';

test('local apps accept device LAN and emulator origins', () => {
  for (const origin of ['http://localhost:8000', 'http://127.0.0.1:8000', 'http://10.0.2.2:8000', 'http://192.168.1.4:8000', 'http://172.16.0.2:8000', 'http://[::1]:8000']) {
    assert.equal(validateApiDestination(origin), origin);
  }
});

test('local tests reject hosted destinations and deceptive hostnames', () => {
  for (const origin of ['https://momo.example', 'https://staging.supabase.co', 'http://localhost.attacker.example', 'http://172.32.0.1', 'http://8.8.8.8']) {
    assert.throws(() => validateApiDestination(origin, 'test'));
  }
});

test('hosted API origins require HTTPS and environment names fail closed', () => {
  assert.equal(validateApiDestination('https://api.example', 'staging'), 'https://api.example');
  assert.throws(() => validateApiDestination('http://api.example', 'production'));
  assert.throws(() => validateApiDestination('https://api.example', 'prodution'));
  assert.throws(() => validateApiDestination('https://user:password@api.example', 'production'));
  assert.throws(() => validateApiDestination('https://api.example?token=secret', 'staging'));
});
