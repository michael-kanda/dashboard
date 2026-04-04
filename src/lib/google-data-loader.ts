// src/lib/google-data-loader.ts
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
  type AiTrafficData,
  type Ga4ExtendedData,
  type GoogleAdsData
} from '@/lib/google-api';
import { getBingData } from '@/lib/bing-api';
import { 
  ProjectDashboardData, 
  ChartEntry, 
  ApiErrorStatus,
  ConvertingPageData,
  LandingPageQueries
} from '@/lib/dashboard-shared';
import type { TopQueryData, ChartPoint } from '@/types/dashboard';

// ✅ DEMO-DATEN IMPORT
import { getDemoAnalyticsData } from '@/lib/demo-data';

// ✅ Weather Import
import { fetchWeatherData, weatherMapToObject } from '@/lib/weather';

function getCacheDuration(dateRange: string): number {
  if (dateRange === '18m' || dateRange === '24m') return 72; // 3 Tage
  if (dateRange === '12m') return 48;
  return 24; // kürzere Zeiträume öfter aktualisieren
}

// Interface für interne Datenhaltung - kompatibel mit Ga4ExtendedData
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

// Hilfsfunktion: Berechnet Veränderung sicher
function calculateChange(current: number, previous: number): number {
  if (!previous || previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

// Initialer State für leere Daten
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

export async function getOrFetchGoogleData(
  user: User,
  dateRange: string,
  forceRefresh = false
): Promise<ProjectDashboardData | null> {
  if (!user.id) return null;
  const userId = user.id;

  // Debug: Sheet-ID prüfen
  console.log(`[Google Data Loader] User: ${user.email} | google_ads_sheet_id: ${user.google_ads_sheet_id || '(nicht gesetzt)'}`);

  // ==========================================
  // ✅ DEMO-MODUS CHECK - GANZ OBEN!
  // ==========================================
  const isDemo = user.email?.includes('demo') || user.domain?.includes('demo-shop');
  
  if (isDemo) {
    console.log('[Google Data Loader] Demo-User erkannt. Lade Demo-Daten...');
    return getDemoAnalyticsData(dateRange);
  }
  // ==========================================
  // ENDE DEMO-MODUS
  // ==========================================

  // 1. Cache prüfen
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

  // 2. Daten frisch holen
  console.log(`[Google Cache] 🔄 Lade frische Daten für ${user.email}...`);

  //  End-Datum = gestern (damit nur vollständige Tage angezeigt werden)
  const end = new Date();
  end.setDate(end.getDate() - 1); // Immer einen Tag zurück

  const start = new Date(end);
  let days = 30;
  if (dateRange === '7d') days = 7;
  if (dateRange === '3m') days = 90;
  if (dateRange === '6m') days = 180;
  if (dateRange === '12m') days = 365;
  if (dateRange === '18m') days = 548;  // ~18 Monate
  if (dateRange === '24m') days = 730;  // ~24 Monate
  start.setDate(end.getDate() - days);
  
  const startDateStr = start.toISOString().split('T')[0];
  const endDateStr = end.toISOString().split('T')[0];

  const prevEnd = new Date(start);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevEnd.getDate() - days);
  const prevStartStr = prevStart.toISOString().split('T')[0];
  const prevEndStr = prevEnd.toISOString().split('T')[0];

  // Datencontainer mit Default-Werten initialisieren
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
  let googleAdsData: GoogleAdsData | undefined;  // ✅ NEU

  // --- GSC FETCH ---
  if (user.gsc_site_url) {
    try {
      const gscRaw = await getSearchConsoleData(user.gsc_site_url, startDateStr, endDateStr);
      currentData = {
        ...currentData,
        clicks: { 
          total: gscRaw.clicks?.total || 0, 
          daily: gscRaw.clicks?.daily || [] 
        },
        impressions: { 
          total: gscRaw.impressions?.total || 0, 
          daily: gscRaw.impressions?.daily || [] 
        }
      };
      
      const gscPrevRaw = await getSearchConsoleData(user.gsc_site_url, prevStartStr, prevEndStr);
      prevData = {
        ...prevData,
        clicks: { ...prevData.clicks, total: gscPrevRaw.clicks?.total || 0 },
        impressions: { ...prevData.impressions, total: gscPrevRaw.impressions?.total || 0 }
      };

      topQueries = await getTopQueries(user.gsc_site_url, startDateStr, endDateStr);
      
      landingPageQueries = await getQueriesByLandingPageObject(user.gsc_site_url, startDateStr, endDateStr, 5);
      
    } catch (e: any) {
      console.error('[GSC Error]', e);
      apiErrors.gsc = e.message || 'GSC Fehler';
    }
  }

  // --- GA4 FETCH ---
  if (user.ga4_property_id) {
    try {
      const propertyId = user.ga4_property_id.trim();
      
      const gaCurrent = await getAnalyticsData(propertyId, startDateStr, endDateStr);
      const gaPrevious = await getAnalyticsData(propertyId, prevStartStr, prevEndStr);
      
      currentData = { 
        ...currentData,
        sessions: gaCurrent.sessions,
        totalUsers: gaCurrent.totalUsers,
        conversions: gaCurrent.conversions,
        engagementRate: gaCurrent.engagementRate,
        bounceRate: gaCurrent.bounceRate,
        newUsers: gaCurrent.newUsers,
        avgEngagementTime: gaCurrent.avgEngagementTime,
        paidSearch: gaCurrent.paidSearch
      };

      prevData = { 
        ...prevData,
        sessions: gaPrevious.sessions,
        totalUsers: gaPrevious.totalUsers,
        conversions: gaPrevious.conversions,
        engagementRate: gaPrevious.engagementRate,
        bounceRate: gaPrevious.bounceRate,
        newUsers: gaPrevious.newUsers,
        avgEngagementTime: gaPrevious.avgEngagementTime,
        paidSearch: gaPrevious.paidSearch
      };

      // AI Traffic
      try { 
        aiTraffic = await getAiTrafficData(propertyId, startDateStr, endDateStr); 
      } catch (e) {
        console.warn('[AI Traffic] Fehler (ignoriert):', e);
      }
      
      // Top Converting Pages + GSC CTR
      try {
        const rawPages = await getTopConvertingPages(propertyId, startDateStr, endDateStr);
        
        let gscCtrData = new Map<string, number>();
        if (user.gsc_site_url) {
          gscCtrData = await getGscPageCtr(user.gsc_site_url, startDateStr, endDateStr);
        }
        
        topConvertingPages = rawPages.map((p: any) => ({
          path: p.path,
          conversions: p.conversions,
          conversionRate: typeof p.conversionRate === 'string' 
            ? parseFloat(p.conversionRate) 
            : Number(p.conversionRate),
          engagementRate: p.engagementRate, 
          sessions: p.sessions, 
          newUsers: p.newUsers,
          ctr: gscCtrData.get(p.path)
        }));
      } catch (e) {
        console.warn('[GA4] Konnte Top-Pages nicht laden:', e);
      }

      // Dimensionen (Charts)
      try {
        const rawCountry = await getGa4DimensionReport(propertyId, startDateStr, endDateStr, 'country');
        countryData = rawCountry.map((item, index) => ({ ...item, fill: `hsl(var(--chart-${(index % 5) + 1}))` }));
        
        const rawChannel = await getGa4DimensionReport(propertyId, startDateStr, endDateStr, 'sessionDefaultChannelGroup');
        channelData = rawChannel.map((item, index) => ({ ...item, fill: `hsl(var(--chart-${(index % 5) + 1}))` }));
        
        const rawDevice = await getGa4DimensionReport(propertyId, startDateStr, endDateStr, 'deviceCategory');
        deviceData = rawDevice.map((item, index) => ({ ...item, fill: `hsl(var(--chart-${(index % 5) + 1}))` }));
      } catch (e) { 
        console.error('[GA4 Dimensions Error]', e); 
      }

      // ✅ Google Ads via GA4 (nur wenn KEIN Sheet konfiguriert ist)
      if (!user.google_ads_sheet_id) {
        try {
          googleAdsData = await getGoogleAdsReport(propertyId, startDateStr, endDateStr);
          console.log(`[Google Ads] ✅ GA4: ${googleAdsData.rows.length} Zeilen, Spend: €${googleAdsData.totals.cost.toFixed(2)}`);
        } catch (e) {
          console.warn('[Google Ads] Keine GA4-Ads-Daten verfügbar (ignoriert):', e);
        }
      }

    } catch (e: any) {
      console.error('[GA4 Error]', e);
      apiErrors.ga4 = e.message || 'GA4 Fehler';
    }
  }

  // --- GOOGLE ADS VIA SHEET (unabhängig von GA4) ---
  if (user.google_ads_sheet_id) {
    try {
      googleAdsData = await getGoogleAdsFromSheet(user.google_ads_sheet_id, startDateStr, endDateStr);
      console.log(`[Google Ads] ✅ Sheet: Kampagnen=${googleAdsData.campaignRows?.length ?? 0}, Spend: €${googleAdsData.totals.cost.toFixed(2)}`);
    } catch (e) {
      console.warn('[Google Ads Sheet] Fehler beim Laden der Sheet-Daten:', e);
    }
  }

  // --- BING FETCH ---
  if (user.gsc_site_url) {
    try {
      bingData = await getBingData(user.gsc_site_url);
      console.log('[Bing] Daten erfolgreich geladen');
    } catch (e: any) {
      console.warn('[Bing] Fetch fehlgeschlagen (optional):', e);
      apiErrors.bing = e.message || 'Bing Fehler';
    }
  }

  // --- WETTER FETCH (parallel-safe, Fehler werden ignoriert) ---
  let weatherData: Record<string, import('@/lib/weather').DailyWeather> = {};
  try {
    const weatherMap = await fetchWeatherData(user.domain, startDateStr, endDateStr);
    weatherData = weatherMapToObject(weatherMap);
  } catch (e) {
    console.warn('[Weather] Fetch fehlgeschlagen (ignoriert):', e);
  }

  // AI Anteil berechnen
  const aiTrafficPercentage = (aiTraffic && currentData.sessions.total > 0)
    ? (aiTraffic.totalSessions / currentData.sessions.total) * 100
    : 0;

  // --- DATEN ZUSAMMENBAUEN ---
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
      engagementRate: { 
        value: parseFloat((currentData.engagementRate.total * 100).toFixed(2)), 
        change: calculateChange(currentData.engagementRate.total, prevData.engagementRate.total) 
      },
      bounceRate: { 
        value: parseFloat((currentData.bounceRate.total * 100).toFixed(2)), 
        change: calculateChange(currentData.bounceRate.total, prevData.bounceRate.total) 
      },
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
    topQueries,
    landingPageQueries,
    topConvertingPages,
    aiTraffic,
    countryData,
    channelData,
    deviceData,
    bingData,
    weatherData,
    googleAdsData,    // ✅ NEU
    apiErrors: Object.keys(apiErrors).length > 0 ? apiErrors : undefined
  };

  // Cache speichern
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
