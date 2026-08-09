import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isRetryableInfrastructureError,
  withInfrastructureRetry,
} from '../../src/lib/sync/retry.ts';

test('recognizes retryable Neon infrastructure errors', () => {
  assert.equal(isRetryableInfrastructureError({ 'neon:retryable': true }), true);
  assert.equal(isRetryableInfrastructureError(new Error('Control plane request failed')), true);
  assert.equal(isRetryableInfrastructureError(new Error('invalid input syntax for uuid')), false);
});

test('retries a transient operation and returns the successful result', async () => {
  let attempts = 0;
  const result = await withInfrastructureRetry(async () => {
    attempts += 1;
    if (attempts < 3) throw new Error('Connection reset');
    return 'ok';
  }, { attempts: 3, initialDelayMs: 0 });

  assert.equal(result, 'ok');
  assert.equal(attempts, 3);
});

test('does not retry permanent errors', async () => {
  let attempts = 0;
  await assert.rejects(
    withInfrastructureRetry(async () => {
      attempts += 1;
      throw new Error('permission denied');
    }, { attempts: 3, initialDelayMs: 0 }),
    /permission denied/,
  );
  assert.equal(attempts, 1);
});
