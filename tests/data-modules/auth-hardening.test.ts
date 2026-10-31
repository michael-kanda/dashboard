import assert from 'node:assert/strict';
import test from 'node:test';
import { getPasswordError, MIN_PASSWORD_LENGTH } from '../../src/lib/password-policy.ts';
import { readClientIp } from '../../src/lib/login-throttle.ts';
import { fingerprintPasswordHash } from '../../src/lib/session-state.ts';

test('rejects passwords below the minimum length', () => {
  assert.match(getPasswordError('a'.repeat(MIN_PASSWORD_LENGTH - 1)) ?? '', /mindestens/);
  assert.equal(getPasswordError('a'.repeat(MIN_PASSWORD_LENGTH)), null);
  assert.notEqual(getPasswordError(undefined), null);
});

test('reads the first forwarded client ip', () => {
  const request = new Request('https://example.test', {
    headers: { 'x-forwarded-for': '203.0.113.7, 10.0.0.1' },
  });
  assert.equal(readClientIp(request), '203.0.113.7');
  assert.equal(readClientIp(new Request('https://example.test')), null);
  assert.equal(readClientIp(), null);
});

test('password fingerprint is stable and changes with the hash', async () => {
  const first = await fingerprintPasswordHash('$2b$10$abc');
  assert.equal(first, await fingerprintPasswordHash('$2b$10$abc'));
  assert.notEqual(first, await fingerprintPasswordHash('$2b$10$abd'));
  assert.equal(first.length, 16);
});
