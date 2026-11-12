// src/lib/ai-chat/context.ts
// Kontext-Builder des DataMax-Chats: verdichtet Dashboard-, KI-Traffic-,
// Google-Ads-, Wetter- und Feiertagsdaten zum Prompt-Kontext

import Holidays from 'date-holidays';
import type { User } from '@/lib/schemas';
import type { ProjectDashboardData } from '@/lib/dashboard-shared';
import type { DailyWeather } from '@/lib/weather';
import type { AiTrafficDetailData } from '@/types/ai-traffic-detail';
import { getDateRangeLabel } from './date-range';

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
    if (dateRange === '3m') days = 90;
    if (dateRange === '6m') days = 180;
    if (dateRange === '12m') days = 365;
    if (dateRange === '18m') days = 548;
    if (dateRange === '24m') days = 730;
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
      yearHolidays.forEach((h) => {
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

export function buildChatContext(
  data: ProjectDashboardData, 
  user: User, 
  dateRange: string,
  aiTrafficDetail?: AiTrafficDetailData | null, // Extended AI Traffic Data
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

  let localSeoSection = '';
  if (data.localSeo?.locations?.length) {
    const localTotals = data.localSeo.totals;
    const localLocations = data.localSeo.locations
      .slice()
      .sort((a, b) => (b.conversions - a.conversions) || (b.sessions - a.sessions) || (b.impressions - a.impressions))
      .slice(0, 8)
      .map((location, index) => {
        const topQueries = location.topQueries?.slice(0, 3)
          .map(q => `"${q.query}" (${fmt(q.impressions)} Impr., ${fmt(q.clicks)} Klicks, Pos. ${q.position?.toFixed(1) ?? 'k.A.'})`)
          .join('; ') || 'keine passenden GSC-Queries';
        const landingPages = location.topLandingPages?.slice(0, 3)
          .map(p => `${p.path} (${fmt(p.newUsers || 0)} neue Besucher, ${fmt(p.sessions || 0)} Sessions, ${fmt(p.conversions || 0)} Conv.)`)
          .join('; ') || 'keine Standort-Landingpage-Daten';

        return `${index + 1}. ${location.name} (${[location.postalCode, location.city, location.country].filter(Boolean).join(', ') || 'ohne Standortangabe'})
   GSC: ${fmt(location.clicks)} Klicks, ${fmt(location.impressions)} Impr., CTR ${location.ctr.toFixed(1)}%, Ø Pos. ${location.position?.toFixed(1) ?? 'k.A.'}
   GA4: ${fmt(location.newUsers)} neue Besucher, ${fmt(location.sessions)} Sessions, ${fmt(location.conversions)} Conversions
   Top-Queries: ${topQueries}
   Landingpages: ${landingPages}`;
      })
      .join('\n');

    localSeoSection = `
=== LOKALE SICHTBARKEIT ===
Summen: ${fmt(localTotals.clicks)} GSC-Klicks, ${fmt(localTotals.impressions)} GSC-Impressionen, ${fmt(localTotals.newUsers || 0)} neue Besucher, ${fmt(localTotals.sessions)} Sessions, ${fmt(localTotals.conversions)} Conversions

STANDORTE:
${localLocations}

DATENLOGIK:
- GSC-Werte werden aus lokalen Queries, PLZ/Stadt/Keywords und konfigurierten Standort-Landingpages gematcht.
- GA4-Werte pro Standort kommen primaer aus den konfigurierten Standort-Landingpages.
- Nur wenn ein Standort keine Landingpages hat, wird GA4-Stadt-Traffic als Fallback genutzt.
- Deshalb niemals Stadt-Traffic pauschal als Standortleistung interpretieren, wenn Landingpages gepflegt sind.
`;
  }

  // =========================================================================
  // ✅ NEU: Erweiterte KI-Traffic Analyse
  // =========================================================================
  let aiTrafficSection = '';
  
  if (aiTrafficDetail && aiTrafficDetail.totalSessions > 0) {
    // KI-Quellen mit Details
    const aiSources = aiTrafficDetail.sources?.slice(0, 5)
      .map((s) => `- ${s.source}: ${s.sessions} Sessions (${s.percentage.toFixed(1)}%), Top-Seite: ${s.topPages?.[0]?.path || 'k.A.'}`)
      .join('\n') || 'Keine KI-Quellen';

    // Landingpages die von KI-Traffic profitieren
    const aiLandingPages = aiTrafficDetail.landingPages?.slice(0, 5)
      .map((p) => {
        const topSource = p.sources?.[0]?.source || 'unbekannt';
        return `- ${p.path}: ${p.sessions} Sessions (via ${topSource}), ${p.conversions} Conv., Bounce: ${p.bounceRate.toFixed(1)}%`;
      })
      .join('\n') || 'Keine Seiten';

    // Trend-Analyse
    let trendInfo = '';
    if (aiTrafficDetail.trend && aiTrafficDetail.trend.length >= 7) {
      const recentWeek = aiTrafficDetail.trend.slice(-7).reduce((sum, t) => sum + t.sessions, 0);
      const previousWeek = aiTrafficDetail.trend.slice(-14, -7).reduce((sum, t) => sum + t.sessions, 0);
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

  // =========================================================================
  // ✅ NEU: Google Ads / SEA Daten
  // =========================================================================
  let googleAdsSection = '';

  const gAds = data.googleAdsData;
  if (gAds && gAds.rows.length > 0) {
    const t = gAds.totals;
    const ir = t.sessions > 0 ? ((t.engagedSessions ?? 0) / t.sessions * 100).toFixed(1) : '0';

    // Kampagnen mit echten Conversions (aus Lookup-Map, ohne Thresholding)
    const campaignMap = new Map<string, { cost: number; clicks: number; sessions: number }>();
    for (const row of gAds.rows) {
      const key = row.campaign || '(not set)';
      if (key === '–') continue;
      const existing = campaignMap.get(key) || { cost: 0, clicks: 0, sessions: 0 };
      existing.cost += row.cost;
      existing.clicks += row.clicks;
      existing.sessions += row.sessions;
      campaignMap.set(key, existing);
    }
    const campaigns = Array.from(campaignMap.entries())
      .sort(([, a], [, b]) => b.cost - a.cost)
      .slice(0, 5)
      .map(([name, c]) => {
        const conv = gAds.conversionsByCampaign?.[name] ?? 0;
        const cpc = c.clicks > 0 ? (c.cost / c.clicks).toFixed(2) : '0.00';
        return `- ${name}: ${c.cost.toFixed(2)}€ Kosten, ${c.clicks} Klicks, CPC ${cpc}€, ${conv} Conv., ${c.sessions} Sessions`;
      })
      .join('\n');

    // Anzeigengruppen mit echten Conversions
    const adGroupMap = new Map<string, { cost: number; clicks: number; sessions: number }>();
    for (const row of gAds.rows) {
      const key = row.adGroup || '(not set)';
      if (key === '–') continue;
      const existing = adGroupMap.get(key) || { cost: 0, clicks: 0, sessions: 0 };
      existing.cost += row.cost;
      existing.clicks += row.clicks;
      existing.sessions += row.sessions;
      adGroupMap.set(key, existing);
    }
    const adGroups = Array.from(adGroupMap.entries())
      .sort(([, a], [, b]) => b.cost - a.cost)
      .slice(0, 5)
      .map(([name, a]) => {
        const conv = gAds.conversionsByAdGroup?.[name] ?? 0;
        const cpc = a.clicks > 0 ? (a.cost / a.clicks).toFixed(2) : '0.00';
        return `- ${name}: ${a.cost.toFixed(2)}€ Kosten, ${a.clicks} Klicks, CPC ${cpc}€, ${conv} Conv., ${a.sessions} Sessions`;
      })
      .join('\n');

    // Top Suchanfragen (nur Kosten, Klicks, CPC — keine Conversions wegen Thresholding)
    const queryMap = new Map<string, { cost: number; clicks: number; sessions: number }>();
    for (const row of gAds.rows) {
      const key = row.searchQuery || '(not set)';
      if (key === '–') continue;
      const existing = queryMap.get(key) || { cost: 0, clicks: 0, sessions: 0 };
      existing.cost += row.cost;
      existing.clicks += row.clicks;
      existing.sessions += row.sessions;
      queryMap.set(key, existing);
    }
    const topQueries = Array.from(queryMap.entries())
      .sort(([, a], [, b]) => b.clicks - a.clicks)
      .slice(0, 10)
      .map(([q, d]) => {
        const cpc = d.clicks > 0 ? (d.cost / d.clicks).toFixed(2) : '0.00';
        return `- "${q}": ${d.clicks} Klicks, CPC ${cpc}€, ${d.sessions} Sessions`;
      })
      .join('\n');

    googleAdsSection = `
=== GOOGLE ADS / SEA PERFORMANCE ===
Gesamtausgaben: ${t.cost.toFixed(2)}€
Klicks: ${fmt(t.clicks)}
Ø CPC: ${t.avgCpc.toFixed(2)}€
Conversions: ${fmt(t.conversions)}
Sessions: ${fmt(t.sessions)}
Interaktionsrate: ${ir}%

KAMPAGNEN (Top 5 nach Kosten):
${campaigns}

ANZEIGENGRUPPEN (Top 5 nach Kosten):
${adGroups}

TOP SUCHANFRAGEN (Top 10 nach Klicks, keine Conversions wegen GA4 Datenschutz-Thresholding):
${topQueries}

HINWEIS: Conversions sind nur auf Kampagnen- und Anzeigengruppen-Ebene zuverlaessig. Auf Suchanfragen-Ebene kuerzt Google die Daten aus Datenschutzgruenden.
`;
  }

  // Wetter- und Feiertagskontext
  const weatherSection = buildWeatherContext(data.weatherData);
  const holidaySection = buildHolidayContext(dateRange, country || 'AT');

  return `
PROJEKT: ${user.domain || 'Unbekannt'}
ZEITRAUM: ${getDateRangeLabel(dateRange)}

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
${localSeoSection}${googleAdsSection}${weatherSection}${holidaySection}`.trim();
}
