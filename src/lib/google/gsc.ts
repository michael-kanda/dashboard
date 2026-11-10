import type { DailyDataPoint, DateRangeData } from './types';
import { createAuth } from './client';
import { parseGscDate } from './dates';
import { google } from 'googleapis';
import { requestBudgetOptions } from '../sync/request-budget';
import { type GoogleGenAiPerformanceData, type GoogleGenAiBreakdownItem } from '@/lib/dashboard-shared';
import type { TopQueryData } from '@/types/dashboard';
import type { PromptTrackingResult, PromptQueryData, PromptWordCountBucket, QuestionTypeDistribution } from '@/lib/dashboard-shared';
import { isBrandedQuery, hasGeoReference, detectQuestionType, type QuestionType } from '@/lib/prompt-tracking/query-classifier';

export async function getSearchConsoleData(
  siteUrl: string,
  startDate: string,
  endDate: string
): Promise<{ clicks: DateRangeData; impressions: DateRangeData }> {
  const auth = createAuth();
  const searchconsole = google.searchconsole({ version: 'v1', auth, ...requestBudgetOptions() });

  try {
    const res = await searchconsole.searchanalytics.query({
      siteUrl,
      requestBody: {
        dataState: 'all', // frische Daten bis gestern, nicht nur finale
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

export const GOOGLE_GENAI_DATA_VERSION = 3;

const GEN_AI_SEARCH_APPEARANCE_MATCHERS = [
  'ai overview',
  'ai overviews',
  'ai mode',
  'generative ai',
  'generative ki',
  'gen ai',
  'search generative',
  'auf generativer ki basierende funktionen',
];

function isGenAiSearchAppearance(value: string): boolean {
  const normalized = value
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/[^a-z0-9äöüß]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

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
    dataVersion: GOOGLE_GENAI_DATA_VERSION,
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
        dataState: 'all', // frische Daten bis gestern, nicht nur finale
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
  const searchconsole = google.searchconsole({ version: 'v1', auth, ...requestBudgetOptions() });

  try {
    const appearanceRes = await searchconsole.searchanalytics.query({
      siteUrl,
      requestBody: {
        dataState: 'all', // frische Daten bis gestern, nicht nur finale
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

    const genAiAppearances = Array.from(new Set(allAppearances.filter(isGenAiSearchAppearance)));

    if (genAiAppearances.length === 0) {
      console.info('[Google GenAI] Keine GenAI-Search-Appearance erkannt. GSC lieferte:', allAppearances);
      return emptyGoogleGenAiPerformance(
        'Der Google-GenAI-Report ist fuer diese Property noch nicht per API/Search-Appearance sichtbar oder es gibt zu wenige Impressionen.'
      );
    }

    console.info('[Google GenAI] Erkannte Search-Appearances:', genAiAppearances);

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
      topPages: pages,
      countries: countries.slice(0, 10),
      devices: devices.slice(0, 10),
      detectedAppearances: genAiAppearances,
      source: 'gsc-search-appearance',
      dataVersion: GOOGLE_GENAI_DATA_VERSION,
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
  const searchconsole = google.searchconsole({ version: 'v1', auth, ...requestBudgetOptions() });

  try {
    const res = await searchconsole.searchanalytics.query({
      siteUrl,
      requestBody: {
        dataState: 'all', // frische Daten bis gestern, nicht nur finale
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
        dataState: 'all', // frische Daten bis gestern, nicht nur finale
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
  const searchconsole = google.searchconsole({ version: 'v1', auth, ...requestBudgetOptions() });
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
    const searchconsole = google.searchconsole({ version: 'v1', auth, ...requestBudgetOptions() });

    const response = await searchconsole.searchanalytics.query({
      siteUrl,
      requestBody: {
        dataState: 'all', // frische Daten bis gestern, nicht nur finale
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

async function getQueriesByLandingPage(
  siteUrl: string,
  startDate: string,
  endDate: string,
  limit: number = 5
): Promise<Map<string, Array<{ query: string; clicks: number; impressions: number }>>> {
  const auth = createAuth();
  const searchconsole = google.searchconsole({ version: 'v1', auth, ...requestBudgetOptions() });

  try {
    const res = await searchconsole.searchanalytics.query({
      siteUrl,
      requestBody: {
        dataState: 'all', // frische Daten bis gestern, nicht nur finale
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

export type { PromptTrackingResult, PromptQueryData };

export const DEFAULT_PROMPT_TRACKING_MIN_WORDS = 6;

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
  const searchconsole = google.searchconsole({ version: 'v1', auth, ...requestBudgetOptions() });

  const regex = `^(?:\\S+\\s+){${minWords - 1},}\\S+$`;

  try {
    // 1. Hauptabfrage
    const res = await searchconsole.searchanalytics.query({
      siteUrl,
      requestBody: {
        dataState: 'all', // frische Daten bis gestern, nicht nur finale
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
          dataState: 'all', // frische Daten bis gestern, nicht nur finale
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
