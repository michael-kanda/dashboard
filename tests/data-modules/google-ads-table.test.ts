import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildGa4GoogleAdsLevelRows,
  GOOGLE_ADS_NO_AD_GROUP_LABEL,
  GOOGLE_ADS_UNASSIGNED_LABEL,
} from '../../src/lib/google-ads-table.ts';
import { hasGoogleAdsRows } from '../../src/lib/data-modules/google-ads.ts';

function row(campaign: string, adGroup: string, cost: number, clicks: number, sessions: number) {
  return {
    campaign, adGroup, adName: '–', keyword: '–', searchQuery: 'stempel', landingPage: '–',
    cost, clicks, impressions: 0, cpc: clicks ? cost / clicks : 0, roas: 0,
    conversions: 0, sessions, engagedSessions: Math.round(sessions / 2),
  };
}

// Stand aus dem Dashboard: Summen 240,30 € / 715 Klicks, Tabelle zeigte nur „Stempel“.
const data = {
  rows: [
    row('Stempel', 'Stempel 01', 20.62, 54, 22),
    row('Stempel', 'Stempel Webseite – dynamische Anzeigengruppe', 9.11, 9, 4),
  ],
  landingPageRows: [],
  totals: { cost: 240.3, clicks: 715, avgCpc: 0.34, roas: 0, conversions: 4, sessions: 333, engagedSessions: 180 },
  metricsByCampaign: {
    Stempel: { cost: 29.73, clicks: 63, sessions: 26, engagedSessions: 13 },
    'PMax Stempel': { cost: 210.57, clicks: 652, sessions: 307, engagedSessions: 165 },
  },
  conversionsByCampaign: { Stempel: 0, 'PMax Stempel': 4 },
  metricsByAdGroup: {
    'Stempel 01': { cost: 20.62, clicks: 54, sessions: 22, engagedSessions: 11 },
    'Stempel Webseite – dynamische Anzeigengruppe': { cost: 9.11, clicks: 9, sessions: 4, engagedSessions: 2 },
    '(not set)': { cost: 210.57, clicks: 652, sessions: 307, engagedSessions: 165 },
  },
  conversionsByAdGroup: { '(not set)': 4 },
};

test('GA4-Kampagnen enthalten Kampagnen, die nur in der 1-Dimension-Abfrage stehen', () => {
  const rows = buildGa4GoogleAdsLevelRows(data, 'campaign');
  const pmax = rows.find((r) => r.label === 'PMax Stempel');
  assert.ok(pmax, 'PMax-Kampagne fehlt');
  assert.equal(pmax.clicks, 652);
  assert.equal(pmax.conversions, 4);
  assert.equal(rows.some((r) => r.isRemainder), false);
  const cost = rows.reduce((s, r) => s + r.cost, 0);
  assert.ok(Math.abs(cost - data.totals.cost) < 0.01);
  assert.equal(rows.reduce((s, r) => s + r.clicks, 0), 715);
});

test('Anzeigengruppe (not set) wird verständlich benannt', () => {
  const rows = buildGa4GoogleAdsLevelRows(data, 'adGroup');
  assert.ok(rows.some((r) => r.label === GOOGLE_ADS_NO_AD_GROUP_LABEL && r.clicks === 652));
  assert.equal(rows.some((r) => r.label === '(not set)'), false);
});

test('Fehlt eine Kampagne auch in den Lookups, gleicht eine Restzeile die Summen aus', () => {
  const rows = buildGa4GoogleAdsLevelRows({ ...data, metricsByCampaign: { Stempel: data.metricsByCampaign.Stempel } }, 'campaign');
  const rest = rows.find((r) => r.isRemainder);
  assert.ok(rest);
  assert.equal(rest.label, GOOGLE_ADS_UNASSIGNED_LABEL);
  assert.equal(rest.clicks, 652);
  assert.equal(rest.sessions, 307);
  assert.ok(Math.abs(rest.cost - 210.57) < 0.001);
});

test('Ohne Abweichung gibt es keine Restzeile', () => {
  const rows = buildGa4GoogleAdsLevelRows({
    ...data,
    totals: { ...data.totals, cost: 29.73, clicks: 63, sessions: 26, conversions: 0 },
    metricsByCampaign: { Stempel: data.metricsByCampaign.Stempel },
  }, 'campaign');
  assert.deepEqual(rows.map((r) => r.label), ['Stempel']);
});

test('Widget gilt als befüllt, wenn nur Lookups vorhanden sind (reine PMax-Konten)', () => {
  assert.equal(hasGoogleAdsRows({ ...data, rows: [] }), true);
});
