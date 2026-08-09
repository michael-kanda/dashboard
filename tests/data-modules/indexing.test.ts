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
    verifiedUrls: 10,
    unverifiedUrls: 0,
    verificationCoverage: 100,
    isVerificationComplete: true,
    recheckPendingUrls: 0,
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

test('Indexing keeps aggregate metrics partial until every URL has a valid inspection result', () => {
  const completeReport = {
    configured: true,
    sitemapUrl: 'https://example.at/sitemap.xml',
    status: 'partial' as const,
    sitemapEntryCount: 10,
    excludedUrlCount: 0,
    excludedUrls: [],
    warningMessage: null,
    progressStage: 'queued' as const,
    progressTotal: 4,
    progressCompleted: 4,
    progressDueTotal: 7,
    totalUrls: 10,
    verifiedUrls: 7,
    unverifiedUrls: 3,
    verificationCoverage: 70,
    isVerificationComplete: false,
    recheckPendingUrls: 0,
    indexedUrls: 6,
    notIndexedUrls: 1,
    pendingUrls: 2,
    issueUrls: 2,
    lastSyncedAt: '2026-08-09T08:00:00.000Z',
    nextSyncAt: '2026-08-09T08:05:00.000Z',
    errorMessage: null,
    performanceRange: 'Letzte 90 Tage',
    rows: [],
  };

  const result = createIndexingDataModule(completeReport);
  assert.equal(result.meta.status, 'partial');
  assert.equal(result.metrics['indexing.total']?.coverage.status, 'complete');
  assert.equal(result.metrics['indexing.indexed']?.coverage.status, 'partial');
  assert.equal(result.metrics['indexing.notIndexed']?.coverage.status, 'partial');
});
