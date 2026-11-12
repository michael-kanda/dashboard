// src/lib/ai-traffic-v2/aggregate.ts
// Aggregator: verdichtet die GA4-Roh-Responses zum AiTrafficExtendedData-Ergebnis

import { normalizeSource } from '../ai-sources';
import { parseGa4Metric } from '../ga4-metrics';
import type { AiTrafficExtendedData, IntentCategory, UserJourneyData } from './types';
import { detectIntent } from './intent';
import type { AiTrafficReportResponses } from './ga4-queries';

function parseGa4Date(dateString: string): string {
  const year = dateString.substring(0, 4);
  const month = dateString.substring(4, 6);
  const day = dateString.substring(6, 8);
  return `${year}-${month}-${day}`;
}

// normalizeSource, AI_SOURCES und der KI-Traffic-Filter kommen jetzt zentral
// aus '@/lib/ai-sources' (siehe Import oben).

/**
 * Baut aus den Roh-Responses der Hauptanalyse und den kanonischen
 * Gesamtwerten (Totals-Report ohne Dimensionen) das finale Ergebnis.
 */
export function aggregateAiTrafficReports(
  reports: AiTrafficReportResponses,
  currentTotals: { totalSessions: number; totalUsers: number }
): AiTrafficExtendedData {
  const {
    mainResponse,
    trendResponse,
    journeyResponse,
    eventsResponse,
    scrollResponse,
    trendBySourceResponse,
    sourceTotalsResponse,
  } = reports;

  // =========================================================================
  // DATEN VERARBEITEN
  // =========================================================================

  const mainRows = mainResponse.data.rows || [];
  const trendRows = trendResponse.data.rows || [];
  const journeyRows = journeyResponse.data.rows || [];
  const eventsRows = eventsResponse.data.rows || [];
  const scrollRows = scrollResponse.data.rows || [];
  const trendBySourceRows = trendBySourceResponse.data.rows || [];
  const sourceTotalsRows = sourceTotalsResponse.data.rows || [];

  // --- Akkurate Pro-Quelle-Totals (aus dem flachen Source-only-Report) ---
  // Numerator und Denominator stammen hier aus derselben niedrig-kardinalen
  // Abfrage, daher kein (other)-Undercount. Wird unten für sessions/users/
  // conversions/conversionRate/percentage der Quellen verwendet.
  const sourceTotals = new Map<string, { sessions: number; users: number; conversions: number }>();
  let sourceTotalsSessionsSum = 0;
  for (const row of sourceTotalsRows) {
    const s = normalizeSource(row.dimensionValues?.[0]?.value || 'unknown');
    const sessions = parseInt(row.metricValues?.[0]?.value || '0', 10);
    const users = parseInt(row.metricValues?.[1]?.value || '0', 10);
    const conversions = parseGa4Metric(row.metricValues?.[2]?.value);
    const prev = sourceTotals.get(s) || { sessions: 0, users: 0, conversions: 0 };
    sourceTotals.set(s, {
      sessions: prev.sessions + sessions,
      users: prev.users + users,
      conversions: prev.conversions + conversions,
    });
    sourceTotalsSessionsSum += sessions;
  }

  // --- Aggregations-Maps ---
  const sourceMap = new Map<string, {
    sessions: number;
    users: number;
    conversions: number;
    engagementRateWeighted: number;
    pages: Map<string, { sessions: number; conversions: number }>;
  }>();

  const pageMap = new Map<string, {
    sessions: number;
    users: number;
    avgEngagementTime: number;
    bounceRate: number;
    engagementRate: number;
    conversions: number;
    engagementTimeSum: number;
    bounceRateSum: number;
    engagementRateSum: number;
    pagesPerSessionSum: number;
    sources: Map<string, { sessions: number; users: number }>;
  }>();

  const intentMap = new Map<string, {
    intent: IntentCategory;
    sessions: number;
    users: number;
    conversions: number;
    engagementTimeSum: number;
    engagementRateSum: number;
    pages: Map<string, number>;
  }>();

  let totalSessions = 0;
  let totalEngagementTimeWeighted = 0;
  let totalBounceRateWeighted = 0;
  let totalEngagementRateWeighted = 0;
  let totalConversions = 0;
  let totalPagesPerSessionWeighted = 0;

  // --- Hauptdaten aggregieren ---
  for (const row of mainRows) {
    const rawSource = row.dimensionValues?.[0]?.value || 'unknown';
    const source = normalizeSource(rawSource);
    const path = row.dimensionValues?.[1]?.value || '/';
    
    if (path === '(not set)' || path === '(not provided)') continue;
    
    const sessions = parseInt(row.metricValues?.[0]?.value || '0', 10);
    const users = parseInt(row.metricValues?.[1]?.value || '0', 10);
    const avgEngTime = parseFloat(row.metricValues?.[2]?.value || '0');
    const bounceRate = parseFloat(row.metricValues?.[3]?.value || '0');
    const conversions = parseGa4Metric(row.metricValues?.[4]?.value);
    const pagesPerSession = parseFloat(row.metricValues?.[5]?.value || '0');
    const engagementRate = parseFloat(row.metricValues?.[6]?.value || '0');

    // Totals
    totalSessions += sessions;
    totalEngagementTimeWeighted += avgEngTime * sessions;
    totalBounceRateWeighted += bounceRate * sessions;
    totalEngagementRateWeighted += engagementRate * sessions;
    totalConversions += conversions;
    totalPagesPerSessionWeighted += pagesPerSession * sessions;

    // Intent ermitteln
    const intent = detectIntent(path);
    if (!intentMap.has(intent.key)) {
      intentMap.set(intent.key, {
        intent,
        sessions: 0,
        users: 0,
        conversions: 0,
        engagementTimeSum: 0,
        engagementRateSum: 0,
        pages: new Map()
      });
    }
    const intentData = intentMap.get(intent.key)!;
    intentData.sessions += sessions;
    intentData.users += users;
    intentData.conversions += conversions;
    intentData.engagementTimeSum += avgEngTime * sessions;
    intentData.engagementRateSum += engagementRate * sessions;
    intentData.pages.set(path, (intentData.pages.get(path) || 0) + sessions);

    // Source aggregieren
    if (!sourceMap.has(source)) {
      sourceMap.set(source, {
        sessions: 0,
        users: 0,
        conversions: 0,
        engagementRateWeighted: 0,
        pages: new Map()
      });
    }
    const sourceData = sourceMap.get(source)!;
    sourceData.sessions += sessions;
    sourceData.users += users;
    sourceData.conversions += conversions;
    sourceData.engagementRateWeighted += engagementRate * sessions;
    const existingPage = sourceData.pages.get(path) || { sessions: 0, conversions: 0 };
    sourceData.pages.set(path, {
      sessions: existingPage.sessions + sessions,
      conversions: existingPage.conversions + conversions,
    });

    // Page aggregieren
    if (!pageMap.has(path)) {
      pageMap.set(path, {
        sessions: 0,
        users: 0,
        avgEngagementTime: 0,
        bounceRate: 0,
        engagementRate: 0,
        conversions: 0,
        engagementTimeSum: 0,
        bounceRateSum: 0,
        engagementRateSum: 0,
        pagesPerSessionSum: 0,
        sources: new Map()
      });
    }
    const pageData = pageMap.get(path)!;
    pageData.sessions += sessions;
    pageData.users += users;
    pageData.engagementTimeSum += avgEngTime * sessions;
    pageData.bounceRateSum += bounceRate * sessions;
    pageData.engagementRateSum += engagementRate * sessions;
    pageData.conversions += conversions;
    pageData.pagesPerSessionSum += pagesPerSession * sessions;

    if (!pageData.sources.has(source)) {
      pageData.sources.set(source, { sessions: 0, users: 0 });
    }
    pageData.sources.get(source)!.sessions += sessions;
    pageData.sources.get(source)!.users += users;
  }

  const displayTotalSessions = currentTotals.totalSessions;
  const displayTotalUsers = currentTotals.totalUsers;

  // --- User Journey verarbeiten ---
  const journeyMap = new Map<string, Map<string, number>>();
  
  for (const row of journeyRows) {
    const landingPage = row.dimensionValues?.[0]?.value || '/';
    const nextPage = row.dimensionValues?.[1]?.value || '/';
    const sessions = parseInt(row.metricValues?.[0]?.value || '0', 10);

    if (landingPage === '(not set)' || nextPage === '(not set)') continue;
    if (landingPage === nextPage) continue;

    if (!journeyMap.has(landingPage)) {
      journeyMap.set(landingPage, new Map());
    }
    journeyMap.get(landingPage)!.set(nextPage, 
      (journeyMap.get(landingPage)!.get(nextPage) || 0) + sessions
    );
  }

  // Top Journeys erstellen
  const topJourneys: UserJourneyData[] = Array.from(pageMap.entries())
    .sort((a, b) => b[1].sessions - a[1].sessions)
    .slice(0, 10)
    .map(([landingPage, data]) => {
      const nextPagesMap = journeyMap.get(landingPage) || new Map();
      const nextPages = Array.from(nextPagesMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([path, sessions]) => ({
          path,
          sessions,
          percentage: data.sessions > 0 ? (sessions / data.sessions) * 100 : 0
        }));

      return {
        landingPage,
        totalSessions: data.sessions,
        avgPagesPerSession: data.sessions > 0 ? data.pagesPerSessionSum / data.sessions : 0,
        avgSessionDuration: data.sessions > 0 ? data.engagementTimeSum / data.sessions : 0,
        conversionRate: data.sessions > 0 ? (data.conversions / data.sessions) * 100 : 0,
        engagementRate: data.sessions > 0 ? (data.engagementRateSum / data.sessions) * 100 : 0,
        nextPages,
        exitPages: [],
        journeySteps: []
      };
    });

  // --- Events verarbeiten ---
  const totalEvents = eventsRows.reduce((sum, row) => 
    sum + parseInt(row.metricValues?.[0]?.value || '0', 10), 0);
  
  const interactionEvents = eventsRows.map(row => ({
    eventName: row.dimensionValues?.[0]?.value || 'unknown',
    count: parseInt(row.metricValues?.[0]?.value || '0', 10),
    percentage: totalEvents > 0 
      ? (parseInt(row.metricValues?.[0]?.value || '0', 10) / totalEvents) * 100 
      : 0
  }));

  // --- Scroll-Tiefe verarbeiten ---
  const scrollDepth = { reached25: 0, reached50: 0, reached75: 0, reached100: 0 };
  for (const row of scrollRows) {
    const percent = row.dimensionValues?.[0]?.value || '0';
    const count = parseInt(row.metricValues?.[0]?.value || '0', 10);
    
    if (percent === '25') scrollDepth.reached25 = count;
    else if (percent === '50') scrollDepth.reached50 = count;
    else if (percent === '75') scrollDepth.reached75 = count;
    else if (percent === '90' || percent === '100') scrollDepth.reached100 += count;
  }

  // =========================================================================
  // ERGEBNIS ZUSAMMENBAUEN
  // =========================================================================

  const avgEngagementTime = totalSessions > 0 ? totalEngagementTimeWeighted / totalSessions : 0;
  const avgBounceRate = totalSessions > 0 ? (totalBounceRateWeighted / totalSessions) * 100 : 0;
  const avgEngagementRate = totalSessions > 0 ? (totalEngagementRateWeighted / totalSessions) * 100 : 0;
  const avgPagesPerSession = totalSessions > 0 ? totalPagesPerSessionWeighted / totalSessions : 0;

  // Intent Breakdown
  const intentBreakdown = Array.from(intentMap.values())
    .map(data => ({
      intent: data.intent,
      sessions: data.sessions,
      users: data.users,
      conversions: data.conversions,
      conversionRate: data.sessions > 0 ? (data.conversions / data.sessions) * 100 : 0,
      avgEngagementTime: data.sessions > 0 ? data.engagementTimeSum / data.sessions : 0,
      engagementRate: data.sessions > 0 ? (data.engagementRateSum / data.sessions) * 100 : 0,
      percentage: displayTotalSessions > 0 ? (data.sessions / displayTotalSessions) * 100 : 0,
      topPages: Array.from(data.pages.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([path, sessions]) => ({ path, sessions }))
    }))
    .sort((a, b) => b.sessions - a.sessions);

  // Sources
  // Schlüssel-Union aus Landingpage-Aggregation (für topPages) und dem flachen
  // Source-only-Report (für korrekte Totals) — so geht keine Quelle verloren,
  // selbst wenn ihre Landingpage-Zeilen ins (other)-Bucket gefallen sind.
  const allSourceKeys = new Set<string>([
    ...Array.from(sourceMap.keys()),
    ...Array.from(sourceTotals.keys()),
  ]);
  const sourcePercentageDenominator =
    sourceTotalsSessionsSum > 0 ? sourceTotalsSessionsSum : displayTotalSessions;

  const sources = Array.from(allSourceKeys)
    .map((source) => {
      const data = sourceMap.get(source);
      const sortedPages = data
        ? Array.from(data.pages.entries()).sort((a, b) => b[1].sessions - a[1].sessions)
        : [];
      const topPages = sortedPages
        .slice(0, 5)
        .map(([path, vals]) => ({
          path,
          sessions: vals.sessions,
          conversions: vals.conversions,
        }));
      const topLandingPage = sortedPages[0]
        ? {
            path: sortedPages[0][0],
            sessions: sortedPages[0][1].sessions,
            conversions: sortedPages[0][1].conversions,
          }
        : undefined;

      // Korrekte Totals bevorzugen; Fallback auf die Landingpage-Aggregation,
      // falls der Source-only-Report leer/fehlerhaft war.
      const accurate = sourceTotals.get(source);
      const sourceSessions = accurate?.sessions ?? data?.sessions ?? 0;
      const sourceUsers = accurate?.users ?? data?.users ?? 0;
      const sourceConversions = accurate?.conversions ?? data?.conversions ?? 0;

      // engagementRate kommt weiterhin aus der gewichteten Landingpage-Aggregation
      // (source-only-Report enthält die Metrik nicht).
      const engRateWeighted = data?.engagementRateWeighted ?? 0;
      const engRateBaseSessions = data?.sessions ?? 0;

      return {
        source,
        sessions: sourceSessions,
        users: sourceUsers,
        engagementRate: engRateBaseSessions > 0 ? (engRateWeighted / engRateBaseSessions) * 100 : 0,
        percentage: sourcePercentageDenominator > 0 ? (sourceSessions / sourcePercentageDenominator) * 100 : 0,
        conversions: sourceConversions,
        conversionRate: sourceSessions > 0 ? (sourceConversions / sourceSessions) * 100 : 0,
        topPages,
        topLandingPage,
      };
    })
    .sort((a, b) => b.sessions - a.sessions);

  // Landing Pages mit Intent
  const landingPages = Array.from(pageMap.entries())
    .map(([path, data]) => ({
      path,
      intent: detectIntent(path),
      sessions: data.sessions,
      users: data.users,
      avgEngagementTime: data.sessions > 0 ? data.engagementTimeSum / data.sessions : 0,
      bounceRate: data.sessions > 0 ? (data.bounceRateSum / data.sessions) * 100 : 0,
      engagementRate: data.sessions > 0 ? (data.engagementRateSum / data.sessions) * 100 : 0,
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

  // Trend
  const trend = trendRows.map(row => ({
    date: parseGa4Date(row.dimensionValues?.[0]?.value || ''),
    sessions: parseInt(row.metricValues?.[0]?.value || '0', 10),
    users: parseInt(row.metricValues?.[1]?.value || '0', 10)
  }));

  // Trend pro KI-Quelle (long format) — normalisierte Sources nach Tag aggregiert
  // Mehrere Raw-Sources können auf dieselbe normalisierte Source mappen (z.B. chat.openai.com → chatgpt.com).
  // Daher Map<dateKey, Map<normalizedSource, {sessions, users}>>
  const trendBySourceMap = new Map<string, Map<string, { sessions: number; users: number }>>();
  for (const row of trendBySourceRows) {
    const date = parseGa4Date(row.dimensionValues?.[0]?.value || '');
    const rawSource = row.dimensionValues?.[1]?.value || 'unknown';
    const source = normalizeSource(rawSource);
    const sessions = parseInt(row.metricValues?.[0]?.value || '0', 10);
    const users = parseInt(row.metricValues?.[1]?.value || '0', 10);

    if (!trendBySourceMap.has(date)) {
      trendBySourceMap.set(date, new Map());
    }
    const dayMap = trendBySourceMap.get(date)!;
    const existing = dayMap.get(source) || { sessions: 0, users: 0 };
    dayMap.set(source, {
      sessions: existing.sessions + sessions,
      users: existing.users + users
    });
  }

  const trendBySource: Array<{ date: string; source: string; sessions: number; users: number }> = [];
  for (const [date, dayMap] of trendBySourceMap.entries()) {
    for (const [source, vals] of dayMap.entries()) {
      trendBySource.push({ date, source, sessions: vals.sessions, users: vals.users });
    }
  }
  trendBySource.sort((a, b) => a.date.localeCompare(b.date));

  return {
    totalSessions: displayTotalSessions,
    totalUsers: displayTotalUsers,
    avgEngagementTime,
    bounceRate: avgBounceRate,
    engagementRate: avgEngagementRate,
    conversions: totalConversions,
    intentBreakdown,
    userJourney: {
      avgPagesPerSession,
      avgSessionDuration: avgEngagementTime,
      avgEngagementRate,
      topJourneys,
      interactionEvents,
      scrollDepth
    },
    sources,
    landingPages,
    trend,
    trendBySource
  };
}
