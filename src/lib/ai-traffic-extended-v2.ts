// src/lib/ai-traffic-extended-v2.ts
// Erweiterte KI-Traffic Analyse mit User-Journey und Intent-Kategorisierung

import { google } from 'googleapis';
import { JWT } from 'google-auth-library';

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

function normalizeSource(source: string): string {
  const lower = source.toLowerCase();
  
  if (lower.includes('chatgpt') || lower.includes('openai')) return 'chatgpt.com';
  if (lower.includes('claude') || lower.includes('anthropic')) return 'claude.ai';
  if (lower.includes('perplexity')) return 'perplexity.ai';
  if (lower.includes('gemini') || lower.includes('bard')) return 'gemini.google.com';
  if (lower.includes('copilot') || lower.includes('bing')) return 'copilot.microsoft.com';
  if (lower.includes('you.com')) return 'you.com';
  if (lower.includes('poe')) return 'poe.com';
  if (lower.includes('character')) return 'character.ai';
  
  return source;
}

const AI_SOURCES = [
  'chatgpt.com', 'chat.openai.com', 'openai.com',
  'claude.ai', 'anthropic.com',
  'gemini.google.com', 'bard.google.com',
  'perplexity.ai',
  'bing.com/chat', 'copilot.microsoft.com',
  'you.com', 'poe.com', 'character.ai'
];

// ============================================================================
// HAUPTFUNKTION
// ============================================================================

export async function getAiTrafficExtended(
  propertyId: string,
  startDate: string,
  endDate: string
): Promise<AiTrafficExtendedData> {
  // Defensiv: niemals einen invertierten Range an GA4 schicken (sonst 400).
  ({ startDate, endDate } = normalizeDateRange(startDate, endDate));

  const formattedPropertyId = propertyId.startsWith('properties/') 
    ? propertyId 
    : `properties/${propertyId}`;
    
  const auth = createAuth();
  const analytics = google.analyticsdata({ version: 'v1beta', auth });

  // AI Source Filter für alle Requests
  const aiSourceFilter = {
    orGroup: {
      expressions: AI_SOURCES.map(source => ({
        filter: {
          fieldName: 'sessionSource',
          stringFilter: {
            matchType: 'CONTAINS' as const,
            value: source,
            caseSensitive: false
          }
        }
      }))
    }
  };

  try {
    // =========================================================================
    // PARALLEL API CALLS
    // =========================================================================
    
    const [
      mainResponse,
      trendResponse,
      journeyResponse,
      eventsResponse,
      scrollResponse,
      trendBySourceResponse
    ] = await Promise.all([
      
      // 1. Hauptdaten: Source + Landingpage + Metriken (inkl. engagementRate)
      analytics.properties.runReport({
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
            { name: 'conversions' },
            { name: 'screenPageViewsPerSession' },
            { name: 'engagementRate' }
          ],
          dimensionFilter: aiSourceFilter,
          orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
          limit: '1000'
        },
      }),

      // 2. Trend-Daten (täglich)
      analytics.properties.runReport({
        property: formattedPropertyId,
        requestBody: {
          dateRanges: [{ startDate, endDate }],
          dimensions: [{ name: 'date' }],
          metrics: [
            { name: 'sessions' },
            { name: 'totalUsers' }
          ],
          dimensionFilter: aiSourceFilter,
          orderBys: [{ dimension: { dimensionName: 'date' } }]
        },
      }),

      // 3. User Journey: Landingpage → nächste Seite
      analytics.properties.runReport({
        property: formattedPropertyId,
        requestBody: {
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
        },
      }),

      // 4. Interaktions-Events
      analytics.properties.runReport({
        property: formattedPropertyId,
        requestBody: {
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
        },
      }),

      // 5. Scroll-Tiefe
      analytics.properties.runReport({
        property: formattedPropertyId,
        requestBody: {
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
        },
      }).catch(() => ({ data: { rows: [] } })),

      // 6. Trend-Daten pro KI-Quelle (täglich × source)
      analytics.properties.runReport({
        property: formattedPropertyId,
        requestBody: {
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
        },
      }).catch(() => ({ data: { rows: [] } }))
    ]);

    // =========================================================================
    // DATEN VERARBEITEN
    // =========================================================================

    const mainRows = mainResponse.data.rows || [];
    const trendRows = trendResponse.data.rows || [];
    const journeyRows = journeyResponse.data.rows || [];
    const eventsRows = eventsResponse.data.rows || [];
    const scrollRows = scrollResponse.data.rows || [];
    const trendBySourceRows = trendBySourceResponse.data.rows || [];

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
    const sources = Array.from(sourceMap.entries())
      .map(([source, data]) => {
        const sortedPages = Array.from(data.pages.entries())
          .sort((a, b) => b[1].sessions - a[1].sessions);
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
        return {
          source,
          sessions: data.sessions,
          users: data.users,
          engagementRate: data.sessions > 0 ? (data.engagementRateWeighted / data.sessions) * 100 : 0,
          percentage: displayTotalSessions > 0 ? (data.sessions / displayTotalSessions) * 100 : 0,
          conversions: data.conversions,
          conversionRate: data.sessions > 0 ? (data.conversions / data.sessions) * 100 : 0,
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

  const [currentData, previousData] = await Promise.all([
    getAiTrafficExtended(propertyId, currentStart, currentEnd),
    getAiTrafficExtended(propertyId, previousStart, previousEnd)
  ]);

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
