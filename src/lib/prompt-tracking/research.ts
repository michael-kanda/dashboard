// src/lib/prompt-tracking/research.ts
//
// Reine Hilfsfunktionen und Typen für das admin-only Prompt Research Tool
// (ausgelagert aus src/components/PromptTrackingCard.tsx).

import type {
  ProjectDashboardData,
  PromptTrackingResult,
  PromptQueryData,
} from '@/lib/dashboard-shared';

export interface ResearchOpportunity {
  rank: number;
  score: number;
  topic: string;
  prompt: string;
  source: 'GSC' | 'GA4' | 'GSC + GA4';
  intent: 'Quick Win' | 'Buy Intent' | 'Optimierung';
  reason: string;
  action: string;
}

export interface ResearchSetup {
  domainLabel: string;
  industry: string;
  region: string;
  projectName: string;
  landingPage: string;
  topic: string;
  includeBrand: boolean;
  isLegal: boolean;
}

export interface ResearchSetupOverrides {
  industry?: string;
  region?: string;
  landingPage?: string;
  topic?: string;
  includeBrand?: boolean;
}

// ════════════════════════════════════════════════════════════════════
// All utility functions below are unchanged (logic only)
// ════════════════════════════════════════════════════════════════════

export function buildResearchSetup(
  data?: PromptTrackingResult,
  dashboardData?: ProjectDashboardData,
  domain?: string
): ResearchSetup {
  const corpus = [
    domain,
    ...(data?.brandKeywordsUsed ?? []),
    ...(data?.queries ?? []).slice(0, 30).map((q) => q.query),
    ...(dashboardData?.topQueries ?? []).slice(0, 20).map((q) => q.query),
    ...(dashboardData?.topConvertingPages ?? []).slice(0, 10).map((p) => p.path),
  ].filter(Boolean).join(' ');
  const isLegal = /\b(anwalt|rechtsanwalt|kanzlei|jurist|recht|scheidung|strafrecht|arbeitsrecht|erbrecht)\b/i.test(corpus);
  const projectName = getProjectName(domain, data?.brandKeywordsUsed);
  const landingPage = inferLandingPage(data, dashboardData);
  const topic = inferPrimaryTopic(data, dashboardData, projectName, isLegal);

  return {
    domainLabel: normalizeDomain(domain),
    industry: isLegal ? 'Rechtsanwalt / Kanzlei' : inferIndustry(corpus),
    region: inferRegion(corpus, domain),
    projectName,
    landingPage,
    topic,
    includeBrand: true,
    isLegal,
  };
}

export function buildResearchDataSummary(
  opportunities: Array<Omit<ResearchOpportunity, 'rank'>>,
  data?: PromptTrackingResult,
  dashboardData?: ProjectDashboardData,
) {
  return {
    gscQueries: (data?.totals.totalQueries ?? 0).toLocaleString('de-DE'),
    gscImpressions: (data?.totals.totalImpressions ?? 0).toLocaleString('de-DE'),
    gscClicks: (data?.totals.totalClicks ?? 0).toLocaleString('de-DE'),
    ga4Sessions: (dashboardData?.kpis?.sessions?.value ?? 0).toLocaleString('de-DE'),
    ga4Conversions: (dashboardData?.kpis?.conversions?.value ?? 0).toLocaleString('de-DE'),
    aiSessions: (dashboardData?.aiTraffic?.totalSessions ?? 0).toLocaleString('de-DE'),
    quickWins: opportunities.filter((item) => item.intent === 'Quick Win').length,
    buyIntent: opportunities.filter((item) => item.intent === 'Buy Intent').length,
    optimizationCandidates: opportunities.filter((item) => item.intent === 'Optimierung').length,
  };
}

export function buildResearchOpportunities(
  data?: PromptTrackingResult,
  dashboardData?: ProjectDashboardData,
  setup?: ResearchSetup
): ResearchOpportunity[] {
  const resolvedSetup = setup ?? buildResearchSetup(data, dashboardData);
  const conversionPaths = new Set(
    (dashboardData?.topConvertingPages ?? [])
      .filter((page) => (page.conversions ?? 0) > 0)
      .map((page) => normalizePath(page.path))
  );

  const focusLandingPath = normalizePath(resolvedSetup.landingPage);
  const hasFocusLandingPage = focusLandingPath !== '/';
  const effectiveSetup = hasFocusLandingPage
    ? resolvedSetup
    : { ...resolvedSetup, landingPage: '' };

  const queryCandidates = (data?.queries ?? [])
    .map((query): Omit<ResearchOpportunity, 'rank'> | null => {
      const topic = queryToResearchTopic(query.query, resolvedSetup.projectName, data?.brandKeywordsUsed, resolvedSetup.isLegal);
      // Per-Query-Topic ist die Wahrheit. setup.topic überschreibt nur, wenn
      // der User es manuell als Fokus gesetzt hat (= explizite Absicht).
      const focusTopic = resolvedSetup.topic.trim();
      const finalTopic = normalizeResearchTopic(focusTopic || topic, resolvedSetup.isLegal);
      if (!finalTopic) return null;
      const queryPath = query.url ? normalizePath(query.url) : '';
      const matchesFocusLandingPage = hasFocusLandingPage && queryPath === focusLandingPath;
      const hasConversionPath = queryPath ? conversionPaths.has(queryPath) || matchesFocusLandingPage : matchesFocusLandingPage;
      const buyIntent = hasBuyIntent(query.query, finalTopic, resolvedSetup.isLegal);
      const weakCtr = query.impressions >= 10 && query.ctr < 0.025;
      const rankablePosition = query.position >= 4 && query.position <= 18;
      // Score: keine Cluster-at-92-Falle mehr. Cap auf 100, sodass die wirklich
      // perfekten Queries 95-100 erreichen und schwächere klar darunter streuen.
      const score = Math.min(100, scoreOpportunity(query, buyIntent, rankablePosition, weakCtr, hasConversionPath) + (matchesFocusLandingPage ? 6 : 0));
      const intent: ResearchOpportunity['intent'] =
        buyIntent ? 'Buy Intent' :
        rankablePosition ? 'Quick Win' :
        'Optimierung';

      return {
        score, topic,
        prompt: buildDecisionPrompt(finalTopic, intent, effectiveSetup),
        source: hasConversionPath ? 'GSC + GA4' : 'GSC',
        intent, reason: `${query.impressions.toLocaleString('de-DE')} Impr., ${query.clicks.toLocaleString('de-DE')} Klicks, Pos. ${query.position.toFixed(1)}, CTR ${(query.ctr * 100).toFixed(1)} %.`,
        action: actionForOpportunity(intent, resolvedSetup.isLegal, hasConversionPath, finalTopic),
      } satisfies Omit<ResearchOpportunity, 'rank'>;
    })
    .filter((item): item is Omit<ResearchOpportunity, 'rank'> => Boolean(item));

  const pageCandidates: Array<Omit<ResearchOpportunity, 'rank'>> = (dashboardData?.topConvertingPages ?? [])
    .filter((page) => (page.conversions ?? 0) > 0 || normalizePath(page.path) === focusLandingPath)
    .slice(0, 4)
    .map((page) => {
      // Path-Topic primär, focus-Topic nur als Override wenn User es explizit gesetzt hat.
      const pageTopic = pathToTopic(page.path, resolvedSetup);
      const focusTopic = resolvedSetup.topic.trim();
      const topic = normalizeResearchTopic(focusTopic || pageTopic, resolvedSetup.isLegal);
      const matchesFocusLandingPage = normalizePath(page.path) === focusLandingPath;
      return {
        score: Math.min(100, 58 + Math.round((page.conversions ?? 0) * 3) + (matchesFocusLandingPage ? 6 : 0)),
        topic, prompt: buildDecisionPrompt(topic, 'Buy Intent', effectiveSetup),
        source: 'GA4', intent: 'Buy Intent',
        reason: `${(page.conversions ?? 0).toLocaleString('de-DE')} Conversions auf ${page.path}.`,
        action: `Decision-Prompt zu „${topic}" gegen diese Landingpage testen und Trust-/FAQ-Blöcke ergänzen.`,
      } satisfies Omit<ResearchOpportunity, 'rank'>;
    });

  const fallback = queryCandidates.length + pageCandidates.length >= 3 ? [] : defaultResearchOpportunities(effectiveSetup);
  const combined = uniqueOpportunities([...queryCandidates, ...pageCandidates, ...fallback]);

  return combined.sort((a, b) => b.score - a.score).slice(0, 10).map((item, idx) => ({ ...item, rank: idx + 1 }));
}

function getProjectName(domain?: string, brandKeywords?: string[] | null): string {
  const brand = brandKeywords?.map((kw) => prettifyProjectName(kw)).find((kw) => kw.length > 1 && !looksLikeGenericLegalQuery(kw));
  if (brand) return brand;
  if (!domain) return 'dieses Projekt';
  return prettifyProjectName(normalizeDomain(domain).split('.')[0]) || 'dieses Projekt';
}

function normalizeDomain(domain?: string): string {
  if (!domain) return 'nicht gesetzt';
  return domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split(/[/?#]/)[0].trim();
}

export function normalizePath(value: string): string {
  if (!value.trim()) return '/';
  try { return new URL(value).pathname.replace(/\/$/, '') || '/'; }
  catch { return value.split(/[?#]/)[0].replace(/\/$/, '') || '/'; }
}

function inferLandingPage(data?: PromptTrackingResult, dashboardData?: ProjectDashboardData): string {
  const convertingPage = (dashboardData?.topConvertingPages ?? []).slice().sort((a, b) => (b.conversions ?? 0) - (a.conversions ?? 0))[0]?.path;
  if (convertingPage) return normalizePath(convertingPage);
  const queryUrl = (data?.queries ?? []).slice().sort((a, b) => (b.impressions + b.clicks * 20) - (a.impressions + a.clicks * 20)).find((query) => query.url)?.url;
  return queryUrl ? normalizePath(queryUrl) : '';
}

function inferPrimaryTopic(_data?: PromptTrackingResult, _dashboardData?: ProjectDashboardData, _projectName = '', _isLegal = false): string {
  // Bewusst leer: Wenn der User keinen Fokus-Topic gesetzt hat, soll das Tool
  // pro Query ein eigenes Topic verwenden (queryToResearchTopic), statt einen
  // globalen Topic aus der Top-Query abzuleiten. Das war die Hauptursache für
  // "alle Prompts klingen gleich" (siehe Tickethistorie #prompt-research-bug).
  return '';
}

function prettifyProjectName(value: string): string {
  // Generische Tokenisierung: Domain/String säubern, Bindestriche/Underscores zu Leerzeichen,
  // jedes Wort kapitalisieren. "anwalt-hofer.at" → "Anwalt Hofer".
  // Wer einen formal-akademischen Namen wie "Mag. Bernhard Hofer" anzeigen will, soll diesen
  // als brand_keyword setzen — das passiert dann in detectBrandKeywords / Settings, nicht hier.
  return value
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split(/[/?#]/)[0]
    .replace(/\.[a-z]{2,}$/i, '')
    .replace(/[§|]+/g, ' ')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function inferIndustry(corpus: string): string {
  if (/\b(seo|marketing|agentur|ads|semrush|traffic)\b/i.test(corpus)) return 'Marketing / SEO';
  if (/\b(shop|ecommerce|produkt|kaufen|preis)\b/i.test(corpus)) return 'E-Commerce';
  if (/\b(hotel|restaurant|praxis|klinik|arzt)\b/i.test(corpus)) return 'Local Business';
  return 'Projekt-Branche aus Daten ableiten';
}

function inferRegion(corpus: string, domain?: string): string {
  if (/\b(1010|wien|vienna)\b/i.test(corpus)) return 'Wien';
  if (/\b(graz)\b/i.test(corpus)) return 'Graz';
  if (/\b(salzburg)\b/i.test(corpus)) return 'Salzburg';
  if (/\b(linz)\b/i.test(corpus)) return 'Linz';
  if (/\.at(\/|$)/i.test(domain ?? '')) return 'Österreich';
  return 'nicht eindeutig';
}

function queryToResearchTopic(query: string, projectName: string, brandKeywords?: string[] | null, isLegal = false): string {
  // 'mag'/'magister' bleibt als generischer Akademiker-Titel-Stopword für DACH-Domains.
  // Customer-spezifische Stopwords gehören ausschließlich in brandKeywords.
  const brandParts = [projectName, ...(brandKeywords ?? []), 'mag', 'magister'].flatMap((part) => part.split(/[\s\-_.§,]+/));
  const cleaned = query.replace(/[?!"'():;,.§]/g, ' ').replace(/\s+/g, ' ').trim();
  const stopWords = new Set(['was','wie','warum','wieso','welche','welcher','welches','wer','wo','wann','ist','sind','kann','koennen','können','fuer','für','und','oder','mit','ohne','bei','von','im','in','der','die','das','ein','eine','einen','einer','zu','zum','zur','am','besten','beste','kosten','kostet','rechtsanwalt','anwalt','kanzlei','law','attorney','1010','wien']);
  const brandStopWords = new Set(brandParts.map((part) => part.toLowerCase().trim()).filter((part) => part.length > 2));
  const words = cleaned.split(' ').filter((word) => { const n = word.toLowerCase(); return n.length > 2 && !stopWords.has(n) && !brandStopWords.has(n); });
  const topic = (words.length > 0 ? words.slice(0, 5).join(' ') : '').slice(0, 80).trim();
  if (!topic || (isLegal && looksLikeGenericLegalQuery(topic))) return '';
  return prettifyTopic(topic);
}

function prettifyTopic(value: string): string {
  return value.replace(/\s+/g, ' ').trim().replace(/\b(arbeitsrecht|erbrecht|immobilienrecht|strafrecht|vertragsrecht|scheidungsanwalt|mietrecht)\b/gi, (match) => match.charAt(0).toUpperCase() + match.slice(1).toLowerCase());
}

function normalizeResearchTopic(value: string, _isLegal: boolean): string {
  // Bewusst SCHWACH: nur Casing/Trim + ein paar legal-typische Stemming-Korrekturen,
  // die wirklich nur Schreibvarianten zusammenfassen.
  // Themen-CLUSTERN (z.B. "scheidung" + "ehe" auf einen Topic) macht DataMax/AI,
  // nicht regex — sonst werden faktisch unterschiedliche Rechtsprobleme zusammengeworfen.
  const topic = prettifyTopic(value);
  if (!topic) return topic;
  const normalized = topic.toLowerCase();

  // Nur stark eindeutige Schreibvariant-Konsolidierung (kein Topic-Merging):
  if (/\bführerscheinentzug(s|es)?\b/.test(normalized)) return prettifyTopic('Führerscheinentzug');
  if (/\banwaltskosten\b|\brechtsanwaltstarif\b/.test(normalized)) return prettifyTopic('Anwaltskosten');

  return topic;
}

function pathToTopic(path: string, setup: ResearchSetup): string {
  const topic = path.split('/').filter(Boolean).pop()?.replace(/[-_]+/g, ' ').trim();
  if (topic && topic.length > 2) return prettifyTopic(topic);
  return setup.isLegal ? 'rechtliche Erstberatung' : setup.projectName;
}

function looksLikeGenericLegalQuery(value: string): boolean {
  const n = value.toLowerCase().trim();
  if (!n) return true;
  return ['anwalt','rechtsanwalt','kanzlei','anwalt wien','rechtsanwalt wien','mag','mag.'].includes(n);
}

function hasBuyIntent(query: string, topic: string, isLegal: boolean): boolean {
  const text = `${query} ${topic}`.toLowerCase();
  // Generische Buy-Signale: explizite Preis-/Vergleichs-/Kontakt-/Kauf-Wörter.
  const generic = /\b(kosten|kostet|preis|preise|vergleich|beste|empfehlung|anbieter|beratung|kontakt|termin|kaufen)\b/i.test(text);
  // Legal-Buy-Signale: NUR echte Mandats-/Kontakt-Signale.
  // Bloße Rechtsbereich-Wörter (scheidung, mietrecht, anwalt, …) qualifizieren NICHT
  // automatisch — die landen sonst auf jeder Anwaltsseite in allen Queries und erzeugen
  // einen "alle 10 Buy Intent"-Eindruck. Wenn echte Kauf-Signale dabei sind, greift
  // sowieso schon der generic-Path.
  const legalBuy = /\b(erstberatung|mandat|kanzleibesuch|honorar|anwaltskosten|rechtsanwaltstarif|terminvereinbarung)\b/i.test(text);
  return generic || (isLegal && legalBuy);
}

function scoreOpportunity(query: PromptQueryData, buyIntent: boolean, rankablePosition: boolean, weakCtr: boolean, hasConversionPath: boolean): number {
  const impressionScore = Math.min(30, Math.round(Math.log10(query.impressions + 1) * 12));
  const positionScore = rankablePosition ? 22 : query.position <= 3 ? 4 : 8;
  const ctrScore = weakCtr ? 16 : query.ctr >= 0.03 ? 2 : 6;
  const buyScore = buyIntent ? 18 : 0;
  const ga4Score = hasConversionPath ? 10 : 0;
  return Math.min(100, 12 + impressionScore + positionScore + ctrScore + buyScore + ga4Score);
}

function buildDecisionPrompt(topic: string, intent: ResearchOpportunity['intent'], setup: ResearchSetup): string {
  const brandPart = setup.includeBrand ? (setup.isLegal ? ` und bewerte ${setup.projectName} als mögliche Kanzlei` : ` und bewerte ${setup.projectName} als mögliche Lösung`) : '';
  if (setup.isLegal) {
    if (isLegalCostTopic(topic)) return `Mit welchen Anwaltskosten muss ich in ${setup.region} bzw. Österreich rechnen, wie setzen sie sich zusammen und welche Fragen sollte ich vor einer Erstberatung klären${brandPart}?`;
    if (intent === 'Buy Intent') return `Ich brauche rechtliche Unterstützung zu "${topic}" in ${setup.region}. Welche Kanzlei passt, welche Kosten/Unterlagen sind wichtig${brandPart}?`;
    if (intent === 'Quick Win') return `Welche Rechtsanwälte in ${setup.region} werden für "${topic}" empfohlen? Vergleiche Spezialisierung, Vertrauenssignale, Erstberatung und Erreichbarkeit${brandPart}.`;
    return `Welche Fragen sollte eine Kanzlei-Seite zu "${topic}" beantworten, damit Mandanten Vertrauen fassen und eine Erstberatung anfragen?${brandPart}.`;
  }
  if (intent === 'Buy Intent') return `Ich suche eine Lösung für "${topic}". Welche Anbieter kommen infrage und welche Kosten/Nutzen-Argumente zählen${brandPart}?`;
  if (intent === 'Quick Win') return `Welche Anbieter werden für "${topic}" empfohlen? Vergleiche Nutzen, Aufwand, Risiken und Entscheidungskriterien${brandPart}.`;
  return `Welche Inhalte muss eine Seite zu "${topic}" liefern, um in KI-Antworten als hilfreiche Quelle genannt zu werden?${brandPart}.`;
}

function actionForOpportunity(intent: ResearchOpportunity['intent'], isLegal: boolean, hasConversionPath: boolean, topic: string): string {
  // hasConversionPath ist ein MODIFIER, kein Override: die topic-spezifische
  // Empfehlung bleibt erhalten, wir hängen nur einen Conversion-Hinweis an.
  const baseAction =
    intent === 'Buy Intent'
      ? (isLegal
          ? `Leistungsseite zu „${topic}" um Kosten, Ablauf, Unterlagen und Erstberatung ausbauen.`
          : `Landingpage zu „${topic}" um Preise, Vergleich und Entscheidungshilfen erweitern.`)
      : intent === 'Quick Win'
        ? `Snippet/FAQ zu „${topic}" optimieren — Query exakt in H2 oder FAQ-Frage aufnehmen.`
        : `Content-Lücke zu „${topic}" schließen: klare Antwort, Belege, Beispiele und interne Verlinkung ergänzen.`;
  return hasConversionPath
    ? `${baseAction} (Conversion-Seite vorhanden — Trust-Signale & CTA an dieser Stelle priorisieren.)`
    : baseAction;
}

function isLegalCostTopic(topic: string): boolean {
  return /\b(anwaltskosten|honorar|kosten|rechtsanwaltstarif)\b/i.test(topic);
}

function defaultResearchOpportunities(setup: ResearchSetup): Array<Omit<ResearchOpportunity, 'rank'>> {
  const topics = setup.isLegal
    ? ['rechtliche Erstberatung', 'Scheidungsanwalt', 'Arbeitsrechtliche Beratung', 'Erbrecht und Testament']
    : [`${setup.projectName} Vergleich`, `${setup.projectName} Kosten`, `${setup.projectName} Alternative`];
  return topics.map((topic, idx) => {
    const intent: ResearchOpportunity['intent'] = idx === 0 ? 'Buy Intent' : idx === 1 ? 'Quick Win' : 'Optimierung';
    return { score: 55 - idx * 4, topic, prompt: buildDecisionPrompt(topic, intent, setup), source: 'GSC', intent, reason: 'Fallback, falls im aktuellen Zeitraum zu wenige verwertbare Prompt-Queries vorhanden sind.', action: actionForOpportunity(intent, setup.isLegal, false, topic) } satisfies Omit<ResearchOpportunity, 'rank'>;
  });
}

function uniqueOpportunities(items: Array<Omit<ResearchOpportunity, 'rank'>>): Array<Omit<ResearchOpportunity, 'rank'>> {
  const bestByTopic = new Map<string, Omit<ResearchOpportunity, 'rank'>>();
  items.forEach((item) => {
    const key = item.topic.toLowerCase();
    const existing = bestByTopic.get(key);
    if (!existing || item.score > existing.score) bestByTopic.set(key, item);
  });
  return Array.from(bestByTopic.values());
}
