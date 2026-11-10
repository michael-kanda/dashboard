import assert from 'node:assert/strict';
import test from 'node:test';
import {
  INVALIDATED_CACHE_TIMESTAMP,
  getDashboardCacheDurationHours,
  getReportingWindow,
  isDashboardSnapshotBehind,
  isDashboardSnapshotStale,
} from '../../src/lib/sync/cache-policy.ts';

test('uses longer cache durations for historical dashboard ranges', () => {
  assert.equal(getDashboardCacheDurationHours('7d'), 48);
  assert.equal(getDashboardCacheDurationHours('30d'), 48);
  assert.equal(getDashboardCacheDurationHours('3m'), 48);
  assert.equal(getDashboardCacheDurationHours('6m'), 72);
  assert.equal(getDashboardCacheDurationHours('12m'), 168);
  assert.equal(getDashboardCacheDurationHours('24m'), 168);
});

test('reporting window always ends yesterday', () => {
  assert.deepEqual(
    getReportingWindow('7d', new Date('2026-08-10T12:00:00.000Z')),
    {
      startDate: '2026-08-03',
      endDate: '2026-08-09',
      previousStartDate: '2026-07-27',
      previousEndDate: '2026-08-02',
      days: 7,
    },
  );
  const thirtyDays = getReportingWindow('30d', new Date('2026-11-10T09:00:00.000Z'));
  assert.equal(thirtyDays.endDate, '2026-11-09');
  assert.equal(thirtyDays.startDate, '2026-10-11');
});

test('yesterday is based on Vienna time, not server UTC', () => {
  // 23:30 UTC am 09.11. ist in Wien bereits 00:30 am 10.11.
  assert.equal(getReportingWindow('30d', new Date('2026-11-09T23:30:00.000Z')).endDate, '2026-11-09');
  // 22:30 UTC am 09.11. ist in Wien noch 23:30 am 09.11.
  assert.equal(getReportingWindow('30d', new Date('2026-11-09T22:30:00.000Z')).endDate, '2026-11-08');
  // Sommerzeit: 22:30 UTC am 10.08. ist in Wien 00:30 am 11.08.
  assert.equal(getReportingWindow('7d', new Date('2026-08-10T22:30:00.000Z')).endDate, '2026-08-10');
});

test('a snapshot ending before yesterday is behind regardless of its TTL', () => {
  const now = new Date('2026-11-10T09:00:00.000Z');
  assert.equal(isDashboardSnapshotBehind('30d', '2026-11-06', now), true);
  assert.equal(isDashboardSnapshotBehind('30d', '2026-11-08', now), true);
  assert.equal(isDashboardSnapshotBehind('30d', '2026-11-09', now), false);
  assert.equal(isDashboardSnapshotBehind('24m', '2026-11-09', now), false);
  assert.equal(isDashboardSnapshotBehind('30d', undefined, now), true);
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
  assert.equal(
    isDashboardSnapshotStale('30d', '2026-08-03T12:00:00.001Z', now),
    false,
  );
  assert.equal(
    isDashboardSnapshotStale('30d', '2026-08-03T12:00:00.000Z', now),
    true,
  );
});

test('a preserved snapshot can be marked for refresh without removing its data', () => {
  assert.equal(
    isDashboardSnapshotStale('30d', INVALIDATED_CACHE_TIMESTAMP, Date.parse('2026-09-18T12:00:00.000Z')),
    true,
  );
});
