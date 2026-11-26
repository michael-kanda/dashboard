import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseAnalyticsSettingsInput,
  parseConversionEvents,
  readAnalyticsSettings,
} from '../../src/lib/vercel-analytics/settings.ts';
import {
  buildAiTraffic,
  buildChannels,
  buildInFilter,
  buildLandingPages,
  classifyChannel,
  countryName,
  toDailyPoints,
} from '../../src/lib/vercel-analytics/mapping.ts';
import { describeVercelAnalyticsStatus } from '../../src/lib/vercel-analytics/client.ts';
import { analyticsSourceNote } from '../../src/lib/vercel-analytics/ai-note.ts';
import { classifyGoogleApiError } from '../../src/lib/sync/google-api-error.ts';
import { extractDashboardMetricValues } from '../../src/lib/metric-metadata.ts';

test('settings default to GA4 and need a project id for Vercel', () => {
  assert.equal(readAnalyticsSettings({}).source, 'ga4');
  assert.equal(readAnalyticsSettings({ analytics_source: 'vercel' }).source, 'ga4');
  const vercel = readAnalyticsSettings({
    analytics_source: 'vercel',
    vercel_project_id: ' designare ',
    vercel_conversion_events: 'kontakt, anruf, kontakt',
  });
  assert.equal(vercel.source, 'vercel');
  assert.equal(vercel.vercelProjectId, 'designare');
  assert.deepEqual(vercel.conversionEvents, ['kontakt', 'anruf']);

  assert.equal(parseAnalyticsSettingsInput({ analytics_source: 'vercel' }).ok, false);
  assert.equal(parseAnalyticsSettingsInput({ analytics_source: 'vercel', vercel_project_id: 'prj abc' }).ok, false);
  const parsed = parseAnalyticsSettingsInput({
    analytics_source: 'vercel',
    vercel_project_id: 'prj_123',
    vercel_team_id: '',
    vercel_conversion_events: 'a,\nb',
  });
  assert.deepEqual(parsed, {
    ok: true,
    columns: {
      analytics_source: 'vercel',
      vercel_project_id: 'prj_123',
      vercel_team_id: null,
      vercel_conversion_events: 'a, b',
    },
  });
  assert.deepEqual(parseConversionEvents(['x', ' ', 'y']), ['x', 'y']);
});

test('channels follow the GA4 default channel names', () => {
  assert.equal(classifyChannel('', ''), 'Direct');
  assert.equal(classifyChannel('www.google.at', null), 'Organic Search');
  assert.equal(classifyChannel('www.google.com', 'cpc'), 'Paid Search');
  assert.equal(classifyChannel('chatgpt.com', ''), 'AI Assistant');
  assert.equal(classifyChannel('l.facebook.com', ''), 'Organic Social');
  assert.equal(classifyChannel('t.co', ''), 'Organic Social');
  assert.equal(classifyChannel('newsletter.example.com', 'email'), 'Email');
  assert.equal(classifyChannel('partner.example.com', ''), 'Referral');

  const channels = buildChannels([
    { referrerHostname: '', utmMedium: '', visitors: 10 },
    { referrerHostname: 'www.google.at', utmMedium: '', visitors: 7 },
    { referrerHostname: 'www.google.de', utmMedium: '', visitors: 3 },
  ]);
  assert.deepEqual(channels.map(({ name, value }) => [name, value]), [['Direct', 10], ['Organic Search', 10]]);
});

test('AI traffic groups referrers and computes the change', () => {
  const ai = buildAiTraffic(
    [
      { referrerHostname: 'chatgpt.com', visitors: 6 },
      { referrerHostname: 'chat.openai.com', visitors: 2 },
      { referrerHostname: 'www.perplexity.ai', visitors: 2 },
      { referrerHostname: 'www.google.at', visitors: 50 },
    ],
    [
      { timestamp: '2026-11-02T00:00:00.000Z', visitors: 4 },
      { timestamp: '2026-11-01T00:00:00.000Z', visitors: 6 },
    ],
    5,
  );
  assert.equal(ai.totalUsers, 10);
  assert.equal(ai.totalSessions, 10);
  assert.equal(ai.totalUsersChange, 100);
  assert.deepEqual(ai.topAiSources.map((source) => [source.source, source.users]), [['chatgpt.com', 8], ['perplexity.ai', 2]]);
  assert.deepEqual(ai.trend.map((point) => point.sessions), [6, 4]);
});

test('landing pages skip the Others group and attach event conversions', () => {
  const pages = buildLandingPages(
    [
      { requestPath: '/', visitors: 40 },
      { requestPath: '/kontakt', visitors: 10 },
      { requestPath: 'Others', visitors: 99 },
    ],
    [{ requestPath: '/kontakt', count: 2 }],
  );
  assert.deepEqual(pages, [
    { path: '/', sessions: 40, conversions: 0, conversionRate: 0 },
    { path: '/kontakt', sessions: 10, conversions: 2, conversionRate: 20 },
  ]);
});

test('daily points and country names', () => {
  assert.deepEqual(
    toDailyPoints([
      { timestamp: '2026-11-02T00:00:00.000Z', pageviews: 3 },
      { timestamp: '2026-11-01T00:00:00.000Z', pageviews: 1 },
      { timestamp: '2026-11-02T00:00:00.000Z', pageviews: 2 },
    ], 'pageviews'),
    [
      { date: Date.parse('2026-11-01T00:00:00.000Z'), value: 1 },
      { date: Date.parse('2026-11-02T00:00:00.000Z'), value: 5 },
    ],
  );
  assert.equal(countryName('AT'), 'Österreich');
  assert.equal(countryName('Others'), 'Sonstige');
  assert.equal(countryName(''), '(unbekannt)');
  assert.equal(buildInFilter('eventName', ["o'brien", 'b']), "eventName in ('o''brien', 'b')");
});

test('API errors keep a good snapshot only for temporary failures', () => {
  const kind = (status: number) => classifyGoogleApiError(describeVercelAnalyticsStatus(status, '')).kind;
  assert.equal(kind(429), 'quota');
  assert.equal(kind(503), 'transient');
  assert.equal(kind(401), 'permanent');
  assert.equal(kind(403), 'permanent');
  assert.equal(kind(404), 'permanent');
});

test('AI note and metric keys depend on the analytics source', () => {
  assert.equal(analyticsSourceNote({}), '');
  const note = analyticsSourceNote({
    analyticsSource: 'vercel',
    vercelAnalytics: { pageviews: { value: 1200, change: 5 }, pageviewsDaily: [], conversionsConfigured: false },
  });
  assert.match(note, /Vercel Web Analytics/);
  assert.match(note, /Conversions werden nicht gemessen/);

  const vercelValues = extractDashboardMetricValues({
    analyticsSource: 'vercel',
    kpis: { totalUsers: { value: 50, change: 0 }, sessions: { value: 50, change: 0 }, engagementRate: { value: 0, change: 0 } },
    vercelAnalytics: { pageviews: { value: 80, change: 0 }, pageviewsDaily: [], conversionsConfigured: false },
  });
  assert.equal(vercelValues['vercel.visitors'], 50);
  assert.equal(vercelValues['vercel.pageviews'], 80);
  assert.equal(vercelValues['vercel.conversions'], undefined);
  assert.equal(Object.keys(vercelValues).some((key) => key.startsWith('ga4.')), false);

  const ga4Values = extractDashboardMetricValues({ kpis: { sessions: { value: 9, change: 0 } } });
  assert.equal(ga4Values['ga4.sessions'], 9);
  assert.equal(Object.keys(ga4Values).some((key) => key.startsWith('vercel.')), false);
});
