// src/lib/google-api.ts

import { google } from 'googleapis';
import type { analyticsdata_v1beta } from 'googleapis';
import { buildAiTrafficDimensionFilter, normalizeSource } from './ai-sources';
// ── Globales Retry-/Timeout-Verhalten für ALLE googleapis-Calls ──────────
// GA4 runReport & GSC query sind POST und werden von gaxios per Default NICHT
// wiederholt. Da diese Reports rein lesend/idempotent sind, ist Retry sicher.
//
// TIMEOUT-HÄRTUNG (Juni 2026):
// 20 s waren für schwere GA4-Reports (viele Metriken, 3–24 Monate) zu knapp —
// Folge: AbortSignal-Abbruch ("The operation was aborted."). WICHTIG: gaxios
// (7.1.3) retried per Timeout abgebrochene Requests in der Praxis NICHT
// (Produktions-Logs zeigen currentRetryAttempt: 0 beim Wurf), die frühere
// Worst-Case-Rechnung "2 × 20 s" galt für Timeouts also nie. Effektiv gab es
// EINEN 20-s-Versuch, dann Fehler. Deshalb: 45 s pro Versuch.
//
// QUOTA-HÄRTUNG:
// 429 wird NICHT mehr retried — ein Quota-Fehler erholt sich nicht in 500 ms,
// der Retry verbrennt nur ein weiteres Token. 5xx-Retry bleibt für GSC/Sheets
// erhalten; GA4-Calls laufen unten über ga4RunReport mit eigener, strengerer
// Konfiguration (kein 5xx-Retry wegen der winzigen Server-Error-Quota von
// 10/Stunde pro Property — siehe ai-traffic-extended-v2.ts).
google.options({
  retry: true,
  retryConfig: {
    retry: 1,
    retryDelay: 500,
    httpMethodsToRetry: ['GET', 'HEAD', 'PUT', 'OPTIONS', 'DELETE', 'POST'],
    statusCodesToRetry: [[100, 199], [500, 599]],
    // Echte Netzwerkfehler (ECONNRESET etc.) einmal wiederholen — die schlagen
    // schnell fehl und kosten kein Zeitbudget. Timeout-Aborts retried gaxios
    // ohnehin nicht (siehe oben).
    noResponseRetries: 1,
    onRetryAttempt: (err: any) => {
      const code = err?.response?.status ?? err?.code ?? err?.error?.type ?? 'no-response';
      const attempt = err?.config?.retryConfig?.currentRetryAttempt ?? '?';
      console.warn(`[Google API] Retry nach ${code} (Versuch ${attempt})`);
    },
  },
  // Per-Versuch-Timeout (Timeouts werden nicht retried, s.o.) — bleibt unter
  // dem 60-s-Function-Limit, GA4-Parallelität wird zusätzlich per Semaphore
  // (ga4RunReport) begrenzt, damit mehrere Reports nicht gleichzeitig die
  // GA4-Concurrent-Slots blockieren und sich gegenseitig ins Timeout drängen.
  timeout: 45_000,
});
import { JWT } from 'google-auth-library';
import { ChartEntry, type GoogleGenAiPerformanceData, type GoogleGenAiBreakdownItem } from '@/lib/dashboard-shared';
import type { TopQueryData } from '@/types/dashboard';

// --- Typdefinitionen ---

// ── GA4-Wrapper: Concurrency-Limit + GA4-sichere Request-Optionen ─────────
// GA4 drosselt gleichzeitige Requests pro Property hart ("Exhausted concurrent
// requests quota"). Die Projekt-Seite feuert mehrere Reports parallel
// (Promise.all/allSettled) — die warten sich dann gegenseitig in die 45-s-
// Timeouts. Lösung: Semaphore, max. 2 GA4-runReports gleichzeitig pro warmer
// Lambda-Instanz. Wartende Calls kosten kein GA4-Budget, nur etwas Latenz.
const GA4_MAX_CONCURRENT = 2;
let ga4ActiveSlots = 0;
const ga4SlotQueue: Array<() => void> = [];

function acquireGa4Slot(): Promise<void> {
  if (ga4ActiveSlots < GA4_MAX_CONCURRENT) {
    ga4ActiveSlots++;
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => ga4SlotQueue.push(resolve));
}

function releaseGa4Slot(): void {
  const next = ga4SlotQueue.shift();
  if (next) {
    // Slot direkt an den nächsten Wartenden weitergeben (Zähler bleibt gleich).
    next();
  } else {
    ga4ActiveSlots--;
  }
}

// Strengere Optionen NUR für GA4 (überschreiben google.options pro Request):
// kein 5xx-Retry (verbrennt Tokens der winzigen Server-Error-Quota, 10/h pro
// Property), kein 429-Retry. Nur 408 und echte Netzwerkfehler.
const GA4_REQUEST_OPTIONS = {
  timeout: 45_000,
  retryConfig: {
    retry: 1,
    retryDelay: 500,
    httpMethodsToRetry: ['POST'],
    statusCodesToRetry: [[408, 408]],
    noResponseRetries: 1,
  },
};

/**
 * Einheitlicher Einstiegspunkt für ALLE GA4-runReport-Calls dieser Datei.
 * Rückgabetyp ist bewusst auf das RunReport-Schema typisiert, damit die
 * Typinferenz an den Aufrufstellen (rows.map((row) => ...)) erhalten bleibt —
 * sonst schlägt noImplicitAny im Build zu.
 */
async function ga4RunReport(
  analytics: analyticsdata_v1beta.Analyticsdata,
  request: analyticsdata_v1beta.Params$Resource$Properties$Runreport
): Promise<{ data: analyticsdata_v1beta.Schema$RunReportResponse }> {
  await acquireGa4Slot();
  try {
    return (await analytics.properties.runReport(
      request,
      GA4_REQUEST_OPTIONS as any
    )) as unknown as { data: analyticsdata_v1beta.Schema$RunReportResponse };
  } finally {
    releaseGa4Slot();
  }
}


interface DailyDataPoint {
  date: number; // Timestamp
  value: number;
}

export interface DateRangeData {
  total: number;
  daily: DailyDataPoint[];
}

export interface Ga4ExtendedData {
  sessions: DateRangeData;
  totalUsers: DateRangeData;
  newUsers: DateRangeData;
  conversions: DateRangeData;
  bounceRate: DateRangeData;
  engagementRate: DateRangeData;
  avgEngagementTime: DateRangeData;
  clicks: DateRangeData;
  impressions: DateRangeData;
  paidSearch: DateRangeData;
}

export interface AiTrafficData {
  totalSessions: number;
  totalUsers: number;
  totalSessionsChange?: number;
  totalUsersChange?: number;
  sessionsBySource: {
    [key: string]: number;
  };
  topAiSources: Array<{
    source: string;
    sessions: number;
    users: number;
    percentage: number;
  }>;
  trend: Array<{
    date: number;
    sessions: number;
  }>;
}

// --- Authentifizierung ---

function createAuth(): JWT {
  if (process.env.GOOGLE_CREDENTIALS) {
    try {
      const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
      return new JWT({
        email: credentials.client_email,
        key: credentials.private_key,
        scopes: [
          'https://www.googleapis.com/auth/webmasters.readonly',
          'https://www.googleapis.com/auth/analytics.readonly',
          'https://www.googleapis.com/auth/spreadsheets.readonly',
        ],
      });
    } catch (e) {
      console.error('Fehler beim Parsen der GOOGLE_CREDENTIALS:', e);
      throw new Error('Google Credentials invalid');
    }
  }

  // Fallback für alte Env Vars
  const privateKeyBase64 = process.env.GOOGLE_PRIVATE_KEY_BASE64;
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;

  if (!privateKeyBase64 || !clientEmail) {
    throw new Error('Google API Credentials fehlen.');
  }

  try {
    const privateKey = Buffer.from(privateKeyBase64, 'base64').toString('utf-8');
    return new JWT({
      email: clientEmail,
      key: privateKey,
      scopes: [
        'https://www.googleapis.com/auth/webmasters.readonly',
        'https://www.googleapis.com/auth/analytics.readonly',
        'https://www.googleapis.com/auth/spreadsheets.readonly',
      ],
    });
  } catch (error) {
    throw new Error('Fehler beim Initialisieren der Google API Authentifizierung.');
  }
}

// --- Sheet API ---
export async function getGoogleSheetData(sheetId: string): Promise<any[]> {
  const auth = createAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: 'A1:Z2000',
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) return [];

    const headers = rows[0];
    const data = rows.slice(1).map((row) => {
      const obj: Record<string, string> = {};
      headers.forEach((header, index) => {
        const key = header?.trim();
        const val = row[index] ? row[index].toString().trim() : '';
        if (key) {
          obj[key] = val;
        }
      });
      return obj;
    });

    return data;
  } catch (error: unknown) {
    console.error('[Sheets API] Fehler:', error);
    throw new Error('Konnte Google Sheet nicht lesen.');
  }
}

// --- Helper ---

function parseGscDate(dateString: string): number {
  return new Date(dateString).getTime();
}

function parseGa4Date(dateString: string): number {
  const year = parseInt(dateString.substring(0, 4), 10);
  const month = parseInt(dateString.substring(4, 6), 10) - 1;
  const day = parseInt(dateString.substring(6, 8), 10);
  return new Date(year, month, day).getTime();
}

// --- Search Console (GSC) ---

export async function getSearchConsoleData(
  siteUrl: string,
  startDate: string,
  endDate: string
): Promise<{ clicks: DateRangeData; impressions: DateRangeData }> {
  const auth = createAuth();
  const searchconsole = google.searchconsole({ version: 'v1', auth });

  try {
    const res = await searchconsole.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate,
        endDate,
        dimensions: ['date'],
        rowLimit: 25000,
      },
    });

    const rows = res.data.rows || [];
    rows.sort((a, b) => (a.keys?.[0] || '').localeCompare(b.keys?.[0] || ''));

    const clicksDaily: DailyDataPoint[] = [];
    const impressionsDaily: DailyDataPoint[] = [];
    let totalClicks = 0;
    let totalImpressions = 0;

    for (const row of rows) {
      const dateStr = row.keys?.[0];
      if (!dateStr) continue;

      const dateTs = parseGscDate(dateStr);
      const c = row.clicks || 0;
      const i = row.impressions || 0;

      clicksDaily.push({ date: dateTs, value: c });
      impressionsDaily.push({ date: dateTs, value: i });

      totalClicks += c;
      totalImpressions += i;
    }

    return {
      clicks: { total: totalClicks, daily: clicksDaily },
      impressions: { total: totalImpressions, daily: impressionsDaily },
    };
  } catch (error) {
    console.error('GSC Error:', error);
    throw error;
  }
}

const GEN_AI_SEARCH_APPEARANCE_MATCHERS = [
  'ai overview',
  'ai overviews',
  'ai mode',
  'generative ai',
  'gen ai',
  'search generative',
];

function isGenAiSearchAppearance(value: string): boolean {
  const normalized = value.toLowerCase();
  return GEN_AI_SEARCH_APPEARANCE_MATCHERS.some((needle) => normalized.includes(needle));
}

function emptyGoogleGenAiPerformance(message: string): GoogleGenAiPerformanceData {
  return {
    status: 'unavailable',
    message,
    totalImpressions: 0,
    trend: [],
    topPages: [],
    countries: [],
    devices: [],
    detectedAppearances: [],
    source: 'gsc-report-rollout',
  };
}

async function queryGenAiDimension(
  searchconsole: any,
  siteUrl: string,
  startDate: string,
  endDate: string,
  appearances: string[],
  dimension: 'date' | 'page' | 'country' | 'device',
  rowLimit = 25000
): Promise<GoogleGenAiBreakdownItem[]> {
  const aggregate = new Map<string, number>();

  for (const appearance of appearances) {
    const res = await searchconsole.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate,
        endDate,
        dimensions: [dimension],
        rowLimit,
        type: 'web',
        dimensionFilterGroups: [{
          groupType: 'and',
          filters: [{
            dimension: 'searchAppearance',
            operator: 'equals',
            expression: appearance,
          }],
        }],
      },
    });

    for (const row of res.data.rows || []) {
      const key = row.keys?.[0] || '(unbekannt)';
      aggregate.set(key, (aggregate.get(key) || 0) + (row.impressions || 0));
    }
  }

  return Array.from(aggregate.entries())
    .map(([key, impressions]) => ({ key, impressions }))
    .sort((a, b) => b.impressions - a.impressions);
}

export async function getGoogleGenAiPerformanceData(
  siteUrl: string,
  startDate: string,
  endDate: string
): Promise<GoogleGenAiPerformanceData> {
  const auth = createAuth();
  const searchconsole = google.searchconsole({ version: 'v1', auth });

  try {
    const appearanceRes = await searchconsole.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate,
        endDate,
        dimensions: ['searchAppearance'],
        rowLimit: 25000,
        type: 'web',
      },
    });

    const allAppearances = (appearanceRes.data.rows || [])
      .map((row) => row.keys?.[0])
      .filter((value): value is string => typeof value === 'string' && value.length > 0);

    const genAiAppearances = allAppearances.filter(isGenAiSearchAppearance);

    if (genAiAppearances.length === 0) {
      return emptyGoogleGenAiPerformance(
        'Der Google-GenAI-Report ist fuer diese Property noch nicht per API/Search-Appearance sichtbar oder es gibt zu wenige Impressionen.'
      );
    }

    const [dates, pages, countries, devices] = await Promise.all([
      queryGenAiDimension(searchconsole, siteUrl, startDate, endDate, genAiAppearances, 'date'),
      queryGenAiDimension(searchconsole, siteUrl, startDate, endDate, genAiAppearances, 'page', 100),
      queryGenAiDimension(searchconsole, siteUrl, startDate, endDate, genAiAppearances, 'country', 100),
      queryGenAiDimension(searchconsole, siteUrl, startDate, endDate, genAiAppearances, 'device', 100),
    ]);

    const trend = dates
      .map((item) => ({
        date: parseGscDate(item.key),
        impressions: item.impressions,
      }))
      .sort((a, b) => a.date - b.date);

    const totalImpressions = trend.reduce((sum, point) => sum + point.impressions, 0);

    return {
      status: totalImpressions > 0 ? 'available' : 'unavailable',
      message: totalImpressions > 0
        ? 'Offizielle Google-GenAI-Sichtbarkeit aus Search Console Search-Appearance-Daten.'
        : 'Google-GenAI-Daten wurden erkannt, aber im Zeitraum liegen keine Impressionen vor.',
      totalImpressions,
      trend,
      topPages: pages.slice(0, 10),
      countries: countries.slice(0, 10),
      devices: devices.slice(0, 10),
      detectedAppearances: genAiAppearances,
      source: 'gsc-search-appearance',
    };
  } catch (error: any) {
    console.warn('[Google GenAI] Report/API nicht verfuegbar:', error?.message || error);
    return {
      ...emptyGoogleGenAiPerformance(
        'Der neue Google-GenAI-Report ist offiziell angekuendigt, aber fuer diese Property/API-Abfrage noch nicht verfuegbar.'
      ),
      status: 'api_unsupported',
    };
  }
}

export async function getTopQueries(
  siteUrl: string,
  startDate: string,
  endDate: string
): Promise<TopQueryData[]> {
  const auth = createAuth();
  const searchconsole = google.searchconsole({ version: 'v1', auth });

  try {
    const res = await searchconsole.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate,
        endDate,
        dimensions: ['query', 'page'],
        rowLimit: 1000,
      },
    });

    const rows = res.data.rows || [];

    const queryMap = new Map<
      string,
      {
        clicks: number;
        impressions: number;
        positionSum: number;
        count: number;
        topUrl: string;
        maxClicksForUrl: number;
      }
    >();

    for (const row of rows) {
      const query = row.keys?.[0] || '(not set)';
      const url = row.keys?.[1] || '';
      const clicks = row.clicks || 0;
      const impressions = row.impressions || 0;
      const position = row.position || 0;

      if (!queryMap.has(query)) {
        queryMap.set(query, {
          clicks: 0,
          impressions: 0,
          positionSum: 0,
          count: 0,
          topUrl: url,
          maxClicksForUrl: clicks,
        });
      }

      const entry = queryMap.get(query)!;
      entry.clicks += clicks;
      entry.impressions += impressions;
      entry.positionSum += position * impressions;

      if (clicks > entry.maxClicksForUrl) {
        entry.maxClicksForUrl = clicks;
        entry.topUrl = url;
      }
    }

    const results: TopQueryData[] = [];
    for (const [query, data] of queryMap.entries()) {
      const avgPosition = data.impressions > 0 ? data.positionSum / data.impressions : 0;
      const ctr = data.impressions > 0 ? data.clicks / data.impressions : 0;

      results.push({
        query,
        clicks: data.clicks,
        impressions: data.impressions,
        ctr,
        position: avgPosition,
        url: data.topUrl,
      });
    }

    return results.sort((a, b) => b.clicks - a.clicks).slice(0, 100);
  } catch (error) {
    console.error('Error in getTopQueries:', error);
    return [];
  }
}

// --- Google Analytics (GA4) ---

export async function getAnalyticsData(
  propertyId: string,
  startDate: string,
  endDate: string
): Promise<Ga4ExtendedData> {
  const formattedPropertyId = propertyId.startsWith('properties/')
    ? propertyId
    : `properties/${propertyId}`;
  const auth = createAuth();
  const analytics = google.analyticsdata({ version: 'v1beta', auth });

  const result: Ga4ExtendedData = {
    sessions: { total: 0, daily: [] },
    totalUsers: { total: 0, daily: [] },
    newUsers: { total: 0, daily: [] },
    conversions: { total: 0, daily: [] },
    bounceRate: { total: 0, daily: [] },
    engagementRate: { total: 0, daily: [] },
    avgEngagementTime: { total: 0, daily: [] },
    clicks: { total: 0, daily: [] },
    impressions: { total: 0, daily: [] },
    paidSearch: { total: 0, daily: [] },
  };

  try {
    const response = await ga4RunReport(analytics, {
      property: formattedPropertyId,
      requestBody: {
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'date' }],
        metrics: [
          { name: 'sessions' },
          { name: 'totalUsers' },
          { name: 'newUsers' },
          { name: 'conversions' },
          { name: 'bounceRate' },
          { name: 'engagementRate' },
          { name: 'averageSessionDuration' },
        ],
        orderBys: [{ dimension: { dimensionName: 'date' } }],
      },
    });

    const rows = response.data.rows || [];

    let sessionsTotal = 0;
    let totalUsersTotal = 0;
    let newUsersTotal = 0;
    let conversionsTotal = 0;
    let bounceRateSum = 0;
    let engagementRateSum = 0;
    let avgEngagementTimeSum = 0;
    let count = 0;

    for (const row of rows) {
      const dateStr = row.dimensionValues?.[0]?.value || '';
      const dateTs = parseGa4Date(dateStr);

      const sessions = parseInt(row.metricValues?.[0]?.value || '0', 10);
      const users = parseInt(row.metricValues?.[1]?.value || '0', 10);
      const newUsers = parseInt(row.metricValues?.[2]?.value || '0', 10);
      const conversions = parseInt(row.metricValues?.[3]?.value || '0', 10);
      const bounceRate = parseFloat(row.metricValues?.[4]?.value || '0');
      const engagementRate = parseFloat(row.metricValues?.[5]?.value || '0');
      const avgEngagementTime = parseFloat(row.metricValues?.[6]?.value || '0');

      result.sessions.daily.push({ date: dateTs, value: sessions });
      result.totalUsers.daily.push({ date: dateTs, value: users });
      result.newUsers.daily.push({ date: dateTs, value: newUsers });
      result.conversions.daily.push({ date: dateTs, value: conversions });
      result.bounceRate.daily.push({ date: dateTs, value: bounceRate });
      result.engagementRate.daily.push({ date: dateTs, value: engagementRate });
      result.avgEngagementTime.daily.push({ date: dateTs, value: avgEngagementTime });

      sessionsTotal += sessions;
      totalUsersTotal += users;
      newUsersTotal += newUsers;
      conversionsTotal += conversions;
      bounceRateSum += bounceRate;
      engagementRateSum += engagementRate;
      avgEngagementTimeSum += avgEngagementTime;
      count++;
    }

    result.sessions.total = sessionsTotal;
    result.totalUsers.total = totalUsersTotal;
    result.newUsers.total = newUsersTotal;
    result.conversions.total = conversionsTotal;
    result.bounceRate.total = count > 0 ? bounceRateSum / count : 0;
    result.engagementRate.total = count > 0 ? engagementRateSum / count : 0;
    result.avgEngagementTime.total = count > 0 ? avgEngagementTimeSum / count : 0;

    // Paid Search Daten separat laden
    try {
      const paidResponse = await ga4RunReport(analytics, {
        property: formattedPropertyId,
        requestBody: {
          dateRanges: [{ startDate, endDate }],
          dimensions: [{ name: 'date' }],
          metrics: [{ name: 'sessions' }],
          dimensionFilter: {
            filter: {
              fieldName: 'sessionDefaultChannelGroup',
              stringFilter: {
                matchType: 'EXACT',
                value: 'Paid Search',
              },
            },
          },
          orderBys: [{ dimension: { dimensionName: 'date' } }],
        },
      });

      const paidRows = paidResponse.data.rows || [];
      let paidTotal = 0;

      for (const row of paidRows) {
        const dateStr = row.dimensionValues?.[0]?.value || '';
        const dateTs = parseGa4Date(dateStr);
        const sessions = parseInt(row.metricValues?.[0]?.value || '0', 10);

        result.paidSearch.daily.push({ date: dateTs, value: sessions });
        paidTotal += sessions;
      }

      result.paidSearch.total = paidTotal;
    } catch (paidError) {
      console.warn('[GA4] Paid Search Daten nicht verfügbar:', paidError);
    }

    return result;
  } catch (error) {
    console.error('GA4 Error:', error);
    throw error;
  }
}

export async function getAiTrafficData(
  propertyId: string,
  startDate: string,
  endDate: string
): Promise<AiTrafficData> {
  const formattedPropertyId = propertyId.startsWith('properties/')
    ? propertyId
    : `properties/${propertyId}`;
  const auth = createAuth();
  const analytics = google.analyticsdata({ version: 'v1beta', auth });

  try {
    const response = await ga4RunReport(analytics, {
      property: formattedPropertyId,
      requestBody: {
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'sessionSource' }, { name: 'date' }],
        metrics: [{ name: 'sessions' }, { name: 'totalUsers' }],
        dimensionFilter: buildAiTrafficDimensionFilter(),
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: '1000',
      },
    });

    const rows = response.data.rows || [];

    let totalSessions = 0;
    let totalUsers = 0;
    const sessionsBySource: { [key: string]: number } = {};
    const usersBySource: { [key: string]: number } = {};
    const trendMap = new Map<number, number>();

    for (const row of rows) {
      const source = normalizeSource(row.dimensionValues?.[0]?.value || 'unknown');
      const dateStr = row.dimensionValues?.[1]?.value || '';
      const sessions = parseInt(row.metricValues?.[0]?.value || '0', 10);
      const users = parseInt(row.metricValues?.[1]?.value || '0', 10);

      totalSessions += sessions;
      totalUsers += users;

      sessionsBySource[source] = (sessionsBySource[source] || 0) + sessions;
      usersBySource[source] = (usersBySource[source] || 0) + users;

      if (dateStr) {
        const dateTs = parseGa4Date(dateStr);
        trendMap.set(dateTs, (trendMap.get(dateTs) || 0) + sessions);
      }
    }

    const topAiSources = Object.entries(sessionsBySource)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([source, sessions]) => ({
        source,
        sessions,
        users: usersBySource[source] || 0,
        percentage: totalSessions > 0 ? (sessions / totalSessions) * 100 : 0,
      }));

    const trend = Array.from(trendMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([date, sessions]) => ({ date, sessions }));

    return {
      totalSessions,
      totalUsers,
      sessionsBySource,
      topAiSources,
      trend,
    };
  } catch (error) {
    console.error('Error fetching AI traffic data:', error);
    return {
      totalSessions: 0,
      totalUsers: 0,
      sessionsBySource: {},
      topAiSources: [],
      trend: [],
    };
  }
}

export async function getGa4DimensionReport(
  propertyId: string,
  startDate: string,
  endDate: string,
  dimensionName: string
): Promise<ChartEntry[]> {
  const formattedPropertyId = propertyId.startsWith('properties/')
    ? propertyId
    : `properties/${propertyId}`;
  const auth = createAuth();
  const analytics = google.analyticsdata({ version: 'v1beta', auth });

  try {
    const response = await ga4RunReport(analytics, {
      property: formattedPropertyId,
      requestBody: {
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: dimensionName }],
        metrics: [
          { name: 'sessions' },
          { name: 'engagementRate' },
          { name: 'conversions' },
        ],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: '10',
      },
    });

    const rows = response.data.rows || [];
    const results: ChartEntry[] = [];

    for (const row of rows) {
      const name = row.dimensionValues?.[0]?.value || 'Unknown';
      const sessions = parseInt(row.metricValues?.[0]?.value || '0', 10);
      const rate = parseFloat(row.metricValues?.[1]?.value || '0');
      const conversions = parseInt(row.metricValues?.[2]?.value || '0', 10);

      results.push({
        name,
        value: sessions,
        subValue: `${(rate * 100).toFixed(1)}%`,
        subLabel: 'Interaktionsrate',
        subValue2: conversions,
        subLabel2: 'Conversions',
      });
    }

    if (results.length > 6) {
      const top5 = results.slice(0, 5);
      const otherSessions = results.slice(5).reduce((acc, curr) => acc + curr.value, 0);
      const otherConversions = results
        .slice(5)
        .reduce((acc, curr) => acc + (curr.subValue2 || 0), 0);

      if (otherSessions > 0) {
        return [
          ...top5,
          {
            name: 'Sonstige',
            value: otherSessions,
            subValue: '-',
            subLabel: 'Interaktionsrate',
            subValue2: otherConversions,
            subLabel2: 'Conversions',
          },
        ];
      }
      return top5;
    }
    return results;
  } catch (error) {
    console.error(`GA4 Dimension Report Error (${dimensionName}):`, error);
    return [];
  }
}

export interface ConvertingPageData {
  path: string;
  conversions: number;
  sessions: number;
  conversionRate: string;
}

export async function getTopConvertingPages(
  propertyId: string,
  startDate: string,
  endDate: string
): Promise<ConvertingPageData[]> {
  const formattedPropertyId = propertyId.startsWith('properties/')
    ? propertyId
    : `properties/${propertyId}`;
  const auth = createAuth();
  const analytics = google.analyticsdata({ version: 'v1beta', auth });

  try {
    const response = await ga4RunReport(analytics, {
      property: formattedPropertyId,
      requestBody: {
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'landingPagePlusQueryString' }],
        metrics: [
          { name: 'conversions' },
          { name: 'sessions' },
          { name: 'engagementRate' },
          { name: 'newUsers' },
        ],
        orderBys: [
          { metric: { metricName: 'conversions' }, desc: true },
          { metric: { metricName: 'sessions' }, desc: true },
        ],
        limit: '100',
      },
    });

    const rows = response.data.rows || [];

    return rows
      .map((row) => {
        const conversions = parseInt(row.metricValues?.[0]?.value || '0', 10);
        const sessions = parseInt(row.metricValues?.[1]?.value || '0', 10);
        const engagementRate = parseFloat(row.metricValues?.[2]?.value || '0');
        const newUsers = parseInt(row.metricValues?.[3]?.value || '0', 10);
        const convRate = sessions > 0 ? ((conversions / sessions) * 100).toFixed(2) : '0';

        return {
          path: row.dimensionValues?.[0]?.value || '(not set)',
          conversions,
          sessions,
          newUsers,
          conversionRate: convRate,
          engagementRate: parseFloat((engagementRate * 100).toFixed(2)),
        };
      })
      .filter((p) => p.conversions > 0 || p.sessions > 5)
      .slice(0, 50);
  } catch (error) {
    console.error('Error fetching Top Converting Pages:', error);
    return [];
  }
}

// GSC CTR pro Seite laden (für LandingPageChart)

export interface GscPageData {
  clicks: number;
  clicks_change: number;
  impressions: number;
  impressions_change: number;
  position: number;
  position_change: number;
}

const GSC_BATCH_SIZE = 20;

async function fetchGscBatch(
  searchconsole: any,
  siteUrl: string,
  pageUrls: string[],
  startDate: string,
  endDate: string
): Promise<Map<string, { clicks: number; impressions: number; position: number }>> {
  const dataMap = new Map<string, { clicks: number; impressions: number; position: number }>();

  if (pageUrls.length === 0) return dataMap;

  try {
    const response = await searchconsole.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate,
        endDate,
        dimensions: ['page'],
        dimensionFilterGroups: [
          {
            filters: [
              {
                dimension: 'page',
                operator: 'including_regex',
                expression: pageUrls
                  .map((url) => url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
                  .join('|'),
              },
            ],
          },
        ],
        rowLimit: 25000,
      },
    });

    for (const row of response.data.rows || []) {
      const page = row.keys?.[0];
      if (page) {
        dataMap.set(page, {
          clicks: row.clicks || 0,
          impressions: row.impressions || 0,
          position: row.position || 0,
        });
      }
    }
  } catch (error: any) {
    console.error(`[GSC Batch] Fehler für ${pageUrls.length} URLs:`, error.message);
  }

  return dataMap;
}

export async function getGscDataForPagesWithComparison(
  siteUrl: string,
  pageUrls: string[],
  currentRange: { startDate: string; endDate: string },
  previousRange: { startDate: string; endDate: string }
): Promise<Map<string, GscPageData>> {
  const auth = createAuth();
  const searchconsole = google.searchconsole({ version: 'v1', auth });
  const resultMap = new Map<string, GscPageData>();

  const batches: string[][] = [];
  for (let i = 0; i < pageUrls.length; i += GSC_BATCH_SIZE) {
    batches.push(pageUrls.slice(i, i + GSC_BATCH_SIZE));
  }

  console.log(`[GSC] Verarbeite ${pageUrls.length} URLs in ${batches.length} Batches...`);

  try {
    const currentDataMaps = await Promise.all(
      batches.map((batch) =>
        fetchGscBatch(searchconsole, siteUrl, batch, currentRange.startDate, currentRange.endDate)
      )
    );

    const previousDataMaps = await Promise.all(
      batches.map((batch) =>
        fetchGscBatch(
          searchconsole,
          siteUrl,
          batch,
          previousRange.startDate,
          previousRange.endDate
        )
      )
    );

    const currentData = new Map<
      string,
      { clicks: number; impressions: number; position: number }
    >();
    const previousData = new Map<
      string,
      { clicks: number; impressions: number; position: number }
    >();

    for (const map of currentDataMaps) {
      for (const [key, value] of map.entries()) {
        currentData.set(key, value);
      }
    }

    for (const map of previousDataMaps) {
      for (const [key, value] of map.entries()) {
        previousData.set(key, value);
      }
    }

    for (const url of pageUrls) {
      const current = currentData.get(url);
      const previous = previousData.get(url);

      if (current) {
        const clicksChange = previous
          ? previous.clicks > 0
            ? ((current.clicks - previous.clicks) / previous.clicks) * 100
            : 100
          : current.clicks > 0
          ? 100
          : 0;

        const impressionsChange = previous
          ? previous.impressions > 0
            ? ((current.impressions - previous.impressions) / previous.impressions) * 100
            : 100
          : current.impressions > 0
          ? 100
          : 0;

        const positionChange = previous ? current.position - previous.position : 0;

        resultMap.set(url, {
          clicks: current.clicks,
          clicks_change: clicksChange,
          impressions: current.impressions,
          impressions_change: impressionsChange,
          position: current.position,
          position_change: positionChange,
        });
      }
    }

    console.log(`[GSC] ✅ ${resultMap.size} von ${pageUrls.length} URLs erfolgreich abgerufen.`);
    return resultMap;
  } catch (error) {
    console.error('Error in getGscDataForPagesWithComparison:', error);
    throw error;
  }
}

export async function getGscPageCtr(
  siteUrl: string,
  startDate: string,
  endDate: string
): Promise<Map<string, number>> {
  const result = new Map<string, number>();

  try {
    const auth = createAuth();
    const searchconsole = google.searchconsole({ version: 'v1', auth });

    const response = await searchconsole.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate,
        endDate,
        dimensions: ['page'],
        rowLimit: 500,
      },
    });

    response.data.rows?.forEach((row) => {
      const pageUrl = row.keys?.[0];
      const ctr = row.ctr;

      if (pageUrl && ctr !== undefined && ctr !== null) {
        try {
          const url = new URL(pageUrl);
          result.set(url.pathname, ctr * 100);
        } catch {
          const path = pageUrl.replace(/^https?:\/\/[^\/]+/, '') || '/';
          result.set(path, ctr * 100);
        }
      }
    });

    console.log(`[GSC] ${result.size} Seiten mit CTR-Daten geladen`);
  } catch (err) {
    console.warn('[GSC] CTR-Daten konnten nicht geladen werden:', err);
  }

  return result;
}

// ============================================================================
// Queries nach Landingpage
// ============================================================================

export async function getQueriesByLandingPage(
  siteUrl: string,
  startDate: string,
  endDate: string,
  limit: number = 5
): Promise<Map<string, Array<{ query: string; clicks: number; impressions: number }>>> {
  const auth = createAuth();
  const searchconsole = google.searchconsole({ version: 'v1', auth });

  try {
    const res = await searchconsole.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate,
        endDate,
        dimensions: ['page', 'query'],
        rowLimit: 5000,
      },
    });

    const rows = res.data.rows || [];
    const pageQueryMap = new Map<
      string,
      Array<{ query: string; clicks: number; impressions: number }>
    >();

    for (const row of rows) {
      const fullUrl = row.keys?.[0] || '';
      const query = row.keys?.[1] || '';
      const clicks = row.clicks || 0;
      const impressions = row.impressions || 0;

      let path = '/';
      try {
        const urlObj = new URL(fullUrl);
        path = urlObj.pathname;
        if (path.length > 1 && path.endsWith('/')) {
          path = path.slice(0, -1);
        }
      } catch {
        const match = fullUrl.match(/https?:\/\/[^\/]+(\/[^?#]*)?/);
        if (match && match[1]) {
          path = match[1];
        }
      }

      if (!query || query === '(not set)' || query === '(not provided)') continue;
      if (clicks === 0 && impressions < 10) continue;

      if (!pageQueryMap.has(path)) {
        pageQueryMap.set(path, []);
      }

      pageQueryMap.get(path)!.push({ query, clicks, impressions });
    }

    for (const [path, queries] of pageQueryMap.entries()) {
      const sorted = queries
        .sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions)
        .slice(0, limit);
      pageQueryMap.set(path, sorted);
    }

    return pageQueryMap;
  } catch (error) {
    console.error('[GSC] Error in getQueriesByLandingPage:', error);
    return new Map();
  }
}

export interface LandingPageQueries {
  [path: string]: Array<{ query: string; clicks: number; impressions: number }>;
}

export async function getQueriesByLandingPageObject(
  siteUrl: string,
  startDate: string,
  endDate: string,
  limit: number = 5
): Promise<LandingPageQueries> {
  const mapResult = await getQueriesByLandingPage(siteUrl, startDate, endDate, limit);

  const result: LandingPageQueries = {};
  for (const [path, queries] of mapResult.entries()) {
    result[path] = queries;
  }

  return result;
}

// ============================================================================
// Folgepfade der Einstiegsseiten
// ============================================================================

export interface FollowUpPath {
  path: string;
  sessions: number;
  percentage: number;
}

export interface LandingPageFollowUpData {
  landingPage: string;
  totalSessions: number;
  landingPageSessions: number;
  followUpPaths: FollowUpPath[];
}

export async function getLandingPageFollowUpPaths(
  propertyId: string,
  landingPage: string,
  startDate: string,
  endDate: string,
  siteUrl?: string
): Promise<LandingPageFollowUpData> {
  const formattedPropertyId = propertyId.startsWith('properties/')
    ? propertyId
    : `properties/${propertyId}`;

  const auth = createAuth();
  const analytics = google.analyticsdata({ version: 'v1beta', auth });

  let normalizedLandingPage = landingPage;

  if (landingPage.startsWith('http')) {
    try {
      const url = new URL(landingPage);
      normalizedLandingPage = url.pathname;
    } catch {
      // Fallback: Behalte Original
    }
  }

  const landingPageBase = normalizedLandingPage.split('?')[0];
  const cleanLandingPage = landingPageBase.startsWith('/')
    ? landingPageBase
    : `/${landingPageBase}`;

  console.log(`[GA4 Followup] Property: ${formattedPropertyId}`);
  console.log(`[GA4 Followup] Landing Page: "${cleanLandingPage}"`);
  console.log(`[GA4 Followup] Date Range: ${startDate} - ${endDate}`);

  try {
    const response = await ga4RunReport(analytics, {
      property: formattedPropertyId,
      requestBody: {
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'pagePath' }],
        metrics: [{ name: 'screenPageViews' }, { name: 'activeUsers' }],
        dimensionFilter: {
          filter: {
            fieldName: 'landingPagePlusQueryString',
            stringFilter: {
              matchType: 'CONTAINS',
              value: cleanLandingPage,
              caseSensitive: false,
            },
          },
        },
        orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
        limit: '100',
      },
    });

    const rows = response.data.rows || [];
    console.log(`[GA4 Followup] Rows returned: ${rows.length}`);

    if (rows.length > 0) {
      console.log(
        `[GA4 Followup] Sample results:`,
        rows.slice(0, 3).map((r) => ({
          path: r.dimensionValues?.[0]?.value,
          views: r.metricValues?.[0]?.value,
        }))
      );
    }

    const followUpPaths: FollowUpPath[] = [];
    let totalPageViews = 0;
    let landingPageViews = 0;

    for (const row of rows) {
      const pagePath = row.dimensionValues?.[0]?.value || '';
      const pageViews = parseInt(row.metricValues?.[0]?.value || '0', 10);

      if (!pagePath || pagePath === '(not set)' || pagePath === '(not provided)') {
        continue;
      }

      const isLandingPage =
        pagePath === cleanLandingPage ||
        pagePath === `${cleanLandingPage}/` ||
        pagePath.replace(/\/$/, '') === cleanLandingPage.replace(/\/$/, '') ||
        (cleanLandingPage === '/' && pagePath === '/');

      if (isLandingPage) {
        landingPageViews = pageViews;
        continue;
      }

      totalPageViews += pageViews;
      followUpPaths.push({ path: pagePath, sessions: pageViews, percentage: 0 });
    }

    console.log(`[GA4 Followup] Landing page views: ${landingPageViews}`);
    console.log(`[GA4 Followup] Follow-up page views: ${totalPageViews}`);
    console.log(`[GA4 Followup] Unique follow-up paths: ${followUpPaths.length}`);

    for (const fp of followUpPaths) {
      fp.percentage =
        landingPageViews > 0 ? (fp.sessions / landingPageViews) * 100 : 0;
    }

    const sortedPaths = followUpPaths
      .sort((a, b) => b.sessions - a.sessions)
      .slice(0, 20);

    return {
      landingPage: cleanLandingPage,
      totalSessions: landingPageViews + totalPageViews,
      landingPageSessions: landingPageViews,
      followUpPaths: sortedPaths,
    };
  } catch (error) {
    console.error('[GA4 Followup] Error:', error);
    return {
      landingPage: cleanLandingPage,
      totalSessions: 0,
      landingPageSessions: 0,
      followUpPaths: [],
    };
  }
}

// ── Google Ads Types ──

export interface GoogleAdsRow {
  campaign: string;
  adGroup: string;
  adName: string;
  keyword: string;
  searchQuery: string;
  landingPage: string;
  cost: number;
  clicks: number;
  impressions: number;
  cpc: number;
  roas: number;
  conversions: number;
  sessions: number;
  engagedSessions: number;
}

export interface GoogleAdsData {
  rows: GoogleAdsRow[];
  landingPageRows: GoogleAdsRow[];
  totals: {
    cost: number;
    clicks: number;
    avgCpc: number;
    roas: number;
    conversions: number;
    sessions: number;
    engagedSessions: number;
  };
  /** Echte Conversions pro Kampagne (1-Dimension-Call, kein Thresholding) */
  conversionsByCampaign?: Record<string, number>;
  /** Echte Conversions pro Anzeigengruppe (1-Dimension-Call, kein Thresholding) */
  conversionsByAdGroup?: Record<string, number>;
  /** Echte Conversions pro Suchanfrage (1-Dimension-Call, kein Thresholding) */
  conversionsByQuery?: Record<string, number>;
  /** Alle Metriken pro Kampagne (1-Dimension-Call, kein Thresholding) */
  metricsByCampaign?: Record<string, { cost: number; clicks: number; sessions: number; engagedSessions: number }>;
  /** Alle Metriken pro Anzeigengruppe (1-Dimension-Call, kein Thresholding) */
  metricsByAdGroup?: Record<string, { cost: number; clicks: number; sessions: number; engagedSessions: number }>;
  /** Sheet-basierte Daten (pro Ebene separat, keine Thresholding-Probleme) */
  campaignRows?: GoogleAdsRow[];
  adGroupRows?: GoogleAdsRow[];
  adRows?: GoogleAdsRow[];
  searchQueryRows?: GoogleAdsRow[];
  /** Datenquelle: 'ga4' (Standard, via GA4 Data API) oder 'sheet' (via Google Ads Script Export) */
  source?: 'ga4' | 'sheet';
}

/**
 * Google Ads Performance über GA4 Data API.
 *
 * Call 0: Totals OHNE Dimensionen → kein Thresholding, echte Conversions
 * Call 1: sessionGoogleAds*-Dimensionen → Kampagnen / Anzeigengruppen / Suchanfragen
 * Call 2: landingPage (nur 1 Dimension) → Landingpages
 *
 * Alle Calls filtern auf sessionGoogleAdsCampaignName != (not set).
 */
export async function getGoogleAdsReport(
  propertyId: string,
  startDate: string,
  endDate: string
): Promise<GoogleAdsData> {
  const formattedPropertyId = propertyId.startsWith('properties/')
    ? propertyId
    : `properties/${propertyId}`;

  const auth = createAuth();
  const analytics = google.analyticsdata({ version: 'v1beta', auth });

  // Gemeinsamer Filter: nur Google Ads Traffic
  const adsFilter = {
    notExpression: {
      filter: {
        fieldName: 'sessionGoogleAdsCampaignName',
        stringFilter: { matchType: 'EXACT' as const, value: '(not set)' },
      },
    },
  };

  // ═════════════════════════════════════════
  // CALL 0: Totals OHNE Dimensionen
  //
  // GA4 unterdrückt Conversions bei Multi-Dimension-Queries
  // (Data Thresholding). Ohne Dimensionen liefert die API
  // die echten, ungekürzten Totals.
  // ═════════════════════════════════════════
  const totalsResponse = await ga4RunReport(analytics, {
    property: formattedPropertyId,
    requestBody: {
      dateRanges: [{ startDate, endDate }],
      dimensions: [],
      metrics: [
        { name: 'advertiserAdCost' },
        { name: 'advertiserAdClicks' },
        { name: 'advertiserAdCostPerClick' },
        { name: 'returnOnAdSpend' },
        { name: 'conversions' },
        { name: 'sessions' },
        { name: 'engagedSessions' },
      ],
      dimensionFilter: adsFilter,
    },
  });

  const totalsRow = totalsResponse.data.rows?.[0]?.metricValues || [];
  const totalCost = parseFloat(totalsRow[0]?.value || '0');
  const totalClicks = parseInt(totalsRow[1]?.value || '0', 10);
  const totalAvgCpc = parseFloat(totalsRow[2]?.value || '0');
  const totalRoas = parseFloat(totalsRow[3]?.value || '0');
  const totalConversions = parseFloat(totalsRow[4]?.value || '0');
  const totalSessions = parseInt(totalsRow[5]?.value || '0', 10);
  const totalEngagedSessions = parseInt(totalsRow[6]?.value || '0', 10);

  console.log(
    `[Google Ads] Call 0 Totals → Spend: €${totalCost.toFixed(2)} | Klicks: ${totalClicks} | Conv.: ${totalConversions} | Sessions: ${totalSessions} | Engaged: ${totalEngagedSessions}`
  );

  // ═════════════════════════════════════════
  // CALL 1: Ads-Performance nach Kampagne / AdGroup / Query
  // ═════════════════════════════════════════
  const adsResponse = await ga4RunReport(analytics, {
    property: formattedPropertyId,
    requestBody: {
      dateRanges: [{ startDate, endDate }],
      dimensions: [
        { name: 'sessionGoogleAdsCampaignName' },
        { name: 'sessionGoogleAdsAdGroupName' },
        { name: 'sessionGoogleAdsQuery' },
      ],
      metrics: [
        { name: 'advertiserAdCost' },
        { name: 'advertiserAdClicks' },
        { name: 'advertiserAdCostPerClick' },
        { name: 'returnOnAdSpend' },
        { name: 'conversions' },
        { name: 'sessions' },
        { name: 'engagedSessions' },
      ],
      orderBys: [{ metric: { metricName: 'advertiserAdCost' }, desc: true }],
      limit: '500',
      dimensionFilter: adsFilter,
    },
  });

  const rows: GoogleAdsRow[] = (adsResponse.data.rows || []).map((row) => {
    const dims = row.dimensionValues || [];
    const mets = row.metricValues || [];
    return {
      campaign: dims[0]?.value || '(not set)',
      adGroup: dims[1]?.value || '(not set)',
      adName: '–',
      keyword: '–',
      searchQuery: dims[2]?.value || '(not set)',
      landingPage: '–',
      cost: parseFloat(mets[0]?.value || '0'),
      clicks: parseInt(mets[1]?.value || '0', 10),
      impressions: 0,
      cpc: parseFloat(mets[2]?.value || '0'),
      roas: parseFloat(mets[3]?.value || '0'),
      conversions: parseFloat(mets[4]?.value || '0'),
      sessions: parseInt(mets[5]?.value || '0', 10),
      engagedSessions: parseInt(mets[6]?.value || '0', 10),
    };
  });

  // ═════════════════════════════════════════
  // CALL 1b/1c/1d: Echte Conversions pro Dimension (je 1 Dimension)
  //
  // Call 1 (3 Dimensionen) liefert wegen GA4 Thresholding 0 Conversions.
  // Separate 1-Dimension-Calls liefern die echten, unverfälschten Werte.
  // ═════════════════════════════════════════
  // CALL 1e/1f: Alle Metriken pro Kampagne / Anzeigengruppe (je 1 Dimension)
  //
  // Call 1 (3 Dimensionen) verliert durch Thresholding auch Zeilen
  // bei Kosten, Klicks, Sessions etc. 1-Dimension-Calls liefern
  // die echten Werte für die Hauptzeilen der Tabelle.
  // ═════════════════════════════════════════
  const conversionsByCampaign: Record<string, number> = {};
  const conversionsByAdGroup: Record<string, number> = {};
  const conversionsByQuery: Record<string, number> = {};
  const metricsByCampaign: Record<string, { cost: number; clicks: number; sessions: number; engagedSessions: number }> = {};
  const metricsByAdGroup: Record<string, { cost: number; clicks: number; sessions: number; engagedSessions: number }> = {};

  try {
    const [convByCamp, convByAg, convByQuery, metsByCamp, metsByAg] = await Promise.all([
      ga4RunReport(analytics, {
        property: formattedPropertyId,
        requestBody: {
          dateRanges: [{ startDate, endDate }],
          dimensions: [{ name: 'sessionGoogleAdsCampaignName' }],
          metrics: [{ name: 'conversions' }],
          dimensionFilter: adsFilter,
        },
      }),
      ga4RunReport(analytics, {
        property: formattedPropertyId,
        requestBody: {
          dateRanges: [{ startDate, endDate }],
          dimensions: [{ name: 'sessionGoogleAdsAdGroupName' }],
          metrics: [{ name: 'conversions' }],
          dimensionFilter: adsFilter,
        },
      }),
      ga4RunReport(analytics, {
        property: formattedPropertyId,
        requestBody: {
          dateRanges: [{ startDate, endDate }],
          dimensions: [{ name: 'sessionGoogleAdsQuery' }],
          metrics: [{ name: 'conversions' }],
          dimensionFilter: adsFilter,
        },
      }),
      // CALL 1e: Alle Metriken pro Kampagne (1 Dimension)
      ga4RunReport(analytics, {
        property: formattedPropertyId,
        requestBody: {
          dateRanges: [{ startDate, endDate }],
          dimensions: [{ name: 'sessionGoogleAdsCampaignName' }],
          metrics: [
            { name: 'advertiserAdCost' },
            { name: 'advertiserAdClicks' },
            { name: 'sessions' },
            { name: 'engagedSessions' },
          ],
          dimensionFilter: adsFilter,
        },
      }),
      // CALL 1f: Alle Metriken pro Anzeigengruppe (1 Dimension)
      ga4RunReport(analytics, {
        property: formattedPropertyId,
        requestBody: {
          dateRanges: [{ startDate, endDate }],
          dimensions: [{ name: 'sessionGoogleAdsAdGroupName' }],
          metrics: [
            { name: 'advertiserAdCost' },
            { name: 'advertiserAdClicks' },
            { name: 'sessions' },
            { name: 'engagedSessions' },
          ],
          dimensionFilter: adsFilter,
        },
      }),
    ]);

    for (const row of convByCamp.data.rows || []) {
      const name = row.dimensionValues?.[0]?.value || '(not set)';
      conversionsByCampaign[name] = parseFloat(row.metricValues?.[0]?.value || '0');
    }
    for (const row of convByAg.data.rows || []) {
      const name = row.dimensionValues?.[0]?.value || '(not set)';
      conversionsByAdGroup[name] = parseFloat(row.metricValues?.[0]?.value || '0');
    }
    for (const row of convByQuery.data.rows || []) {
      const name = row.dimensionValues?.[0]?.value || '(not set)';
      conversionsByQuery[name] = parseFloat(row.metricValues?.[0]?.value || '0');
    }

    // Metriken-Lookups für Kampagnen
    for (const row of metsByCamp.data.rows || []) {
      const name = row.dimensionValues?.[0]?.value || '(not set)';
      const mets = row.metricValues || [];
      metricsByCampaign[name] = {
        cost: parseFloat(mets[0]?.value || '0'),
        clicks: parseInt(mets[1]?.value || '0', 10),
        sessions: parseInt(mets[2]?.value || '0', 10),
        engagedSessions: parseInt(mets[3]?.value || '0', 10),
      };
    }

    // Metriken-Lookups für Anzeigengruppen
    for (const row of metsByAg.data.rows || []) {
      const name = row.dimensionValues?.[0]?.value || '(not set)';
      const mets = row.metricValues || [];
      metricsByAdGroup[name] = {
        cost: parseFloat(mets[0]?.value || '0'),
        clicks: parseInt(mets[1]?.value || '0', 10),
        sessions: parseInt(mets[2]?.value || '0', 10),
        engagedSessions: parseInt(mets[3]?.value || '0', 10),
      };
    }

    console.log(`[Google Ads] Conv-Lookups → Campaigns: ${Object.keys(conversionsByCampaign).length} | AdGroups: ${Object.keys(conversionsByAdGroup).length} | Queries: ${Object.keys(conversionsByQuery).length}`);
    console.log(`[Google Ads] Metrics-Lookups → Campaigns: ${Object.keys(metricsByCampaign).length} | AdGroups: ${Object.keys(metricsByAdGroup).length}`);
  } catch (e) {
    console.warn('[Google Ads] Conv/Metrics-Lookup fehlgeschlagen (ignoriert):', e);
  }

  // ═════════════════════════════════════════
  // CALL 2: Landingpages
  //
  // Versuch A: Mit Ad-Metriken (Kosten/Klicks) — benötigt Google-Ads-Dimension.
  //            Kann wegen Thresholding bei wenig Daten 0 Rows liefern.
  // Versuch B: Fallback ohne Ad-Metriken — nur Sessions/Conv./EngagedSessions.
  //            Funktioniert immer, aber ohne Kosten/Klicks.
  // ═════════════════════════════════════════
  let landingPageRows: GoogleAdsRow[] = [];

  // Versuch A: Mit Kosten (2 Dimensionen + Ad-Metriken)
  try {
    const lpFullResponse = await ga4RunReport(analytics, {
      property: formattedPropertyId,
      requestBody: {
        dateRanges: [{ startDate, endDate }],
        dimensions: [
          { name: 'landingPagePlusQueryString' },
          { name: 'sessionGoogleAdsCampaignName' },
        ],
        metrics: [
          { name: 'advertiserAdCost' },
          { name: 'advertiserAdClicks' },
          { name: 'advertiserAdCostPerClick' },
          { name: 'conversions' },
          { name: 'sessions' },
          { name: 'engagedSessions' },
        ],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: '200',
        dimensionFilter: adsFilter,
      },
    });

    const fullRows = lpFullResponse.data.rows || [];
    if (fullRows.length > 0) {
      landingPageRows = fullRows.map((row) => {
        const dims = row.dimensionValues || [];
        const mets = row.metricValues || [];
        return {
          campaign: dims[1]?.value || '(not set)',
          adGroup: '–',
          adName: '–',
          keyword: '–',
          searchQuery: '–',
          landingPage: dims[0]?.value || '(not set)',
          cost: parseFloat(mets[0]?.value || '0'),
          clicks: parseInt(mets[1]?.value || '0', 10),
          impressions: 0,
          cpc: parseFloat(mets[2]?.value || '0'),
          roas: 0,
          conversions: parseFloat(mets[3]?.value || '0'),
          sessions: parseInt(mets[4]?.value || '0', 10),
          engagedSessions: parseInt(mets[5]?.value || '0', 10),
        };
      });
      console.log(`[Google Ads] LP-Call A (mit Kosten): ${landingPageRows.length} Landingpages ✅`);
    } else {
      console.log('[Google Ads] LP-Call A: 0 Rows (Thresholding) → Fallback B');
    }
  } catch (e) {
    console.log('[Google Ads] LP-Call A fehlgeschlagen → Fallback B');
  }

  // Versuch B: Fallback ohne Ad-Metriken (falls A leer)
  if (landingPageRows.length === 0) {
    try {
      const lpResponse = await ga4RunReport(analytics, {
        property: formattedPropertyId,
        requestBody: {
          dateRanges: [{ startDate, endDate }],
          dimensions: [
            { name: 'landingPagePlusQueryString' },
          ],
          metrics: [
            { name: 'sessions' },
            { name: 'conversions' },
            { name: 'engagedSessions' },
          ],
          orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
          limit: '200',
          dimensionFilter: {
            filter: {
              fieldName: 'sessionDefaultChannelGroup',
              stringFilter: { matchType: 'EXACT' as const, value: 'Paid Search' },
            },
          },
        },
      });

      landingPageRows = (lpResponse.data.rows || []).map((row) => {
        const dims = row.dimensionValues || [];
        const mets = row.metricValues || [];
        return {
          campaign: '–',
          adGroup: '–',
          adName: '–',
          keyword: '–',
          searchQuery: '–',
          landingPage: dims[0]?.value || '(not set)',
          cost: 0,
          clicks: 0,
          impressions: 0,
          cpc: 0,
          roas: 0,
          conversions: parseFloat(mets[1]?.value || '0'),
          sessions: parseInt(mets[0]?.value || '0', 10),
          engagedSessions: parseInt(mets[2]?.value || '0', 10),
        };
      });

      console.log(`[Google Ads] LP-Call B (ohne Kosten): ${landingPageRows.length} Landingpages`);
    } catch (e) {
      console.warn('[Google Ads] LP-Call B fehlgeschlagen (ignoriert):', e);
    }
  }

  // ═════════════════════════════════════════
  // Totals aus Call 0 (dimensionsfrei = kein Thresholding)
  // ═════════════════════════════════════════
  const totals = {
    cost: totalCost,
    clicks: totalClicks,
    avgCpc: totalAvgCpc,
    roas: totalRoas,
    conversions: totalConversions,
    sessions: totalSessions,
    engagedSessions: totalEngagedSessions,
  };

  return { rows, landingPageRows, totals, conversionsByCampaign, conversionsByAdGroup, conversionsByQuery, metricsByCampaign, metricsByAdGroup };
}

// ═══════════════════════════════════════════════════════════════
// Google Ads Daten aus Google Sheet (via Ads-Script-Export)
//
// Liest die 4 Tabs (Kampagnen, Anzeigengruppen, Anzeigen,
// Suchanfragen) aus dem Sheet und aggregiert die Tagesdaten
// für den gewählten Zeitraum.
//
// Vorteile gegenüber GA4:
//   • Echte Google-Ads-Metriken (keine GA4-Attribution)
//   • Kein Data Thresholding
//   • Conversions stimmen mit Google Ads überein
//   • Anzeigen-Ebene verfügbar
// ═══════════════════════════════════════════════════════════════

interface SheetRowRaw {
  [key: string]: string;
}

function parseSheetNumber(val: string | undefined): number {
  if (!val) return 0;
  // Handles both "1.234,56" (DE) and "1234.56" (EN) formats
  const cleaned = val.replace(/[^\d,.\-]/g, '');
  // If contains comma as decimal separator (DE format)
  if (cleaned.includes(',') && cleaned.indexOf(',') > cleaned.lastIndexOf('.')) {
    return parseFloat(cleaned.replace(/\./g, '').replace(',', '.')) || 0;
  }
  return parseFloat(cleaned) || 0;
}

function parseSheetDate(val: string | undefined): Date | null {
  if (!val) return null;
  // Handles YYYY-MM-DD (from Ads Script)
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

function isInDateRange(dateStr: string | undefined, startDate: string, endDate: string): boolean {
  const d = parseSheetDate(dateStr);
  if (!d) return false;
  const start = new Date(startDate);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999); // inclusive
  return d >= start && d <= end;
}

async function readSheetTab(
  sheets: ReturnType<typeof google.sheets>,
  sheetId: string,
  tabName: string
): Promise<SheetRowRaw[]> {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `${tabName}!A1:Z50000`,
    });

    const rows = response.data.values;
    if (!rows || rows.length < 2) return [];

    const headers = rows[0];
    return rows.slice(1).map((row) => {
      const obj: SheetRowRaw = {};
      headers.forEach((header, index) => {
        const key = header?.trim();
        if (key) obj[key] = row[index]?.toString().trim() || '';
      });
      return obj;
    });
  } catch (e) {
    console.warn(`[Google Ads Sheet] Tab "${tabName}" nicht lesbar:`, e);
    return [];
  }
}

function sheetRowToAdsRow(
  raw: SheetRowRaw,
  mapping: {
    campaign?: string;
    adGroup?: string;
    adName?: string;
    searchQuery?: string;
  }
): GoogleAdsRow {
  const impressions = parseSheetNumber(raw['Impressionen']);
  const clicks = parseSheetNumber(raw['Klicks']);
  const cost = parseSheetNumber(raw['Kosten']);
  return {
    campaign: raw[mapping.campaign || 'Kampagne'] || '(not set)',
    adGroup: raw[mapping.adGroup || 'Anzeigengruppe'] || '–',
    adName: raw[mapping.adName || 'AnzeigenName'] || '–',
    keyword: '–',
    searchQuery: raw[mapping.searchQuery || 'Suchanfrage'] || '–',
    landingPage: '–',
    cost,
    clicks,
    impressions,
    cpc: clicks > 0 ? cost / clicks : 0,
    roas: 0,
    conversions: parseSheetNumber(raw['Conversions']),
    sessions: 0,
    engagedSessions: 0,
  };
}

export async function getGoogleAdsFromSheet(
  sheetId: string,
  startDate: string,
  endDate: string
): Promise<GoogleAdsData> {
  const auth = createAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  console.log(`[Google Ads Sheet] Lese Sheet ${sheetId} für ${startDate} – ${endDate}`);

  // ── Alle Tabs parallel lesen ──
  const [rawCampaigns, rawAdGroups, rawAds, rawQueries] = await Promise.all([
    readSheetTab(sheets, sheetId, 'Kampagnen'),
    readSheetTab(sheets, sheetId, 'Anzeigengruppen'),
    readSheetTab(sheets, sheetId, 'Anzeigen'),
    readSheetTab(sheets, sheetId, 'Suchanfragen'),
  ]);

  // ── Nach Datum filtern ──
  const filteredCampaigns = rawCampaigns.filter((r) => isInDateRange(r['Datum'], startDate, endDate));
  const filteredAdGroups = rawAdGroups.filter((r) => isInDateRange(r['Datum'], startDate, endDate));
  const filteredAds = rawAds.filter((r) => isInDateRange(r['Datum'], startDate, endDate));
  const filteredQueries = rawQueries.filter((r) => isInDateRange(r['Datum'], startDate, endDate));

  console.log(`[Google Ads Sheet] Gefiltert → Kampagnen: ${filteredCampaigns.length} | AG: ${filteredAdGroups.length} | Anzeigen: ${filteredAds.length} | SQ: ${filteredQueries.length}`);

  // ── In GoogleAdsRow[] konvertieren ──
  const campaignRows: GoogleAdsRow[] = filteredCampaigns.map((r) =>
    sheetRowToAdsRow(r, { campaign: 'Kampagne' })
  );

  const adGroupRows: GoogleAdsRow[] = filteredAdGroups.map((r) =>
    sheetRowToAdsRow(r, { campaign: 'Kampagne', adGroup: 'Anzeigengruppe' })
  );

  const adRows: GoogleAdsRow[] = filteredAds.map((r) =>
    sheetRowToAdsRow(r, { campaign: 'Kampagne', adGroup: 'Anzeigengruppe', adName: 'AnzeigenName' })
  );

  const searchQueryRows: GoogleAdsRow[] = filteredQueries.map((r) =>
    sheetRowToAdsRow(r, { campaign: 'Kampagne', adGroup: 'Anzeigengruppe', searchQuery: 'Suchanfrage' })
  );

  // ── Totals aus Kampagnen-Tab berechnen (höchste Ebene = kein Doppelzählen) ──
  let totalCost = 0;
  let totalClicks = 0;
  let totalImpressions = 0;
  let totalConversions = 0;

  for (const row of campaignRows) {
    totalCost += row.cost;
    totalClicks += row.clicks;
    totalImpressions += row.impressions;
    totalConversions += row.conversions;
  }

  const totals = {
    cost: totalCost,
    clicks: totalClicks,
    avgCpc: totalClicks > 0 ? totalCost / totalClicks : 0,
    roas: 0,
    conversions: totalConversions,
    sessions: 0,
    engagedSessions: 0,
    impressions: totalImpressions,
    interactionRate: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
  };

  console.log(
    `[Google Ads Sheet] Totals → Spend: €${totalCost.toFixed(2)} | Klicks: ${totalClicks} | Conv.: ${totalConversions}`
  );

  // rows = adGroupRows als Fallback für Legacy-Kompatibilität (aggregateBy funktioniert damit)
  return {
    rows: adGroupRows,
    landingPageRows: [],
    totals,
    campaignRows,
    adGroupRows,
    adRows,
    searchQueryRows,
    source: 'sheet',
  };
}

// ════════════════════════════════════════════════════════════════════
// PROMPT TRACKING v4 – ANFÜGEN/ERSETZEN in src/lib/google-api.ts
//
// Dieser Block ersetzt den bestehenden Prompt-Tracking-Block.
// Klassifikation (Brand/Geo/Frage-Typ) ist nach query-classifier.ts ausgelagert.
//
// Wenn der Block schon einmal eingefügt wurde, alten Block KOMPLETT löschen
// und durch diesen ersetzen.
// ════════════════════════════════════════════════════════════════════

import type {
  PromptTrackingResult,
  PromptQueryData,
  PromptWordCountBucket,
  QuestionTypeDistribution,
} from '@/lib/dashboard-shared';

import {
  isBrandedQuery,
  hasGeoReference,
  detectQuestionType,
  type QuestionType,
} from '@/lib/prompt-tracking/query-classifier';

export type { PromptTrackingResult, PromptQueryData };

export const DEFAULT_PROMPT_TRACKING_MIN_WORDS = 6;

// ─── Helpers ────────────────────────────────────────────────────────

function countWords(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

function buildWordCountDistribution(queries: PromptQueryData[]): PromptWordCountBucket[] {
  const ranges = [
    { range: '6–7',   minWords: 6, max: 7 },
    { range: '8–9',   minWords: 8, max: 9 },
    { range: '10–14', minWords: 10, max: 14 },
    { range: '15+',   minWords: 15, max: Infinity },
  ];
  return ranges.map(({ range, minWords, max }) => {
    const matching = queries.filter(q => q.wordCount >= minWords && q.wordCount <= max);
    return {
      range,
      minWords,
      count: matching.length,
      impressions: matching.reduce((sum, q) => sum + q.impressions, 0),
    };
  });
}

function buildQuestionTypeDistribution(queries: PromptQueryData[]): QuestionTypeDistribution {
  const dist: QuestionTypeDistribution = {
    what: 0, how: 0, why: 0, who: 0, where: 0, when: 0,
    compare: 0, price: 0, recommendation: 0, other: 0,
  };
  for (const q of queries) dist[q.questionType]++;
  return dist;
}

function dominantQuestionType(dist: QuestionTypeDistribution): QuestionType {
  let max: QuestionType = 'other';
  let maxCount = 0;
  for (const [k, c] of Object.entries(dist)) {
    if (c > maxCount) { max = k as QuestionType; maxCount = c; }
  }
  return max;
}

// ─── Hauptfunktion ──────────────────────────────────────────────────

/**
 * Lädt alle Suchanfragen mit ≥ minWords Wörtern aus der GSC und
 * klassifiziert sie nach Brand, Geo und Frage-Typ.
 */
export async function getPromptLikeQueries(
  siteUrl: string,
  startDate: string,
  endDate: string,
  domain?: string,
  brandKeywords?: string[] | null,
  totalImpressionsAll: number = 0,
  minWords: number = DEFAULT_PROMPT_TRACKING_MIN_WORDS
): Promise<PromptTrackingResult> {
  const auth = createAuth();
  const searchconsole = google.searchconsole({ version: 'v1', auth });

  const regex = `^(?:\\S+\\s+){${minWords - 1},}\\S+$`;

  try {
    // 1. Hauptabfrage
    const res = await searchconsole.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate,
        endDate,
        dimensions: ['query', 'page'],
        rowLimit: 5000,
        dimensionFilterGroups: [{
          filters: [{
            dimension: 'query',
            operator: 'includingRegex',
            expression: regex,
          }],
        }],
      },
    });

    const rows = res.data.rows || [];

    // 2. Aggregation pro Query
    const queryMap = new Map<string, {
      clicks: number; impressions: number; positionSum: number;
      topUrl: string; maxClicksForUrl: number;
    }>();

    for (const row of rows) {
      const query = row.keys?.[0] || '(not set)';
      const url = row.keys?.[1] || '';
      const clicks = row.clicks || 0;
      const impressions = row.impressions || 0;
      const position = row.position || 0;

      if (!queryMap.has(query)) {
        queryMap.set(query, {
          clicks: 0, impressions: 0, positionSum: 0,
          topUrl: url, maxClicksForUrl: clicks,
        });
      }
      const e = queryMap.get(query)!;
      e.clicks += clicks;
      e.impressions += impressions;
      e.positionSum += position * impressions;
      if (clicks > e.maxClicksForUrl) {
        e.maxClicksForUrl = clicks;
        e.topUrl = url;
      }
    }

    // 3. In Output-Format + Klassifikation
    const keywordsForBrand = brandKeywords && brandKeywords.length > 0 ? brandKeywords : undefined;

    const queries: PromptQueryData[] = [];
    let brandedCount = 0;
    let geoCount = 0;
    let brandedImpressions = 0;
    let geoImpressions = 0;

    for (const [query, data] of queryMap.entries()) {
      const ctr = data.impressions > 0 ? data.clicks / data.impressions : 0;
      const position = data.impressions > 0 ? data.positionSum / data.impressions : 0;
      const branded = isBrandedQuery(query, domain, keywordsForBrand);
      const hasGeo = hasGeoReference(query);
      const qType = detectQuestionType(query);

      if (branded) brandedCount++;
      if (hasGeo) geoCount++;
      if (branded) brandedImpressions += data.impressions;
      if (hasGeo) geoImpressions += data.impressions;

      queries.push({
        query,
        clicks: data.clicks,
        impressions: data.impressions,
        ctr,
        position,
        url: data.topUrl,
        wordCount: countWords(query),
        isBranded: branded,
        hasGeoReference: hasGeo,
        questionType: qType,
      });
    }

    queries.sort((a, b) => b.impressions - a.impressions);

    // 4. Totals
    const totalClicks = queries.reduce((s, q) => s + q.clicks, 0);
    const totalImpressions = queries.reduce((s, q) => s + q.impressions, 0);
    const avgCtr = totalImpressions > 0 ? totalClicks / totalImpressions : 0;
    const positionSum = queries.reduce((s, q) => s + q.position * q.impressions, 0);
    const avgPosition = totalImpressions > 0 ? positionSum / totalImpressions : 0;
    const totalQueries = queries.length;
    const brandedShare = totalQueries > 0 ? (brandedCount / totalQueries) * 100 : 0;
    const geoShare = totalQueries > 0 ? (geoCount / totalQueries) * 100 : 0;
    const brandedImpressionShare = totalImpressions > 0 ? (brandedImpressions / totalImpressions) * 100 : 0;
    const geoImpressionShare = totalImpressions > 0 ? (geoImpressions / totalImpressions) * 100 : 0;
    const sharePercent = totalImpressionsAll > 0
      ? (totalImpressions / totalImpressionsAll) * 100 : 0;

    const wordCountDistribution = buildWordCountDistribution(queries);
    const questionTypeDistribution = buildQuestionTypeDistribution(queries);
    const domQType = dominantQuestionType(questionTypeDistribution);

    let brandKeywordsSource: 'configured' | 'auto-detected' | 'domain-heuristic' | 'none' = 'none';
    if (keywordsForBrand && keywordsForBrand.length > 0) brandKeywordsSource = 'configured';
    else if (domain) brandKeywordsSource = 'domain-heuristic';

    // 5. Tagestrend (best effort)
    let trend: { date: number; clicks: number; impressions: number }[] = [];
    try {
      const trendRes = await searchconsole.searchanalytics.query({
        siteUrl,
        requestBody: {
          startDate, endDate,
          dimensions: ['date'],
          rowLimit: 25000,
          dimensionFilterGroups: [{
            filters: [{ dimension: 'query', operator: 'includingRegex', expression: regex }],
          }],
        },
      });
      const trendRows = trendRes.data.rows || [];
      trendRows.sort((a, b) => (a.keys?.[0] || '').localeCompare(b.keys?.[0] || ''));
      trend = trendRows.map(row => ({
        date: parseGscDate(row.keys?.[0] || ''),
        clicks: row.clicks || 0,
        impressions: row.impressions || 0,
      }));
    } catch (e) {
      console.warn('[Prompt Tracking] Trend-Abfrage fehlgeschlagen (ignoriert):', e);
    }

    return {
      queries: queries.slice(0, 500),
      totals: {
        totalQueries,
        totalClicks,
        totalImpressions,
        avgCtr,
        avgPosition,
        brandedShare,
        nonBrandedShare: 100 - brandedShare,
        brandedImpressionShare,
        nonBrandedImpressionShare: 100 - brandedImpressionShare,
        sharePercent,
        totalImpressionsAll,
        geoShare,
        geoImpressionShare,
        questionTypeDistribution,
        dominantQuestionType: domQType,
      },
      trend,
      shareTrend: [],   // wird im Loader befüllt
      wordCountDistribution,
      minWords,
      brandKeywordsUsed: keywordsForBrand,
      brandKeywordsSource,
    };
  } catch (error) {
    console.error('[Prompt Tracking] Error:', error);
    throw error;
  }
}
