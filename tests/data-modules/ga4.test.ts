import assert from 'node:assert/strict';
import test from 'node:test';
import { createGa4DataModule } from '../../src/lib/data-modules/ga4.ts';

test('GA4 keeps cached data usable during a transient timeout', () => {
  const result = createGa4DataModule({
    fromCache: true,
    kpis: { sessions: { value: 1258, change: 3.2 } },
    apiErrors: { ga4: 'The operation was aborted.' },
  });

  assert.equal(result.meta.status, 'partial');
  assert.equal(result.meta.fromCache, true);
  assert.equal(result.meta.issues[0]?.retryable, true);
  assert.equal(result.data.displayError, null);
  assert.equal(result.data.kpis.sessions.value, 1258);
});

test('GA4 normalizes a missing AI traffic payload', () => {
  const result = createGa4DataModule({});

  assert.equal(result.meta.status, 'empty');
  assert.equal(result.data.aiTraffic.totalSessions, 0);
  assert.deepEqual(result.data.aiTraffic.topAiSources, []);
});

test('GA4 exposes paid search KPI and trend through its stable contract', () => {
  const result = createGa4DataModule({
    kpis: { paidSearch: { value: 42, change: 12.5 } },
    charts: { paidSearch: [{ date: 1_786_291_200_000, value: 3 }] },
  });

  assert.deepEqual(result.data.kpis.paidSearch, { value: 42, change: 12.5 });
  assert.deepEqual(result.data.charts.paidSearch, [{ date: 1_786_291_200_000, value: 3 }]);
});
