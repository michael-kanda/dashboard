// Vorjahreswerte für den Dashboard-Snapshot. Vergangene Tage ändern sich nicht mehr,
// deshalb gilt ein geladener Block so lange, wie sein Vorjahreszeitraum gleich bleibt:
// Abfragen gibt es höchstens einmal am Tag je Zeitraum, wenn das Fenster weiterrückt.
// Fenster vor der 16-Monats-Grenze der Search Console werden gar nicht erst abgefragt.
import { sql } from '@vercel/postgres';
import { getAnalyticsData, getSearchConsoleData } from '@/lib/google-api';
import {
  YEAR_OVER_YEAR_VERSION,
  assessCoverage,
  getYearOverYearPeriod,
  getYoySource,
  isPeriodWithinGscRetention,
  YOY_KPI_KEYS,
  type YearOverYearData,
  type YoyKpiKey,
  type YoySourceStatus,
} from '@/lib/comparison';
import { REPORTING_LAG_DAYS, type ReportingWindow } from '@/lib/sync/cache-policy';
import { getShortGoogleError } from '@/lib/google/ga4-runtime';

type SourcePart = Pick<YearOverYearData, 'values' | 'charts'> & { status: YoySourceStatus };

export async function readCachedYearOverYear(
  userId: string,
  dateRange: string,
): Promise<YearOverYearData | undefined> {
  try {
    const { rows } = await sql`
      SELECT data->'yearOverYear' AS yoy FROM google_data_cache
      WHERE user_id = ${userId}::uuid AND date_range = ${dateRange} LIMIT 1
    `;
    const yoy = rows[0]?.yoy as YearOverYearData | null | undefined;
    return yoy && typeof yoy === 'object' ? yoy : undefined;
  } catch (error) {
    console.warn('[Vorjahr] Gespeicherte Vorjahreswerte nicht lesbar (ignoriert):', error);
    return undefined;
  }
}

function addIsoDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Übernimmt die Werte einer Quelle aus dem gespeicherten Block. */
function pickSource(cached: YearOverYearData, source: 'gsc' | 'web'): SourcePart {
  const values: YearOverYearData['values'] = {};
  const charts: YearOverYearData['charts'] = {};
  for (const key of YOY_KPI_KEYS) {
    if (getYoySource(key) !== source) continue;
    if (cached.values?.[key] !== undefined) values[key] = cached.values[key];
    if (cached.charts?.[key]) charts[key] = cached.charts[key];
  }
  return { status: cached[source], values, charts };
}

async function loadGscPart(siteUrl: string, period: YearOverYearData['period']): Promise<SourcePart> {
  const raw = await getSearchConsoleData(siteUrl, period.from, period.to);
  const status = assessCoverage(raw.impressions?.daily, raw.impressions?.total ?? 0, period);
  if (status !== 'available') return { status, values: {}, charts: {} };
  return {
    status,
    values: { clicks: raw.clicks?.total ?? 0, impressions: raw.impressions?.total ?? 0 },
    charts: { clicks: raw.clicks?.daily ?? [], impressions: raw.impressions?.daily ?? [] },
  };
}

async function loadGa4Part(propertyId: string, period: YearOverYearData['period']): Promise<SourcePart> {
  const raw = await getAnalyticsData(propertyId, period.from, period.to);
  const status = assessCoverage(raw.sessions.daily, raw.sessions.total, period);
  if (status !== 'available') return { status, values: {}, charts: {} };
  // Gleiche Einheiten wie die KPI-Werte im Loader: Raten in Prozent mit zwei Stellen.
  const percent = (value: number) => parseFloat((value * 100).toFixed(2));
  const values: Partial<Record<YoyKpiKey, number>> = {
    sessions: raw.sessions.total,
    totalUsers: raw.totalUsers.total,
    newUsers: raw.newUsers.total,
    conversions: raw.conversions.total,
    engagementRate: percent(raw.engagementRate.total),
    bounceRate: percent(raw.bounceRate.total),
    avgEngagementTime: raw.avgEngagementTime.total,
  };
  return {
    status,
    values,
    charts: {
      sessions: raw.sessions.daily,
      totalUsers: raw.totalUsers.daily,
      newUsers: raw.newUsers.daily,
      conversions: raw.conversions.daily,
      engagementRate: raw.engagementRate.daily,
      bounceRate: raw.bounceRate.daily,
      avgEngagementTime: raw.avgEngagementTime.daily,
    },
  };
}

export interface LoadYearOverYearInput {
  window: Pick<ReportingWindow, 'startDate' | 'endDate'>;
  gscSiteUrl?: string | null;
  /** Gültige GA4-Property oder null, wenn keine verbunden ist. */
  ga4PropertyId?: string | null;
  analyticsSource: 'ga4' | 'vercel';
  cached?: YearOverYearData;
}

export async function loadYearOverYear({
  window,
  gscSiteUrl,
  ga4PropertyId,
  analyticsSource,
  cached,
}: LoadYearOverYearInput): Promise<YearOverYearData> {
  const period = getYearOverYearPeriod({ from: window.startDate, to: window.endDate });
  const today = addIsoDays(window.endDate, REPORTING_LAG_DAYS);
  const samePeriod = cached?.version === YEAR_OVER_YEAR_VERSION
    && cached.period?.from === period.from
    && cached.period?.to === period.to;
  const sourceIds = { gsc: gscSiteUrl || null, web: analyticsSource === 'vercel' ? 'vercel' : ga4PropertyId || null };
  const reusable = (source: 'gsc' | 'web') => Boolean(
    samePeriod && cached && cached[source] && cached[source] !== 'error'
      && cached.sourceIds?.[source] === sourceIds[source],
  );

  let gsc: SourcePart;
  if (!gscSiteUrl) {
    gsc = { status: 'not_configured', values: {}, charts: {} };
  } else if (!isPeriodWithinGscRetention(period, today)) {
    gsc = { status: 'out_of_range', values: {}, charts: {} };
  } else if (reusable('gsc')) {
    gsc = pickSource(cached!, 'gsc');
  } else {
    try {
      gsc = await loadGscPart(gscSiteUrl, period);
    } catch (error) {
      console.warn('[Vorjahr] Search Console fehlgeschlagen (ignoriert):', getShortGoogleError(error));
      gsc = { status: 'error', values: {}, charts: {} };
    }
  }

  let web: SourcePart;
  if (analyticsSource === 'vercel') {
    web = { status: 'not_supported', values: {}, charts: {} };
  } else if (!ga4PropertyId) {
    web = { status: 'not_configured', values: {}, charts: {} };
  } else if (reusable('web')) {
    web = pickSource(cached!, 'web');
  } else {
    try {
      web = await loadGa4Part(ga4PropertyId, period);
    } catch (error) {
      console.warn('[Vorjahr] GA4 fehlgeschlagen (ignoriert):', getShortGoogleError(error));
      web = { status: 'error', values: {}, charts: {} };
    }
  }

  const reusedAll = reusable('gsc') && reusable('web');
  return {
    version: YEAR_OVER_YEAR_VERSION,
    period,
    fetchedAt: reusedAll && cached ? cached.fetchedAt : new Date().toISOString(),
    gsc: gsc.status,
    web: web.status,
    sourceIds,
    values: { ...gsc.values, ...web.values },
    charts: { ...gsc.charts, ...web.charts },
  };
}

/**
 * Vorjahresblock für einen neuen Snapshot. Mit `allowFetch = false` (Snapshot wird wegen
 * Fehlern nicht gespeichert) nur den gespeicherten Block übernehmen, wenn er passt.
 */
export async function resolveYearOverYear(
  userId: string,
  dateRange: string,
  allowFetch: boolean,
  input: Omit<LoadYearOverYearInput, 'cached'>,
): Promise<YearOverYearData | undefined> {
  const cached = await readCachedYearOverYear(userId, dateRange);
  if (allowFetch) return loadYearOverYear({ ...input, cached });
  const period = getYearOverYearPeriod({ from: input.window.startDate, to: input.window.endDate });
  return cached?.period?.from === period.from && cached.period?.to === period.to ? cached : undefined;
}
