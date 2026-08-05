import assert from 'node:assert/strict';
import test from 'node:test';
import { createGscDataModule } from '../../src/lib/data-modules/gsc.ts';

test('GSC keeps query metrics and exposes an available contract', () => {
  const result = createGscDataModule({
    kpis: {
      clicks: { value: 12, change: 4 },
      impressions: { value: 900, change: -2 },
    },
    topQueriesDataVersion: 2,
    topQueries: [{
      query: 'rechtsanwalt wien',
      clicks: 7,
      impressions: 500,
      ctr: 1.4,
      position: 8.2,
      landingPageConversions: 3,
    }],
  });

  assert.equal(result.meta.source, 'gsc');
  assert.equal(result.meta.status, 'available');
  assert.equal(result.data.topQueries[0]?.landingPageConversions, 3);
  assert.equal(result.data.dataVersion, 2);
});

test('GSC reports a hard error when no usable payload exists', () => {
  const result = createGscDataModule({
    apiErrors: { gsc: 'Property access denied' },
  });

  assert.equal(result.meta.status, 'error');
  assert.equal(result.meta.issues[0]?.retryable, false);
  assert.equal(result.data.displayError, 'Property access denied');
});
