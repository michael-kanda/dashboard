// src/lib/ai-traffic-extended-v2.ts
// Erweiterte KI-Traffic Analyse mit User-Journey und Intent-Kategorisierung

import { google } from 'googleapis';
import { JWT } from 'google-auth-library';
import { normalizeSource, buildAiTrafficDimensionFilter } from './ai-sources';

// ============================================================================
// TYPEN
// ============================================================================

export interface IntentCategory {
  key: string;
  label: string;
  icon: string; // Lucide Icon Name (z.B. 'book-open', 'shopping-cart')
  color: string;
  patterns: RegExp[];
}

export interface PageIntent {
  path: string;
  intent: IntentCategory;
  sessions: number;
  users: number;
  conversions: number;
  avgEngagementTime: number;
  engagementRate: number;
}

export interface UserJourneyStep {
  step: number;
  pagePath: string;
  sessions: number;
  dropoffRate: number;
}

export interface UserJourneyData {
  landingPage: string;
  totalSessions: number;
  avgPagesPerSession: number;
  avgSessionDuration: number;
  conversionRate: number;
  engagementRate: number;
  nextPages: Array<{
    path: string;
    sessions: number;
    percentage: number;
  }>;
  exitPages: Array<{
    path: string;
    sessions: number;
    percentage: number;
  }>;
  journeySteps: UserJourneyStep[];
}

export interface AiTrafficExtendedData {
  // Basis-Daten
  totalSessions: number;
  totalUsers: number;
  totalSessionsChange?: number;
  totalUsersChange?: number;
  avgEngagementTime: number;
  bounceRate: number;
  engagementRate: number; // Globale Interaktionsrate
  conversions: number;
  
  // Intent-Analyse
  intentBreakdown: Array<{
    intent: IntentCategory;
    sessions: number;
    users: number;
    conversions: number;
    conversionRate: number;
    avgEngagementTime: number;
    engagementRate: number;
    percentage: number;
    topPages: Array<{
      path: string;
      sessions: number;
    }>;
  }>;
  
  // User-Journey Daten
  userJourney: {
    avgPagesPerSession: number;
    avgSessionDuration: number;
    avgEngagementRate: number;
    topJourneys: UserJourneyData[];
    interactionEvents: Array<{
      eventName: string;
      count: number;
      percentage: number;
    }>;
    scrollDepth: {
      reached25: number;
      reached50: number;
      reached75: number;
      reached100: number;
    };
  };
  
  // Quellen-Daten
  sources: Array<{
    source: string;
    sessions: number;
    users: number;
    engagementRate: number;
    percentage: number;
    conversions: number;
    conversionRate: number; // in % (conversions / sessions * 100)
    topPages: Array<{ path: string; sessions: number; conversions: number }>;
    topLandingPage?: { path: string; sessions: number; conversions: number };
  }>;
  
  // Landingpages
  landingPages: Array<{
    path: string;
    intent: IntentCategory;
    sessions: number;
    users: number;
    avgEngagementTime: number;
    bounceRate: number;
    engagementRate: number;
    conversions: number;
    sources: Array<{ source: string; sessions: number; users: number }>;
  }>;
  
  trend: Array<{ date: string; sessions: number; users: number }>;

  // Trend pro KI-Quelle (long format) — für Multi-Line-Chart im Frontend
  trendBySource: Array<{ date: string; source: string; sessions: number; users: number }>;
}

// ============================================================================
// INTENT-KATEGORIEN (mit Lucide Icon-Namen statt Emojis)
// ============================================================================

export const INTENT_CATEGORIES: IntentCategory[] = [
  {
    key: 'informational',
    label: 'Informational',
    icon: 'book-open',
    color: '#3b82f6',
    patterns: [
      /\/blog\//i,
      /\/ratgeber\//i,
      /\/wissen\//i,
      /\/magazin\//i,
      /\/artikel\//i,
      /\/news\//i,
      /\/tipps\//i,
      /\/guide\//i,
      /\/tutorial\//i,
      /\/how-to\//i,
      /\/was-ist\//i,
      /\/erklaerung\//i,
      /\/faq/i,
      /\/glossar/i,
      /\/lexikon/i,
    ]
  },
  {
    key: 'transactional',
    label: 'Transaktional',
    icon: 'shopping-cart',
    color: '#10b981',
    patterns: [
      /\/preise/i,
      /\/pricing/i,
      /\/kosten/i,
      /\/angebot/i,
      /\/tarife/i,
      /\/pakete/i,
      /\/buchen/i,
      /\/bestellen/i,
      /\/kaufen/i,
      /\/shop/i,
      /\/warenkorb/i,
      /\/checkout/i,
      /\/produkt\//i,
      /\/products\//i,
    ]
  },
  {
    key: 'lead',
    label: 'Lead / Anfrage',
    icon: 'phone',
    color: '#f59e0b',
    patterns: [
      /\/kontakt/i,
      /\/contact/i,
      /\/anfrage/i,
      /\/termin/i,
      /\/beratung/i,
      /\/demo/i,
      /\/callback/i,
      /\/rueckruf/i,
      /\/formular/i,
      /\/anfragen/i,
      /\/get-started/i,
      /\/kostenlos-testen/i,
      /\/free-trial/i,
    ]
  },
  {
    key: 'navigational',
    label: 'Service / Leistung',
    icon: 'compass',
    color: '#8b5cf6',
    patterns: [
      /\/leistungen/i,
      /\/services/i,
      /\/loesungen/i,
      /\/solutions/i,
      /\/angebot\//i,
      /\/was-wir-tun/i,
      /\/bereiche/i,
      /\/branchen/i,
      /\/fuer-/i,
      /\/for-/i,
    ]
  },
  {
    key: 'brand',
    label: 'Brand / Vertrauen',
    icon: 'building-2',
    color: '#ec4899',
    patterns: [
      /\/ueber-uns/i,
      /\/about/i,
      /\/team/i,
      /\/referenzen/i,
      /\/kunden/i,
      /\/portfolio/i,
      /\/case-stud/i,
      /\/erfolge/i,
      /\/partner/i,
      /\/karriere/i,
      /\/jobs/i,
      /\/presse/i,
      /\/awards/i,
    ]
  },
  {
    key: 'legal',
    label: 'Rechtliches',
    icon: 'scale',
    color: '#6b7280',
    patterns: [
      /\/impressum/i,
      /\/datenschutz/i,
      /\/privacy/i,
      /\/agb/i,
      /\/terms/i,
      /\/legal/i,
      /\/widerruf/i,
      /\/cookie/i,
    ]
  }
];

// Default-Intent für nicht kategorisierbare Seiten
export const DEFAULT_INTENT: IntentCategory = {
  key: 'other',
  label: 'Sonstige',
  icon: 'file-text',
  color: '#9ca3af',
  patterns: []
};

// Homepage Intent
export const HOMEPAGE_INTENT: IntentCategory = {
  key: 'homepage',
  label: 'Homepage',
  icon: 'home',
  color: '#0ea5e9',
  patterns: []
};

// ============================================================================
// HELPER FUNKTIONEN
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

/**
 * Ermittelt die Intent-Kategorie für einen Pfad
 */
export function detectIntent(path: string): IntentCategory {
  if (path === '/' || path === '') {
    return HOMEPAGE_INTENT;
  }

  for (const category of INTENT_CATEGORIES) {
    for (const pattern of category.patterns) {
      if (pattern.test(path)) {
        return category;
      }
    }
  }
  
  return DEFAULT_INTENT;
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
function normalizeDateRange(startDate: string, endDate: string): { startDate: string; endDate: string } {
  if (startDate > endDate) {
    console.warn(
      `[AI Traffic V2] Ungültiger Date-Range erkannt (start ${startDate} > end ${endDate}). ` +
      `startDate wird auf ${endDate} geklemmt. Bitte Date-Range-Berechnung im Caller prüfen.`
    );
    return { startDate: endDate, endDate };
  }
  return { startDate, endDate };
}

function parseGa4Date(dateString: string): string {
  const year = dateString.substring(0, 4);
  const month = dateString.substring(4, 6);
  const day = dateString.substring(6, 8);
  return `${year}-${month}-${day}`;
}

// normalizeSource, AI_SOURCES und der KI-Traffic-Filter kommen jetzt zentral
// aus '@/lib/ai-sources' (siehe Import oben).

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
const GA4_TIMEOUT_MS = 45_000;
// Gesamtbudget für ALLE GA4-Calls eines Dashboard-Loads. Muss DEUTLICH unter
// der maxDuration der API-Route (60s) liegen: Auth, 2 Postgres-Queries,
// Cache-Write und JSON-Serialisierung brauchen ebenfalls Zeit. 42s GA4-Budget
// lässt ~18s Headroom — sonst droht der Vercel Runtime Timeout (60s), der die
// ganze Function killt statt nur einzelne Reports zu degradieren.
const TOTAL_GA4_BUDGET_MS = 42_000;
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
function isGa4QuotaError(error: unknown): boolean {
  const e = error as any;
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
  analytics: any,
  property: string,
  requestBody: any,
  { optional = false, deadline }: { optional?: boolean; deadline?: number } = {}
): Promise<{ data: { rows?: any[] } }> {
  const remainingMs = deadline ? deadline - Date.now() : GA4_TIMEOUT_MS;

  if (optional && remainingMs < OPTIONAL_REPORT_MIN_BUDGET_MS) {
    console.warn('[AI Traffic V2] Zeitbudget erschöpft — optionaler Report übersprungen.');
    return { data: { rows: [] } };
  }

  const timeout = Math.max(
    OPTIONAL_REPORT_MIN_BUDGET_MS,
    Math.min(GA4_TIMEOUT_MS, remainingMs)
  );

  try {
    return await analytics.properties.runReport(
      { property, requestBody },
      { ...GA4_REQUEST_OPTIONS, timeout } as any
    );
  } catch (error) {
    if (isGa4QuotaError(error)) throw error;
    if (optional) {
      console.warn(
        '[AI Traffic V2] Optionaler Report fehlgeschlagen, fahre mit leeren Daten fort:',
        error instanceof Error ? error.message : error
      );
      return { data: { rows: [] } };
    }
    throw error;
  }
}

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

  // Kombinierter KI-Traffic-Filter (Referrer-Domains ODER nativer GA4
  // "AI Assistant"-Channel) — zentral aus '@/lib/ai-sources'.
  const aiSourceFilter = buildAiTrafficDimensionFilter();

  try {
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
        { name: 'conversions' },
        { name: 'screenPageViewsPerSession' },
        { name: 'engagementRate' }
      ],
      dimensionFilter: aiSourceFilter,
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit: '1000'
    }, { deadline: reportDeadline });

    // Ab hier alles optional: ein transienter Fehler degradiert nur dieses eine
    // Modul (leere Rows), reißt aber nicht das ganze Dashboard ab. Quota-Fehler
    // werden in safeRunReport trotzdem hochgereicht.
    const trendResponse = await safeRunReport(analytics, formattedPropertyId, {
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'date' }],
      metrics: [
        { name: 'sessions' },
        { name: 'totalUsers' }
      ],
      dimensionFilter: aiSourceFilter,
      orderBys: [{ dimension: { dimensionName: 'date' } }]
    }, { optional: true, deadline: reportDeadline });

    const journeyResponse = await safeRunReport(analytics, formattedPropertyId, {
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
    }, { optional: true, deadline: reportDeadline });

    const eventsResponse = await safeRunReport(analytics, formattedPropertyId, {
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
    }, { optional: true, deadline: reportDeadline });

    const scrollResponse = await safeRunReport(analytics, formattedPropertyId, {
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
    }, { optional: true, deadline: reportDeadline });

    const trendBySourceResponse = await safeRunReport(analytics, formattedPropertyId, {
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
    }, { optional: true, deadline: reportDeadline });

    // Pro-Quelle-Totals OHNE Landingpage-Dimension.
    const sourceTotalsResponse = await safeRunReport(analytics, formattedPropertyId, {
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'sessionSource' }],
      metrics: [
        { name: 'sessions' },
        { name: 'totalUsers' },
        { name: 'conversions' }
      ],
      dimensionFilter: aiSourceFilter,
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit: '1000'
    }, { optional: true, deadline: reportDeadline });

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
      const conversions = parseInt(row.metricValues?.[2]?.value || '0', 10);
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
    let totalUsers = 0;
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
      const conversions = parseInt(row.metricValues?.[4]?.value || '0', 10);
      const pagesPerSession = parseFloat(row.metricValues?.[5]?.value || '0');
      const engagementRate = parseFloat(row.metricValues?.[6]?.value || '0');

      // Totals
      totalSessions += sessions;
      totalUsers += users;
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

    const trendBySourceTotalSessions = trendBySourceRows.reduce((sum, row) =>
      sum + parseInt(row.metricValues?.[0]?.value || '0', 10), 0);
    const trendBySourceTotalUsers = trendBySourceRows.reduce((sum, row) =>
      sum + parseInt(row.metricValues?.[1]?.value || '0', 10), 0);
    const displayTotalSessions = trendBySourceTotalSessions || totalSessions;
    const displayTotalUsers = trendBySourceTotalUsers || totalUsers;

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

  } catch (error) {
    console.error('[AI Traffic Extended V2] Fehler:', error);
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

  // Aktueller Zeitraum: vollständige Analyse (7 Reports).
  const currentData = await getAiTrafficExtended(propertyId, currentStart, currentEnd, deadline);

  // Vergleichszeitraum: vom previousData werden NUR totalSessions und totalUsers
  // verwendet (siehe calcChange unten). Früher lief hier die komplette
  // getAiTrafficExtended-Analyse mit 7 Reports — 6 davon wurden berechnet und
  // sofort weggeworfen. Das halbierte das GA4-Call-Budget grundlos und erhöhte
  // das Server-Error-Quota-Risiko massiv. Jetzt: EIN schlanker Totals-Report.
  //
  // DEGRADATION: Schlägt der Totals-Report transient fehl (Timeout etc.) oder
  // ist das Zeitbudget aufgebraucht, liefern wir die aktuellen Daten OHNE
  // Veränderungs-Prozente aus, statt den kompletten (teuren, bereits
  // erfolgreichen) Dashboard-Load wegzuwerfen. Quota-Fehler werden weiterhin
  // hochgereicht, damit die Route den Cooldown setzen kann.
  let previousTotals: { totalSessions: number; totalUsers: number } | null = null;
  if (deadline - Date.now() >= OPTIONAL_REPORT_MIN_BUDGET_MS) {
    try {
      previousTotals = await getAiTrafficTotalsOnly(propertyId, previousStart, previousEnd, deadline);
    } catch (error) {
      if (isGa4QuotaError(error)) throw error;
      console.warn(
        '[AI Traffic V2] Vergleichs-Totals fehlgeschlagen — liefere Daten ohne Veränderungs-Prozente:',
        error instanceof Error ? error.message : error
      );
    }
  } else {
    console.warn('[AI Traffic V2] Zeitbudget erschöpft — Vergleichs-Totals übersprungen.');
  }

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

// ============================================================================
// SCHLANKER TOTALS-REPORT (für Vergleichszeitraum)
// ============================================================================

/**
 * Liefert ausschließlich die KI-Traffic-Gesamtwerte (Sessions, Users) für einen
 * Zeitraum über EINEN einzigen runReport ohne Dimensionen.
 *
 * Gedacht für den Vergleichszeitraum, wo nur die Veränderungs-Prozente berechnet
 * werden. So fällt die Gesamtzahl der GA4-Calls pro Dashboard-Load von 14 auf 8.
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
  }, { deadline });

  const row = response.data.rows?.[0];
  return {
    totalSessions: parseInt(row?.metricValues?.[0]?.value || '0', 10),
    totalUsers: parseInt(row?.metricValues?.[1]?.value || '0', 10)
  };
}
