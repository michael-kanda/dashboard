// src/lib/intent-analyzer.ts
// Intelligente Suchintentions-Analyse für SEO-optimierten Content

// ============================================================================
// TYPES
// ============================================================================

export type SearchIntent = 
  | 'informational'    // Nutzer will lernen/verstehen
  | 'navigational'     // Nutzer sucht spezifische Website/Marke
  | 'commercial'       // Nutzer vergleicht/recherchiert vor Kauf
  | 'transactional';   // Nutzer will kaufen/buchen/handeln

export type IntentConfidence = 'high' | 'medium' | 'low';

export interface IntentAnalysis {
  keyword: string;
  primaryIntent: SearchIntent;
  secondaryIntent?: SearchIntent;
  confidence: IntentConfidence;
  signals: IntentSignal[];
  contentRecommendations: ContentRecommendation[];
}

export interface IntentSignal {
  type: 'keyword_pattern' | 'question_word' | 'modifier' | 'brand' | 'action_verb';
  value: string;
  weight: number; // 1-10
  description: string;
}

export interface ContentRecommendation {
  element: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  description: string;
}

// ============================================================================
// SIGNAL PATTERNS (Deutsch & Englisch)
// ============================================================================

const INTENT_PATTERNS = {
  // TRANSACTIONAL: Klare Kaufabsicht
  transactional: {
    de: [
      { pattern: /\b(kaufen|bestellen|buchen|reservieren|mieten)\b/i, weight: 10, desc: 'Direkter Kaufwunsch' },
      { pattern: /\b(preis|kosten|tarif|gebühr|angebot)\b/i, weight: 9, desc: 'Preisfokus' },
      { pattern: /\b(shop|store|onlineshop|webshop)\b/i, weight: 8, desc: 'Shopping-Kontext' },
      { pattern: /\b(günstig|billig|rabatt|angebot|sale)\b/i, weight: 8, desc: 'Schnäppchen-Suche' },
      { pattern: /\b(lieferung|versand|verfügbar|lager)\b/i, weight: 7, desc: 'Kauf-Vorbereitung' },
      { pattern: /\b(jetzt|sofort|direkt)\b/i, weight: 6, desc: 'Dringlichkeit' },
    ],
    en: [
      { pattern: /\b(buy|purchase|order|book|rent)\b/i, weight: 10, desc: 'Direct buy intent' },
      { pattern: /\b(price|cost|pricing|fee|deal)\b/i, weight: 9, desc: 'Price focus' },
      { pattern: /\b(cheap|discount|sale|offer|coupon)\b/i, weight: 8, desc: 'Bargain hunting' },
      { pattern: /\b(shipping|delivery|stock|available)\b/i, weight: 7, desc: 'Purchase prep' },
    ]
  },

  // COMMERCIAL: Vergleich & Recherche vor Kauf
  commercial: {
    de: [
      { pattern: /\b(beste|bester|bestes|top)\b/i, weight: 9, desc: 'Suche nach Bestem' },
      { pattern: /\b(vergleich|vs|versus|oder)\b/i, weight: 10, desc: 'Direkte Vergleichsabsicht' },
      { pattern: /\b(test|testbericht|erfahrung|bewertung|review)\b/i, weight: 9, desc: 'Research Intent' },
      { pattern: /\b(empfehlung|tipps|ratgeber)\b/i, weight: 8, desc: 'Beratung gewünscht' },
      { pattern: /\b(alternative|statt|ersatz)\b/i, weight: 8, desc: 'Optionen vergleichen' },
      { pattern: /\b(vor-?\s?nachteile|pro-?\s?contra)\b/i, weight: 9, desc: 'Abwägung' },
      { pattern: /\b(lohnt|sinnvoll|wert)\b/i, weight: 7, desc: 'Wert-Bewertung' },
    ],
    en: [
      { pattern: /\b(best|top|leading)\b/i, weight: 9, desc: 'Best option search' },
      { pattern: /\b(vs|versus|compare|comparison)\b/i, weight: 10, desc: 'Comparison intent' },
      { pattern: /\b(review|rating|testimonial)\b/i, weight: 9, desc: 'Research intent' },
      { pattern: /\b(alternative|instead|replace)\b/i, weight: 8, desc: 'Options comparison' },
    ]
  },

  // NAVIGATIONAL: Spezifische Marke/Website
  navigational: {
    de: [
      { pattern: /\b(login|anmelden|einloggen)\b/i, weight: 10, desc: 'Login-Suche' },
      { pattern: /\b(kontakt|impressum|adresse)\b/i, weight: 9, desc: 'Firmen-Info' },
      { pattern: /\b(standort|filiale|öffnungszeiten)\b/i, weight: 9, desc: 'Lokale Suche' },
      { pattern: /\b(karriere|jobs|stellenangebote)\b/i, weight: 8, desc: 'Karriere-Seite' },
      { pattern: /\b(support|hilfe|kundenservice)\b/i, weight: 8, desc: 'Support-Seite' },
    ],
    en: [
      { pattern: /\b(login|sign in|account)\b/i, weight: 10, desc: 'Login search' },
      { pattern: /\b(contact|location|hours)\b/i, weight: 9, desc: 'Company info' },
      { pattern: /\b(careers|jobs|hiring)\b/i, weight: 8, desc: 'Career page' },
    ]
  },

  // INFORMATIONAL: Lernen, Verstehen (Default)
  informational: {
    de: [
      { pattern: /\b(was ist|was sind|wie funktioniert)\b/i, weight: 10, desc: 'Definition gesucht' },
      { pattern: /\b(warum|wieso|weshalb)\b/i, weight: 9, desc: 'Begründung gesucht' },
      { pattern: /\b(anleitung|tutorial|guide|lernen)\b/i, weight: 9, desc: 'How-to Intent' },
      { pattern: /\b(bedeutung|definition|erklärung)\b/i, weight: 8, desc: 'Wissensfrage' },
      { pattern: /\b(beispiel|beispiele|arten)\b/i, weight: 7, desc: 'Verständnis vertiefen' },
      { pattern: /\b(unterschied|vergleich zwischen)\b/i, weight: 8, desc: 'Konzept-Vergleich' },
    ],
    en: [
      { pattern: /\b(what is|how to|how does)\b/i, weight: 10, desc: 'Definition/How-to' },
      { pattern: /\b(why|when|where)\b/i, weight: 9, desc: 'Understanding' },
      { pattern: /\b(guide|tutorial|learn|tips)\b/i, weight: 9, desc: 'Educational' },
      { pattern: /\b(meaning|definition|explain)\b/i, weight: 8, desc: 'Knowledge query' },
    ]
  }
};

// W-Frage-Wörter (deutet auf informational)
const QUESTION_WORDS = {
  de: ['was', 'wie', 'wo', 'wer', 'warum', 'wann', 'welche', 'welcher', 'welches', 'wieso', 'weshalb'],
  en: ['what', 'how', 'where', 'who', 'why', 'when', 'which']
};

// Marken-Keywords (für navigational, muss angepasst werden)
const BRAND_PATTERNS = [
  /\b(google|facebook|amazon|apple|microsoft)\b/i,
  /\b(designare|evita)\b/i, // Deine eigenen Brands
];

// ============================================================================
// MAIN ANALYSIS FUNCTION
// ============================================================================

/**
 * Analysiert die Suchintention eines Keywords
 * @param keyword - Das zu analysierende Keyword
 * @param context - Optional: Zusätzlicher Kontext (z.B. Domain)
 * @returns IntentAnalysis mit allen Erkenntnissen
 */
export function analyzeSearchIntent(
  keyword: string, 
  context?: { domain?: string; language?: 'de' | 'en' }
): IntentAnalysis {
  const lang = context?.language || detectLanguage(keyword);
  const signals: IntentSignal[] = [];
  
  // 1. Pattern Matching für alle Intent-Typen
  const intentScores = {
    transactional: 0,
    commercial: 0,
    navigational: 0,
    informational: 0
  };

  // Durchsuche alle Pattern-Kategorien
  for (const [intent, patterns] of Object.entries(INTENT_PATTERNS)) {
    const langPatterns = patterns[lang] || patterns.de;
    
    for (const { pattern, weight, desc } of langPatterns) {
      if (pattern.test(keyword)) {
        intentScores[intent as SearchIntent] += weight;
        signals.push({
          type: 'keyword_pattern',
          value: pattern.source,
          weight,
          description: desc
        });
      }
    }
  }

  // 2. Prüfe auf Frage-Format (stark informational)
  const questionWords = QUESTION_WORDS[lang] || QUESTION_WORDS.de;
  const firstWord = keyword.toLowerCase().split(/\s+/)[0];
  
  if (questionWords.includes(firstWord)) {
    intentScores.informational += 12;
    signals.push({
      type: 'question_word',
      value: firstWord,
      weight: 12,
      description: 'W-Frage erkannt → Wissensbedarf'
    });
  }

  // 3. Prüfe auf Marken-Namen (navigational)
  for (const brandPattern of BRAND_PATTERNS) {
    if (brandPattern.test(keyword)) {
      intentScores.navigational += 15;
      signals.push({
        type: 'brand',
        value: brandPattern.source,
        weight: 15,
        description: 'Marken-Keyword → Nutzer kennt Brand'
      });
    }
  }

  // 4. Prüfe auf Domain im Keyword (stark navigational)
  if (context?.domain) {
    const domainName = context.domain.replace(/^(https?:\/\/)?(www\.)?/, '').split('.')[0];
    if (keyword.toLowerCase().includes(domainName.toLowerCase())) {
      intentScores.navigational += 20;
      signals.push({
        type: 'brand',
        value: domainName,
        weight: 20,
        description: 'Domain-Name im Keyword → direkte Navigation'
      });
    }
  }

  // 5. Bestimme Primary & Secondary Intent
  const sortedIntents = Object.entries(intentScores)
    .sort(([, a], [, b]) => b - a);
  
  const primaryIntent = sortedIntents[0][0] as SearchIntent;
  const primaryScore = sortedIntents[0][1];
  const secondaryIntent = sortedIntents[1][1] > primaryScore * 0.5 
    ? sortedIntents[1][0] as SearchIntent 
    : undefined;

  // 6. Bestimme Confidence
  const confidence = determineConfidence(primaryScore, signals.length);

  // 7. Generiere Content-Empfehlungen
  const contentRecommendations = generateContentRecommendations(
    primaryIntent, 
    secondaryIntent,
    keyword
  );

  return {
    keyword,
    primaryIntent,
    secondaryIntent,
    confidence,
    signals,
    contentRecommendations
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Erkennt die Sprache des Keywords (simpel)
 */
function detectLanguage(keyword: string): 'de' | 'en' {
  const deIndicators = ['ä', 'ö', 'ü', 'ß'];
  const hasGermanChars = deIndicators.some(char => keyword.includes(char));
  
  if (hasGermanChars) return 'de';
  
  // Check common German words
  const deWords = ['und', 'oder', 'für', 'mit', 'von', 'zu', 'der', 'die', 'das'];
  const words = keyword.toLowerCase().split(/\s+/);
  const hasGermanWords = words.some(w => deWords.includes(w));
  
  return hasGermanWords ? 'de' : 'en';
}

/**
 * Bestimmt Confidence basierend auf Score und Signal-Anzahl
 */
function determineConfidence(score: number, signalCount: number): IntentConfidence {
  if (score >= 15 && signalCount >= 2) return 'high';
  if (score >= 8 && signalCount >= 1) return 'medium';
  return 'low';
}

/**
 * Generiert konkrete Content-Empfehlungen basierend auf Intent
 */
function generateContentRecommendations(
  primary: SearchIntent,
  secondary: SearchIntent | undefined,
  keyword: string
): ContentRecommendation[] {
  const recommendations: ContentRecommendation[] = [];

  switch (primary) {
    case 'transactional':
      recommendations.push(
        { 
          element: 'H1', 
          priority: 'critical', 
          description: 'Keyword + Handlungsaufforderung (z.B. "jetzt kaufen", "buchen")' 
        },
        { 
          element: 'Hero Section', 
          priority: 'critical', 
          description: 'Starker CTA above-the-fold mit Preis/Angebot' 
        },
        { 
          element: 'Produktdetails', 
          priority: 'high', 
          description: 'Preis, Lieferzeit, Verfügbarkeit prominent zeigen' 
        },
        { 
          element: 'Trust Elemente', 
          priority: 'high', 
          description: 'Gütesiegel, Zahlungsarten, Rückgaberecht' 
        },
        { 
          element: 'CTAs', 
          priority: 'critical', 
          description: 'Mehrere CTAs (Header, Mid-Content, Footer)' 
        }
      );
      break;

    case 'commercial':
      recommendations.push(
        { 
          element: 'H1', 
          priority: 'critical', 
          description: 'Vergleichs-orientiert (z.B. "Die besten X im Vergleich")' 
        },
        { 
          element: 'Vergleichstabelle', 
          priority: 'critical', 
          description: 'Feature-Vergleich mit Pro/Contra für jede Option' 
        },
        { 
          element: 'Bewertungskriterien', 
          priority: 'high', 
          description: 'Erkläre wie du bewertest (Transparenz)' 
        },
        { 
          element: 'Social Proof', 
          priority: 'high', 
          description: 'Kundenbewertungen, Erfahrungsberichte, Testergebnisse' 
        },
        { 
          element: 'FAQ', 
          priority: 'high', 
          description: 'Einwandbehandlung: Kosten, Lohnt es sich?, Alternativen' 
        },
        { 
          element: 'CTAs', 
          priority: 'medium', 
          description: 'Soft CTAs ("Mehr erfahren", "Vergleich ansehen")' 
        }
      );
      break;

    case 'navigational':
      recommendations.push(
        { 
          element: 'H1', 
          priority: 'critical', 
          description: 'Brand-Name + Service (z.B. "Designare - SEO Agentur Wien")' 
        },
        { 
          element: 'Navigation', 
          priority: 'critical', 
          description: 'Klare Menüstruktur zu allen wichtigen Seiten' 
        },
        { 
          element: 'Kontakt-Info', 
          priority: 'high', 
          description: 'Adresse, Telefon, Email prominent in Header/Footer' 
        },
        { 
          element: 'Über uns', 
          priority: 'high', 
          description: 'Team, Geschichte, Standort klar kommunizieren' 
        },
        { 
          element: 'Interne Links', 
          priority: 'medium', 
          description: 'Starke interne Verlinkung zu Haupt-Services' 
        }
      );
      break;

    case 'informational':
    default:
      recommendations.push(
        { 
          element: 'H1', 
          priority: 'critical', 
          description: 'Frage beantworten oder "Was ist X?" Format' 
        },
        { 
          element: 'Definition/Einleitung', 
          priority: 'critical', 
          description: 'Sofortige Antwort auf die Haupt-Frage im ersten Absatz' 
        },
        { 
          element: 'Inhaltsverzeichnis', 
          priority: 'high', 
          description: 'Ermöglicht schnelles Springen zu Unter-Themen' 
        },
        { 
          element: 'Detaillierte Erklärungen', 
          priority: 'high', 
          description: 'Tiefe, umfassende Antworten mit Beispielen' 
        },
        { 
          element: 'FAQ Section', 
          priority: 'high', 
          description: 'Verwandte W-Fragen beantworten' 
        },
        { 
          element: 'Visuelle Elemente', 
          priority: 'medium', 
          description: 'Diagramme, Infografiken zur besseren Verständlichkeit' 
        },
        { 
          element: 'CTAs', 
          priority: 'low', 
          description: 'Soft CTAs am Ende ("Mehr erfahren", "Kontakt für Beratung")' 
        }
      );
      break;
  }

  // Wenn Secondary Intent vorhanden, füge hybride Elemente hinzu
  if (secondary && secondary !== primary) {
    recommendations.push({
      element: 'Hybrid-Content',
      priority: 'medium',
      description: `Kombiniere ${primary} mit ${secondary}: z.B. Info-Content mit sanften Verkaufs-Elementen`
    });
  }

  return recommendations;
}

// ============================================================================
// BATCH ANALYSIS (für mehrere Keywords)
// ============================================================================

/**
 * Analysiert mehrere Keywords und findet dominanten Intent
 * @param keywords - Array von Keywords
 * @param context - Optional: Kontext-Daten
 * @returns Aggregierte Intent-Analyse
 */
export function analyzeBatchIntent(
  keywords: string[],
  context?: { domain?: string; language?: 'de' | 'en' }
): {
  dominantIntent: SearchIntent;
  intentDistribution: Record<SearchIntent, number>;
  detailedAnalyses: IntentAnalysis[];
} {
  if (keywords.length === 0) {
    return {
      dominantIntent: 'informational',
      intentDistribution: { informational: 0, commercial: 0, transactional: 0, navigational: 0 },
      detailedAnalyses: []
    };
  }

  const analyses = keywords.map(kw => analyzeSearchIntent(kw, context));
  
  // Zähle Intent-Verteilung
  const distribution: Record<SearchIntent, number> = {
    informational: 0,
    commercial: 0,
    transactional: 0,
    navigational: 0
  };

  analyses.forEach(a => {
    distribution[a.primaryIntent]++;
    if (a.secondaryIntent) {
      distribution[a.secondaryIntent] += 0.5; // Halber Punkt für Secondary
    }
  });

  // Finde dominanten Intent
  const sorted = Object.entries(distribution).sort(([, a], [, b]) => b - a);
  const dominantIntent = sorted[0][0] as SearchIntent;

  return {
    dominantIntent,
    intentDistribution: distribution,
    detailedAnalyses: analyses
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Prüft ob ein Keyword transactional ist (Kaufabsicht)
 */
export function isTransactional(keyword: string): boolean {
  const analysis = analyzeSearchIntent(keyword);
  return analysis.primaryIntent === 'transactional' && analysis.confidence !== 'low';
}

/**
 * Extrahiert die wichtigsten Intent-Signale
 */
function getTopSignals(analysis: IntentAnalysis, limit: number = 3): IntentSignal[] {
  return analysis.signals
    .sort((a, b) => b.weight - a.weight)
    .slice(0, limit);
}

/**
 * Generiert einen Human-Readable Intent-Report
 */
export function generateIntentReport(analysis: IntentAnalysis): string {
  const intentLabels = {
    informational: 'Informations-Suche',
    commercial: 'Vergleichs-/Research-Absicht',
    transactional: 'Kaufabsicht',
    navigational: 'Navigations-Absicht'
  };

  let report = `🎯 SUCHINTENTIONS-ANALYSE: "${analysis.keyword}"\n\n`;
  report += `Primäre Intention: ${intentLabels[analysis.primaryIntent]} (${analysis.confidence})\n`;
  
  if (analysis.secondaryIntent) {
    report += `Sekundäre Intention: ${intentLabels[analysis.secondaryIntent]}\n`;
  }

  report += `\n📊 ERKANNTE SIGNALE (Top ${Math.min(3, analysis.signals.length)}):\n`;
  getTopSignals(analysis).forEach((s, i) => {
    report += `${i + 1}. ${s.description} (Gewicht: ${s.weight})\n`;
  });

  report += `\n💡 CONTENT-EMPFEHLUNGEN:\n`;
  const criticalRecs = analysis.contentRecommendations.filter(r => r.priority === 'critical');
  criticalRecs.forEach((r, i) => {
    report += `${i + 1}. ${r.element}: ${r.description}\n`;
  });

  return report;
}
