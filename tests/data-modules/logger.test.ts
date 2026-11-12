import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveLogLevel } from '../../src/lib/logger.ts';

test('uses the configured level, case and spaces ignored', () => {
  assert.equal(resolveLogLevel('debug', 'production'), 'debug');
  assert.equal(resolveLogLevel(' WARN ', 'production'), 'warn');
  assert.equal(resolveLogLevel('silent', 'development'), 'silent');
});

test('defaults to info in production and debug elsewhere', () => {
  assert.equal(resolveLogLevel(undefined, 'production'), 'info');
  assert.equal(resolveLogLevel(undefined, 'development'), 'debug');
  assert.equal(resolveLogLevel(undefined, undefined), 'debug');
});

test('ignores unknown levels', () => {
  assert.equal(resolveLogLevel('verbose', 'production'), 'info');
  assert.equal(resolveLogLevel('', 'development'), 'debug');
});
