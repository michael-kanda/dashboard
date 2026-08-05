import assert from 'node:assert/strict';
import test from 'node:test';
import { createIndexingDataModule } from '../../src/lib/data-modules/indexing.ts';

test('Indexing clamps invalid counters to the sitemap total', () => {
  const result = createIndexingDataModule({
    configured: true,
    sitemapUrl: 'https://example.at/sitemap.xml',
    status: 'completed',
    sitemapEntryCount: 10,
    excludedUrlCount: 0,
    excludedUrls: [],
    warningMessage: null,
    progressStage: 'completed',
    progressTotal: 10,
    progressCompleted: 10,
    progressDueTotal: 0,
    totalUrls: 10,
    indexedUrls: 12,
    notIndexedUrls: -1,
    pendingUrls: 0,
    issueUrls: 99,
    lastSyncedAt: '2026-08-05T08:00:00.000Z',
    nextSyncAt: null,
    errorMessage: null,
    performanceRange: 'Letzte 90 Tage',
    rows: [],
  });

  assert.equal(result.meta.status, 'available');
  assert.deepEqual(result.data.counts, {
    total: 10,
    indexed: 10,
    notIndexed: 0,
    pending: 0,
    actionRequired: 10,
  });
  assert.equal(result.data.hasCompletedSync, true);
});

test('Indexing distinguishes an unconfigured project', () => {
  const result = createIndexingDataModule(null);
  assert.equal(result.meta.status, 'not_configured');
  assert.equal(result.data.report, null);
});
