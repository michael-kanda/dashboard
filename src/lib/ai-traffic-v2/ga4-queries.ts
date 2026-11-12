// src/lib/ai-traffic-v2/ga4-queries.ts
// GA4-Repository: Auth, Request-Optionen, Fehlerstrategie und die rohen
// runReport-Abfragen der KI-Traffic-Analyse (V2)

import { google, type analyticsdata_v1beta } from 'googleapis';
import { createGoogleAuth, GOOGLE_SCOPES } from '../google-auth';
import { buildAiTrafficDimensionFilter } from '../ai-sources';
import { GA4_KEY_EVENTS_METRIC } from '../ga4-metrics';
import { logger } from '@/lib/logger';
import { errorFields } from '@/lib/errors';

// ============================================================================
// HELPER FUNKTIONEN
// ============================================================================

export function createAuth() {
  return createGoogleAuth([GOOGLE_SCOPES.analytics]);
}

/**
 * Stellt sicher, dass startDate <= endDate ist.
 *
 * Hintergrund: Bei einer "Monat bis heute"-Logik wird startDate oft auf den
 * 1. des aktuellen Monats und endDate auf "gestern" gesetzt (GA4-Daten für
 * heute sind noch unvollständig). Am 1. eines Monats liegt der Monatsanfang
 * dann NACH "gestern" -> der Range kippt und GA4 wirft einen 400er
 * ("start_date must be less than or equal to end_date").
 *
 * Diese Funktion fängt das defensiv ab: liegt start nach end, wird start auf
 * end geklemmt (gültiger 1-Tages-Range) statt die ganze Anfrage abstürzen zu
 * lassen. Die eigentliche Ursache sollte trotzdem in der aufrufenden
 * Date-Range-Berechnung (API-Route) behoben werden.
 */
export function normalizeDateRange(startDate: string, endDate: string): { startDate: string; endDate: string } {
  if (startDate > endDate) {
    console.warn(
      `[AI Traffic V2] Ungültiger Date-Range erkannt (start ${startDate} > end ${endDate}). ` +
      `startDate wird auf ${endDate} geklemmt. Bitte Date-Range-Berechnung im Caller prüfen.`
    );
    return { startDate: endDate, endDate };
  }
  return { startDate, endDate };
}

// ============================================================================
// GA4-REQUEST-OPTIONS & FEHLERBEHANDLUNG
// ============================================================================

// Sichere Retry-Konfiguration für GA4-Calls.
//
// WICHTIG: Der gaxios-Default retriet u.a. 500–599. Jeder Retry, der erneut
// einen 500/503 bekommt, verbrennt aber ein Token der sehr kleinen Quota
// "Server Errors Per Project Per Property Per Hour" (Standard: nur 10/Stunde).
// Ein einzelner hartnäckiger 5xx-Call konnte so bis zu 4 Tokens fressen und das
// Budget binnen ein, zwei Dashboard-Loads sperren (429 RESOURCE_EXHAUSTED).
//
// Deshalb: KEINE 5xx und KEIN 429 mehr automatisch wiederholen. Nur echte
// Timeouts/Netzwerkfehler (noResponseRetries) werden retried.
//
// TIMEOUT-HÄRTUNG:
// Irgendwo global (googleapis/gaxios) waren 20s Timeout gesetzt — zu knapp für
// die schweren Reports (13 OR-Filter, bis 24 Monate). Folge: AbortSignal-Abbruch
// ("The operation was aborted."), den gaxios NICHT retried (abgebrochene
// Requests werden nie wiederholt). Wir setzen das Timeout deshalb explizit pro
// Request — Request-Optionen überschreiben die globale Konfiguration.
// 60 s pro Request: Bei großen Properties (beobachtet: 337078709) braucht der
// Hauptreport mit dem 14-Expression-OR-Filter über 6+ Monate real 30–50 s.
const GA4_TIMEOUT_MS = 60_000;
// Gesamtbudget für ALLE GA4-Calls eines Dashboard-Loads. Muss DEUTLICH unter
// der maxDuration der API-Route liegen (jetzt 120 s in route.ts): Auth,
// Postgres und Serialisierung brauchen ebenfalls Zeit. Das Budget greift nur
// noch beim ERSTAUFRUF ohne Cache — danach liefert die Route per
// Stale-While-Revalidate sofort aus und refresht im Hintergrund. Beobachtet:
// Vergleichs-Totals ~30 s + Hauptreport ~30–50 s bei großen Properties; mit
// 42 s Budget bekam der Hauptreport nur ~11 s und starb (timeout: 11190).
export const TOTAL_GA4_BUDGET_MS = 100_000;
// Unter diesem Restbudget werden optionale Reports übersprungen statt gestartet.
const OPTIONAL_REPORT_MIN_BUDGET_MS = 5_000;

const GA4_REQUEST_OPTIONS = {
  timeout: GA4_TIMEOUT_MS,
  retryConfig: {
    retry: 2,
    httpMethodsToRetry: ['POST'],
    statusCodesToRetry: [[408, 408]],
    noResponseRetries: 2,
  },
};

/** Erkennt GA4-Quota-/Server-Error-Fehler (429 / RESOURCE_EXHAUSTED). */
export function isGa4QuotaError(error: unknown): boolean {
  const e = errorFields(error);
  const status = e?.status || e?.code || e?.response?.status;
  const message = (e?.cause?.message || e?.message || String(error)).toLowerCase();
  return status === 429 || message.includes('quota') || message.includes('resource_exhausted');
}

/**
 * Führt einen runReport aus und kapselt die Fehlerstrategie:
 * - Quota-/Server-Error-Fehler werden IMMER hochgereicht. Weiterzumachen würde
 *   nur weitere Server-Error-Tokens verbrennen; die API-Route setzt darauf den
 *   Cooldown und liefert ggf. gecachte Daten aus.
 * - Bei `optional: true` werden alle ANDEREN Fehler abgefangen und mit leeren
 *   Rows weitergereicht, damit ein einzelner transienter Report-Fehler nicht
 *   das gesamte Dashboard abreißt (Graceful Degradation).
 * - Pflicht-Reports (optional: false) reichen jeden Fehler hoch.
 * - `deadline` (ms epoch): Gesamt-Zeitbudget. Optionale Reports werden bei
 *   erschöpftem Budget gar nicht erst gestartet (leere Rows), und das
 *   Request-Timeout wird auf das Restbudget geklemmt. So läuft die Lambda
 *   nicht in die maxDuration der Route.
 */
async function safeRunReport(
  analytics: analyticsdata_v1beta.Analyticsdata,
  property: string,
  requestBody: analyticsdata_v1beta.Schema$RunReportRequest,
  { optional = false, deadline, label = 'ga4-report' }: { optional?: boolean; deadline?: number; label?: string } = {}
): Promise<{ data: { rows?: analyticsdata_v1beta.Schema$Row[] | null } }> {
  const startedAt = Date.now();
  const remainingMs = deadline ? deadline - Date.now() : GA4_TIMEOUT_MS;

  if (optional && remainingMs < OPTIONAL_REPORT_MIN_BUDGET_MS) {
    console.warn(`[AI Traffic V2] Zeitbudget erschöpft — optionaler Report übersprungen: ${label}`);
    return { data: { rows: [] } };
  }

  const timeout = Math.max(
    OPTIONAL_REPORT_MIN_BUDGET_MS,
    Math.min(GA4_TIMEOUT_MS, remainingMs)
  );

  try {
    const response = await analytics.properties.runReport(
      { property, requestBody },
      { ...GA4_REQUEST_OPTIONS, timeout }
    );
    logger.debug(
      `[AI Traffic V2] Report OK ${label}: ${Date.now() - startedAt}ms, rows=${response.data.rows?.length || 0}`
    );
    return response;
  } catch (error) {
    const dimensions = (requestBody.dimensions || []).map((item) => item.name).join(',') || '-';
    const metrics = (requestBody.metrics || []).map((item) => item.name).join(',') || '-';
    if (isGa4QuotaError(error)) throw error;
    console.warn(
      `[AI Traffic V2] Report Fehler ${label}: ${Date.now() - startedAt}ms, ` +
      `timeout=${timeout}ms, dimensions=${dimensions}, metrics=${metrics}, ` +
      `${error instanceof Error ? error.message : error}`
    );
    if (optional) {
      console.warn(
        `[AI Traffic V2] Optionaler Report fehlgeschlagen, fahre mit leeren Daten fort (${label}):`,
        error instanceof Error ? error.message : error
      );
      return { data: { rows: [] } };
    }
    throw error;
  }
}

// ============================================================================
// ROHABFRAGEN DER HAUPTANALYSE
// ============================================================================

type Ga4Analytics = Parameters<typeof safeRunReport>[0];
type Ga4ReportResponse = Awaited<ReturnType<typeof safeRunReport>>;

export interface AiTrafficReportResponses {
  mainResponse: Ga4ReportResponse;
  trendResponse: Ga4ReportResponse;
  journeyResponse: Ga4ReportResponse;
  eventsResponse: Ga4ReportResponse;
  scrollResponse: Ga4ReportResponse;
  trendBySourceResponse: Ga4ReportResponse;
  sourceTotalsResponse: Ga4ReportResponse;
}

/**
 * Führt alle dimensionierten GA4-Reports der Hauptanalyse aus (Pflicht-Report
 * plus optionale Reports paarweise parallel) und liefert die Roh-Responses.
 */
export async function runAiTrafficReports(
  analytics: Ga4Analytics,
  formattedPropertyId: string,
  startDate: string,
  endDate: string,
  reportDeadline: number,
  aiSourceFilter: ReturnType<typeof buildAiTrafficDimensionFilter>
): Promise<AiTrafficReportResponses> {
  // GA4 limitiert gleichzeitige Requests pro Property hart. Deshalb bewusst
  // sequenziell ausführen statt Promise.all, sonst kommt "Exhausted concurrent
  // requests quota" bei großen Dashboards oder parallelen Widgets.

  // Pflicht-Report: ohne diese Daten ist das Dashboard leer -> Fehler hoch.
  const mainResponse = await safeRunReport(analytics, formattedPropertyId, {
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
      { name: GA4_KEY_EVENTS_METRIC },
      { name: 'screenPageViewsPerSession' },
      { name: 'engagementRate' }
    ],
    dimensionFilter: aiSourceFilter,
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    limit: '1000'
  }, { deadline: reportDeadline, label: 'ai-main-source-landingpage-quality' });

  // Ab hier alles optional: ein transienter Fehler degradiert nur dieses eine
  // Modul (leere Rows), reißt aber nicht das ganze Dashboard ab. Quota-Fehler
  // werden in safeRunReport trotzdem hochgereicht.
  //
  // PAARWEISE parallel (2 gleichzeitig): GA4 erlaubt 10 Concurrent-Requests
  // pro Property — volles Promise.all über alle 6 plus parallele Widgets war
  // zu viel ("Exhausted concurrent requests quota"), strikt sequenziell war
  // zu langsam (Wall-Time, "Laden dauert ewig"). 2er-Paare halbieren die
  // Dauer der optionalen Phase bei minimalem Concurrency-Fußabdruck.
  const [trendResponse, journeyResponse] = await Promise.all([
    safeRunReport(analytics, formattedPropertyId, {
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'date' }],
      metrics: [
        { name: 'sessions' },
        { name: 'totalUsers' }
      ],
      dimensionFilter: aiSourceFilter,
      orderBys: [{ dimension: { dimensionName: 'date' } }]
    }, { optional: true, deadline: reportDeadline, label: 'ai-trend-date' }),
    safeRunReport(analytics, formattedPropertyId, {
      dateRanges: [{ startDate, endDate }],
      dimensions: [
        { name: 'landingPagePlusQueryString' },
        { name: 'pagePath' }
      ],
      metrics: [
        { name: 'sessions' },
        { name: 'screenPageViews' }
      ],
      dimensionFilter: aiSourceFilter,
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit: '500'
    }, { optional: true, deadline: reportDeadline, label: 'ai-journey-landingpage-nextpage' })
  ]);

  const [eventsResponse, scrollResponse] = await Promise.all([
    safeRunReport(analytics, formattedPropertyId, {
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'eventName' }],
      metrics: [{ name: 'eventCount' }],
      dimensionFilter: {
        andGroup: {
          expressions: [
            aiSourceFilter,
            {
              filter: {
                fieldName: 'eventName',
                inListFilter: {
                  values: [
                    'click', 'file_download', 'form_submit', 'form_start',
                    'video_start', 'video_progress', 'video_complete',
                    'scroll', 'outbound_click', 'purchase', 'add_to_cart',
                    'begin_checkout', 'generate_lead', 'sign_up', 'login'
                  ]
                }
              }
            }
          ]
        }
      },
      orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }]
    }, { optional: true, deadline: reportDeadline, label: 'ai-events' }),
    safeRunReport(analytics, formattedPropertyId, {
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'percentScrolled' }],
      metrics: [{ name: 'eventCount' }],
      dimensionFilter: {
        andGroup: {
          expressions: [
            aiSourceFilter,
            {
              filter: {
                fieldName: 'eventName',
                stringFilter: {
                  matchType: 'EXACT' as const,
                  value: 'scroll'
                }
              }
            }
          ]
        }
      }
    }, { optional: true, deadline: reportDeadline, label: 'ai-scroll-depth' })
  ]);

  // Pro-Quelle-Totals OHNE Landingpage-Dimension (zweiter Report im Paar).
  const [trendBySourceResponse, sourceTotalsResponse] = await Promise.all([
    safeRunReport(analytics, formattedPropertyId, {
      dateRanges: [{ startDate, endDate }],
      dimensions: [
        { name: 'date' },
        { name: 'sessionSource' }
      ],
      metrics: [
        { name: 'sessions' },
        { name: 'totalUsers' }
      ],
      dimensionFilter: aiSourceFilter,
      orderBys: [{ dimension: { dimensionName: 'date' } }],
      limit: '10000'
    }, { optional: true, deadline: reportDeadline, label: 'ai-trend-by-source-date' }),
    safeRunReport(analytics, formattedPropertyId, {
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'sessionSource' }],
      metrics: [
        { name: 'sessions' },
        { name: 'totalUsers' },
        { name: GA4_KEY_EVENTS_METRIC }
      ],
      dimensionFilter: aiSourceFilter,
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit: '1000'
    }, { optional: true, deadline: reportDeadline, label: 'ai-source-totals' })
  ]);

  return {
    mainResponse,
    trendResponse,
    journeyResponse,
    eventsResponse,
    scrollResponse,
    trendBySourceResponse,
    sourceTotalsResponse,
  };
}

// ============================================================================
// SCHLANKER TOTALS-REPORT (für Vergleichszeitraum)
// ============================================================================

/**
 * Liefert ausschließlich die KI-Traffic-Gesamtwerte (Sessions, Users) für einen
 * Zeitraum über EINEN einzigen runReport ohne Dimensionen.
 *
 * Diese Abfrage ist für aktuelle und Vergleichszeiträume die kanonische Quelle:
 * Nutzerzahlen dürfen nicht über dimensionierte Zeilen summiert werden.
 */
export async function getAiTrafficTotalsOnly(
  propertyId: string,
  startDate: string,
  endDate: string,
  deadline?: number
): Promise<{ totalSessions: number; totalUsers: number }> {
  ({ startDate, endDate } = normalizeDateRange(startDate, endDate));

  const formattedPropertyId = propertyId.startsWith('properties/')
    ? propertyId
    : `properties/${propertyId}`;

  const auth = createAuth();
  const analytics = google.analyticsdata({ version: 'v1beta', auth });
  const aiSourceFilter = buildAiTrafficDimensionFilter();

  // Pflicht-Report (nicht optional): bei Quota-Fehler hochreichen, damit die
  // Route den Cooldown setzen kann. Transiente Fehler fängt der Caller ab
  // (Degradation: Daten ohne Veränderungs-Prozente).
  const response = await safeRunReport(analytics, formattedPropertyId, {
    dateRanges: [{ startDate, endDate }],
    metrics: [
      { name: 'sessions' },
      { name: 'totalUsers' }
    ],
    dimensionFilter: aiSourceFilter
  }, { deadline, label: 'ai-totals' });

  const row = response.data.rows?.[0];
  return {
    totalSessions: parseInt(row?.metricValues?.[0]?.value || '0', 10),
    totalUsers: parseInt(row?.metricValues?.[1]?.value || '0', 10)
  };
}
