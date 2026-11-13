import assert from 'node:assert/strict';
import test from 'node:test';
import { pickNextProjectSyncJobType } from '../../src/lib/sync/dispatcher-policy.ts';
import type { ProjectSyncJobType } from '../../src/lib/sync/job-queue.ts';
import type { QueueSourceStates } from '../../src/lib/sync/dispatcher-policy.ts';

const quota: Record<ProjectSyncJobType, number> = {
  dashboard: 3,
  'gsc-history': 2,
  indexing: 4,
};

test('gives every source type a turn before repeating a source', () => {
  const processed: Record<ProjectSyncJobType, number> = {
    dashboard: 0,
    'gsc-history': 0,
    indexing: 0,
  };
  const exhausted = new Set<ProjectSyncJobType>();
  const fits = () => true;

  assert.equal(pickNextProjectSyncJobType({
    remainingQuota: quota,
    processedByType: processed,
    exhaustedTypes: exhausted,
    fits,
  }), 'dashboard');

  processed.dashboard += 1;
  assert.equal(pickNextProjectSyncJobType({
    remainingQuota: quota,
    processedByType: processed,
    exhaustedTypes: exhausted,
    fits,
  }), 'gsc-history');

  processed['gsc-history'] += 1;
  assert.equal(pickNextProjectSyncJobType({
    remainingQuota: quota,
    processedByType: processed,
    exhaustedTypes: exhausted,
    fits,
  }), 'indexing');
});

test('skips exhausted sources and jobs that do not fit the remaining runtime', () => {
  assert.equal(pickNextProjectSyncJobType({
    remainingQuota: quota,
    processedByType: { dashboard: 0, 'gsc-history': 0, indexing: 0 },
    exhaustedTypes: new Set<ProjectSyncJobType>(['dashboard']),
    fits: (type) => type === 'indexing',
  }), 'indexing');
});

test('rotates across short cron runs using persisted source starts', () => {
  const sourceStates: QueueSourceStates = Object.fromEntries(Object.keys(quota).map(type => [type, {
    oldestDueAt: '2026-09-01T00:00:00Z', lastStartedAt: null, dueCount: 20,
  }]));
  const selected = [];
  for (let run = 0; run < 6; run += 1) {
    const type = pickNextProjectSyncJobType({
      remainingQuota: quota,
      processedByType: { dashboard: 0, 'gsc-history': 0, indexing: 0 },
      exhaustedTypes: new Set(), fits: () => true, sourceStates,
    })!;
    selected.push(type);
    sourceStates[type]!.lastStartedAt = new Date(Date.UTC(2026, 8, 2, run * 12)).toISOString();
  }
  assert.deepEqual(selected, ['dashboard', 'gsc-history', 'indexing', 'dashboard', 'gsc-history', 'indexing']);
});

test('prioritizes older waiting work but does not repeatedly reward an ancient backlog', () => {
  const sourceStates: QueueSourceStates = {
    dashboard: { oldestDueAt: '2026-08-01T00:00:00Z', lastStartedAt: '2026-09-10T00:00:00Z', dueCount: 50 },
    indexing: { oldestDueAt: '2026-09-05T00:00:00Z', lastStartedAt: null, dueCount: 1 },
    'gsc-history': { oldestDueAt: '2026-09-06T00:00:00Z', lastStartedAt: null, dueCount: 1 },
  };
  assert.equal(pickNextProjectSyncJobType({
    remainingQuota: quota, processedByType: { dashboard: 0, 'gsc-history': 0, indexing: 0 },
    exhaustedTypes: new Set(), fits: () => true, sourceStates,
  }), 'indexing');
});

test('morning run reserves every slot for dashboard snapshots', async () => {
  const { getRunQuota, parseDispatchMode, MAX_JOBS_PER_RUN } = await import('../../src/lib/sync/dispatcher-policy.ts');
  assert.equal(parseDispatchMode('dashboard'), 'dashboard');
  assert.equal(parseDispatchMode(null), 'mixed');
  assert.equal(parseDispatchMode('indexing'), 'mixed');
  assert.deepEqual(getRunQuota('dashboard'), { dashboard: MAX_JOBS_PER_RUN, 'gsc-history': 0, indexing: 0 });
  assert.deepEqual(getRunQuota('mixed'), { dashboard: 3, 'gsc-history': 2, indexing: 4 });
  assert.equal(pickNextProjectSyncJobType({
    remainingQuota: getRunQuota('dashboard'),
    processedByType: { dashboard: 5, 'gsc-history': 0, indexing: 0 },
    exhaustedTypes: new Set(),
    fits: () => true,
  }), 'dashboard');
});
