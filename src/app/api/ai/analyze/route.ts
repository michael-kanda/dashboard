// src/app/api/ai/analyze/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { sql } from '@vercel/postgres';
import { getOrFetchGoogleData } from '@/lib/google-data-loader';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText } from 'ai';
import crypto from 'node:crypto';
import type { User } from '@/lib/schemas'; 

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY || '',
});

export const runtime = 'nodejs';

// Hilfsfunktionen
const fmt = (val?: number) => (val ? val.toLocaleString('de-DE') : '0');
const change = (val?: number) => {
  if (val === undefined || val === null) return '0';
  const prefix = val > 0 ? '+' : '';
  return `${prefix}${val.toFixed(1)}`;
};

function createHash(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
    }

    // ==========================================
    // ✅ DEMO-MODUS CHECK
    // ==========================================
    const isDemo = session.user.email?.includes('demo');
    
    if (isDemo) {
      console.log('[AI Analyze] Demo-User erkannt. Simuliere Antwort...');
      
      await new Promise(resolve => setTimeout(resolve, 2000));

      const demoResponse = `<h4 class="font-bold text-indigo-900 mb-3 text-base">Zeitplan:</h4>
<p class="mb-4 text-body">Status: Laufende Betreuung<br>Monat: Fortlaufend / Offen</p>
<h4 class="font-bold text-indigo-900 mt-6 mb-3 text-base">Performance Kennzahlen:</h4>
<ul class="space-y-2 mb-4 text-sm text-secondary list-none pl-1">
<li class="flex gap-2"><span class="text-indigo-400 mt-1">•</span><span>Nutzer (Gesamt): <span class="font-semibold text-heading">2.847</span> (<span class="text-emerald-600 font-bold">+19,2%</span>)</span></li>
<li class="flex gap-2"><span class="text-indigo-400 mt-1">•</span><span>Klassische Besucher: <span class="font-semibold text-heading">2.713</span></span></li>
<li class="flex gap-2"><span class="text-indigo-400 mt-1">•</span><span>Sichtbarkeit in KI-Systemen: <span class="font-semibold text-heading">134</span></span></li>
<li class="flex gap-2"><span class="text-indigo-400 mt-1">•</span><span>Impressionen: <span class="font-semibold text-heading">28.934</span> (<span class="text-emerald-600 font-bold">+22,3%</span>)</span></li>
<li class="flex gap-2"><span class="text-indigo-400 mt-1">•</span><span>Klicks: <span class="font-semibold text-heading">1.247</span> (<span class="text-emerald-600 font-bold">+18,5%</span>)</span></li>
<li class="flex gap-2"><span class="text-indigo-400 mt-1">•</span><span>Conversions: <span class="font-semibold text-heading">127</span> (<span class="text-emerald-600 font-bold">+31,5%</span>)</span></li>
<li class="flex gap-2"><span class="text-indigo-400 mt-1">•</span><span>Interaktionsrate: <span class="font-semibold text-heading">68,5%</span></span></li>
</ul>
<div class="mt-6 p-4 bg-emerald-50 rounded-xl border border-emerald-100 flex items-start gap-4 shadow-sm">
<div class="bg-surface p-2.5 rounded-full text-emerald-600 shadow-sm mt-1">🏆</div>
<div><div class="text-[10px] font-bold text-emerald-700 uppercase tracking-wider mb-1">Top Erfolg</div>
<div class="text-sm font-semibold text-emerald-900 leading-relaxed">Starker Zuwachs bei Conversions (+31,5%) und stabile Engagement-Rate</div></div>
</div>[[SPLIT]]<p class="mb-4 font-medium">Sehr geehrte Kundin, sehr geehrter Kunde,</p>
<h4 class="font-bold text-indigo-900 mt-6 mb-3 text-base">Zusammenfassung:</h4>
<p class="mb-4 leading-relaxed text-body">Ihr Demo-Shop entwickelt sich hervorragend! Die Besucherzahlen zeigen einen starken Aufwärtstrend (+24% im Vergleich zum Vormonat). Besonders erfreulich: Die Conversion-Rate ist auf stabile 3,2% gestiegen.</p>
<h4 class="font-bold text-indigo-900 mt-6 mb-3 text-base">Top Seiten (Umsatz):</h4>
<ul class="space-y-2 mb-4 text-sm text-secondary list-none pl-1">
<li class="flex gap-2"><span class="text-indigo-400 mt-1">•</span><span>/produkte/sneaker-collection (52 Conversions)</span></li>
<li class="flex gap-2"><span class="text-indigo-400 mt-1">•</span><span>/sale/sommer-special (38 Conversions)</span></li>
<li class="flex gap-2"><span class="text-indigo-400 mt-1">•</span><span>/landingpage/newsletter-anmeldung (21 Conversions)</span></li>
</ul>
<h4 class="font-bold text-indigo-900 mt-6 mb-3 text-base">Ihr Wachstumspotenzial:</h4>
<p class="mb-4 leading-relaxed text-body">Wir haben tolles Potenzial entdeckt! Viele Menschen suchen nach "sneaker online kaufen", und Sie sind schon fast ganz vorne dabei (Position 4.2). Kleine Anpassungen an Ihren Meta-Beschreibungen und internen Verlinkungen können hier noch mehr Besucher bringen.</p>`;

      return new NextResponse(demoResponse, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    }
    // ==========================================
    // ENDE DEMO-MODUS
    // ==========================================

    const body = await req.json();
    const { projectId, dateRange, googleAdsData } = body;
    const userRole = session.user.role;

    if (!projectId || !dateRange) {
      return NextResponse.json({ message: 'Fehlende Parameter' }, { status: 400 });
    }

    // 1. Daten laden
    const { rows } = await sql`
      SELECT *
      FROM users WHERE id::text = ${projectId}
    `;

    if (rows.length === 0) return NextResponse.json({ message: 'Projekt nicht gefunden' }, { status: 404 });
    
    // Expliziter Cast zu User
    const project = rows[0] as unknown as User;

    const data = await getOrFetchGoogleData(project, dateRange);
    if (!data || !data.kpis) return NextResponse.json({ message: 'Keine Daten' }, { status: 400 });

    const kpis = data.kpis;

    // Timeline Logik
    let timelineInfo = "";
    let startDateStr = "";
    let endDateStr = "";
    
    if (project.project_timeline_active) {
        const start = new Date(project.project_start_date || project.createdAt || new Date());
        const now = new Date();
        const duration = project.project_duration_months || 6;
        const diffMonths = Math.ceil(Math.abs(now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30)); 
        const currentMonth = Math.min(diffMonths, duration);
        
        const end = new Date(start);
        end.setMonth(start.getMonth() + duration);
        
        timelineInfo = `Aktiver Monat: ${currentMonth} von ${duration}`;
        startDateStr = start.toLocaleDateString('de-DE');
        endDateStr = end.toLocaleDateString('de-DE');
    } else {
        timelineInfo = "Laufende Betreuung";
        startDateStr = "Fortlaufend";
        endDateStr = "Offen";
    }

    // Datenaufbereitung
    const aiShare = data.aiTraffic && kpis.sessions?.value
      ? (data.aiTraffic.totalSessions / kpis.sessions.value * 100).toFixed(1)
      : '0';

    const topKeywords = data.topQueries?.slice(0, 5)
      .map((q: any) => `- "${q.query}" (Pos: ${q.position.toFixed(1)}, Klicks: ${q.clicks})`)
      .join('\n') || 'Keine Keywords';

    // ✅ SEO CHANCEN (Striking Distance Keywords - Position 4-20)
    const seoOpportunities = data.topQueries
      ?.filter((q: any) => q.position >= 4 && q.position <= 20)
      .sort((a: any, b: any) => b.impressions - a.impressions)
      .slice(0, 5)
      .map((q: any) => `- "${q.query}" (Pos: ${q.position.toFixed(1)}, Impr: ${q.impressions})`)
      .join('\n') || 'Keine SEO-Chancen identifiziert';

    // ✅ Erweiterter Filter für Data Max
    const topConverters = data.topConvertingPages
      ?.filter((p: any) => {
         const path = p.path.toLowerCase();
         const isStandardExcluded = 
            path.includes('danke') || 
            path.includes('thank') || 
            path.includes('success') || 
            path.includes('confirmation') ||
            path.includes('impressum') ||
            path.includes('datenschutz') ||
            path.includes('widerruf') ||
            path.includes('agb');
         const isTechnical = 
            path.includes('search') ||
            path.includes('suche') ||
            path.includes('404') ||
            path.includes('undefined');
         return !isStandardExcluded && !isTechnical;
      })
      .map((p: any) => {
         if (p.conversions > 0) {
           return `- "${p.path}": ${p.conversions} Conv. (Rate: ${p.conversionRate}%, Eng: ${p.engagementRate}%)`;
         } else {
           return `- "${p.path}": ${p.engagementRate}% Engagement (bei 0 Conversions)`;
         }
      })
      .slice(0, 10)
      .join('\n') || 'Keine relevanten Content-Daten verfügbar.';
      
    const topChannels = data.channelData?.slice(0, 3)
      .map((c: any) => `${c.name} (${fmt(c.value)})`)
      .join(', ') || 'Keine Kanal-Daten';

    // ✅ NEU: Google Ads Daten (aus Frontend/Sheet)
    let googleAdsSection = '';
    if (googleAdsData?.totals) {
      const adsTotals = googleAdsData.totals;
      const fmtCur = (v: number) => v?.toFixed(2).replace('.', ',') + ' €';
      const adsCpc = adsTotals.clicks > 0 ? adsTotals.cost / adsTotals.clicks : 0;
      
      googleAdsSection = `
      ===== GOOGLE ADS (Bezahlte Werbung) =====
      Gesamtkosten: ${fmtCur(adsTotals.cost || 0)}
      Klicks (Ads): ${fmt(adsTotals.clicks || 0)}
      Ø CPC: ${fmtCur(adsCpc)}
      Conversions (Ads): ${fmt(adsTotals.conversions || 0)}
      CTR/Interaktionsrate: ${(adsTotals.interactionRate || 0).toFixed(1)}%`;
      
      // Kampagnen-Breakdown
      const campaigns = googleAdsData.campaignRows || [];
      if (campaigns.length > 0) {
        // Aggregiere nach Kampagnenname
        const campMap = new Map<string, { cost: number; clicks: number; conversions: number }>();
        for (const r of campaigns) {
          const key = r.campaign || '(unbekannt)';
          const existing = campMap.get(key) || { cost: 0, clicks: 0, conversions: 0 };
          existing.cost += r.cost || 0;
          existing.clicks += r.clicks || 0;
          existing.conversions += r.conversions || 0;
          campMap.set(key, existing);
        }
        
        googleAdsSection += `\n\n      KAMPAGNEN:`;
        for (const [name, v] of campMap) {
          const campCpc = v.clicks > 0 ? v.cost / v.clicks : 0;
          googleAdsSection += `\n      - ${name}: ${fmtCur(v.cost)} | ${v.clicks} Klicks | CPC ${fmtCur(campCpc)} | ${v.conversions} Conv.`;
        }
      }
    }

    // ✅ NEU: KI-Traffic Analyse mit Quellen und Top-Seiten
    const aiTrafficSources = data.aiTraffic?.topAiSources
      ?.slice(0, 5)
      .map((s: any) => `- ${s.source}: ${s.sessions} Sitzungen (${s.percentage.toFixed(1)}%)`)
      .join('\n') || 'Keine KI-Quellen erkannt';

    // KI-Traffic Trend-Analyse
    const aiTrend = data.aiTraffic?.trend;
    let aiTrendInfo = 'Keine Trenddaten';
    if (aiTrend && aiTrend.length >= 7) {
      const recentWeek = aiTrend.slice(-7).reduce((sum: number, t: any) => sum + (t.sessions || t.value || 0), 0);
      const previousWeek = aiTrend.slice(-14, -7).reduce((sum: number, t: any) => sum + (t.sessions || t.value || 0), 0);
      if (previousWeek > 0) {
        const trendChange = ((recentWeek - previousWeek) / previousWeek * 100).toFixed(1);
        aiTrendInfo = `Letzte 7 Tage: ${recentWeek} Sitzungen (${Number(trendChange) >= 0 ? '+' : ''}${trendChange}% vs. Vorwoche)`;
      } else {
        aiTrendInfo = `Letzte 7 Tage: ${recentWeek} Sitzungen`;
      }
    }

    const summaryData = `
      DOMAIN: ${project.domain}
      ZEITPLAN STATUS: ${timelineInfo}
      START: ${startDateStr}
      ENDE: ${endDateStr}
      
      KPIs (Format: Wert (Veränderung%)):
      - Nutzer (Gesamt): ${fmt(kpis.totalUsers?.value)} (${change(kpis.totalUsers?.change)}%)
      - Klassische Besucher: ${fmt(Math.max(0, (kpis.totalUsers?.value || 0) - (data.aiTraffic?.totalUsers || 0)))}
      - Sichtbarkeit in KI-Systemen: ${fmt(data.aiTraffic?.totalUsers || 0)}
      - Impressionen: ${fmt(kpis.impressions?.value)} (${change(kpis.impressions?.change)}%)
      - Klicks: ${fmt(kpis.clicks?.value)} (${change(kpis.clicks?.change)}%)
      - Sitzungen: ${fmt(kpis.sessions?.value)} (${change(kpis.sessions?.change)}%)
      - Conversions: ${fmt(kpis.conversions?.value)} (${change(kpis.conversions?.change)}%)
      - Interaktionsrate: ${fmt(kpis.engagementRate?.value)}%
      - KI-Anteil am Traffic: ${aiShare}%
      
      TOP KEYWORDS (Traffic):
      ${topKeywords}

      SEO CHANCEN (Verstecktes Potenzial - Hohe Nachfrage, Ranking verbesserungswürdig):
      ${seoOpportunities}

      TOP CONVERSION TREIBER (RELEVANTE LANDINGPAGES):
      ${topConverters}
      
      KANÄLE:
      ${topChannels}

      ===== KI-TRAFFIC ANALYSE =====
      Gesamt KI-Traffic: ${fmt(data.aiTraffic?.totalSessions || 0)} Sitzungen von ${fmt(data.aiTraffic?.totalUsers || 0)} Nutzern
      Anteil am Gesamttraffic: ${aiShare}%
      Trend: ${aiTrendInfo}
      
      KI-QUELLEN (Woher kommen die Besucher?):
      ${aiTrafficSources}
      
      INTERPRETATION:
      - ChatGPT/OpenAI = Nutzer haben in ChatGPT nach Infos gesucht und wurden auf diese Seite verwiesen
      - Perplexity = KI-Suchmaschine hat diese Seite als Quelle zitiert
      - Gemini/Bard = Google's KI hat auf diese Inhalte verwiesen
      - Copilot = Microsoft's KI-Assistent hat hierher verlinkt
      ${googleAdsSection}
    `;

    // --- CACHE LOGIK ---
    const cacheInputString = `${summaryData}|ROLE:${userRole}|V7_WITH_ADS`;
    const inputHash = createHash(cacheInputString);

    const { rows: cacheRows } = await sql`
      SELECT response 
      FROM ai_analysis_cache
      WHERE 
        user_id = ${projectId}::uuid 
        AND date_range = ${dateRange}
        AND input_hash = ${inputHash}
        AND created_at > NOW() - INTERVAL '48 hours'
      ORDER BY created_at DESC
      LIMIT 1
    `;

    if (cacheRows.length > 0) {
      console.log('[AI Cache] ✅ HIT! Liefere gespeicherte Antwort.');
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(cacheRows[0].response));
          controller.close();
        },
      });
      return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
    // --- ENDE CACHE ---

    // 2. PROMPT SETUP
    const visualSuccessTemplate = `
      <div class="mt-6 p-4 bg-emerald-50 rounded-xl border border-emerald-100 flex items-start gap-4 shadow-sm">
         <div class="bg-surface p-2.5 rounded-full text-emerald-600 shadow-sm mt-1">🏆</div>
         <div><div class="text-[10px] font-bold text-emerald-700 uppercase tracking-wider mb-1">Top Erfolg</div>
         <div class="text-sm font-semibold text-emerald-900 leading-relaxed">ERFOLG_TEXT_PLATZHALTER</div></div>
      </div>
    `;

    // ✅ NEU: KI-Traffic Visual Template
    const aiTrafficTemplate = `
      <div class="mt-4 p-4 bg-purple-50 rounded-xl border border-purple-100">
         <div class="flex items-center gap-2 mb-2">
            <span class="text-purple-600">🤖</span>
            <span class="text-sm font-bold text-purple-900">KI-Traffic Analyse</span>
         </div>
         <div class="text-sm text-purple-800">KI_TRAFFIC_INHALT</div>
      </div>
    `;

    let systemPrompt = `
      Du bist "Data Max", ein Performance-Analyst.

      REGELN FÜR FORMATIERUNG (STRIKT BEFOLGEN):
      1. VERWENDE KEIN MARKDOWN.
      2. Nutze AUSSCHLIESSLICH HTML-Tags.
      
      ERLAUBTE HTML-STRUKTUR:
      - Absätze: <p class="mb-4 leading-relaxed text-body">Dein Text...</p>
      - Überschriften: <h4 class="font-bold text-indigo-900 mt-6 mb-3 text-base flex items-center gap-2">Dein Titel</h4>
      - Listen: <ul class="space-y-2 mb-4 text-sm text-secondary list-none pl-1"> 
                  <li class="flex gap-2"><span class="text-indigo-400 mt-1">•</span> <span>Dein Punkt</span></li> 
                </ul>
      - Positiv: <span class="text-emerald-600 font-bold">
      - Negativ: <span class="text-red-600 font-bold">
      - Wichtig: <span class="font-semibold text-heading">
      - KI-Highlight: <span class="text-purple-600 font-semibold">

      OUTPUT AUFBAU:
      [Inhalt Spalte 1]
      [[SPLIT]]
      [Inhalt Spalte 2]
    `;

    if (userRole === 'ADMIN' || userRole === 'SUPERADMIN') {
      // === ADMIN MODUS ===
      systemPrompt += `
        ZIELGRUPPE: Admin/Experte. Ton: Analytisch.
        
        SPALTE 1 (Status & Zahlen):
        1. <h4...>Zeitplan:</h4> Status, Monat.
        2. <h4...>Performance Kennzahlen:</h4> 
           <ul...>
             <li...>Liste alle KPIs inkl. Conversions und Engagement.
             <li...>Negative Trends ROT.
           </ul...>
        3. <h4...>KI-Traffic Status:</h4>
           Zeige: Gesamt-Sessions, Top 3 Quellen (ChatGPT, Perplexity, etc.), Trend.
           Nutze das lila Design: ${aiTrafficTemplate}
        ${googleAdsSection ? `3b. <h4...>Google Ads:</h4>
           <ul...>
             <li...>Kosten, Klicks, CPC, Conversions als KPI-Liste.
           </ul...>` : ''}
        4. VISUAL ENDING: ${visualSuccessTemplate}
        
        SPALTE 2 (Analyse):
        1. <h4...>Status-Analyse:</h4> Kritische Analyse.
        2. <h4...>Handlungsempfehlung:</h4> Technische Schritte.
        3. <h4...>Conversion Analyse:</h4> Welche Seiten bringen Umsatz?
        4. <h4...>SEO-Chancen (Striking Distance):</h4> 
           Analysiere die "SEO CHANCEN" Daten. Keywords auf Position 4-20 mit hohem Suchvolumen.
        5. <h4...>KI-Sichtbarkeit Optimierung:</h4>
           Basierend auf den KI-Traffic Daten:
           - Welche KI-Plattformen bringen Traffic?
           - Ist der KI-Anteil am Gesamttraffic steigend/fallend?
           - Konkrete Empfehlungen zur Verbesserung der KI-Sichtbarkeit (strukturierte Daten, FAQ-Seiten, etc.)
        ${googleAdsSection ? `6. <h4...>Google Ads Performance:</h4>
           Analysiere die GOOGLE ADS Daten:
           - ROI-Bewertung: Kosten vs. Conversions
           - CPC-Effizienz pro Kampagne
           - Welche Kampagnen performen gut/schlecht?
           - Empfehlungen zur Budget-Optimierung` : ''}
      `;
    } else {
      // === KUNDEN MODUS ===
      systemPrompt += `
        ZIELGRUPPE: Kunde. Ton: Höflich, Positiv.
        
        SPALTE 1 (Status & Zahlen):
        1. <h4...>Projekt-Laufzeit:</h4> Start, Ende, Monat.
        2. <h4...>Aktuelle Leistung:</h4>
           <ul...>
             <li...>Nutzer & Klassische Besucher.
             <li...>Conversions (Erreichte Ziele) & Engagement.
             <li...>KI-Sichtbarkeit: Füge hinzu: <br><span class="text-xs text-purple-600 block mt-0.5">🤖 Ihre Inhalte werden von KI-Assistenten (ChatGPT, Gemini, Perplexity) gefunden und empfohlen!</span>
           </ul...>
        ${googleAdsSection ? `2b. <h4...>Ihre Google Werbung (Überblick):</h4>
           <ul...>
             <li...>Investition und erzielte Klicks/Conversions - kundenfreundlich formuliert.
           </ul...>` : ''}
        3. VISUAL ENDING: ${visualSuccessTemplate}
        
        SPALTE 2 (Performance Analyse):
        1. Anrede: <p class="mb-4 font-medium">Sehr geehrte Kundin, sehr geehrter Kunde,</p>
        2. <h4...>Zusammenfassung:</h4> Fließtext über Erfolge (Conversions hervorheben).
        3. <h4...>Top Seiten (Umsatz):</h4> Nenne lobend die Seiten mit den meisten Conversions.
        4. <h4...>Ihr Wachstumspotenzial:</h4> 
           Greifen Sie 1-2 Keywords aus "SEO CHANCEN" heraus und formulieren Sie es als gute Nachricht.
        5. <h4...>Zukunft: KI-Sichtbarkeit:</h4>
           Erkläre dem Kunden positiv und verständlich:
           - "${fmt(data.aiTraffic?.totalUsers || 0)} Besucher kamen über KI-Assistenten wie ChatGPT"
           - "Das bedeutet: Wenn Menschen KI-Tools nach [Branche/Thema] fragen, werden SIE empfohlen!"
           - "Dieser Trend wächst stark - wir positionieren Sie optimal dafür."
        ${googleAdsSection ? `6. <h4...>Ihre Google Werbung:</h4>
           Erkläre dem Kunden verständlich und positiv:
           - Wie viel wurde investiert und was kam dabei heraus (Conversions)
           - Welche Kampagnen besonders gut funktioniert haben
           - "Ihre Werbung arbeitet für Sie" - positiver Rahmen` : ''}
      `;
    }

    const result = streamText({
      model: google('gemini-2.5-flash'),
      system: systemPrompt,
      prompt: `Analysiere diese Daten für den Zeitraum ${dateRange}:\n${summaryData}`,
      temperature: 0.4, 
      onFinish: async ({ text }) => {
        if (text && text.length > 50) {
          try {
            await sql`
              INSERT INTO ai_analysis_cache (user_id, date_range, input_hash, response)
              VALUES (${projectId}::uuid, ${dateRange}, ${inputHash}, ${text})
            `;
          } catch (e) { console.error('Cache Error', e); }
        }
      }
    });

    return result.toTextStreamResponse();

  } catch (error) {
    console.error('[AI Analyze] Fehler:', error);
    return NextResponse.json({ message: 'Fehler', error: String(error) }, { status: 500 });
  }
}
