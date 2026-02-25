// src/app/api/ai/trend-radar/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { streamText } from 'ai';
import { STYLES, STATUS_COLORS, getCompactStyleGuide } from '@/lib/ai-styles';
import { google, AI_CONFIG } from '@/lib/ai-config';

const SERPAPI_KEY = process.env.SERPAPI_KEY || ''; 

export const runtime = 'nodejs';
export const maxDuration = 60;

const COUNTRY_MAP: Record<string, string> = { 'AT': 'AT', 'DE': 'DE', 'CH': 'CH', 'US': 'US' };
const COUNTRY_LABELS: Record<string, string> = { 'AT': 'Österreich', 'DE': 'Deutschland', 'CH': 'Schweiz', 'US': 'USA' };

// ============================================================================
// FUNKTIONEN - UNVERÄNDERT
// ============================================================================

async function fetchGoogleTrends(keyword: string, geo: string) {
  if (!SERPAPI_KEY) throw new Error('SERPAPI_KEY fehlt');
  const params = new URLSearchParams({
    engine: 'google_trends', q: keyword, geo: geo, data_type: 'TIMESERIES', api_key: SERPAPI_KEY
  });
  const response = await fetch(`https://serpapi.com/search.json?${params.toString()}`);
  if (!response.ok) throw new Error(`SerpApi Error`);
  const data = await response.json();
  return {
    timeline: data.interest_over_time?.timeline_data || [],
    rising: data.related_queries?.rising || [],
    top: data.related_queries?.top || []
  };
}

function analyzeTrend(timeline: any[]): { status: string; color: keyof typeof STATUS_COLORS; icon: string; recommendation: string } {
  if (!timeline || timeline.length < 5) return { status: 'Wenig Daten', color: 'gray', icon: 'bi-bar-chart', recommendation: 'neutral' };
  const last3 = timeline.slice(-3).reduce((a: number, c: any) => a + (c.values[0]?.extracted_value || 0), 0) / 3;
  const prev3 = timeline.slice(-6, -3).reduce((a: number, c: any) => a + (c.values[0]?.extracted_value || 0), 0) / 3;
  if (last3 > prev3 * 1.5) return { status: 'Viral', color: 'rose', icon: 'bi-fire', recommendation: 'positive' };
  if (last3 > prev3 * 1.1) return { status: 'Steigend', color: 'emerald', icon: 'bi-graph-up-arrow', recommendation: 'positive' };
  if (last3 < prev3 * 0.9) return { status: 'Fallend', color: 'amber', icon: 'bi-graph-down-arrow', recommendation: 'caution' };
  return { status: 'Stabil', color: 'blue', icon: 'bi-arrow-right', recommendation: 'neutral' };
}

function calcMetrics(timeline: any[]) {
  if (!timeline?.length) return { avg: 0, peak: 0, current: 0, change: 0 };
  const vals = timeline.map((p: any) => p.values[0]?.extracted_value || 0);
  const avg = Math.round(vals.reduce((a: number, b: number) => a + b, 0) / vals.length);
  const peak = Math.max(...vals);
  const current = vals[vals.length - 1] || 0;
  const prev = vals[Math.max(0, vals.length - 4)] || current;
  const change = prev > 0 ? Math.round(((current - prev) / prev) * 100) : 0;
  return { avg, peak, current, change };
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });

    const { domain, topic, country = 'AT' } = await req.json();
    const geoCode = COUNTRY_MAP[country] || 'AT';
    const countryName = COUNTRY_LABELS[country] || country;
    if (!topic) return NextResponse.json({ message: 'Thema fehlt' }, { status: 400 });

    let trendData = { timeline: [], rising: [], top: [] };
    let analysis = { status: 'Keine Daten', color: 'gray' as keyof typeof STATUS_COLORS, icon: 'bi-question-circle', recommendation: 'neutral' };
    let metrics = { avg: 0, peak: 0, current: 0, change: 0 };
    
    try {
      trendData = await fetchGoogleTrends(topic, geoCode);
      analysis = analyzeTrend(trendData.timeline);
      metrics = calcMetrics(trendData.timeline);
    } catch (e) { console.error("Trend Error", e); }

    interface RQ { query: string; value: string }
    const rising: RQ[] = trendData.rising.slice(0, 5).map((r: any) => ({ query: r.query, value: r.extracted_value || 'N/A' }));
    const top: RQ[] = trendData.top.slice(0, 5).map((r: any) => ({ query: r.query, value: r.extracted_value || 'N/A' }));

    // Dynamische Farben aus zentraler Config
    const statusColors = STATUS_COLORS[analysis.color];
    const trendColor = metrics.change >= 0 ? STYLES.textPositive : STYLES.textNegative;
    const trendPrefix = metrics.change >= 0 ? '+' : '';

    // Rising Keywords HTML
    const risingHTML = rising.length > 0 
      ? rising.map((r: RQ) => `<div class="${STYLES.keywordRow}"><span class="text-body">${r.query}</span><span class="${STYLES.textPositive} font-semibold">${r.value}</span></div>`).join('')
      : `<p class="${STYLES.pSmall} italic">Keine Daten für dieses Keyword</p>`;

    // Top Keywords HTML  
    const topHTML = top.length > 0
      ? top.map((r: RQ) => `<div class="${STYLES.keywordRow}"><span class="text-body">${r.query}</span><span class="${STYLES.textInfo} font-semibold">${r.value}</span></div>`).join('')
      : `<p class="${STYLES.pSmall} italic">Keine Daten für dieses Keyword</p>`;

    // Fazit Box basierend auf Recommendation
    const fazitStyles: Record<string, string> = {
      'positive': STYLES.fazitPositive,
      'caution': STYLES.fazitWarning,
      'neutral': STYLES.fazitNeutral,
    };
    const fazitStyle = fazitStyles[analysis.recommendation] || STYLES.fazitNeutral;
    
    const fazitIcons: Record<string, string> = {
      'positive': 'bi-check-circle-fill',
      'caution': 'bi-exclamation-triangle-fill',
      'neutral': 'bi-info-circle-fill',
    };
    const fazitIcon = fazitIcons[analysis.recommendation] || 'bi-info-circle-fill';

    const fazitColors: Record<string, { title: string; text: string }> = {
      'positive': { title: 'text-emerald-800', text: 'text-emerald-700' },
      'caution': { title: 'text-amber-800', text: 'text-amber-700' },
      'neutral': { title: 'text-blue-800', text: 'text-blue-700' },
    };
    const fazitColor = fazitColors[analysis.recommendation] || fazitColors['neutral'];

    // ========================================================================
    // PROMPT MIT ZENTRALEN STYLES
    // ========================================================================
    const prompt = `Du bist ein HTML-Generator. Generiere einen Trend-Report.

${getCompactStyleGuide()}

DATEN:
- Keyword: "${topic}"
- Region: ${countryName}
- Domain: ${domain}
- Status: ${analysis.status}
- Metriken: Aktuell ${metrics.current}, Ø ${metrics.avg}, Peak ${metrics.peak}, Trend ${trendPrefix}${metrics.change}%
- Aufsteigende: ${rising.map((r: RQ) => r.query).join(', ') || 'keine'}
- Top: ${top.map((r: RQ) => r.query).join(', ') || 'keine'}

GENERIERE DIESES HTML (beginne direkt mit <div>):

<div class="${STYLES.container}">

<div class="${STYLES.cardHeader} flex items-center justify-between">
<div>
<p class="text-indigo-200 text-[10px] uppercase tracking-wider font-medium">Trend-Analyse · ${countryName}</p>
<h2 class="text-base font-bold mt-0.5">${topic}</h2>
</div>
<span class="px-2 py-1 rounded text-[10px] font-bold ${statusColors.badge}"><i class="bi ${analysis.icon}"></i> ${analysis.status.toUpperCase()}</span>
</div>

<div class="${STYLES.grid4}">
<div class="${STYLES.metricCard}"><div class="${STYLES.metricValue}">${metrics.current}</div><div class="${STYLES.metricLabel}">Aktuell</div></div>
<div class="${STYLES.metricCard}"><div class="${STYLES.metricValue}">${metrics.avg}</div><div class="${STYLES.metricLabel}">Ø</div></div>
<div class="${STYLES.metricCard}"><div class="${STYLES.metricValue}">${metrics.peak}</div><div class="${STYLES.metricLabel}">Peak</div></div>
<div class="${STYLES.metricCard}"><div class="${STYLES.metricValue} ${trendColor}">${trendPrefix}${metrics.change}%</div><div class="${STYLES.metricLabel}">Trend</div></div>
</div>

<div class="${STYLES.grid2}">
<div class="${STYLES.card}">
<h4 class="${STYLES.h4}"><i class="bi bi-rocket-takeoff ${STYLES.iconIndigo}"></i> Aufsteigend</h4>
${risingHTML}
</div>
<div class="${STYLES.card}">
<h4 class="${STYLES.h4}"><i class="bi bi-trophy ${STYLES.iconIndigo}"></i> Top</h4>
${topHTML}
</div>
</div>

<div class="${STYLES.amberBox}">
<h4 class="${STYLES.h4} text-amber-700"><i class="bi bi-lightbulb-fill"></i> Alternative Keywords</h4>
<div class="flex flex-wrap gap-1">
[GENERIERE 6 alternative Long-Tail Keywords als: <span class="${STYLES.tagAmber}">Keyword</span>]
</div>
</div>

<div class="${STYLES.indigoBox}">
<h4 class="${STYLES.h4} text-indigo-700"><i class="bi bi-file-earmark-text"></i> Content-Ideen</h4>
<ul class="${STYLES.listCompact}">
[GENERIERE 3 konkrete Blogpost-Titel als: <li class="text-xs text-indigo-900"><i class="bi bi-dot"></i> Titel</li>]
</ul>
</div>

<div class="${STYLES.card}">
<h4 class="${STYLES.h4}"><i class="bi bi-bullseye ${STYLES.iconIndigo}"></i> Nächste Schritte</h4>
<div class="${STYLES.listCompact}">
[GENERIERE 3 Aktionen als: <div class="${STYLES.flexCenter}"><span class="${STYLES.stepNumber}">1</span><span class="${STYLES.stepText}">Aktion</span></div>]
</div>
</div>

<div class="${fazitStyle}">
<div class="${STYLES.flexStart}">
<i class="bi ${fazitIcon} ${analysis.recommendation === 'positive' ? STYLES.textPositive : analysis.recommendation === 'caution' ? STYLES.textWarning : STYLES.textInfo}"></i>
<div>
<p class="font-bold text-sm ${fazitColor.title}">[GENERIERE Fazit-Titel]</p>
<p class="${STYLES.pSmall} ${fazitColor.text}">[GENERIERE kurzen Fazit-Text basierend auf ${analysis.status}]</p>
</div>
</div>
</div>

<p class="${STYLES.footer}"><i class="bi bi-bar-chart"></i> Google Trends · ${countryName}</p>

</div>

Ersetze alle [GENERIERE...] Platzhalter mit echtem Content. Beginne JETZT mit <div class="${STYLES.container}">:`;

    const result = streamText({
      model: google(AI_CONFIG.fallbackModel),
      prompt: prompt,
      temperature: 0.3,
    });

    return result.toTextStreamResponse();

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Fehler';
    console.error('❌ Trend Radar Error:', error);
    return NextResponse.json({ message: errorMessage }, { status: 500 });
  }
}
