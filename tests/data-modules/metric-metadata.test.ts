import assert from 'node:assert/strict';
import test from 'node:test';
import {
  attachDashboardMetricMetadata,
  createMetricMetadata,
  DASHBOARD_SNAPSHOT_VERSION,
  extractDashboardMetricValues,
  resolveMetricPeriod,
} from '../../src/lib/metric-metadata.ts';

test('Metric periods are deterministic for a dashboard range', () => {
  const period = resolveMetricPeriod('30d', new Date('2026-08-05T12:00:00.000Z'));
  assert.deepEqual(period, { from: '2026-07-06', to: '2026-08-04' });
});

test('Indexing metrics use a point-in-time period', () => {
  const period = resolveMetricPeriod('snapshot', new Date('2026-08-05T12:00:00.000Z'));
  assert.deepEqual(period, { from: '2026-08-05', to: '2026-08-05' });
});

test('Metric metadata records source, coverage and calculation version', () => {
  const metadata = createMetricMetadata(
    'localSeo.newUsers',
    '30d',
    '2026-08-05T08:00:00.000Z',
  );

  assert.equal(metadata.source, 'local-seo');
  assert.equal(metadata.coverage.status, 'partial');
  assert.match(metadata.coverage.note, /GA4/);
  assert.equal(metadata.calculation.version, 2);
});

test('Dashboard snapshots receive metadata for every persisted KPI', () => {
  const dashboard = attachDashboardMetricMetadata({
    kpis: {
      clicks: { value: 12, change: 3 },
      sessions: { value: 90, change: -2 },
    },
  }, '30d', '2026-08-05T08:00:00.000Z');
  const values = extractDashboardMetricValues(dashboard);

  assert.equal(values['gsc.clicks'], 12);
  assert.equal(values['ga4.sessions'], 90);
  assert.equal(dashboard.snapshotVersion, DASHBOARD_SNAPSHOT_VERSION);
  assert.deepEqual(
    Object.keys(dashboard.metricMetadata ?? {}).sort(),
    Object.keys(values).sort(),
  );
});

test('Unavailable optional sources are not persisted as measured zero values', () => {
  const dashboard = attachDashboardMetricMetadata({
    kpis: {
      clicks: { value: 0, change: 0 },
      sessions: { value: 0, change: 0 },
    },
  }, '30d', '2026-08-05T08:00:00.000Z');
  const values = extractDashboardMetricValues(dashboard);

  assert.equal(values['gsc.clicks'], 0);
  assert.equal(values['ga4.sessions'], 0);
  assert.equal(values['googleAds.clicks'], undefined);
  assert.equal(values['localSeo.sessions'], undefined);
  assert.equal(values['ga4.aiTrafficSessions'], undefined);
});

test('A source error marks affected metric coverage as partial', () => {
  const dashboard = attachDashboardMetricMetadata({
    kpis: { sessions: { value: 12, change: 0 } },
    apiErrors: { ga4: 'temporär nicht erreichbar' },
  }, '30d', '2026-08-05T08:00:00.000Z');

  assert.equal(dashboard.metricMetadata?.['ga4.sessions']?.coverage.status, 'partial');
  assert.match(
    dashboard.metricMetadata?.['ga4.sessions']?.coverage.note ?? '',
    /temporär nicht erreichbar/,
  );
});
