import assert from 'node:assert/strict';
import test from 'node:test';
import {
  GA4_KEY_EVENTS_METRIC,
  isPaidSearchChannel,
  parseGa4Metric,
} from '../../src/lib/ga4-metrics.ts';

test('GA4 uses the current key-events metric', () => {
  assert.equal(GA4_KEY_EVENTS_METRIC, 'keyEvents');
});

test('GA4 metric parser preserves attributed decimal key events', () => {
  assert.equal(parseGa4Metric('12.75'), 12.75);
  assert.equal(parseGa4Metric(undefined), 0);
  assert.equal(parseGa4Metric('invalid'), 0);
});

test('Paid Search channel matching tolerates whitespace and case', () => {
  assert.equal(isPaidSearchChannel('Paid Search'), true);
  assert.equal(isPaidSearchChannel(' paid search '), true);
  assert.equal(isPaidSearchChannel('Organic Search'), false);
});
