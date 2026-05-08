// src/lib/prompt-tracking/brand-detector.ts
//
// Auto-Detection von brand_keywords pro User aus zwei zuverlässigen Quellen:
//   1. Domain-Tokenisierung
//   2. Page-Title (HTTP-Fetch)
//
// GSC Top-Klick-Queries werden bewusst NICHT genutzt: Bei Content-/Service-Sites
// (Anwalt, Berater, B2B) sind die Top-Klick-Kurzqueries themenbezogen, nicht
// markenbezogen. Beispiel anwalt-hofer.at: Top-Klicks sind "vignette strafe",
// "hundesteuer" — daraus "Brand-Keywords" zu machen führt zu falschen Treffern
// in der Brand/Non-Brand-Klassifikation.

import { GENERIC_TERMS } from './query-classifier';

export interface DetectedBrandKeywords {
  keywords: string[];
  sources: { domain: string[]; pageTitle: string[]; };
  pageTitleRaw?: string;
  pageTitleFetched: boolean;
}

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

const STOP_WORDS = new Set([
  'der','die','das','den','dem','des','ein','eine','einer','einen',
  'und','oder','aber','für','mit','von','zu','bei','aus',
  'the','and','or','for','with','from','to','in','at','of',
  'gmbh','ag','kg','ohg','eg','inc','ltd','llc','co',
  'home','startseite','willkommen','welcome',
]);

function isGenericOrTooShort(token: string): boolean {
  if (!token) return true;
  if (token.length < 3) return true;
  const lower = token.toLowerCase();
  if (GENERIC_TERMS.has(lower)) return true;
  if (STOP_WORDS.has(lower)) return true;
  return false;
}

function extractDomainTokens(domain?: string | null): string[] {
  if (!domain) return [];
  const cleaned = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').toLowerCase();
  const baseDomain = cleaned.split('.')[0];
  if (baseDomain.length < 3) return [];

  const tokens = new Set<string>();
  tokens.add(baseDomain);
  if (baseDomain.includes('-')) {
    tokens.add(baseDomain.replace(/-/g, ''));
    tokens.add(baseDomain.replace(/-/g, ' '));
  }
  baseDomain.split('-').forEach((part) => {
    if (!isGenericOrTooShort(part)) tokens.add(part);
  });
  if (GENERIC_TERMS.has(baseDomain)) tokens.delete(baseDomain);

  return Array.from(tokens);
}

export async function fetchPageTitle(domain: string): Promise<string | null> {
  const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '');
  const candidates = [`https://${cleanDomain}`, `https://www.${cleanDomain}`];

  for (const url of candidates) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; DataPeak/1.0; +https://datapeak.at)',
          'Accept': 'text/html,application/xhtml+xml',
        },
        redirect: 'follow',
      });
      clearTimeout(timeoutId);
      if (!res.ok) continue;

      const reader = res.body?.getReader();
      if (!reader) continue;

      let html = '';
      let totalBytes = 0;
      const decoder = new TextDecoder('utf-8');
      while (totalBytes < 30000) {
        const { done, value } = await reader.read();
        if (done) break;
        html += decoder.decode(value, { stream: true });
        totalBytes += value.byteLength;
        if (html.includes('</title>')) break;
      }
      try { reader.cancel(); } catch {}

      const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (match && match[1]) {
        return match[1].trim().replace(/\s+/g, ' ');
      }
    } catch {
      continue;
    }
  }
  return null;
}

function extractTitleTokens(title: string): string[] {
  if (!title) return [];

  const segments = title
    .split(/\s*[|\u2013\u2014\u2022\-:·]\s*/)
    .map(normalize)
    .filter(s => s.length > 0)
    .filter(s => !isGenericOrTooShort(s));

  const candidates = new Set<string>();

  if (segments.length > 0) {
    const first = segments[0];
    if (first.length >= 3 && first.length <= 50) candidates.add(first);
  }
  if (segments.length > 1) {
    const last = segments[segments.length - 1];
    if (last.length >= 3 && last.length <= 30 && !isGenericOrTooShort(last)) {
      candidates.add(last);
    }
  }

  if (segments.length > 0) {
    const words = segments[0].split(/\s+/).filter(w => !isGenericOrTooShort(w));
    if (words.length >= 1) candidates.add(words[0]);
    if (words.length >= 2) candidates.add(`${words[0]} ${words[1]}`);
  }

  return Array.from(candidates);
}

export async function detectBrandKeywords(params: {
  domain?: string | null;
}): Promise<DetectedBrandKeywords> {
  const { domain } = params;

  const domainTokens = extractDomainTokens(domain);

  let titleTokens: string[] = [];
  let pageTitleRaw: string | undefined;
  let pageTitleFetched = false;
  if (domain) {
    try {
      const title = await fetchPageTitle(domain);
      if (title) {
        pageTitleRaw = title;
        pageTitleFetched = true;
        titleTokens = extractTitleTokens(title);
      }
    } catch (e) {
      console.warn('[brand-detector] page-title fetch failed:', e);
    }
  }

  // Hinweis: GSC Top-Klick-Queries werden bewusst NICHT als Brand-Quelle genutzt.
  // Bei Content-/Service-Sites (Anwalt, Berater, B2B) sind Top-Klick-Kurzqueries
  // themenbezogen, nicht markenbezogen. Z.B. "vignette strafe" auf einer
  // Anwalts-Site → kein Brand. Daher nur Domain + Page-Title als zuverlässige Quellen.

  const all = new Set<string>();
  domainTokens.forEach(t => all.add(t));
  titleTokens.forEach(t => all.add(t));

  const final = Array.from(all)
    .filter(t => !isGenericOrTooShort(t))
    .sort((a, b) => b.length - a.length)
    .slice(0, 15);

  return {
    keywords: final,
    sources: {
      domain: domainTokens,
      pageTitle: titleTokens,
    },
    pageTitleRaw,
    pageTitleFetched,
  };
}
