import assert from 'node:assert/strict';
import test from 'node:test';
import { createLocalSeoDataModule } from '../../src/lib/data-modules/local-seo.ts';

test('Local SEO keeps GA4 and GSC location metrics separate', () => {
  const result = createLocalSeoDataModule({
    localSeo: {
      locations: [{
        id: 'graz',
        name: 'Sprechstelle Graz',
        city: 'Graz',
        score: 0,
        clicks: 0,
        impressions: 0,
        ctr: 0,
        position: null,
        sessions: 240,
        newUsers: 202,
        conversions: 1,
        topQueries: [],
        topLandingPages: [],
      }],
      totals: {
        clicks: 0,
        impressions: 0,
        sessions: 240,
        newUsers: 202,
        conversions: 1,
      },
    },
  });

  assert.equal(result.meta.status, 'available');
  assert.equal(result.data.locations[0]?.newUsers, 202);
  assert.equal(result.data.locations[0]?.clicks, 0);
  assert.equal(result.data.allocation.ga4, 'landing-pages-or-city');
  assert.equal(result.data.allocation.gsc, 'landing-pages-and-keyword-aliases');
});
