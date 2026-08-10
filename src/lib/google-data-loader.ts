// src/lib/google-data-loader.ts (v5 — robustere Fehler-/Cache-Behandlung)

import { sql } from '@vercel/postgres';
import { type User } from '@/lib/schemas';
import {
  getSearchConsoleData,
  getGoogleGenAiPerformanceData,
  getAnalyticsData,
  getPaidSearchData,
  getTopQueries,
  getAiTrafficData,
  getGa4DimensionReport,
  getLandingPageMetricsForPaths,
  getTopConvertingPages,
  getGscPageCtr,
  getQueriesByLandingPageObject,
  getGoogleAdsReport,
  getGoogleAdsFromSheet,
  getPromptLikeQueries,
  DEFAULT_PROMPT_TRACKING_MIN_WORDS,
  type GoogleAdsData,
} from '@/lib/google-api';
import type { AiTrafficData } from '@/types/ai-traffic';
import { detectBrandKeywords } from '@/lib/prompt-tracking/brand-detector';
import { normalizeManualGoogleGenAiData } from '@/lib/google-genai-manual';
import { getBingData } from '@/lib/bing-api';
import {
  ProjectDashboardData,
  TOP_QUERIES_DATA_VERSION,
  ChartEntry,
  ApiErrorStatus,
  ConvertingPageData,
  LandingPageQueries,
  LocalSeoData,
  LocalSeoLocationConfig,
  PromptTrackingResult,
  PromptTrackingShareBucket,
  PromptTrackingPrevious,
} from '@/lib/dashboard-shared';
import type { GoogleGenAiPerformanceData } from '@/lib/dashboard-shared';
import type { TopQueryData, ChartPoint } from '@/types/dashboard';

import { getDemoAnalyticsData } from '@/lib/demo-data';
import { fetchWeatherData, weatherMapToObject } from '@/lib/weather';
import {
  attachDashboardMetricMetadata,
  extractDashboardMetricValues,
} from '@/lib/metric-metadata';
import { persistMetricSnapshotsWithClient } from '@/lib/metric-snapshot-store';
import { readDashboardSnapshot } from '@/lib/sync/dashboard-snapshot';
import { isPaidSearchChannel } from '@/lib/ga4-metrics';
import { getReportingWindow } from '@/lib/sync/cache-policy';
import { classifyGoogleApiError } from '@/lib/sync/google-api-error';
import { isDemoProject } from '@/lib/demo-project';

function getShortErrorMessage(error: unknown): string {
  const err = error as any;
  return (
    err?.cause?.message ||
    err?.response?.data?.error?.message ||
    (error instanceof Error ? error.message : String(error))
  );
}

interface RawApiData {
  clicks: { total: number; daily: ChartPoint[] };
  impressions: { total: number; daily: ChartPoint[] };
  sessions: { total: number; daily: ChartPoint[] };
  totalUsers: { total: number; daily: ChartPoint[] };
  conversions: { total: number; daily: ChartPoint[] };
  engagementRate: { total: number; daily: ChartPoint[] };
  bounceRate: { total: number; daily: ChartPoint[] };
  newUsers: { total: number; daily: ChartPoint[] };
  avgEngagementTime: { total: number; daily: ChartPoint[] };
  paidSearch: { total: number; daily: ChartPoint[] };
}

function calculateChange(current: number, previous: number): number {
  if (!previous || previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

const INITIAL_DATA: RawApiData = {
  clicks: { total: 0, daily: [] },
  impressions: { total: 0, daily: [] },
  sessions: { total: 0, daily: [] },
  totalUsers: { total: 0, daily: [] },
  conversions: { total: 0, daily: [] },
  engagementRate: { total: 0, daily: [] },
  bounceRate: { total: 0, daily: [] },
  newUsers: { total: 0, daily: [] },
  avgEngagementTime: { total: 0, daily: [] },
  paidSearch: { total: 0, daily: [] }
};

function createEmptyGoogleAdsSheetData(sheetId: string): GoogleAdsData {
  return {
    rows: [],
    landingPageRows: [],
    totals: {
      cost: 0,
      clicks: 0,
      avgCpc: 0,
      roas: 0,
      conversions: 0,
      sessions: 0,
      engagedSessions: 0,
      impressions: 0,
      interactionRate: 0,
    },
    campaignRows: [],
    adGroupRows: [],
    adRows: [],
    searchQueryRows: [],
    source: 'sheet',
    configuredSheetId: sheetId,
  };
}

function normalizeForMatch(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss');
}

function normalizePath(value: string) {
  if (!value) return '';
  try {
    const parsed = value.startsWith('http') ? new URL(value).pathname : value;
    return parsed.endsWith('/') && parsed.length > 1 ? parsed.slice(0, -1) : parsed;
  } catch {
    return value.endsWith('/') && value.length > 1 ? value.slice(0, -1) : value;
  }
}

function normalizeLandingPageKey(value: string) {
  if (!value) return '';
  try {
    const path = value.startsWith('http')
      ? new URL(value).pathname
      : value.split(/[?#]/, 1)[0];
    const withSlash = path.startsWith('/') ? path : `/${path}`;
    return withSlash.endsWith('/') && withSlash.length > 1
      ? withSlash.slice(0, -1)
      : withSlash;
  } catch {
    return '';
  }
}

function addLandingPageConversions(
  queries: TopQueryData[],
  pages: ConvertingPageData[]
): TopQueryData[] {
  const conversionsByPath = new Map<string, number>();

  for (const page of pages) {
    const path = normalizeLandingPageKey(page.path);
    if (!path) continue;
    conversionsByPath.set(
      path,
      (conversionsByPath.get(path) ?? 0) + Number(page.conversions || 0)
    );
  }

  return queries.map((query) => {
    const path = normalizeLandingPageKey(query.url || '');
    if (!path || !conversionsByPath.has(path)) return query;
    return {
      ...query,
      landingPageConversions: conversionsByPath.get(path),
    };
  });
}

function getCityNeedles(value: string) {
  const normalized = normalizeForMatch(value || '');
  const aliases = new Set([normalized]);
  if (normalized === 'wien') aliases.add('vienna');
  if (normalized === 'vienna') aliases.add('wien');
  return aliases;
}

function buildLocalSeoData(
  locations: LocalSeoLocationConfig[] | null | undefined,
  topQueries: TopQueryData[],
  topConvertingPages: ConvertingPageData[],
  cityData: ChartEntry[]
): LocalSeoData | undefined {
  const activeLocations = Array.isArray(locations)
    ? locations.filter((location) => location?.name?.trim())
    : [];
  if (activeLocations.length === 0) return undefined;

  const dataLocations = activeLocations.map((location, index) => {
    const terms = [
      location.name,
      location.postalCode,
      location.city,
      ...(location.keywords || []),
    ]
      .map((term) => normalizeForMatch(String(term || '').trim()))
      .filter(Boolean);
    const landingPaths = (location.landingPages || []).map(normalizePath).filter(Boolean);

    const matchedQueries = topQueries.filter((query) => {
      const queryText = normalizeForMatch(query.query || '');
      const queryPath = normalizePath(query.url || '');
      return terms.some((term) => queryText.includes(term)) ||
        landingPaths.some((path) => queryPath === path || queryPath.includes(path));
    });

    const matchedPages = topConvertingPages.filter((page) => {
      const pagePath = normalizePath(page.path || '');
      return landingPaths.some((path) => pagePath === path || pagePath.includes(path));
    });

    const cityNeedles = getCityNeedles(location.city || location.name || '');
    const cityEntry = cityData.find((entry) => cityNeedles.has(normalizeForMatch(entry.name || '')));

    const clicks = matchedQueries.reduce((sum, query) => sum + (query.clicks || 0), 0);
    const impressions = matchedQueries.reduce((sum, query) => sum + (query.impressions || 0), 0);
    const weightedPositionSum = matchedQueries.reduce(
      (sum, query) => sum + ((query.position || 0) * (query.impressions || 0)),
      0
    );
    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
    const position = impressions > 0 ? weightedPositionSum / impressions : null;
    const hasLandingPageConfig = landingPaths.length > 0;
    const pageSessions = matchedPages.reduce((sum, page) => sum + (page.sessions || 0), 0);
    const pageNewUsers = matchedPages.reduce((sum, page) => sum + (page.newUsers || 0), 0);
    const pageConversions = matchedPages.reduce((sum, page) => sum + (page.conversions || 0), 0);
    const sessions = hasLandingPageConfig ? pageSessions : (cityEntry?.value || 0);
    const newUsers = hasLandingPageConfig ? pageNewUsers : (cityEntry?.newUsers || 0);
    const conversions = hasLandingPageConfig ? pageConversions : (cityEntry?.subValue2 || 0);
    const score = Math.max(0, Math.min(100, Math.round(
      (ctr * 8) +
      (position ? Math.max(0, 35 - position * 2) : 0) +
      Math.min(25, impressions / 120) +
      Math.min(20, conversions * 3)
    )));

    return {
      ...location,
      id: location.id || `location-${index + 1}`,
      score,
      clicks,
      impressions,
      ctr,
      position,
      sessions,
      newUsers,
      conversions,
      topQueries: matchedQueries
        .sort((a, b) => b.impressions - a.impressions)
        .slice(0, 5),
      topLandingPages: matchedPages
        .sort((a, b) => (b.conversions || 0) - (a.conversions || 0))
        .slice(0, 5),
    };
  });

  return {
    calculationVersion: 2,
    locations: dataLocations,
    totals: {
      clicks: dataLocations.reduce((sum, location) => sum + location.clicks, 0),
      impressions: dataLocations.reduce((sum, location) => sum + location.impressions, 0),
      sessions: dataLocations.reduce((sum, location) => sum + location.sessions, 0),
      newUsers: dataLocations.reduce((sum, location) => sum + location.newUsers, 0),
      conversions: dataLocations.reduce((sum, location) => sum + location.conversions, 0),
    },
  };
}

function buildShareTrend(
  allDaily: ChartPoint[],
  promptDaily: { date: number; impressions: number }[],
  days: number
): PromptTrackingShareBucket[] {
  const useMonthly = days > 60;
  const allByBucket = new Map<string, number>();
  const promptByBucket = new Map<string, number>();

  function bucketKey(ts: number): { key: string; label: string } {
    const d = new Date(ts);
    if (useMonthly) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const monthNames = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
      return { key: `${y}-${m}`, label: `${monthNames[d.getMonth()]} '${String(y).slice(2)}` };
    }
    const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = tmp.getUTCDay() || 7;
    tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
    const week = Math.ceil((((tmp.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return { key: `${tmp.getUTCFullYear()}-W${String(week).padStart(2, '0')}`, label: `KW ${week}` };
  }

  for (const point of allDaily) {
    const ts = typeof point.date === 'number' ? point.date : new Date(point.date as any).getTime();
    if (!ts) continue;
    const { key } = bucketKey(ts);
    const value = (point as any).value ?? 0;
    allByBucket.set(key, (allByBucket.get(key) || 0) + value);
  }

  for (const point of promptDaily) {
    if (!point.date) continue;
    const { key } = bucketKey(point.date);
    promptByBucket.set(key, (promptByBucket.get(key) || 0) + point.impressions);
  }

  const allKeys = Array.from(new Set([
    ...Array.from(allByBucket.keys()),
    ...Array.from(promptByBucket.keys()),
  ])).sort();

  return allKeys.map((key) => {
    const totalImpressions = allByBucket.get(key) || 0;
    const promptImpressions = promptByBucket.get(key) || 0;
    const sharePercent = totalImpressions > 0 ? (promptImpressions / totalImpressions) * 100 : 0;
    let label = key;
    if (useMonthly) {
      const [y, m] = key.split('-');
      const monthNames = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
      label = `${monthNames[parseInt(m, 10) - 1]} '${y.slice(2)}`;
    } else {
      const week = key.split('-W')[1];
      label = `KW ${week}`;
    }
    return { bucket: key, label, totalImpressions, promptImpressions, sharePercent };
  });
}

// ════════════════════════════════════════════════════════════════════
// Brand-Keywords ermitteln (mit Auto-Detection wenn nötig)
// ════════════════════════════════════════════════════════════════════
async function getBrandKeywordsForUser(
  user: User,
  startDate: string,
  endDate: string
): Promise<{ keywords: string[] | null; autoDetected: boolean }> {
  const existing = (user as any).brand_keywords as string[] | null | undefined;
  if (existing && Array.isArray(existing) && existing.length > 0) {
    return { keywords: existing, autoDetected: false };
  }

  console.log(`[Brand Auto-Detect] Starte für ${user.email}...`);
  try {
    const result = await detectBrandKeywords({ domain: user.domain });

    console.log(
      `[Brand Auto-Detect] ✅ ${result.keywords.length} Keywords erkannt für ${user.email}: ` +
      `[${result.keywords.slice(0, 5).join(', ')}${result.keywords.length > 5 ? ', ...' : ''}]`
    );

    if (result.keywords.length > 0 && user.id) {
      try {
        await sql`
          UPDATE users
          SET brand_keywords = ${result.keywords as any}
          WHERE id = ${user.id}::uuid
        `;
      } catch (dbErr) {
        console.warn('[Brand Auto-Detect] Speichern fehlgeschlagen (ignoriert):', dbErr);
      }
    }

    return { keywords: result.keywords.length > 0 ? result.keywords : null, autoDetected: true };
  } catch (e) {
    console.warn('[Brand Auto-Detect] Fehler (Fallback auf Heuristik):', e);
    return { keywords: null, autoDetected: false };
  }
}

export async function getOrFetchGoogleData(
  user: User,
  dateRange: string,
  forceRefresh = false,
  options: { enqueueIfMissing?: boolean; deadlineAt?: number } = {},
): Promise<ProjectDashboardData | null> {
  if (!user.id) return null;
  const userId = user.id;

  console.log(
    `[Google Data Loader] User: ${user.email} | google_ads_sheet_id: ${user.google_ads_sheet_id || '(nicht gesetzt)'}`
  );

  if (isDemoProject(user)) {
    console.log('[Google Data Loader] Demo-User erkannt. Lade Demo-Daten...');
    return attachDashboardMetricMetadata(getDemoAnalyticsData(dateRange), dateRange);
  }

  if (!forceRefresh) {
    const snapshot = await readDashboardSnapshot(user, dateRange, {
      enqueueIfStale: true,
      enqueueIfMissing: options.enqueueIfMissing,
      priority: 50,
    });
    console.log(`[Google Cache] ${snapshot.data ? '✅ SNAPSHOT' : '⏳ AUSSTEHEND'} für ${user.email}`);
    return snapshot.data;
  }

  console.log(`[Google Cache] 🔄 Lade frische Daten für ${user.email}...`);

  const reportingWindow = getReportingWindow(dateRange);
  const startDateStr = reportingWindow.startDate;
  const endDateStr = reportingWindow.endDate;
  const prevStartStr = reportingWindow.previousStartDate;
  const prevEndStr = reportingWindow.previousEndDate;

  let currentData: RawApiData = { ...INITIAL_DATA };
  let prevData: RawApiData = { ...INITIAL_DATA };

  let topQueries: TopQueryData[] = [];
  let topConvertingPages: ConvertingPageData[] = [];
  let aiTraffic: AiTrafficData | undefined;
  let countryData: ChartEntry[] = [];
  let cityData: ChartEntry[] = [];
  let channelData: ChartEntry[] = [];
  let deviceData: ChartEntry[] = [];
  let bingData: any[] = [];
  let apiErrors: ApiErrorStatus = {};
  let landingPageQueries: LandingPageQueries = {};
  let googleAdsData: GoogleAdsData | undefined;
  let googleGenAi: GoogleGenAiPerformanceData | undefined;
  let promptTracking: PromptTrackingResult | undefined;
  let currentPaidSearchLoaded = false;

  if (user.gsc_site_url) {
    try {
      const gscRaw = await getSearchConsoleData(user.gsc_site_url, startDateStr, endDateStr);
      currentData = {
        ...currentData,
        clicks: { total: gscRaw.clicks?.total || 0, daily: gscRaw.clicks?.daily || [] },
        impressions: { total: gscRaw.impressions?.total || 0, daily: gscRaw.impressions?.daily || [] }
      };

      const gscPrevRaw = await getSearchConsoleData(user.gsc_site_url, prevStartStr, prevEndStr);
      prevData = {
        ...prevData,
        clicks: { ...prevData.clicks, total: gscPrevRaw.clicks?.total || 0 },
        impressions: { ...prevData.impressions, total: gscPrevRaw.impressions?.total || 0 }
      };

      topQueries = await getTopQueries(user.gsc_site_url, startDateStr, endDateStr);
      // Derselbe GSC-Call liefert auch den Content-Studio-Kontext. Mehr Queries
      // pro URL erhöhen nur die lokale Auswertung, nicht die API-Last.
      landingPageQueries = await getQueriesByLandingPageObject(user.gsc_site_url, startDateStr, endDateStr, 20);

      try {
        const [genAiCurrent, genAiPrevious] = await Promise.all([
          getGoogleGenAiPerformanceData(user.gsc_site_url, startDateStr, endDateStr),
          getGoogleGenAiPerformanceData(user.gsc_site_url, prevStartStr, prevEndStr),
        ]);
        googleGenAi = {
          ...genAiCurrent,
          impressionsChange: calculateChange(
            genAiCurrent.totalImpressions,
            genAiPrevious.totalImpressions
          ),
        };
      } catch (e: any) {
        console.warn('[Google GenAI] Fehler (ignoriert):', e);
        apiErrors.genAi = e?.message || 'Google GenAI Report nicht verfügbar';
      }

      const manualGenAi = normalizeManualGoogleGenAiData((user as any).google_genai_manual_data);
      if (manualGenAi && (!googleGenAi || googleGenAi.status !== 'available' || googleGenAi.totalImpressions <= 0)) {
        googleGenAi = manualGenAi;
        console.info('[Google GenAI] Nutze manuellen GSC-Export-Fallback.');
      }

      try {
        const { keywords: brandKeywords, autoDetected } = await getBrandKeywordsForUser(
          user, startDateStr, endDateStr
        );

        const totalImpressionsAll = gscRaw.impressions?.total || 0;
        const totalImpressionsAllPrev = gscPrevRaw.impressions?.total || 0;

        promptTracking = await getPromptLikeQueries(
          user.gsc_site_url, startDateStr, endDateStr,
          user.domain ?? undefined,
          brandKeywords,
          totalImpressionsAll, DEFAULT_PROMPT_TRACKING_MIN_WORDS
        );

        try {
          const prevPt = await getPromptLikeQueries(
            user.gsc_site_url, prevStartStr, prevEndStr,
            user.domain ?? undefined,
            brandKeywords,
            totalImpressionsAllPrev, DEFAULT_PROMPT_TRACKING_MIN_WORDS
          );
          const previous: PromptTrackingPrevious = {
            totalQueries: prevPt.totals.totalQueries,
            totalImpressions: prevPt.totals.totalImpressions,
            totalClicks: prevPt.totals.totalClicks,
            sharePercent: prevPt.totals.sharePercent,
          };
          promptTracking = { ...promptTracking, previous };
        } catch (e) {
          console.warn('[Prompt Tracking] Vorperiode fehlgeschlagen (ignoriert):', e);
        }

        const shareTrend = buildShareTrend(
          gscRaw.impressions?.daily || [],
          promptTracking.trend || [],
          days
        );
        // Loader weiß, ob Keywords gerade auto-detected wurden (überschreibt die
        // 'configured'-Vermutung der Patch-Funktion in google-api).
        const finalBrandSource: 'configured' | 'auto-detected' | 'domain-heuristic' | 'none' =
          autoDetected ? 'auto-detected' : (promptTracking.brandKeywordsSource ?? 'none');
        promptTracking = {
          ...promptTracking,
          shareTrend,
          brandKeywordsSource: finalBrandSource,
        };

        console.log(
          `[Prompt Tracking] ✅ ${promptTracking.totals.totalQueries} Queries ` +
          `(${promptTracking.totals.sharePercent.toFixed(1)} % Anteil, ` +
          `${promptTracking.totals.brandedImpressionShare.toFixed(1)} % Brand-Impressions` +
          `${autoDetected ? ' – auto-detected' : ''}, ` +
          `Geo ${promptTracking.totals.geoImpressionShare.toFixed(1)} % Impressions, ` +
          `Top-Frage: ${promptTracking.totals.dominantQuestionType})`
        );
      } catch (e) {
        console.warn('[Prompt Tracking] Fehler (ignoriert):', e);
      }
    } catch (e: any) {
      console.error('[GSC Error]', e);
      apiErrors.gsc = e.message || 'GSC Fehler';
    }
  }

  if (user.ga4_property_id) {
    try {
      const propertyId = user.ga4_property_id.trim();

      // GA4 drosselt parallele Reports pro Property hart und große Date-Trends
      // laufen leicht in Timeouts. Deshalb sequenziell laden: aktuelle Periode
      // zuerst, Vorperiode danach isoliert.
      const gaCurrent = await getAnalyticsData(propertyId, startDateStr, endDateStr);
      currentData = {
        ...currentData,
        sessions: gaCurrent.sessions, totalUsers: gaCurrent.totalUsers,
        conversions: gaCurrent.conversions, engagementRate: gaCurrent.engagementRate,
        bounceRate: gaCurrent.bounceRate, newUsers: gaCurrent.newUsers,
        avgEngagementTime: gaCurrent.avgEngagementTime
      };

      try {
        currentData.paidSearch = await getPaidSearchData(propertyId, startDateStr, endDateStr);
        currentPaidSearchLoaded = true;
      } catch (paidSearchError) {
        console.warn('[GA4] Paid Search Trend nicht verfügbar:', getShortErrorMessage(paidSearchError));
      }

      try {
        const gaPrevious = await getAnalyticsData(propertyId, prevStartStr, prevEndStr);
        prevData = {
          ...prevData,
          sessions: gaPrevious.sessions, totalUsers: gaPrevious.totalUsers,
          conversions: gaPrevious.conversions, engagementRate: gaPrevious.engagementRate,
          bounceRate: gaPrevious.bounceRate, newUsers: gaPrevious.newUsers,
          avgEngagementTime: gaPrevious.avgEngagementTime
        };
        try {
          prevData.paidSearch = await getPaidSearchData(propertyId, prevStartStr, prevEndStr);
        } catch (paidSearchError) {
          console.warn('[GA4] Paid Search Vorperiode nicht verfügbar:', getShortErrorMessage(paidSearchError));
        }
      } catch (previousError) {
        console.warn(
          '[GA4] Vorperiode fehlgeschlagen (ignoriert, Veränderungen evtl. ungenau):',
          getShortErrorMessage(previousError)
        );
      }

      try { aiTraffic = await getAiTrafficData(propertyId, startDateStr, endDateStr); }
      catch (e) { console.warn('[AI Traffic] Fehler (ignoriert):', getShortErrorMessage(e)); }

      try {
        const rawPages = await getTopConvertingPages(propertyId, startDateStr, endDateStr);
        const configuredLocationPaths = Array.isArray((user as any).project_locations)
          ? (user as any).project_locations
              .flatMap((location: any) => Array.isArray(location?.landingPages) ? location.landingPages : [])
              .map((path: unknown) => normalizePath(String(path || '')))
              .filter(Boolean)
          : [];
        const localSeoPages = configuredLocationPaths.length > 0
          ? await getLandingPageMetricsForPaths(propertyId, startDateStr, endDateStr, configuredLocationPaths)
          : [];
        let gscCtrData = new Map<string, number>();
        if (user.gsc_site_url) {
          gscCtrData = await getGscPageCtr(user.gsc_site_url, startDateStr, endDateStr);
        }
        const pageMap = new Map<string, ConvertingPageData>();
        [...rawPages, ...localSeoPages].forEach((p: any) => {
          const normalizedPath = normalizePath(p.path || '');
          if (!normalizedPath || pageMap.has(normalizedPath)) return;
          pageMap.set(normalizedPath, {
            path: p.path,
            conversions: p.conversions,
            conversionRate: typeof p.conversionRate === 'string' ? parseFloat(p.conversionRate) : Number(p.conversionRate),
            engagementRate: p.engagementRate,
            sessions: p.sessions,
            newUsers: p.newUsers,
            ctr: gscCtrData.get(p.path)
          });
        });
        topConvertingPages = Array.from(pageMap.values());
        topQueries = addLandingPageConversions(topQueries, topConvertingPages);
      } catch (e) { console.warn('[GA4] Konnte Top-Pages nicht laden:', getShortErrorMessage(e)); }

      try {
        const rawCountry = await getGa4DimensionReport(propertyId, startDateStr, endDateStr, 'country');
        const rawCity = await getGa4DimensionReport(propertyId, startDateStr, endDateStr, 'city');
        const rawChannel = await getGa4DimensionReport(propertyId, startDateStr, endDateStr, 'sessionDefaultChannelGroup');
        const rawDevice = await getGa4DimensionReport(propertyId, startDateStr, endDateStr, 'deviceCategory');
        countryData = rawCountry.map((item, index) => ({ ...item, fill: `hsl(var(--chart-${(index % 5) + 1}))` }));
        cityData = rawCity.map((item, index) => ({ ...item, fill: `hsl(var(--chart-${(index % 5) + 1}))` }));
        channelData = rawChannel.map((item, index) => ({ ...item, fill: `hsl(var(--chart-${(index % 5) + 1}))` }));
        const paidSearchChannel = rawChannel.find((item) => isPaidSearchChannel(item.name));
        if (paidSearchChannel && (!currentPaidSearchLoaded || currentData.paidSearch.total === 0)) {
          currentData.paidSearch = {
            total: paidSearchChannel.value,
            daily: currentData.paidSearch.daily,
          };
        }
        deviceData = rawDevice.map((item, index) => ({ ...item, fill: `hsl(var(--chart-${(index % 5) + 1}))` }));
      } catch (e) { console.warn('[GA4 Dimensions] Fehler (ignoriert):', getShortErrorMessage(e)); }

      if (!user.google_ads_sheet_id) {
        try { googleAdsData = await getGoogleAdsReport(propertyId, startDateStr, endDateStr); }
        catch (e) { console.warn('[Google Ads] Keine GA4-Ads-Daten verfügbar (ignoriert):', e); }
      }
    } catch (e: any) {
      const message = getShortErrorMessage(e);
      console.warn('[GA4] Basisdaten nicht verfügbar:', message);
      apiErrors.ga4 = message || 'GA4 Fehler';
    }
  }

  if (user.google_ads_sheet_id) {
    const sheetId = user.google_ads_sheet_id.trim();
    googleAdsData = createEmptyGoogleAdsSheetData(sheetId);
    try { googleAdsData = await getGoogleAdsFromSheet(sheetId, startDateStr, endDateStr); }
    catch (e: any) {
      const message = getShortErrorMessage(e);
      console.warn('[Google Ads Sheet] Fehler:', message);
      apiErrors.googleAds = message || 'Google Ads Sheet nicht verfügbar';
    }
  }

  if (user.gsc_site_url) {
    try { bingData = await getBingData(user.gsc_site_url); }
    catch (e: any) { console.warn('[Bing] Fetch fehlgeschlagen:', e); apiErrors.bing = e.message || 'Bing Fehler'; }
  }

  let weatherData: Record<string, import('@/lib/weather').DailyWeather> = {};
  try {
    const weatherMap = await fetchWeatherData(user.domain, startDateStr, endDateStr);
    weatherData = weatherMapToObject(weatherMap);
  } catch (e) { console.warn('[Weather] Fetch fehlgeschlagen (ignoriert):', e); }

  const aiTrafficPercentage = (aiTraffic && currentData.sessions.total > 0)
    ? (aiTraffic.totalSessions / currentData.sessions.total) * 100 : 0;

  const freshData: ProjectDashboardData = {
    kpis: {
      clicks: { value: currentData.clicks.total, change: calculateChange(currentData.clicks.total, prevData.clicks.total) },
      impressions: { value: currentData.impressions.total, change: calculateChange(currentData.impressions.total, prevData.impressions.total) },
      sessions: {
        value: currentData.sessions.total,
        change: calculateChange(currentData.sessions.total, prevData.sessions.total),
        aiTraffic: aiTraffic ? { value: aiTraffic.totalSessions, percentage: aiTrafficPercentage } : undefined
      },
      totalUsers: { value: currentData.totalUsers.total, change: calculateChange(currentData.totalUsers.total, prevData.totalUsers.total) },
      conversions: { value: currentData.conversions.total, change: calculateChange(currentData.conversions.total, prevData.conversions.total) },
      engagementRate: { value: parseFloat((currentData.engagementRate.total * 100).toFixed(2)), change: calculateChange(currentData.engagementRate.total, prevData.engagementRate.total) },
      bounceRate: { value: parseFloat((currentData.bounceRate.total * 100).toFixed(2)), change: calculateChange(currentData.bounceRate.total, prevData.bounceRate.total) },
      newUsers: { value: currentData.newUsers.total, change: calculateChange(currentData.newUsers.total, prevData.newUsers.total) },
      avgEngagementTime: { value: currentData.avgEngagementTime.total, change: calculateChange(currentData.avgEngagementTime.total, prevData.avgEngagementTime.total) },
      genAiImpressions: { value: googleGenAi?.totalImpressions || 0, change: googleGenAi?.impressionsChange || 0 },
      paidSearch: { value: currentData.paidSearch.total, change: calculateChange(currentData.paidSearch.total, prevData.paidSearch.total) }
    },
    charts: {
      clicks: currentData.clicks.daily || [],
      impressions: currentData.impressions.daily || [],
      sessions: currentData.sessions.daily || [],
      totalUsers: currentData.totalUsers.daily || [],
      conversions: currentData.conversions.daily || [],
      engagementRate: currentData.engagementRate.daily || [],
      bounceRate: currentData.bounceRate.daily || [],
      newUsers: currentData.newUsers.daily || [],
      avgEngagementTime: currentData.avgEngagementTime.daily || [],
      genAiImpressions: (googleGenAi?.trend || []).map(point => ({ date: point.date, value: point.impressions })),
      paidSearch: currentData.paidSearch.daily || []
    },
    topQueries,
    topQueriesDataVersion: TOP_QUERIES_DATA_VERSION,
    landingPageQueries,
    topConvertingPages,
    localSeo: buildLocalSeoData((user as any).project_locations, topQueries, topConvertingPages, cityData),
    aiTraffic, countryData, channelData, deviceData,
    bingData, weatherData, googleAdsData, googleGenAi, promptTracking,
    apiErrors: Object.keys(apiErrors).length > 0 ? apiErrors : undefined,
    snapshotVersion: 2,
  };

  // ════════════════════════════════════════════════════════════════════
  // Cache-Write nur bei "sauberem" Ergebnis.
  // Kritische Fehler (GSC/GA4) bedeuten i.d.R. genullte KPIs – diese NICHT
  // persistieren, sonst überschreibt ein transienter 502-Blip den letzten
  // guten Eintrag und der Kunde sieht stunden-/tagelang Nullen.
  // Nicht-kritische Quellen (Bing, Ads, Weather) sind hier bewusst egal.
  // ════════════════════════════════════════════════════════════════════
  const synchronizedAt = new Date().toISOString();
  const enrichedFreshData = attachDashboardMetricMetadata(freshData, dateRange, synchronizedAt);
  const blockingSources = (['gsc', 'ga4'] as const).filter((source) => {
    const raw = apiErrors[source];
    return raw ? classifyGoogleApiError(raw).blocksSnapshotWrite : false;
  });
  const hasCriticalErrors = blockingSources.length > 0;

  if (!hasCriticalErrors) {
    const client = await sql.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO google_data_cache (user_id, date_range, data, last_fetched)
         VALUES ($1::uuid, $2, $3::jsonb, NOW())
         ON CONFLICT (user_id, date_range)
         DO UPDATE SET data = EXCLUDED.data, last_fetched = NOW()`,
        [userId, dateRange, JSON.stringify(enrichedFreshData)],
      );
      await persistMetricSnapshotsWithClient(
        client,
        userId,
        dateRange,
        extractDashboardMetricValues(enrichedFreshData),
        enrichedFreshData.metricMetadata ?? {},
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      console.error('[Cache Write Error]', error);
      throw error;
    } finally {
      client.release();
    }
  } else {
    console.warn('[Cache Write] Übersprungen wegen behebbarer API-Fehler:', blockingSources, apiErrors);
  }

  return enrichedFreshData;
}
