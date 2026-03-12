// src/app/api/ai/chat/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { sql } from '@vercel/postgres';
import { getOrFetchGoogleData } from '@/lib/google-data-loader';
import { streamTextSafe } from '@/lib/ai-config';
import { UserSchema, type User } from '@/lib/schemas';
import type { ProjectDashboardData } from '@/lib/dashboard-shared';
import { getAiTrafficDetailWithComparison } from '@/lib/ai-traffic-extended';
import Holidays from 'date-holidays';
import type { DailyWeather } from '@/lib/weather';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ============================================================================
// HELPER: Datumsberechnung
// ============================================================================

function getDateRanges(dateRange: string) {
  const end = new Date();
  end.setDate(end.getDate() - 1); // Gestern

  const start = new Date(end);
  let days = 30;
  if (dateRange === '7d') days = 7;
  if (dateRange === '3m') days = 90;
  if (dateRange === '6m') days = 180;
  if (dateRange === '12m') days = 365;
  start.setDate(end.getDate() - days);

  const startDateStr = start.toISOString().split('T')[0];
  const endDateStr = end.toISOString().split('T')[0];

  // Vorperiode
  const prevEnd = new Date(start);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevEnd.getDate() - days);

  return {
    current: { start: startDateStr, end: endDateStr },
    previous: { start: prevStart.toISOString().split('T')[0], end: prevEnd.toISOString().split('T')[0] },
    days
  };
}

// ============================================================================
// HELPER: Wetter- & Feiertags-Kontext
// ============================================================================

function buildWeatherContext(weatherData?: Record<string, DailyWeather>): string {
  if (!weatherData || Object.keys(weatherData).length === 0) return '';

  const entries = Object.entries(weatherData)
    .sort(([a], [b]) => a.localeCompare(b));

  if (entries.length === 0) return '';

  // Zusammenfassung statt alle Einzeltage (sonst wird der Kontext zu lang)
  const maxTemps = entries.map(([, w]) => w.tempMax);
  const minTemps = entries.map(([, w]) => w.tempMin);
  const avgTemp = (maxTemps.reduce((a, b) => a + b, 0) / maxTemps.length).toFixed(1);
  const minTemp = Math.min(...minTemps).toFixed(1);
  const maxTemp = Math.max(...maxTemps).toFixed(1);

  // Wetterbedingungs-Häufigkeit (nutzt label: "Sonnig", "Regen", etc.)
  const conditionCounts: Record<string, number> = {};
  entries.forEach(([, w]) => {
    conditionCounts[w.label] = (conditionCounts[w.label] || 0) + 1;
  });
  const topConditions = Object.entries(conditionCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([cond, count]) => `${cond} (${count} Tage)`)
    .join(', ');

  // Niederschlagstage zählen (icon: 'rain', 'snow', 'thunderstorm')
  const rainyDays = entries.filter(([, w]) =>
    w.icon === 'rain' || w.icon === 'snow' || w.icon === 'thunderstorm'
  ).length;

  // Auffällige Wettertage (Extremwerte)
  const extremeDays = entries.filter(([, w]) =>
    w.tempMax > 35 || w.tempMin < -5
  );

  let section = `
=== WETTERDATEN IM ZEITRAUM ===
Durchschnittstemperatur (Max): ${avgTemp}°C (Min: ${minTemp}°C, Max: ${maxTemp}°C)
Häufigste Bedingungen: ${topConditions}
Niederschlagstage: ${rainyDays} von ${entries.length} Tagen
`;

  if (extremeDays.length > 0) {
    section += `Extreme Wetterereignisse: ${extremeDays.map(([date, w]) => `${date}: ${w.tempMax}°C/${w.tempMin}°C ${w.label}`).join(', ')}\n`;
  }

  // Letzte 7 Tage Detail (für kurzfristige Korrelationen)
  const last7 = entries.slice(-7);
  if (last7.length > 0) {
    section += `\nLetzte 7 Tage (Detail):\n`;
    last7.forEach(([date, w]) => {
      section += `- ${date}: ${w.tempMax}°C/${w.tempMin}°C, ${w.label}\n`;
    });
  }

  section += `\nHINWEIS: Wetterdaten können Traffic-Schwankungen erklären (z.B. weniger Sessions bei extremem Wetter, mehr Indoor-Suchen bei Regen).\n`;

  return section;
}

function buildHolidayContext(dateRange: string, country: string = 'AT'): string {
  try {
    const hd = new Holidays(country);
    
    const end = new Date();
    end.setDate(end.getDate() - 1);
    const start = new Date(end);
    
    let days = 30;
    if (dateRange === '7d') days = 7;
    if (dateRange === '3m') days = 90;
    if (dateRange === '6m') days = 180;
    if (dateRange === '12m') days = 365;
    start.setDate(end.getDate() - days);

    // Feiertage im Zeitraum sammeln
    const holidays: { date: string; name: string; type: string }[] = [];
    
    // Alle Jahre im Bereich abdecken
    const years = new Set<number>();
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      years.add(d.getFullYear());
    }

    years.forEach(year => {
      const yearHolidays = hd.getHolidays(year);
      yearHolidays.forEach((h: any) => {
        const hDate = new Date(h.date);
        if (hDate >= start && hDate <= end) {
          holidays.push({
            date: hDate.toISOString().split('T')[0],
            name: h.name,
            type: h.type, // 'public', 'bank', 'school', 'optional'
          });
        }
      });
    });

    if (holidays.length === 0) return '';

    const publicHolidays = holidays.filter(h => h.type === 'public');
    const otherHolidays = holidays.filter(h => h.type !== 'public');

    let section = `\n=== FEIERTAGE IM ZEITRAUM (${country}) ===\n`;
    
    if (publicHolidays.length > 0) {
      section += `Gesetzliche Feiertage:\n`;
      publicHolidays.forEach(h => {
        section += `- ${h.date}: ${h.name}\n`;
      });
    }
    
    if (otherHolidays.length > 0) {
      section += `Weitere Feiertage/Events:\n`;
      otherHolidays.forEach(h => {
        section += `- ${h.date}: ${h.name} (${h.type})\n`;
      });
    }

    section += `\nHINWEIS: An Feiertagen sinkt typischerweise der B2B-Traffic, während B2C-Traffic je nach Branche steigen kann. Nutze diese Daten um Traffic-Einbrüche zu erklären.\n`;

    return section;
  } catch (e) {
    console.warn('[DataMax Chat] Feiertage nicht verfügbar:', e);
    return '';
  }
}

// ============================================================================
// KONTEXT-BUILDER (Erweitert mit AI Traffic Details)
// ============================================================================

function buildChatContext(
  data: ProjectDashboardData, 
  user: User, 
  dateRange: string,
  aiTrafficDetail?: any, // Extended AI Traffic Data
  country?: string // Land für Feiertage
): string {
  const kpis = data.kpis;
  const fmt = (val?: number) => val?.toLocaleString('de-DE') ?? '0';
  const pct = (val?: number) => val ? `${val > 0 ? '+' : ''}${val.toFixed(1)}%` : '0%';

  // Early return wenn keine KPIs vorhanden
  if (!kpis) {
    return `
PROJEKT: ${user.domain || 'Unbekannt'}
ZEITRAUM: ${dateRange}

Keine Daten verfügbar. Bitte stelle sicher, dass GA4 und GSC korrekt konfiguriert sind.
`.trim();
  }

  // Top Keywords (max 10)
  const topKeywords = data.topQueries?.slice(0, 10)
    .map(q => `"${q.query}" (Pos: ${q.position.toFixed(1)}, Klicks: ${q.clicks})`)
    .join('\n') || 'Keine Daten';

  // SEO-Chancen (Position 4-20)
  const seoChances = data.topQueries
    ?.filter(q => q.position >= 4 && q.position <= 20)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 5)
    .map(q => `"${q.query}" (Pos: ${q.position.toFixed(1)}, Impr: ${q.impressions})`)
    .join('\n') || 'Keine identifiziert';

  // Top Converting Pages
  const topPages = data.topConvertingPages
    ?.filter(p => !p.path.includes('danke') && !p.path.includes('thank'))
    .slice(0, 5)
    .map(p => `${p.path}: ${p.conversions} Conv. (${p.conversionRate}%)`)
    .join('\n') || 'Keine Daten';

  // Kanäle
  const channels = data.channelData?.slice(0, 5)
    .map(c => `${c.name}: ${fmt(c.value)} Sessions`)
    .join('\n') || 'Keine Daten';

  // =========================================================================
  // ✅ NEU: Erweiterte KI-Traffic Analyse
  // =========================================================================
  let aiTrafficSection = '';
  
  if (aiTrafficDetail && aiTrafficDetail.totalSessions > 0) {
    // KI-Quellen mit Details
    const aiSources = aiTrafficDetail.sources?.slice(0, 5)
      .map((s: any) => `- ${s.source}: ${s.sessions} Sessions (${s.percentage.toFixed(1)}%), Top-Seite: ${s.topPages?.[0]?.path || 'k.A.'}`)
      .join('\n') || 'Keine KI-Quellen';

    // Landingpages die von KI-Traffic profitieren
    const aiLandingPages = aiTrafficDetail.landingPages?.slice(0, 5)
      .map((p: any) => {
        const topSource = p.sources?.[0]?.source || 'unbekannt';
        return `- ${p.path}: ${p.sessions} Sessions (via ${topSource}), ${p.conversions} Conv., Bounce: ${p.bounceRate.toFixed(1)}%`;
      })
      .join('\n') || 'Keine Seiten';

    // Trend-Analyse
    let trendInfo = '';
    if (aiTrafficDetail.trend && aiTrafficDetail.trend.length >= 7) {
      const recentWeek = aiTrafficDetail.trend.slice(-7).reduce((sum: number, t: any) => sum + t.sessions, 0);
      const previousWeek = aiTrafficDetail.trend.slice(-14, -7).reduce((sum: number, t: any) => sum + t.sessions, 0);
      if (previousWeek > 0) {
        const change = ((recentWeek - previousWeek) / previousWeek * 100).toFixed(1);
        trendInfo = `Trend letzte 7 Tage: ${recentWeek} Sessions (${Number(change) >= 0 ? '+' : ''}${change}% vs Vorwoche)`;
      }
    }

    aiTrafficSection = `
=== KI-TRAFFIC DETAIL-ANALYSE ===
Gesamt: ${fmt(aiTrafficDetail.totalSessions)} Sessions von ${fmt(aiTrafficDetail.totalUsers)} Nutzern
Veraenderung: ${pct(aiTrafficDetail.totalSessionsChange)}
Durchschn. Engagement: ${aiTrafficDetail.avgEngagementTime?.toFixed(0) || '0'} Sekunden
Bounce-Rate: ${aiTrafficDetail.bounceRate?.toFixed(1) || '0'}%
Conversions durch KI-Traffic: ${aiTrafficDetail.conversions || 0}
${trendInfo}

KI-QUELLEN (woher kommen die Besucher?):
${aiSources}

TOP LANDINGPAGES (von KI empfohlen):
${aiLandingPages}

INTERPRETATION:
- ChatGPT/OpenAI: Nutzer haben ChatGPT gefragt und wurden hierher verwiesen
- Perplexity: KI-Suchmaschine hat diese Seite als Quelle zitiert
- Gemini/Bard: Google's KI hat auf diese Inhalte verwiesen
- Copilot: Microsoft's KI-Assistent hat hierher verlinkt

WICHTIG: Seiten mit hohem KI-Traffic und niedriger Bounce-Rate sind besonders wertvoll!
`;
  } else if (data.aiTraffic && data.aiTraffic.totalSessions > 0) {
    // Fallback auf Basis-Daten wenn Extended nicht verfügbar
    aiTrafficSection = `
=== KI-TRAFFIC (Basis) ===
Gesamt: ${fmt(data.aiTraffic.totalSessions)} Sessions von ${fmt(data.aiTraffic.totalUsers)} Nutzern
Top-Quellen: ${data.aiTraffic.topAiSources?.slice(0, 3).map(s => `${s.source} (${s.sessions})`).join(', ') || 'Keine'}
`;
  }

  // Wetter- und Feiertagskontext
  const weatherSection = buildWeatherContext(data.weatherData);
  const holidaySection = buildHolidayContext(dateRange, country || 'AT');

  return `
PROJEKT: ${user.domain || 'Unbekannt'}
ZEITRAUM: ${dateRange === '7d' ? 'Letzte 7 Tage' : dateRange === '30d' ? 'Letzte 30 Tage' : dateRange === '3m' ? 'Letzte 3 Monate' : dateRange === '6m' ? 'Letzte 6 Monate' : 'Letztes Jahr'}

=== HAUPT-KPIs ===
Nutzer: ${fmt(kpis.totalUsers?.value)} (${pct(kpis.totalUsers?.change)})
Sessions: ${fmt(kpis.sessions?.value)} (${pct(kpis.sessions?.change)})
Klicks (GSC): ${fmt(kpis.clicks?.value)} (${pct(kpis.clicks?.change)})
Impressionen: ${fmt(kpis.impressions?.value)} (${pct(kpis.impressions?.change)})
Conversions: ${fmt(kpis.conversions?.value)} (${pct(kpis.conversions?.change)})
Interaktionsrate: ${kpis.engagementRate?.value?.toFixed(1) ?? '0'}%
Bounce Rate: ${kpis.bounceRate?.value?.toFixed(1) ?? '0'}%
${aiTrafficSection}
=== TOP KEYWORDS ===
${topKeywords}

=== SEO-CHANCEN (Striking Distance) ===
${seoChances}

=== TOP CONVERTING PAGES ===
${topPages}

=== TRAFFIC-KANAELE ===
${channels}
${weatherSection}${holidaySection}`.trim();
}

// ============================================================================
// SUGGESTED QUESTIONS GENERATOR (Erweitert)
// ============================================================================

function generateSuggestedQuestions(data: ProjectDashboardData, aiTrafficDetail?: any, hasHolidays?: boolean): string[] {
  const questions: string[] = [];
  const kpis = data.kpis;

  // Basierend auf Daten-Anomalien
  if (kpis) {
    if (kpis.conversions?.change && kpis.conversions.change < -10) {
      questions.push('Warum sind meine Conversions gesunken?');
    }
    if (kpis.clicks?.change && kpis.clicks.change > 20) {
      questions.push('Was hat den Klick-Anstieg verursacht?');
    }
  }
  
  // ✅ NEU: KI-Traffic spezifische Fragen
  if (aiTrafficDetail && aiTrafficDetail.totalSessions > 50) {
    questions.push('Welche Seiten werden von KI-Systemen empfohlen?');
    
    if (aiTrafficDetail.conversions > 0) {
      questions.push('Wie viele Conversions kommen durch KI-Traffic?');
    }
    
    if (aiTrafficDetail.sources?.length > 1) {
      questions.push('Welche KI-Plattform bringt den besten Traffic?');
    }
  } else if (data.aiTraffic && data.aiTraffic.totalSessions > 50) {
    questions.push('Erklaere meinen KI-Traffic genauer');
  }
  
  if (data.topQueries?.some(q => q.position >= 4 && q.position <= 10)) {
    questions.push('Welche Keywords sollte ich priorisieren?');
  }

  // ✅ NEU: Wetter- & Feiertags-Fragen
  if (data.weatherData && Object.keys(data.weatherData).length > 0) {
    questions.push('Hat das Wetter meinen Traffic beeinflusst?');
  }
  if (hasHolidays) {
    questions.push('Wie haben Feiertage meinen Traffic beeinflusst?');
  }

  // Fallback-Fragen
  if (questions.length < 3) {
    questions.push('Wie kann ich meine Conversion-Rate verbessern?');
    questions.push('Was sind meine groessten SEO-Chancen?');
    questions.push('Gib mir 3 konkrete Empfehlungen');
  }

  return questions.slice(0, 4);
}

// ============================================================================
// POST HANDLER
// ============================================================================

export async function POST(req: NextRequest) {
  console.log('[DataMax Chat] POST Request erhalten');
  
  try {
    // 1. Auth
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
    }

    const body = await req.json();
    const { message, projectId, dateRange = '30d' } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Nachricht fehlt' }, { status: 400 });
    }

    // 2. Ziel-User bestimmen
    const userId = session.user.id;
    const userRole = session.user.role;
    let targetUserId = projectId || userId;

    // Admin-Check für fremde Projekte
    if (targetUserId !== userId && userRole === 'ADMIN') {
      const { rows: assignments } = await sql`
        SELECT 1 FROM project_assignments
        WHERE user_id::text = ${userId} AND project_id::text = ${targetUserId}
      `;
      if (assignments.length === 0) {
        return NextResponse.json({ error: 'Zugriff verweigert' }, { status: 403 });
      }
    }

    // 3. User-Daten laden
    const { rows } = await sql`SELECT * FROM users WHERE id::text = ${targetUserId}`;
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Projekt nicht gefunden' }, { status: 404 });
    }

    const parseResult = UserSchema.safeParse(rows[0]);
    if (!parseResult.success) {
      console.error('[DataMax Chat] User Parse Error:', parseResult.error);
      return NextResponse.json({ error: 'Daten fehlerhaft' }, { status: 500 });
    }
    const user = parseResult.data;

    // 4. Dashboard-Daten laden (aus Cache)
    const dashboardData = await getOrFetchGoogleData(user, dateRange);
    if (!dashboardData) {
      return NextResponse.json({ error: 'Keine Projektdaten verfügbar' }, { status: 400 });
    }

    // =========================================================================
    // ✅ NEU: Extended AI Traffic Daten laden
    // =========================================================================
    let aiTrafficDetail = null;
    
    if (user.ga4_property_id) {
      try {
        const dateRanges = getDateRanges(dateRange);
        aiTrafficDetail = await getAiTrafficDetailWithComparison(
          user.ga4_property_id,
          dateRanges.current.start,
          dateRanges.current.end,
          dateRanges.previous.start,
          dateRanges.previous.end
        );
        console.log('[DataMax Chat] Extended AI Traffic geladen:', aiTrafficDetail?.totalSessions, 'Sessions');
      } catch (e) {
        console.warn('[DataMax Chat] Extended AI Traffic nicht verfügbar:', e);
        // Kein Fehler werfen - wir nutzen dann die Basis-Daten
      }
    }

    // 5. Kontext bauen (mit Extended AI Traffic + Wetter + Feiertage)
    const userCountry = user.country || 'AT'; // Fallback auf Österreich
    const context = buildChatContext(dashboardData, user, dateRange, aiTrafficDetail, userCountry);
    
    // Feiertage prüfen für Suggested Questions
    const hasHolidays = (() => {
      try {
        const hd = new Holidays(userCountry);
        const dateRanges = getDateRanges(dateRange);
        const start = new Date(dateRanges.current.start);
        const end = new Date(dateRanges.current.end);
        const years = new Set<number>();
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          years.add(d.getFullYear());
        }
        return Array.from(years).some(year => 
          hd.getHolidays(year).some((h: any) => {
            const hDate = new Date(h.date);
            return hDate >= start && hDate <= end && h.type === 'public';
          })
        );
      } catch { return false; }
    })();
    
    const suggestedQuestions = generateSuggestedQuestions(dashboardData, aiTrafficDetail, hasHolidays);

    // 6. System-Prompt
    const isAdmin = userRole === 'ADMIN' || userRole === 'SUPERADMIN';
    
    const systemPrompt = `Du bist "DataMax", ein freundlicher aber kompetenter SEO- und Analytics-Experte.

DEINE PERSOENLICHKEIT:
- Praezise und datengetrieben
- Gibst konkrete, umsetzbare Empfehlungen
- Erklaerst komplexe Zusammenhaenge verstaendlich
- ${isAdmin ? 'Sprichst technisch mit SEO-Fachbegriffen' : 'Sprichst kundenfreundlich ohne zu viel Fachjargon'}

KONTEXT - AKTUELLE PROJEKTDATEN:
${context}

REGELN:
1. Beziehe dich IMMER auf die konkreten Zahlen oben
2. Gib maximal 3-4 Empfehlungen pro Antwort
3. Sei praegnant (max. 250 Woerter, ausser explizit mehr gewuenscht)
4. Bei Fragen ausserhalb deines Datenbereichs: Sage ehrlich, dass du das nicht weisst
5. Formatiere mit **fett** fuer wichtige Zahlen und Begriffe
6. Nutze Aufzaehlungen fuer Empfehlungen
7. Bei KI-Traffic Fragen: Erklaere welche Seiten von welchen KI-Systemen empfohlen werden
8. Bei Wetter-Fragen: Korreliere Wetterdaten mit Traffic-Schwankungen (z.B. Hitzetage vs. Sessions)
9. Bei Feiertags-Fragen: Erklaere wie Feiertage den Traffic beeinflussen (B2B sinkt, B2C variiert)
10. Wenn Traffic-Einbrueche sichtbar sind, pruefe ob Wetter oder Feiertage eine Erklaerung bieten

${isAdmin ? `
ADMIN-MODUS AKTIV:
- Du kannst technische Details und API-Daten erwaehnen
- Erwaehne auch negative Trends offen
- Schlage auch komplexere SEO-Massnahmen vor
- Analysiere KI-Traffic im Detail (Quellen, Landingpages, Conversions)
` : `
KUNDEN-MODUS AKTIV:
- Erklaere Fachbegriffe kurz
- Fokussiere auf positive Entwicklungen, aber sei ehrlich
- Halte Empfehlungen einfach umsetzbar
- Bei KI-Traffic: Erklaere es als "Ihre Inhalte werden von KI-Assistenten empfohlen"
`}`;

    // 7. Stream-Response
    const result = await streamTextSafe({
      system: systemPrompt,
      prompt: message,
      temperature: 0.7,
    });

    // Base64-Encoding für Header
    const questionsBase64 = Buffer.from(JSON.stringify(suggestedQuestions), 'utf-8').toString('base64');
    
    const response = result.toTextStreamResponse();
    response.headers.set('X-Suggested-Questions', questionsBase64);
    
    return response;

  } catch (error) {
    console.error('[DataMax Chat] Fehler:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Interner Fehler' },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET: Suggested Questions ohne Chat
// ============================================================================

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId') || session.user.id;
    const dateRange = searchParams.get('dateRange') || '30d';

    // User laden
    const { rows } = await sql`SELECT * FROM users WHERE id::text = ${projectId}`;
    if (rows.length === 0) {
      return NextResponse.json({ questions: [] });
    }

    const parseResult = UserSchema.safeParse(rows[0]);
    if (!parseResult.success) {
      return NextResponse.json({ questions: [] });
    }

    const user = parseResult.data;

    // Daten laden
    const dashboardData = await getOrFetchGoogleData(user, dateRange);
    if (!dashboardData) {
      return NextResponse.json({ questions: [] });
    }

    // Extended AI Traffic für bessere Fragen
    let aiTrafficDetail = null;
    if (user.ga4_property_id) {
      try {
        const dateRanges = getDateRanges(dateRange);
        aiTrafficDetail = await getAiTrafficDetailWithComparison(
          user.ga4_property_id,
          dateRanges.current.start,
          dateRanges.current.end,
          dateRanges.previous.start,
          dateRanges.previous.end
        );
      } catch {
        // Ignore - nutzen Basis-Daten
      }
    }

    const questions = generateSuggestedQuestions(dashboardData, aiTrafficDetail, (() => {
      try {
        const userCountry = user.country || 'AT';
        const hd = new Holidays(userCountry);
        const dateRanges = getDateRanges(dateRange);
        const start = new Date(dateRanges.current.start);
        const end = new Date(dateRanges.current.end);
        const years = new Set<number>();
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          years.add(d.getFullYear());
        }
        return Array.from(years).some(year =>
          hd.getHolidays(year).some((h: any) => {
            const hDate = new Date(h.date);
            return hDate >= start && hDate <= end && h.type === 'public';
          })
        );
      } catch { return false; }
    })());
    return NextResponse.json({ questions });

  } catch (error) {
    console.error('[DataMax Questions] Fehler:', error);
    return NextResponse.json({ questions: [] });
  }
}
