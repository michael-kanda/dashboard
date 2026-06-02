// src/lib/ai-traffic-extended.ts
// Erweiterte KI-Traffic Analyse mit Landingpage-Zuordnung

import { google } from 'googleapis';
import { JWT } from 'google-auth-library';
import type { AiTrafficDetailData, AiLandingPageData, AiSourceData } from '@/components/AiTrafficDetailCard';
import { normalizeSource, buildAiTrafficDimensionFilter } from './ai-sources';

// ============================================================================
// AUTHENTIFIZIERUNG
// ============================================================================

function createAuth(): JWT {
  if (process.env.GOOGLE_CREDENTIALS) {
    try {
      const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
      return new JWT({
        email: credentials.client_email,
        key: credentials.private_key,
        scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
      });
    } catch (e) {
      console.error('Fehler beim Parsen der GOOGLE_CREDENTIALS:', e);
      throw new Error('Google Credentials invalid');
    }
  }
  
  const privateKeyBase64 = process.env.GOOGLE_PRIVATE_KEY_BASE64;
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;

  if (!privateKeyBase64 || !clientEmail) {
    throw new Error('Google API Credentials fehlen.');
  }

  const privateKey = Buffer.from(privateKeyBase64, 'base64').toString('utf-8');
  return new JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
  });
}

// ============================================================================
// KONSTANTEN
// ============================================================================

// AI_SOURCES, normalizeSource und der KI-Traffic-Filter kommen jetzt zentral
// aus '@/lib/ai-sources' (siehe Import oben).

// ============================================================================
// HELPER
// ============================================================================

function parseGa4Date(dateString: string): string {
  const year = dateString.substring(0, 4);
  const month = dateString.substring(4, 6);
  const day = dateString.substring(6, 8);
  return `${year}-${month}-${day}`;
}

// ============================================================================
// HAUPTFUNKTION
// ============================================================================

export async function getAiTrafficWithLandingPages(
  propertyId: string,
  startDate: string,
  endDate: string
): Promise<AiTrafficDetailData> {
  const formattedPropertyId = propertyId.startsWith('properties/') 
    ? propertyId 
    : `properties/${propertyId}`;
    
  const auth = createAuth();
  const analytics = google.analyticsdata({ version: 'v1beta', auth });

  // Kombinierter KI-Traffic-Filter (Referrer-Domains ODER nativer GA4
  // "AI Assistant"-Channel) — zentral aus '@/lib/ai-sources', für alle Reports.
  const aiTrafficFilter = buildAiTrafficDimensionFilter();

  // Default Return
  const emptyResult: AiTrafficDetailData = {
    totalSessions: 0,
    totalUsers: 0,
    avgEngagementTime: 0,
    bounceRate: 0,
    conversions: 0,
    sources: [],
    landingPages: [],
    trend: []
  };

  try {
    // =========================================================================
    // REPORT 1: Hauptdaten mit Source + Landingpage
    // =========================================================================
    const mainResponse = await analytics.properties.runReport({
      property: formattedPropertyId,
      requestBody: {
        dateRanges: [{ startDate, endDate }],
        dimensions: [
          { name: 'sessionSource' },
          { name: 'landingPagePlusQueryString' }
        ],
        metrics: [
          { name: 'sessions' },
          { name: 'totalUsers' },
          { name: 'averageSessionDuration' },
          { name: 'bounceRate' },
          { name: 'conversions' }
        ],
        dimensionFilter: aiTrafficFilter,
        orderBys: [
          { metric: { metricName: 'sessions' }, desc: true }
        ],
        limit: '1000'
      },
    });

    // =========================================================================
    // REPORT 2: Trend-Daten (täglich)
    // =========================================================================
    const trendResponse = await analytics.properties.runReport({
      property: formattedPropertyId,
      requestBody: {
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'date' }],
        metrics: [
          { name: 'sessions' },
          { name: 'totalUsers' }
        ],
        dimensionFilter: aiTrafficFilter,
        orderBys: [
          { dimension: { dimensionName: 'date' } }
        ]
      },
    });

    // =========================================================================
    // REPORT 3: Pro-Quelle-Totals OHNE Landingpage-Dimension
    // =========================================================================
    // Report 1 nutzt sessionSource × landingPagePlusQueryString. Diese hohe
    // Kardinalität triggert in GA4 das (other)-Row-Limit, wodurch pro Quelle
    // aufsummierte Sitzungen UNTER dem wahren Wert liegen und eine daraus
    // berechnete conversionRate zu hoch ausfällt. Dieser flache Report liefert
    // die korrekten Pro-Quelle-Zahlen (sessions/users/conversions).
    const sourceTotalsResponse = await analytics.properties.runReport({
      property: formattedPropertyId,
      requestBody: {
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'sessionSource' }],
        metrics: [
          { name: 'sessions' },
          { name: 'totalUsers' },
          { name: 'conversions' }
        ],
        dimensionFilter: aiTrafficFilter,
        orderBys: [
          { metric: { metricName: 'sessions' }, desc: true }
        ],
        limit: '1000'
      },
    }).catch(() => ({ data: { rows: [] as any[] } }));

    // =========================================================================
    // DATEN VERARBEITEN
    // =========================================================================
    
    const mainRows = mainResponse.data.rows || [];
    const trendRows = trendResponse.data.rows || [];
    const sourceTotalsRows = sourceTotalsResponse.data.rows || [];

    if (mainRows.length === 0) {
      return emptyResult;
    }

    // Akkurate Pro-Quelle-Totals aus dem flachen Report (kein (other)-Undercount).
    const sourceTotals = new Map<string, { sessions: number; users: number; conversions: number }>();
    let sourceTotalsSessionsSum = 0;
    for (const row of sourceTotalsRows) {
      const s = normalizeSource(row.dimensionValues?.[0]?.value || 'unknown');
      const sessions = parseInt(row.metricValues?.[0]?.value || '0', 10);
      const users = parseInt(row.metricValues?.[1]?.value || '0', 10);
      const conversions = parseInt(row.metricValues?.[2]?.value || '0', 10);
      const prev = sourceTotals.get(s) || { sessions: 0, users: 0, conversions: 0 };
      sourceTotals.set(s, {
        sessions: prev.sessions + sessions,
        users: prev.users + users,
        conversions: prev.conversions + conversions,
      });
      sourceTotalsSessionsSum += sessions;
    }

    // Aggregations-Maps
    const sourceMap = new Map<string, {
      sessions: number;
      users: number;
      conversions: number;
      pages: Map<string, { sessions: number; conversions: number }>;
    }>();

    const pageMap = new Map<string, {
      sessions: number;
      users: number;
      avgEngagementTime: number;
      bounceRate: number;
      conversions: number;
      engagementTimeSum: number;
      bounceRateSum: number;
      rowCount: number;
      sources: Map<string, { sessions: number; users: number }>;
    }>();

    let totalSessions = 0;
    let totalUsers = 0;
    let totalAvgEngagementTime = 0;
    let totalBounceRate = 0;
    let totalConversions = 0;
    let rowCount = 0;

    // Hauptdaten aggregieren
    for (const row of mainRows) {
      const rawSource = row.dimensionValues?.[0]?.value || 'unknown';
      const source = normalizeSource(rawSource);
      const path = row.dimensionValues?.[1]?.value || '/';
      
      const sessions = parseInt(row.metricValues?.[0]?.value || '0', 10);
      const users = parseInt(row.metricValues?.[1]?.value || '0', 10);
      const avgEngTime = parseFloat(row.metricValues?.[2]?.value || '0');
      const bounceRate = parseFloat(row.metricValues?.[3]?.value || '0');
      const conversions = parseInt(row.metricValues?.[4]?.value || '0', 10);

      // Totals
      totalSessions += sessions;
      totalUsers += users;
      totalAvgEngagementTime += avgEngTime * sessions; // Gewichteter Durchschnitt
      totalBounceRate += bounceRate * sessions;
      totalConversions += conversions;
      rowCount++;

      // Source aggregieren
      if (!sourceMap.has(source)) {
        sourceMap.set(source, { sessions: 0, users: 0, conversions: 0, pages: new Map() });
      }
      const sourceData = sourceMap.get(source)!;
      sourceData.sessions += sessions;
      sourceData.users += users;
      sourceData.conversions += conversions;
      const existingSourcePage = sourceData.pages.get(path) || { sessions: 0, conversions: 0 };
      sourceData.pages.set(path, {
        sessions: existingSourcePage.sessions + sessions,
        conversions: existingSourcePage.conversions + conversions,
      });

      // Page aggregieren
      if (!pageMap.has(path)) {
        pageMap.set(path, {
          sessions: 0,
          users: 0,
          avgEngagementTime: 0,
          bounceRate: 0,
          conversions: 0,
          engagementTimeSum: 0,
          bounceRateSum: 0,
          rowCount: 0,
          sources: new Map()
        });
      }
      const pageData = pageMap.get(path)!;
      pageData.sessions += sessions;
      pageData.users += users;
      pageData.engagementTimeSum += avgEngTime * sessions;
      pageData.bounceRateSum += bounceRate * sessions;
      pageData.conversions += conversions;
      pageData.rowCount++;

      // Source pro Page
      if (!pageData.sources.has(source)) {
        pageData.sources.set(source, { sessions: 0, users: 0 });
      }
      const pageSourceData = pageData.sources.get(source)!;
      pageSourceData.sessions += sessions;
      pageSourceData.users += users;
    }

    // Durchschnittswerte berechnen
    const avgEngagementTime = totalSessions > 0 ? totalAvgEngagementTime / totalSessions : 0;
    const avgBounceRate = totalSessions > 0 ? (totalBounceRate / totalSessions) * 100 : 0;

    // Sources Array erstellen
    // Schlüssel-Union aus Landingpage-Aggregation (für topPages) und flachem
    // Source-only-Report (für korrekte Totals).
    const allSourceKeys = new Set<string>([
      ...Array.from(sourceMap.keys()),
      ...Array.from(sourceTotals.keys()),
    ]);
    const sourcePercentageDenominator =
      sourceTotalsSessionsSum > 0 ? sourceTotalsSessionsSum : totalSessions;

    const sources: AiSourceData[] = Array.from(allSourceKeys)
      .map((source) => {
        const data = sourceMap.get(source);
        const sortedPages = data
          ? Array.from(data.pages.entries()).sort((a, b) => b[1].sessions - a[1].sessions)
          : [];

        // Korrekte Totals bevorzugen, Fallback auf Landingpage-Aggregation.
        const accurate = sourceTotals.get(source);
        const srcSessions = accurate?.sessions ?? data?.sessions ?? 0;
        const srcUsers = accurate?.users ?? data?.users ?? 0;
        const srcConversions = accurate?.conversions ?? data?.conversions ?? 0;

        const topLandingPage = sortedPages[0]
          ? {
              path: sortedPages[0][0],
              sessions: sortedPages[0][1].sessions,
              conversions: sortedPages[0][1].conversions,
            }
          : undefined;

        return {
          source,
          sessions: srcSessions,
          users: srcUsers,
          percentage: sourcePercentageDenominator > 0 ? (srcSessions / sourcePercentageDenominator) * 100 : 0,
          conversions: srcConversions,
          conversionRate: srcSessions > 0 ? (srcConversions / srcSessions) * 100 : 0,
          topLandingPage,
          topPages: sortedPages
            .slice(0, 5)
            .map(([path, vals]) => ({ path, sessions: vals.sessions, conversions: vals.conversions })),
        };
      })
      .sort((a, b) => b.sessions - a.sessions);

    // Landingpages Array erstellen
    const landingPages: AiLandingPageData[] = Array.from(pageMap.entries())
      .map(([path, data]) => ({
        path,
        sessions: data.sessions,
        users: data.users,
        avgEngagementTime: data.sessions > 0 ? data.engagementTimeSum / data.sessions : 0,
        bounceRate: data.sessions > 0 ? (data.bounceRateSum / data.sessions) * 100 : 0,
        conversions: data.conversions,
        sources: Array.from(data.sources.entries())
          .map(([source, sourceData]) => ({
            source,
            sessions: sourceData.sessions,
            users: sourceData.users
          }))
          .sort((a, b) => b.sessions - a.sessions)
      }))
      .sort((a, b) => b.sessions - a.sessions);

    // Trend-Daten
    const trend = trendRows.map(row => ({
      date: parseGa4Date(row.dimensionValues?.[0]?.value || ''),
      sessions: parseInt(row.metricValues?.[0]?.value || '0', 10),
      users: parseInt(row.metricValues?.[1]?.value || '0', 10)
    }));

    return {
      totalSessions,
      totalUsers,
      avgEngagementTime,
      bounceRate: avgBounceRate,
      conversions: totalConversions,
      sources,
      landingPages,
      trend
    };

  } catch (error) {
    console.error('[AI Traffic Extended] Fehler:', error);
    throw error;
  }
}

// ============================================================================
// CHANGE CALCULATION (Vergleich mit Vorperiode)
// ============================================================================

export async function getAiTrafficDetailWithComparison(
  propertyId: string,
  currentStart: string,
  currentEnd: string,
  previousStart: string,
  previousEnd: string
): Promise<AiTrafficDetailData> {
  
  const [currentData, previousData] = await Promise.all([
    getAiTrafficWithLandingPages(propertyId, currentStart, currentEnd),
    getAiTrafficWithLandingPages(propertyId, previousStart, previousEnd)
  ]);

  // Changes berechnen
  const calcChange = (current: number, previous: number): number => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

  return {
    ...currentData,
    totalSessionsChange: calcChange(currentData.totalSessions, previousData.totalSessions),
    totalUsersChange: calcChange(currentData.totalUsers, previousData.totalUsers)
  };
}
