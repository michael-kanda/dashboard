import assert from 'node:assert/strict';
import test from 'node:test';
import { createGoogleAdsDataModule } from '../../src/lib/data-modules/google-ads.ts';

const emptyTotals = {
  cost: 0,
  clicks: 0,
  avgCpc: 0,
  roas: 0,
  conversions: 0,
  sessions: 0,
  engagedSessions: 0,
};

test('Google Ads preserves a configured Sheet as a renderable report', () => {
  const result = createGoogleAdsDataModule({
    googleAdsData: {
      rows: [],
      landingPageRows: [],
      totals: emptyTotals,
      source: 'sheet',
      configuredSheetId: 'sheet-123',
    },
  });

  assert.equal(result.meta.configured, true);
  assert.equal(result.meta.status, 'empty');
  assert.equal(result.data.source, 'sheet');
  assert.equal(result.data.hasRows, false);
  assert.equal(result.data.hasRenderableData, true);
});

test('Google Ads is not configured without GA4 or Sheet data', () => {
  const result = createGoogleAdsDataModule({});
  assert.equal(result.meta.status, 'not_configured');
  assert.equal(result.data.report, null);
});
