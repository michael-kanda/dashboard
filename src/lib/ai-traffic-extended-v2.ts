// src/lib/ai-traffic-extended-v2.ts
// Erweiterte KI-Traffic Analyse mit User-Journey und Intent-Kategorisierung
//
// Öffentlicher Einstiegspunkt. Die Implementierung liegt in src/lib/ai-traffic-v2/:
// - types.ts        Typen
// - intent.ts       Klassifizierer (Intent-Kategorien, detectIntent)
// - ga4-queries.ts  GA4-Repository (Auth, Request-Optionen, Rohabfragen, Totals)
// - aggregate.ts    Aggregator (Ergebnis zusammenbauen)

import { google } from 'googleapis';
import { buildAiTrafficDimensionFilter } from './ai-sources';
import type { AiTrafficExtendedData } from './ai-traffic-v2/types';
import {
  createAuth,
  getAiTrafficTotalsOnly,
  isGa4QuotaError,
  normalizeDateRange,
  runAiTrafficReports,
  TOTAL_GA4_BUDGET_MS,
} from './ai-traffic-v2/ga4-queries';
import { aggregateAiTrafficReports } from './ai-traffic-v2/aggregate';

export type {
  IntentCategory,
  PageIntent,
  UserJourneyStep,
  UserJourneyData,
  AiTrafficExtendedData,
} from './ai-traffic-v2/types';
export {
  INTENT_CATEGORIES,
  DEFAULT_INTENT,
  HOMEPAGE_INTENT,
  detectIntent,
} from './ai-traffic-v2/intent';
export { getAiTrafficTotalsOnly } from './ai-traffic-v2/ga4-queries';

// ============================================================================
// HAUPTFUNKTION
// ============================================================================

export async function getAiTrafficExtended(
  propertyId: string,
  startDate: string,
  endDate: string,
  deadline?: number
): Promise<AiTrafficExtendedData> {
  // Defensiv: niemals einen invertierten Range an GA4 schicken (sonst 400).
  ({ startDate, endDate } = normalizeDateRange(startDate, endDate));

  // Eigenes Budget, falls der Caller keins mitgibt (z.B. Direktaufruf).
  const reportDeadline = deadline ?? Date.now() + TOTAL_GA4_BUDGET_MS;

  const formattedPropertyId = propertyId.startsWith('properties/') 
    ? propertyId 
    : `properties/${propertyId}`;
    
  const auth = createAuth();
  const analytics = google.analyticsdata({ version: 'v1beta', auth });

  // Kombinierter KI-Traffic-Filter (offizielles GA4-Medium/Channel ODER
  // ergänzende Referrer-Domains) — zentral aus '@/lib/ai-sources'.
  const aiSourceFilter = buildAiTrafficDimensionFilter();

  try {
    // Kanonische Gesamtwerte ohne Dimensionen. totalUsers ist nicht additiv:
    // Eine Summe über Tage, Quellen oder Landingpages würde wiederkehrende
    // Nutzer mehrfach zählen.
    const currentTotals = await getAiTrafficTotalsOnly(
      propertyId,
      startDate,
      endDate,
      reportDeadline
    );

    const reports = await runAiTrafficReports(
      analytics,
      formattedPropertyId,
      startDate,
      endDate,
      reportDeadline,
      aiSourceFilter
    );

    return aggregateAiTrafficReports(reports, currentTotals);

  } catch (error) {
    console.error('[AI Traffic Extended V2] Fehler:', error instanceof Error ? error.message : error);
    throw error;
  }
}

// ============================================================================
// MIT VERGLEICHSZEITRAUM
// ============================================================================

export async function getAiTrafficExtendedWithComparison(
  propertyId: string,
  currentStart: string,
  currentEnd: string,
  previousStart: string,
  previousEnd: string
): Promise<AiTrafficExtendedData> {
  
  // Defensiv: beide Ranges normalisieren, bevor sie weitergereicht werden.
  ({ startDate: currentStart, endDate: currentEnd } = normalizeDateRange(currentStart, currentEnd));
  ({ startDate: previousStart, endDate: previousEnd } = normalizeDateRange(previousStart, previousEnd));

  // EIN gemeinsames Zeitbudget für Hauptanalyse UND Vergleichs-Totals,
  // abgestimmt auf maxDuration=60 der API-Route.
  const deadline = Date.now() + TOTAL_GA4_BUDGET_MS;

  // Vergleichs-Totals ZUERST: Das ist der billigste Call der gesamten Kette
  // (2 Metriken, KEINE Dimensionen, typisch 1–3 s) und liefert das Headline-
  // Veränderungs-Prozent — wichtiger als die optionalen Widgets. Lief er als
  // LETZTER, bekam er nur den Budget-Rest und starb bei langsamen Properties
  // regelmäßig im Timeout ("Vergleichs-Totals fehlgeschlagen").
  //
  // Vom Vergleichszeitraum werden NUR totalSessions/totalUsers verwendet.
  // Früher lief hier die komplette getAiTrafficExtended-Analyse mit 7 Reports —
  // 6 davon wurden berechnet und sofort weggeworfen. Jetzt: EIN Totals-Report.
  //
  // DEGRADATION: Schlägt der Totals-Report transient fehl (Timeout etc.),
  // liefern wir die aktuellen Daten OHNE Veränderungs-Prozente aus. Quota-
  // Fehler werden hochgereicht, damit die Route den Cooldown setzen kann.
  let previousTotals: { totalSessions: number; totalUsers: number } | null = null;
  try {
    previousTotals = await getAiTrafficTotalsOnly(propertyId, previousStart, previousEnd, deadline);
  } catch (error) {
    if (isGa4QuotaError(error)) throw error;
    console.warn(
      '[AI Traffic V2] Vergleichs-Totals fehlgeschlagen — liefere Daten ohne Veränderungs-Prozente:',
      error instanceof Error ? error.message : error
    );
  }

  // Aktueller Zeitraum: vollständige Analyse mit kanonischem Totals-Report.
  const currentData = await getAiTrafficExtended(propertyId, currentStart, currentEnd, deadline);

  const calcChange = (current: number, previous: number): number => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

  if (!previousTotals) {
    return currentData;
  }

  return {
    ...currentData,
    totalSessionsChange: calcChange(currentData.totalSessions, previousTotals.totalSessions),
    totalUsersChange: calcChange(currentData.totalUsers, previousTotals.totalUsers)
  };
}
