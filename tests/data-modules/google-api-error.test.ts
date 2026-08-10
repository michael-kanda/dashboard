import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyGoogleApiError } from '../../src/lib/sync/google-api-error.ts';

test('classifies quota failures without treating the URL as broken', () => {
  const result = classifyGoogleApiError(new Error('Exhausted concurrent requests quota'));
  assert.equal(result.kind, 'quota');
  assert.equal(result.retryable, true);
  assert.equal(result.blocksSnapshotWrite, true);
});

test('classifies permission messages even when only a string was retained', () => {
  const result = classifyGoogleApiError('Permission denied for analytics property');
  assert.equal(result.kind, 'permanent');
  assert.equal(result.retryable, false);
  assert.equal(result.blocksSnapshotWrite, false);
});

test('preserves the HTTP status for project-level access decisions', () => {
  const result = classifyGoogleApiError({ response: { status: 403 } });
  assert.equal(result.kind, 'permanent');
  assert.equal(result.status, 403);
});

test('classifies aborted requests as transient', () => {
  const result = classifyGoogleApiError(new Error('The operation was aborted.'));
  assert.equal(result.kind, 'transient');
  assert.equal(result.blocksSnapshotWrite, true);
});
