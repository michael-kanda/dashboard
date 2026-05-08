// src/lib/google-data-loader.ts (v4 — mit Brand-Auto-Detection)

import { sql } from '@vercel/postgres';
import { type User } from '@/lib/schemas';
import {
  getSearchConsoleData,
  getAnalyticsData,
  getTopQueries,
  getAiTrafficData,
  getGa4DimensionReport,
  getTopConvertingPages,
  getGscPageCtr,
  getQueriesByLandingPageObject,
  getGoogleAdsReport,
  getGoogleAdsFromSheet,
  getPromptLikeQueries,
  type AiTrafficData,
  type GoogleAdsData,
} from '@/lib/google-api';
import { detectBrandKeywords } from '@/lib/prompt-tracking/brand-detector';
import { getBingData } from '@/lib/bing-api';
import {
  ProjectDashboardData,
  ChartEntry,
  ApiErrorStatus,
  ConvertingPageData,
  LandingPageQueries,
  PromptTrackingResult,
  PromptTrackingShareBucket,
  PromptTrackingPrevious,
} from '@/lib/dashboard-shared';
import type { TopQueryData, ChartPoint } from '@/types/dashboard';

import { getDemoAnalyticsData } from '@/lib/demo-data';
import { fetchWeatherData, weatherMapToObject } from '@/lib/weather';

function getCacheDuration(dateRange: string): number {
  if (dateRange === '18m' || dateRange === '24m') return 72;
  if (dateRange === '12m') return 48;
  return 24;
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
    // Top-Queries aus GSC holen für die Recurring-Token-Analyse
    let topQueries: { query: string; clicks: number }[] = [];
    if (user.gsc_site_url) {
      try {
        const top = await getTopQueries(user.gsc_site_url, startDate, endDate);
        topQueries = (top as any[])
          .map((q) => ({
            query: q.query || q.keys?.[0] || '',
            clicks: q.clicks ?? 0,
          }))
          .filter((q) => q.query.length > 0);
      } catch (gscErr) {
        console.warn('[Brand Auto-Detect] GSC Top-Queries Fetch fehlgeschlagen:', gscErr);
      }
    }

    const result = await detectBrandKeywords({
      domain: user.domain,
      topQueries,
    });

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
  forceRefresh = false
): Promise<ProjectDashboardData | null> {
  if (!user.id) return null;
  const userId = user.id;

  console.log(
    `[Google Data Loader] User: ${user.email} | google_ads_sheet_id: ${user.google_ads_sheet_id || '(nicht gesetzt)'}`
  );

  const isDemo = user.email?.includes('demo') || user.domain?.includes('demo-shop');
  if (isDemo) {
    console.log('[Google Data Loader] Demo-User erkannt. Lade Demo-Daten...');
    return getDemoAnalyticsData(dateRange);
  }

  if (!forceRefresh) {
    try {
      const { rows } = await sql`
        SELECT data, last_fetched
        FROM google_data_cache
        WHERE user_id = ${userId}::uuid AND date_range = ${dateRange}
        LIMIT 1
      `;
      if (rows.length > 0) {
        const cacheEntry = rows[0];
        const lastFetched = new Date(cacheEntry.last_fetched).getTime();
        const now = Date.now();
        if ((now - lastFetched) / (1000 * 60 * 60) < getCacheDuration(dateRange)) {
          console.log(`[Google Cache] ✅ HIT für ${user.email}`);
          return { ...cacheEntry.data, fromCache: true };
        }
      }
    } catch (error) {
      console.warn('[Google Cache] Lesefehler:', error);
    }
  }

  console.log(`[Google Cache] 🔄 Lade frische Daten für ${user.email}...`);

  const end = new Date();
  end.setDate(end.getDate() - 1);
  const start = new Date(end);
  let days = 30;
  if (dateRange === '7d') days = 7;
  if (dateRange === '3m') days = 90;
  if (dateRange === '6m') days = 180;
  if (dateRange === '12m') days = 365;
  if (dateRange === '18m') days = 548;
  if (dateRange === '24m') days = 730;
  start.setDate(end.getDate() - days);

  const startDateStr = start.toISOString().split('T')[0];
  const endDateStr = end.toISOString().split('T')[0];

  const prevEnd = new Date(start);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevEnd.getDate() - days);
  const prevStartStr = prevStart.toISOString().split('T')[0];
  const prevEndStr = prevEnd.toISOString().split('T')[0];

  let currentData: RawApiData = { ...INITIAL_DATA };
  let prevData: RawApiData = { ...INITIAL_DATA };

  let topQueries: TopQueryData[] = [];
  let topConvertingPages: ConvertingPageData[] = [];
  let aiTraffic: AiTrafficData | undefined;
  let countryData: ChartEntry[] = [];
  let channelData: ChartEntry[] = [];
  let deviceData: ChartEntry[] = [];
  let bingData: any[] = [];
  let apiErrors: ApiErrorStatus = {};
  let landingPageQueries: LandingPageQueries = {};
  let googleAdsData: GoogleAdsData | undefined;
  let promptTracking: PromptTrackingResult | undefined;

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
      landingPageQueries = await getQueriesByLandingPageObject(user.gsc_site_url, startDateStr, endDateStr, 5);

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
          totalImpressionsAll, 10
        );

        try {
          const prevPt = await getPromptLikeQueries(
            user.gsc_site_url, prevStartStr, prevEndStr,
            user.domain ?? undefined,
            brandKeywords,
            totalImpressionsAllPrev, 10
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
          `${promptTracking.totals.brandedShare.toFixed(1)} % Brand` +
          `${autoDetected ? ' – auto-detected' : ''}, ` +
          `Geo ${promptTracking.totals.geoShare.toFixed(1)} %, ` +
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
      const gaCurrent = await getAnalyticsData(propertyId, startDateStr, endDateStr);
      const gaPrevious = await getAnalyticsData(propertyId, prevStartStr, prevEndStr);

      currentData = {
        ...currentData,
        sessions: gaCurrent.sessions, totalUsers: gaCurrent.totalUsers,
        conversions: gaCurrent.conversions, engagementRate: gaCurrent.engagementRate,
        bounceRate: gaCurrent.bounceRate, newUsers: gaCurrent.newUsers,
        avgEngagementTime: gaCurrent.avgEngagementTime, paidSearch: gaCurrent.paidSearch
      };
      prevData = {
        ...prevData,
        sessions: gaPrevious.sessions, totalUsers: gaPrevious.totalUsers,
        conversions: gaPrevious.conversions, engagementRate: gaPrevious.engagementRate,
        bounceRate: gaPrevious.bounceRate, newUsers: gaPrevious.newUsers,
        avgEngagementTime: gaPrevious.avgEngagementTime, paidSearch: gaPrevious.paidSearch
      };

      try { aiTraffic = await getAiTrafficData(propertyId, startDateStr, endDateStr); }
      catch (e) { console.warn('[AI Traffic] Fehler (ignoriert):', e); }

      try {
        const rawPages = await getTopConvertingPages(propertyId, startDateStr, endDateStr);
        let gscCtrData = new Map<string, number>();
        if (user.gsc_site_url) {
          gscCtrData = await getGscPageCtr(user.gsc_site_url, startDateStr, endDateStr);
        }
        topConvertingPages = rawPages.map((p: any) => ({
          path: p.path, conversions: p.conversions,
          conversionRate: typeof p.conversionRate === 'string' ? parseFloat(p.conversionRate) : Number(p.conversionRate),
          engagementRate: p.engagementRate, sessions: p.sessions,
          newUsers: p.newUsers, ctr: gscCtrData.get(p.path)
        }));
      } catch (e) { console.warn('[GA4] Konnte Top-Pages nicht laden:', e); }

      try {
        const rawCountry = await getGa4DimensionReport(propertyId, startDateStr, endDateStr, 'country');
        countryData = rawCountry.map((item, index) => ({ ...item, fill: `hsl(var(--chart-${(index % 5) + 1}))` }));
        const rawChannel = await getGa4DimensionReport(propertyId, startDateStr, endDateStr, 'sessionDefaultChannelGroup');
        channelData = rawChannel.map((item, index) => ({ ...item, fill: `hsl(var(--chart-${(index % 5) + 1}))` }));
        const rawDevice = await getGa4DimensionReport(propertyId, startDateStr, endDateStr, 'deviceCategory');
        deviceData = rawDevice.map((item, index) => ({ ...item, fill: `hsl(var(--chart-${(index % 5) + 1}))` }));
      } catch (e) { console.error('[GA4 Dimensions Error]', e); }

      if (!user.google_ads_sheet_id) {
        try { googleAdsData = await getGoogleAdsReport(propertyId, startDateStr, endDateStr); }
        catch (e) { console.warn('[Google Ads] Keine GA4-Ads-Daten verfügbar (ignoriert):', e); }
      }
    } catch (e: any) {
      console.error('[GA4 Error]', e);
      apiErrors.ga4 = e.message || 'GA4 Fehler';
    }
  }

  if (user.google_ads_sheet_id) {
    try { googleAdsData = await getGoogleAdsFromSheet(user.google_ads_sheet_id, startDateStr, endDateStr); }
    catch (e) { console.warn('[Google Ads Sheet] Fehler:', e); }
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
      paidSearch: currentData.paidSearch.daily || []
    },
    topQueries, landingPageQueries, topConvertingPages,
    aiTraffic, countryData, channelData, deviceData,
    bingData, weatherData, googleAdsData, promptTracking,
    apiErrors: Object.keys(apiErrors).length > 0 ? apiErrors : undefined
  };

  try {
    await sql`
      INSERT INTO google_data_cache (user_id, date_range, data, last_fetched)
      VALUES (${userId}::uuid, ${dateRange}, ${JSON.stringify(freshData)}::jsonb, NOW())
      ON CONFLICT (user_id, date_range)
      DO UPDATE SET data = ${JSON.stringify(freshData)}::jsonb, last_fetched = NOW();
    `;
  } catch (e) { console.error('[Cache Write Error]', e); }

  return freshData;
}
