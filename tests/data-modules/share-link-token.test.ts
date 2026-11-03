import assert from 'node:assert/strict';
import test from 'node:test';
import { createShareToken, hashShareToken, isShareTokenFormat } from '../../src/lib/share-link-token.ts';

test('share tokens are random, url-safe and only stored as hash', () => {
  const a = createShareToken();
  const b = createShareToken();
  assert.notEqual(a, b);
  assert.ok(isShareTokenFormat(a));
  assert.match(hashShareToken(a), /^[0-9a-f]{64}$/);
  assert.notEqual(hashShareToken(a), hashShareToken(b));
});

test('rejects malformed share tokens before any lookup', () => {
  assert.equal(isShareTokenFormat(''), false);
  assert.equal(isShareTokenFormat('../../etc/passwd'), false);
  assert.equal(isShareTokenFormat('a'.repeat(42)), false);
  assert.equal(isShareTokenFormat(`${'a'.repeat(42)}'`), false);
});
