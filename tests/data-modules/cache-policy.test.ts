import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getDashboardCacheDurationHours,
  getReportingWindow,
  isDashboardSnapshotStale,
} from '../../src/lib/sync/cache-policy.ts';

test('uses longer cache durations for historical dashboard ranges', () => {
  assert.equal(getDashboardCacheDurationHours('30d'), 24);
  assert.equal(getDashboardCacheDurationHours('3m'), 48);
  assert.equal(getDashboardCacheDurationHours('6m'), 72);
  assert.equal(getDashboardCacheDurationHours('12m'), 168);
  assert.equal(getDashboardCacheDurationHours('24m'), 168);
});

test('uses one lag-aware reporting window for dashboard and GSC history', () => {
  assert.deepEqual(
    getReportingWindow('7d', new Date('2026-08-10T12:00:00.000Z')),
    {
      startDate: '2026-08-02',
      endDate: '2026-08-08',
      previousStartDate: '2026-07-26',
      previousEndDate: '2026-08-01',
      days: 7,
    },
  );
});

test('marks snapshots stale only after their range-specific TTL', () => {
  const now = Date.parse('2026-08-05T12:00:00.000Z');
  assert.equal(
    isDashboardSnapshotStale('3m', '2026-08-04T13:00:00.000Z', now),
    false,
  );
  assert.equal(
    isDashboardSnapshotStale('3m', '2026-08-03T11:59:59.000Z', now),
    true,
  );
  assert.equal(isDashboardSnapshotStale('30d', null, now), true);
});
