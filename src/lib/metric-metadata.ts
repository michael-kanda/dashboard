import type { ProjectDashboardData } from './dashboard-shared';
import type { ProjectIndexingStatus } from './indexing-status';

export const DASHBOARD_SNAPSHOT_VERSION = 1;

export type MetricSource = 'gsc' | 'ga4' | 'google-ads' | 'local-seo' | 'indexing';
export type MetricUnit = 'count' | 'percent' | 'seconds' | 'currency';
export type MetricCoverageStatus = 'complete' | 'partial' | 'modeled' | 'unknown';

export interface MetricDefinition {
  key: string;
  source: MetricSource;
  unit: MetricUnit;
  calculationMethod: string;
  calculationVersion: number;
  defaultCoverage: MetricCoverageStatus;
  coverageNote: string;
}

export interface MetricMetadata {
  key: string;
  source: MetricSource;
  unit: MetricUnit;
  updatedAt: string;
  period: {
    from: string;
    to: string;
  };
  coverage: {
    status: MetricCoverageStatus;
    note: string;
  };
  calculation: {
    method: string;
    version: number;
  };
}

const GSC_COVERAGE = 'Search Console kann seltene Suchanfragen aus Datenschutzgründen ausblenden.';
const GA4_COVERAGE = 'GA4 ist consent-abhängig; Consent Mode kann modellierte Werte enthalten.';
const ADS_COVERAGE = 'Abdeckung entspricht den im Projekt konfigurierten Google-Ads-Daten.';
const LOCAL_COVERAGE = 'GA4 wird über Standort-Landingpages oder Stadt zugeordnet; GSC über Landingpages und Keyword-Aliase.';
const INDEXING_COVERAGE = 'URL-Inspection wird innerhalb des API-Budgets schrittweise fortgesetzt.';

export const METRIC_CATALOG: Record<string, MetricDefinition> = {
  'gsc.clicks': { key: 'gsc.clicks', source: 'gsc', unit: 'count', calculationMethod: 'Summe der GSC-Klicks im Zeitraum', calculationVersion: 1, defaultCoverage: 'partial', coverageNote: GSC_COVERAGE },
  'gsc.impressions': { key: 'gsc.impressions', source: 'gsc', unit: 'count', calculationMethod: 'Summe der GSC-Impressionen im Zeitraum', calculationVersion: 1, defaultCoverage: 'partial', coverageNote: GSC_COVERAGE },
  'gsc.genAiImpressions': { key: 'gsc.genAiImpressions', source: 'gsc', unit: 'count', calculationMethod: 'GSC-Impressionen der generativen Suchdarstellung', calculationVersion: 1, defaultCoverage: 'partial', coverageNote: 'Nur für Properties und Zeiträume verfügbar, die Google im GenAI-Report ausliefert.' },
  'ga4.sessions': { key: 'ga4.sessions', source: 'ga4', unit: 'count', calculationMethod: 'GA4 Sessions', calculationVersion: 1, defaultCoverage: 'modeled', coverageNote: GA4_COVERAGE },
  'ga4.totalUsers': { key: 'ga4.totalUsers', source: 'ga4', unit: 'count', calculationMethod: 'GA4 Total Users', calculationVersion: 1, defaultCoverage: 'modeled', coverageNote: GA4_COVERAGE },
  'ga4.newUsers': { key: 'ga4.newUsers', source: 'ga4', unit: 'count', calculationMethod: 'GA4 New Users', calculationVersion: 1, defaultCoverage: 'modeled', coverageNote: GA4_COVERAGE },
  'ga4.conversions': { key: 'ga4.conversions', source: 'ga4', unit: 'count', calculationMethod: 'Summe der in GA4 konfigurierten Conversions', calculationVersion: 1, defaultCoverage: 'modeled', coverageNote: GA4_COVERAGE },
  'ga4.engagementRate': { key: 'ga4.engagementRate', source: 'ga4', unit: 'percent', calculationMethod: 'GA4 Engagement Rate × 100', calculationVersion: 1, defaultCoverage: 'modeled', coverageNote: GA4_COVERAGE },
  'ga4.bounceRate': { key: 'ga4.bounceRate', source: 'ga4', unit: 'percent', calculationMethod: 'GA4 Bounce Rate × 100', calculationVersion: 1, defaultCoverage: 'modeled', coverageNote: GA4_COVERAGE },
  'ga4.avgEngagementTime': { key: 'ga4.avgEngagementTime', source: 'ga4', unit: 'seconds', calculationMethod: 'Durchschnittliche GA4 Engagement-Dauer', calculationVersion: 1, defaultCoverage: 'modeled', coverageNote: GA4_COVERAGE },
  'ga4.paidSearch': { key: 'ga4.paidSearch', source: 'ga4', unit: 'count', calculationMethod: 'GA4 Sessions im Channel Paid Search', calculationVersion: 1, defaultCoverage: 'modeled', coverageNote: GA4_COVERAGE },
  'ga4.aiTrafficSessions': { key: 'ga4.aiTrafficSessions', source: 'ga4', unit: 'count', calculationMethod: 'GA4 Medium ai-assistant plus erkannte KI-Referrer', calculationVersion: 2, defaultCoverage: 'partial', coverageNote: 'Nur identifizierbare KI-Referrer und das GA4-Medium ai-assistant sind enthalten.' },
  'ga4.aiTrafficUsers': { key: 'ga4.aiTrafficUsers', source: 'ga4', unit: 'count', calculationMethod: 'Nutzer aus GA4 ai-assistant und erkannten KI-Referrern', calculationVersion: 2, defaultCoverage: 'partial', coverageNote: 'Nur identifizierbare KI-Referrer und das GA4-Medium ai-assistant sind enthalten.' },
  'googleAds.cost': { key: 'googleAds.cost', source: 'google-ads', unit: 'currency', calculationMethod: 'Summe der Google-Ads-Kosten', calculationVersion: 1, defaultCoverage: 'complete', coverageNote: ADS_COVERAGE },
  'googleAds.clicks': { key: 'googleAds.clicks', source: 'google-ads', unit: 'count', calculationMethod: 'Summe der Google-Ads-Klicks', calculationVersion: 1, defaultCoverage: 'complete', coverageNote: ADS_COVERAGE },
  'googleAds.impressions': { key: 'googleAds.impressions', source: 'google-ads', unit: 'count', calculationMethod: 'Summe der Google-Ads-Impressionen', calculationVersion: 1, defaultCoverage: 'complete', coverageNote: ADS_COVERAGE },
  'googleAds.conversions': { key: 'googleAds.conversions', source: 'google-ads', unit: 'count', calculationMethod: 'Summe der Google-Ads-Conversions', calculationVersion: 1, defaultCoverage: 'complete', coverageNote: ADS_COVERAGE },
  'localSeo.clicks': { key: 'localSeo.clicks', source: 'local-seo', unit: 'count', calculationMethod: 'Summe der standortbezogenen GSC-Klicks', calculationVersion: 2, defaultCoverage: 'partial', coverageNote: LOCAL_COVERAGE },
  'localSeo.impressions': { key: 'localSeo.impressions', source: 'local-seo', unit: 'count', calculationMethod: 'Summe der standortbezogenen GSC-Impressionen', calculationVersion: 2, defaultCoverage: 'partial', coverageNote: LOCAL_COVERAGE },
  'localSeo.sessions': { key: 'localSeo.sessions', source: 'local-seo', unit: 'count', calculationMethod: 'Summe der zugeordneten GA4-Sessions', calculationVersion: 2, defaultCoverage: 'partial', coverageNote: LOCAL_COVERAGE },
  'localSeo.newUsers': { key: 'localSeo.newUsers', source: 'local-seo', unit: 'count', calculationMethod: 'Summe der zugeordneten neuen GA4-Nutzer', calculationVersion: 2, defaultCoverage: 'partial', coverageNote: LOCAL_COVERAGE },
  'localSeo.conversions': { key: 'localSeo.conversions', source: 'local-seo', unit: 'count', calculationMethod: 'Summe der zugeordneten GA4-Conversions', calculationVersion: 2, defaultCoverage: 'partial', coverageNote: LOCAL_COVERAGE },
  'indexing.total': { key: 'indexing.total', source: 'indexing', unit: 'count', calculationMethod: 'Bereinigte URLs aus Sitemap und Unter-Sitemaps', calculationVersion: 2, defaultCoverage: 'complete', coverageNote: INDEXING_COVERAGE },
  'indexing.indexed': { key: 'indexing.indexed', source: 'indexing', unit: 'count', calculationMethod: 'URL-Inspection-Ergebnis: indexiert', calculationVersion: 2, defaultCoverage: 'partial', coverageNote: INDEXING_COVERAGE },
  'indexing.notIndexed': { key: 'indexing.notIndexed', source: 'indexing', unit: 'count', calculationMethod: 'URL-Inspection-Ergebnis: nicht indexiert', calculationVersion: 2, defaultCoverage: 'partial', coverageNote: INDEXING_COVERAGE },
  'indexing.actionRequired': { key: 'indexing.actionRequired', source: 'indexing', unit: 'count', calculationMethod: 'Nicht indexierte URLs ohne erkennbar beabsichtigten Ausschluss, zuzüglich Prüffehler und Canonical-Abweichungen', calculationVersion: 3, defaultCoverage: 'partial', coverageNote: INDEXING_COVERAGE },
  'indexing.intentional': { key: 'indexing.intentional', source: 'indexing', unit: 'count', calculationMethod: 'Nicht indexierte URLs mit beabsichtigtem Ausschluss: noindex, Weiterleitung oder alternative Seite mit Canonical', calculationVersion: 1, defaultCoverage: 'partial', coverageNote: INDEXING_COVERAGE },
  'indexing.stale': { key: 'indexing.stale', source: 'indexing', unit: 'count', calculationMethod: 'URLs, deren letzte URL-Inspection älter als das Re-Check-Intervall zuzüglich Puffer ist', calculationVersion: 1, defaultCoverage: 'complete', coverageNote: 'Zeigt, wie weit der Datenstand hinter dem tatsächlichen Google-Index liegen kann.' },
};

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function resolveMetricPeriod(dateRange: string, referenceDate = new Date()) {
  const end = new Date(referenceDate);
  end.setUTCHours(12, 0, 0, 0);
  end.setUTCDate(end.getUTCDate() - 1);
  if (dateRange === 'snapshot') {
    const snapshotDate = formatDate(referenceDate);
    return { from: snapshotDate, to: snapshotDate };
  }
  const daysByRange: Record<string, number> = {
    '7d': 7,
    '30d': 30,
    '90d': 90,
    '3m': 90,
    '6m': 180,
    '12m': 365,
    '18m': 548,
    '24m': 730,
  };
  const days = daysByRange[dateRange] ?? 30;
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  return { from: formatDate(start), to: formatDate(end) };
}

export function createMetricMetadata(
  metricKey: string,
  dateRange: string,
  updatedAt: string,
  coverageOverride?: Partial<MetricMetadata['coverage']>,
): MetricMetadata {
  const definition = METRIC_CATALOG[metricKey];
  if (!definition) throw new Error(`Unbekannte Kennzahl: ${metricKey}`);
  return {
    key: metricKey,
    source: definition.source,
    unit: definition.unit,
    updatedAt,
    period: resolveMetricPeriod(dateRange, new Date(updatedAt)),
    coverage: {
      status: coverageOverride?.status ?? definition.defaultCoverage,
      note: coverageOverride?.note ?? definition.coverageNote,
    },
    calculation: {
      method: definition.calculationMethod,
      version: definition.calculationVersion,
    },
  };
}

export function extractDashboardMetricValues(data: ProjectDashboardData) {
  const values: Record<string, number> = {};
  const addKpi = (key: string, value: number | undefined) => {
    if (typeof value === 'number' && Number.isFinite(value)) values[key] = value;
  };

  addKpi('gsc.clicks', data.kpis?.clicks?.value);
  addKpi('gsc.impressions', data.kpis?.impressions?.value);
  addKpi('gsc.genAiImpressions', data.kpis?.genAiImpressions?.value);
  addKpi('ga4.sessions', data.kpis?.sessions?.value);
  addKpi('ga4.totalUsers', data.kpis?.totalUsers?.value);
  addKpi('ga4.newUsers', data.kpis?.newUsers?.value);
  addKpi('ga4.conversions', data.kpis?.conversions?.value);
  addKpi('ga4.engagementRate', data.kpis?.engagementRate?.value);
  addKpi('ga4.bounceRate', data.kpis?.bounceRate?.value);
  addKpi('ga4.avgEngagementTime', data.kpis?.avgEngagementTime?.value);
  addKpi('ga4.paidSearch', data.kpis?.paidSearch?.value);

  if (data.aiTraffic) {
    addKpi('ga4.aiTrafficSessions', data.aiTraffic.totalSessions);
    addKpi('ga4.aiTrafficUsers', data.aiTraffic.totalUsers);
  }
  if (data.googleAdsData) {
    addKpi('googleAds.cost', data.googleAdsData.totals.cost);
    addKpi('googleAds.clicks', data.googleAdsData.totals.clicks);
    addKpi('googleAds.impressions', data.googleAdsData.totals.impressions);
    addKpi('googleAds.conversions', data.googleAdsData.totals.conversions);
  }
  if (data.localSeo) {
    addKpi('localSeo.clicks', data.localSeo.totals.clicks);
    addKpi('localSeo.impressions', data.localSeo.totals.impressions);
    addKpi('localSeo.sessions', data.localSeo.totals.sessions);
    addKpi('localSeo.newUsers', data.localSeo.totals.newUsers);
    addKpi('localSeo.conversions', data.localSeo.totals.conversions);
  }

  return values;
}

function resolveCoverageOverride(
  data: ProjectDashboardData,
  metricKey: string,
): Partial<MetricMetadata['coverage']> | undefined {
  const sourceError = metricKey === 'gsc.genAiImpressions'
    ? data.apiErrors?.genAi
    : metricKey.startsWith('gsc.')
      ? data.apiErrors?.gsc
      : metricKey.startsWith('ga4.')
        ? data.apiErrors?.ga4
        : metricKey.startsWith('googleAds.')
          ? data.apiErrors?.googleAds
          : metricKey.startsWith('localSeo.')
            ? data.apiErrors?.gsc || data.apiErrors?.ga4
            : undefined;
  if (!sourceError) return undefined;
  return {
    status: 'partial',
    note: `Die letzte Synchronisierung war unvollständig: ${sourceError}`,
  };
}

export function attachDashboardMetricMetadata(
  data: ProjectDashboardData,
  dateRange: string,
  updatedAt = new Date().toISOString(),
) {
  const values = extractDashboardMetricValues(data);
  const metricMetadata = Object.fromEntries(
    Object.keys(values).map((key) => [
      key,
      createMetricMetadata(key, dateRange, updatedAt, resolveCoverageOverride(data, key)),
    ]),
  );
  return {
    ...data,
    snapshotVersion: DASHBOARD_SNAPSHOT_VERSION,
    metricMetadata,
  };
}

export function extractIndexingMetricValues(status: ProjectIndexingStatus) {
  return {
    'indexing.total': status.totalUrls,
    'indexing.indexed': status.indexedUrls,
    'indexing.notIndexed': status.notIndexedUrls,
    'indexing.actionRequired': status.issueUrls,
    'indexing.intentional': status.intentionalUrls,
    'indexing.stale': status.staleUrls,
  } satisfies Record<string, number>;
}
