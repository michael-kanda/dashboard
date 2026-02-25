// src/app/api/ai/ai-visibility-check/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { STYLES } from '@/lib/ai-styles';
import { AI_CONFIG } from '@/lib/ai-config';
import * as cheerio from 'cheerio';

export const runtime = 'nodejs';
export const maxDuration = 120; // 2 Minuten für mehrere API-Calls

// ============================================================================
// KONFIGURATION - Nutzt ai-config.ts
// ============================================================================

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
// Grounding funktioniert mit gemini-2.0-flash und höher
const GROUNDING_MODEL = AI_CONFIG.lastResortModel; // gemini-2.0-flash - stabil für Grounding

// ============================================================================
// TYPEN
// ============================================================================

interface VisibilityTestResult {
  query: string;
  description: string;
  mentioned: boolean;
  sentiment: 'positive' | 'neutral' | 'negative' | 'not_found';
  excerpt: string;
  competitors: string[];
}

interface DomainAnalysis {
  hasSchema: boolean;
  schemaTypes: string[];
  hasAboutPage: boolean;
  hasContactPage: boolean;
  hasAuthorInfo: boolean;
  contentQuality: 'high' | 'medium' | 'low';
  estimatedAuthority: number;
  title: string;
  description: string;
}

// ============================================================================
// HILFSFUNKTIONEN
// ============================================================================

function extractDomain(url: string): string {
  try {
    let cleanUrl = url.trim();
    if (!cleanUrl.startsWith('http')) {
      cleanUrl = 'https://' + cleanUrl;
    }
    const urlObj = new URL(cleanUrl);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return url.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
  }
}

/**
 * Formatiert Markdown zu lesbarem Text und entfernt "Such-Gedanken" der KI
 */
function formatResponseText(text: string): string {
  // Entfernt typische Grounding-Einleitungen am Anfang der Antwort
  let cleaned = text.replace(/^(Okay,|Ich habe|Ich werde|Lass mich|Sicher|Natürlich)\s.*?(suchen|finden|nachschauen|prüfen|hier sind|hier ist).*?(\n|\:|\. )/i, '');
  
  // Falls nach der Bereinigung noch "Okay, " am Anfang steht
  cleaned = cleaned.replace(/^Okay,?\s*/i, '');

  let formatted = cleaned
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>')
    .replace(/^[-•]\s+(.+)$/gm, '• $1');
  
  // Zeilenumbrüche und Abstände optimieren
  formatted = formatted.replace(/<\/strong>\s*\n+/g, '</strong> ');
  formatted = formatted.replace(/\n+\s*<strong>/g, ' <strong>');
  formatted = formatted.replace(/\n{3,}/g, '\n\n');
  formatted = formatted.replace(/\n\n/g, '<br><br>');
  formatted = formatted.replace(/\n(•)/g, '<br>$1');
  formatted = formatted.replace(/\n/g, ' ');
  formatted = formatted.replace(/\s{2,}/g, ' ');
  formatted = formatted.replace(/\s+([.,!?:;])/g, '$1');
  
  return formatted.trim();
}

/**
 * Crawlt die Website und analysiert KI-relevante Faktoren
 */
async function analyzeDomainForAI(url: string): Promise<DomainAnalysis> {
  const result: DomainAnalysis = {
    hasSchema: false,
    schemaTypes: [],
    hasAboutPage: false,
    hasContactPage: false,
    hasAuthorInfo: false,
    contentQuality: 'medium',
    estimatedAuthority: 50,
    title: '',
    description: '',
  };

  try {
    let cleanUrl = url.trim();
    if (!cleanUrl.startsWith('http')) {
      cleanUrl = 'https://' + cleanUrl;
    }

    const res = await fetch(cleanUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AIVisibilityChecker/1.0)',
        'Accept': 'text/html',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) return result;

    const html = await res.text();
    const $ = cheerio.load(html);

    // Title & Description
    result.title = $('title').text().trim();
    result.description = $('meta[name="description"]').attr('content') || '';

    // Schema.org JSON-LD prüfen
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const json = JSON.parse($(el).html() || '');
        result.hasSchema = true;
        
        if (json['@type']) {
          result.schemaTypes.push(json['@type']);
        }
        if (json['@graph']) {
          json['@graph'].forEach((item: any) => {
            if (item['@type'] && !result.schemaTypes.includes(item['@type'])) {
              result.schemaTypes.push(item['@type']);
            }
          });
        }
      } catch {}
    });

    // Links auf About/Kontakt Seiten prüfen
    const links = $('a').map((_, el) => $(el).attr('href')?.toLowerCase() || '').get();
    result.hasAboutPage = links.some(l => 
      l.includes('/about') || l.includes('/ueber-uns') || l.includes('/über-uns') || 
      l.includes('/unternehmen') || l.includes('/team') || l.includes('/wir')
    );
    result.hasContactPage = links.some(l => 
      l.includes('/contact') || l.includes('/kontakt') || l.includes('/impressum')
    );

    // Autor-Infos prüfen
    result.hasAuthorInfo = 
      $('[rel="author"]').length > 0 ||
      $('[class*="author"]').length > 0 ||
      $('[itemprop="author"]').length > 0 ||
      result.schemaTypes.includes('Person') ||
      html.toLowerCase().includes('geschäftsführer') ||
      html.toLowerCase().includes('inhaber');

    // Content-Qualität schätzen
    const textLength = $('body').text().replace(/\s+/g, ' ').trim().length;
    const h2Count = $('h2').length;
    const imgCount = $('img').length;

    if (textLength > 3000 && h2Count >= 3 && imgCount >= 2) {
      result.contentQuality = 'high';
    } else if (textLength > 1000 && h2Count >= 1) {
      result.contentQuality = 'medium';
    } else {
      result.contentQuality = 'low';
    }

    // Authority Score berechnen
    let score = 50;
    if (result.hasSchema) score += 15;
    if (result.schemaTypes.length >= 3) score += 10;
    if (result.hasAboutPage) score += 5;
    if (result.hasContactPage) score += 5;
    if (result.hasAuthorInfo) score += 10;
    if (result.contentQuality === 'high') score += 10;
    if (result.contentQuality === 'low') score -= 15;
    
    result.estimatedAuthority = Math.min(100, Math.max(0, score));

  } catch (error) {
    console.error('[AI Visibility] Domain Analysis Error:', error);
  }

  return result;
}

/**
 * Ruft Gemini API DIREKT mit Google Search Grounding auf (REST API)
 */
async function callGeminiWithGrounding(prompt: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GROUNDING_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  
  const requestBody = {
    contents: [{
      role: "user",
      parts: [{ text: prompt }]
    }],
    tools: [{
      google_search: {}  // REST API Syntax für Grounding!
    }],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 2048  // Erhöht für vollständige Antworten
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(45000), // 45 Sekunden Timeout
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[AI Visibility] Gemini API Error:', response.status, errorText);
    throw new Error(`Gemini API Error: ${response.status}`);
  }

  const data = await response.json();
  
  // ALLE Parts aus der Response extrahieren und zusammenfügen
  const candidate = data.candidates?.[0];
  if (!candidate?.content?.parts) {
    console.warn('[AI Visibility] Keine Parts in Response:', JSON.stringify(data).substring(0, 500));
    return '';
  }
  
  // Alle Text-Parts zusammenfügen
  const allText = candidate.content.parts
    .filter((part: any) => part.text)
    .map((part: any) => part.text)
    .join('\n');
  
  // Debug: Zeige wie viele Parts und Finish-Reason
  console.log(`[AI Visibility] Response: ${candidate.content.parts.length} parts, finish: ${candidate.finishReason}`);
  
  return allText;
}

/**
 * Führt einen KI-Sichtbarkeitstest MIT GOOGLE SEARCH GROUNDING durch
 */
async function testVisibilityWithGrounding(
  domain: string, 
  prompt: string,
  description: string
): Promise<VisibilityTestResult> {
  const result: VisibilityTestResult = {
    query: prompt.split('\n')[0].substring(0, 100),
    description,
    mentioned: false,
    sentiment: 'not_found',
    excerpt: '',
    competitors: [],
  };

  try {
    // Gemini mit Grounding aufrufen
    const text = await callGeminiWithGrounding(prompt);
    const formattedText = formatResponseText(text);
    const textLower = text.toLowerCase();
    const domainLower = domain.toLowerCase();
    const domainBase = domain.split('.')[0].toLowerCase();

    // Prüfen ob Domain erwähnt wird
    result.mentioned = textLower.includes(domainLower) || textLower.includes(domainBase);

    if (result.mentioned) {
      // Sentiment analysieren
      const positiveWords = ['empfehlenswert', 'qualität', 'professionell', 'zuverlässig', 
        'gute bewertungen', 'positive', 'zufrieden', 'top', 'ausgezeichnet',
        'spezialist', 'experte', 'erfahren', 'hochwertig', 'vertrauenswürdig', 'sterne'];
      const negativeWords = ['keine informationen', 'nicht gefunden', 'keine ergebnisse', 
        'keine bewertungen', 'nicht bekannt', 'keine erwähnungen', 'vorsicht', 'warnung'];
      
      const positiveScore = positiveWords.filter(w => textLower.includes(w)).length;
      const negativeScore = negativeWords.filter(w => textLower.includes(w)).length;
      
      if (positiveScore > negativeScore) result.sentiment = 'positive';
      else if (negativeScore > positiveScore) result.sentiment = 'negative';
      else result.sentiment = 'neutral';
      
      // Excerpt (formatiert)
      result.excerpt = formattedText.length > 500 
        ? formattedText.substring(0, 500) + '...' 
        : formattedText;
    } else {
      result.excerpt = formattedText.length > 300 
        ? formattedText.substring(0, 300) + '...' 
        : formattedText;
    }

    // Konkurrenten extrahieren
    const urlRegex = /(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9][-a-zA-Z0-9]{2,}\.[a-zA-Z]{2,}(?:\.[a-zA-Z]{2,})?)/gi;
    const matches = text.match(urlRegex) || [];
    result.competitors = [...new Set(matches)]
      .map(m => m.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0].toLowerCase())
      .filter(d => 
        !d.includes(domainBase) && 
        !d.includes('google') && 
        !d.includes('schema.org') &&
        !d.includes('facebook') &&
        !d.includes('instagram') &&
        d.length > 5
      )
      .slice(0, 5);

  } catch (error) {
    console.error('[AI Visibility] Grounding Test Error:', error);
    result.excerpt = 'Test fehlgeschlagen: ' + (error as Error).message;
  }

  return result;
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

export async function POST(req: NextRequest) {
  try {
    // Auth Check
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
    }

    const { role } = session.user;
    if (role !== 'ADMIN' && role !== 'SUPERADMIN') {
      return NextResponse.json({ message: 'Zugriff verweigert' }, { status: 403 });
    }

    const { domain, branche } = await req.json();

    if (!domain) {
      return NextResponse.json({ message: 'Domain ist erforderlich' }, { status: 400 });
    }

    const cleanDomain = extractDomain(domain);
    const brancheText = branche || 'allgemein';

    console.log(`[AI Visibility] Starte Check für: ${cleanDomain} (${brancheText})`);

    // 1. Domain-Analyse (Crawling)
    const domainAnalysis = await analyzeDomainForAI(domain);
    console.log('[AI Visibility] Domain Analysis:', {
      hasSchema: domainAnalysis.hasSchema,
      schemaTypes: domainAnalysis.schemaTypes.length,
      title: domainAnalysis.title?.substring(0, 50)
    });

    // 2. Test-Queries MIT GROUNDING
    const testQueries = [
      {
        prompt: `Suche im Web nach der Website **${cleanDomain}** und beschreibe:

1. Was bietet dieses Unternehmen/diese Website an?
2. Wo ist der Standort (Stadt, Land)?
3. Welche konkreten Informationen findest du?

**Wichtig:** 
- Schreibe den Firmennamen/Domain immer **fett**
- Nutze kurze, klare Sätze
- Wenn du nichts findest, sage klar: "Zu **${cleanDomain}** konnte ich keine Informationen im Web finden."

Antworte auf Deutsch in 3-5 Sätzen.`,
        description: 'Bekanntheit im Web'
      },
      {
        prompt: brancheText !== 'allgemein'
          ? `Suche nach den **besten Anbietern für "${brancheText}"** in Österreich.

Nenne **5-8 empfehlenswerte Unternehmen/Websites**:
- **Firmenname** – Website – kurze Beschreibung

Prüfe auch: Wird **${cleanDomain}** in diesem Bereich erwähnt oder empfohlen?

Formatiere als übersichtliche Liste. Antworte auf Deutsch.`
          : `Suche nach empfehlenswerten **Webentwicklern und Digital-Agenturen** in Österreich.

Nenne **5-8 bekannte Anbieter** mit Website. Antworte auf Deutsch.`,
        description: 'Empfehlungen in der Branche'
      },
      {
        prompt: `Suche nach **Bewertungen und Rezensionen** zu **${cleanDomain}**.

Prüfe:
- Google Reviews / Google Maps
- Trustpilot, ProvenExpert oder ähnliche Plattformen
- Erwähnungen in Foren oder Artikeln

Fasse zusammen:
- **Bewertung:** (z.B. "4.5 Sterne bei Google")
- **Kundenmeinungen:** Was sagen Kunden?

Wenn keine Bewertungen vorhanden sind, sage: "Zu **${cleanDomain}** sind keine Online-Bewertungen zu finden."

Antworte auf Deutsch.`,
        description: 'Online-Reputation'
      },
      {
        prompt: `Suche nach **externen Erwähnungen** von **${cleanDomain}**:

- Einträge in Branchenverzeichnissen (Herold, WKO, Gelbe Seiten, etc.)
- Links von anderen Websites
- Erwähnungen in Artikeln oder Blogs
- Social Media Profile

Liste gefundene Erwähnungen auf. Wenn nichts gefunden wird: "Zu **${cleanDomain}** wurden keine externen Erwähnungen gefunden."

Antworte auf Deutsch.`,
        description: 'Externe Erwähnungen'
      }
    ];

    // 3. Tests durchführen (sequentiell wegen Rate-Limits)
    const testResults: VisibilityTestResult[] = [];
    
    for (const test of testQueries) {
      console.log(`[AI Visibility] Test: ${test.description}...`);
      const result = await testVisibilityWithGrounding(cleanDomain, test.prompt, test.description);
      testResults.push(result);
      console.log(`[AI Visibility] → ${result.mentioned ? '✅ Erwähnt' : '❌ Nicht erwähnt'} (${result.sentiment})`);
      
      // Pause zwischen Requests
      await new Promise(resolve => setTimeout(resolve, 800));
    }

    // 4. Gesamt-Score berechnen
    const mentionCount = testResults.filter(r => r.mentioned).length;
    const mentionRate = (mentionCount / testResults.length) * 100;
    const positiveCount = testResults.filter(r => r.sentiment === 'positive').length;
    
    // Gewichteter Score
    let visibilityScore = 0;
    visibilityScore += (mentionCount / testResults.length) * 40; // 40% für Erwähnungen
    visibilityScore += domainAnalysis.estimatedAuthority * 0.35; // 35% für technische Faktoren
    visibilityScore += (positiveCount / testResults.length) * 25; // 25% für positive Sentiments
    visibilityScore = Math.round(Math.min(100, visibilityScore));

    // Alle Konkurrenten sammeln
    const allCompetitors = [...new Set(testResults.flatMap(r => r.competitors))].slice(0, 10);

    console.log(`[AI Visibility] Score: ${visibilityScore}/100 (${mentionCount}/${testResults.length} erwähnt)`);

    // 5. Score-Kategorie bestimmen
    let scoreCategory: { label: string; color: string; icon: string; bgColor: string };
    if (visibilityScore >= 65) {
      scoreCategory = { label: 'Gut sichtbar', color: 'text-emerald-600', icon: 'bi-check-circle-fill', bgColor: 'bg-emerald-50 border-emerald-200' };
    } else if (visibilityScore >= 35) {
      scoreCategory = { label: 'Ausbaufähig', color: 'text-amber-600', icon: 'bi-exclamation-circle-fill', bgColor: 'bg-amber-50 border-amber-200' };
    } else {
      scoreCategory = { label: 'Kaum sichtbar', color: 'text-rose-600', icon: 'bi-x-circle-fill', bgColor: 'bg-rose-50 border-rose-200' };
    }

    // 6. Report HTML generieren
    const reportDate = new Date().toLocaleDateString('de-DE', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });

    // Test-Ergebnisse HTML
    const testResultsHTML = testResults.map((r) => {
      const statusIcon = r.mentioned 
        ? '<i class="bi bi-check-circle-fill text-emerald-500"></i>' 
        : '<i class="bi bi-x-circle-fill text-rose-400"></i>';
      
      const sentimentBadge = r.mentioned
        ? `<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
            r.sentiment === 'positive' ? 'bg-emerald-100 text-emerald-700' :
            r.sentiment === 'negative' ? 'bg-rose-100 text-rose-700' :
            'bg-surface-secondary text-body'
          }">${r.sentiment}</span>`
        : '<span class="text-faint text-xs">Nicht erwähnt</span>';
      
      return `
        <details class="border border-theme-border-subtle rounded-lg mb-2 overflow-hidden">
          <summary class="flex items-center gap-3 p-3 cursor-pointer hover:bg-surface-secondary transition-colors">
            <div class="shrink-0">${statusIcon}</div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-strong">${r.description}</p>
            </div>
            ${sentimentBadge}
            <i class="bi bi-chevron-down text-faint transition-transform"></i>
          </summary>
          <div class="p-3 pt-0 border-t border-theme-border-subtle bg-surface-secondary/50">
            <div class="text-sm text-secondary leading-relaxed">${r.excerpt || 'Keine Details verfügbar'}</div>
            ${r.competitors.length > 0 ? `
              <div class="mt-2 pt-2 border-t border-theme-border-subtle">
                <p class="text-xs text-muted mb-1">Erwähnte Alternativen:</p>
                <div class="flex flex-wrap gap-1">
                  ${r.competitors.map(c => `<span class="px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs">${c}</span>`).join('')}
                </div>
              </div>
            ` : ''}
          </div>
        </details>
      `;
    }).join('');

    // Schema-Status HTML
    const schemaHTML = domainAnalysis.hasSchema
      ? `<div class="flex items-center gap-2 text-emerald-600">
           <i class="bi bi-check-circle-fill"></i> 
           <span class="text-sm">${domainAnalysis.schemaTypes.slice(0, 5).join(', ')}</span>
         </div>`
      : `<div class="flex items-center gap-2 text-rose-500">
           <i class="bi bi-x-circle-fill"></i> 
           <span class="text-sm">Kein Schema.org Markup gefunden</span>
         </div>`;

    // Konkurrenten HTML
    const competitorsHTML = allCompetitors.length > 0
      ? allCompetitors.map(c => `<a href="https://${c}" target="_blank" class="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded text-sm transition-colors">${c}</a>`).join(' ')
      : '<span class="text-faint text-sm italic">Keine Konkurrenten in KI-Antworten identifiziert</span>';

    // Empfehlungen basierend auf Analyse
    const recommendations: string[] = [];
    if (!domainAnalysis.hasSchema) {
      recommendations.push('Schema.org Markup (JSON-LD) implementieren – besonders LocalBusiness oder Organization');
    }
    if (mentionCount === 0) {
      recommendations.push('Online-Präsenz durch Google Business Profile und Branchenverzeichnisse aufbauen');
    }
    if (positiveCount === 0 && mentionCount > 0) {
      recommendations.push('Aktiv Kundenbewertungen auf Google und anderen Plattformen sammeln');
    }
    if (!domainAnalysis.hasAboutPage || !domainAnalysis.hasAuthorInfo) {
      recommendations.push('E-E-A-T Signale stärken: Über-uns Seite mit Team-Fotos und Qualifikationen');
    }
    if (domainAnalysis.contentQuality !== 'high') {
      recommendations.push('Content-Qualität verbessern: Längere, strukturierte Inhalte mit Mehrwert');
    }

    // Vollständiger HTML Report
    const reportHTML = `
<div class="${STYLES.container}">

<!-- HEADER -->
<div class="${STYLES.cardHeader} flex items-center justify-between">
  <div>
    <p class="text-indigo-200 text-[10px] uppercase tracking-wider font-medium"><i class="bi bi-robot"></i> KI-Sichtbarkeits-Audit</p>
    <h2 class="text-lg font-bold mt-0.5">${cleanDomain}</h2>
    <p class="text-indigo-200 text-xs mt-1">Branche: ${brancheText}</p>
  </div>
  <div class="text-right">
    <div class="text-3xl font-black text-white">${visibilityScore}</div>
    <div class="text-[10px] text-indigo-200 uppercase">Score</div>
  </div>
</div>

<!-- SCORE CARD -->
<div class="${scoreCategory.bgColor} border rounded-xl p-4 flex items-center justify-between">
  <div class="flex items-center gap-3">
    <i class="${scoreCategory.icon} ${scoreCategory.color} text-xl"></i>
    <div>
      <p class="font-bold ${scoreCategory.color}">${scoreCategory.label}</p>
      <p class="text-xs text-secondary">${mentionCount} von ${testResults.length} KI-Tests erfolgreich</p>
    </div>
  </div>
  <div class="text-right">
    <div class="text-2xl font-bold ${scoreCategory.color}">${mentionRate.toFixed(0)}%</div>
    <div class="text-[10px] text-muted uppercase">Erwähnungsrate</div>
  </div>
</div>

<!-- METRIKEN -->
<div class="${STYLES.grid4}">
  <div class="${STYLES.metricCard}">
    <div class="${STYLES.metricValue} ${domainAnalysis.hasSchema ? 'text-emerald-600' : 'text-rose-500'}">${domainAnalysis.hasSchema ? '✓' : '✗'}</div>
    <div class="${STYLES.metricLabel}">Schema</div>
  </div>
  <div class="${STYLES.metricCard}">
    <div class="${STYLES.metricValue} ${domainAnalysis.hasAuthorInfo ? 'text-emerald-600' : 'text-rose-500'}">${domainAnalysis.hasAuthorInfo ? '✓' : '✗'}</div>
    <div class="${STYLES.metricLabel}">E-E-A-T</div>
  </div>
  <div class="${STYLES.metricCard}">
    <div class="${STYLES.metricValue}">${domainAnalysis.estimatedAuthority}</div>
    <div class="${STYLES.metricLabel}">Authority</div>
  </div>
  <div class="${STYLES.metricCard}">
    <div class="${STYLES.metricValue} ${domainAnalysis.contentQuality === 'high' ? 'text-emerald-600' : domainAnalysis.contentQuality === 'low' ? 'text-rose-500' : 'text-amber-500'}">${domainAnalysis.contentQuality === 'high' ? 'A' : domainAnalysis.contentQuality === 'medium' ? 'B' : 'C'}</div>
    <div class="${STYLES.metricLabel}">Content</div>
  </div>
</div>

<!-- TEST-ERGEBNISSE -->
<div class="${STYLES.card}">
  <h4 class="${STYLES.h4}"><i class="bi bi-search ${STYLES.iconIndigo}"></i> Gemini Live-Tests (mit Web-Suche)</h4>
  <p class="text-xs text-muted mb-3">Echte Web-Suchen mit Google Search Grounding</p>
  ${testResultsHTML}
</div>

<!-- SCHEMA STATUS -->
<div class="${STYLES.card}">
  <h4 class="${STYLES.h4}"><i class="bi bi-code-slash ${STYLES.iconIndigo}"></i> Strukturierte Daten (Schema.org)</h4>
  ${schemaHTML}
  ${!domainAnalysis.hasSchema ? `
  <div class="${STYLES.warningBox} mt-3">
    <p class="${STYLES.pSmall}"><i class="bi bi-exclamation-triangle"></i> <strong>Wichtig:</strong> Ohne Schema.org Markup ist es für KI-Systeme schwerer, den Inhalt zu verstehen.</p>
  </div>
  ` : ''}
</div>

<!-- KONKURRENTEN -->
${allCompetitors.length > 0 ? `
<div class="${STYLES.card}">
  <h4 class="${STYLES.h4}"><i class="bi bi-people ${STYLES.iconIndigo}"></i> Konkurrenten in KI-Antworten</h4>
  <p class="${STYLES.pSmall} mb-3">Diese Domains werden von Gemini bei Fragen zu "${brancheText}" erwähnt:</p>
  <div class="flex flex-wrap gap-2">
    ${competitorsHTML}
  </div>
</div>
` : ''}

<!-- E-E-A-T CHECK -->
<div class="${STYLES.card}">
  <h4 class="${STYLES.h4}"><i class="bi bi-shield-check ${STYLES.iconIndigo}"></i> E-E-A-T Signale</h4>
  <div class="space-y-2">
    <div class="flex items-center justify-between py-2 border-b border-theme-border-subtle">
      <span class="text-sm text-body">About/Team-Seite</span>
      <span class="${domainAnalysis.hasAboutPage ? 'text-emerald-600' : 'text-rose-500'}">${domainAnalysis.hasAboutPage ? '<i class="bi bi-check-circle-fill"></i> Vorhanden' : '<i class="bi bi-x-circle-fill"></i> Fehlt'}</span>
    </div>
    <div class="flex items-center justify-between py-2 border-b border-theme-border-subtle">
      <span class="text-sm text-body">Kontakt/Impressum</span>
      <span class="${domainAnalysis.hasContactPage ? 'text-emerald-600' : 'text-rose-500'}">${domainAnalysis.hasContactPage ? '<i class="bi bi-check-circle-fill"></i> Vorhanden' : '<i class="bi bi-x-circle-fill"></i> Fehlt'}</span>
    </div>
    <div class="flex items-center justify-between py-2">
      <span class="text-sm text-body">Autor-Informationen</span>
      <span class="${domainAnalysis.hasAuthorInfo ? 'text-emerald-600' : 'text-rose-500'}">${domainAnalysis.hasAuthorInfo ? '<i class="bi bi-check-circle-fill"></i> Vorhanden' : '<i class="bi bi-x-circle-fill"></i> Fehlt'}</span>
    </div>
  </div>
</div>

<!-- EMPFEHLUNGEN -->
${recommendations.length > 0 ? `
<div class="${STYLES.recommendBox}">
  <h4 class="font-semibold text-white mb-3"><i class="bi bi-lightbulb-fill"></i> Top Empfehlungen</h4>
  <div class="space-y-2">
    ${recommendations.slice(0, 4).map((rec, i) => `
      <div class="flex items-start gap-3 bg-white/10 rounded-lg p-3">
        <span class="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold text-white shrink-0">${i + 1}</span>
        <span class="text-sm text-indigo-100">${rec}</span>
      </div>
    `).join('')}
  </div>
</div>
` : ''}

<!-- FAZIT -->
<div class="${visibilityScore >= 65 ? STYLES.fazitPositive : visibilityScore >= 35 ? STYLES.fazitWarning : STYLES.fazitNegative}">
  <div class="flex items-start gap-3">
    <i class="bi ${visibilityScore >= 65 ? 'bi-trophy-fill text-emerald-600' : visibilityScore >= 35 ? 'bi-exclamation-triangle-fill text-amber-600' : 'bi-exclamation-octagon-fill text-rose-600'} text-xl"></i>
    <div>
      <p class="font-bold text-sm ${visibilityScore >= 65 ? 'text-emerald-800' : visibilityScore >= 35 ? 'text-amber-800' : 'text-rose-800'}">
        ${visibilityScore >= 65 ? 'Gute KI-Sichtbarkeit!' : visibilityScore >= 35 ? 'KI-Sichtbarkeit ausbaufähig' : 'Geringe KI-Sichtbarkeit'}
      </p>
      <p class="text-sm mt-1 ${visibilityScore >= 65 ? 'text-emerald-700' : visibilityScore >= 35 ? 'text-amber-700' : 'text-rose-700'}">
        ${visibilityScore >= 65 
          ? `${cleanDomain} wird von Gemini erkannt und in ${mentionCount} von ${testResults.length} relevanten Suchanfragen erwähnt.` 
          : visibilityScore >= 35
            ? `${cleanDomain} wird teilweise erkannt. Mit den Empfehlungen oben kann die Sichtbarkeit verbessert werden.`
            : `${cleanDomain} wird von Gemini kaum gefunden. Fokussiere auf die Empfehlungen, um die Online-Präsenz zu stärken.`
        }
      </p>
    </div>
  </div>
</div>

<!-- FOOTER -->
<p class="${STYLES.footer}"><i class="bi bi-robot"></i> KI-Sichtbarkeits-Check · Mit Google Search Grounding · ${reportDate}</p>

</div>`;

    // Response als Stream (für Kompatibilität mit Frontend)
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(reportHTML));
        controller.close();
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'X-Visibility-Score': visibilityScore.toString(),
        'X-Mention-Rate': mentionRate.toFixed(0),
      },
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler';
    console.error('❌ AI Visibility Check Error:', error);
    return NextResponse.json({ message: errorMessage }, { status: 500 });
  }
}
