// src/lib/prompt-tracking/query-classifier.ts
//
// Pro-Query-Klassifikation: Brand, Geo-Bezug, Frage-Typ.
// Wird in getPromptLikeQueries() (google-api.ts) auf jede Query angewandt.

export type QuestionType =
  | 'what' | 'how' | 'why' | 'who' | 'where' | 'when'
  | 'compare' | 'price' | 'recommendation' | 'other';

export const QUESTION_TYPE_LABELS: Record<QuestionType, { label: string; emoji: string; color: string }> = {
  what:           { label: 'Was-Frage',    emoji: '❓', color: 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800' },
  how:            { label: 'Wie-Frage',    emoji: '🔧', color: 'bg-purple-50 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800' },
  why:            { label: 'Warum-Frage',  emoji: '💭', color: 'bg-indigo-50 text-indigo-800 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800' },
  who:            { label: 'Wer-Frage',    emoji: '👤', color: 'bg-cyan-50 text-cyan-800 border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-300 dark:border-cyan-800' },
  where:          { label: 'Wo-Frage',     emoji: '📍', color: 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800' },
  when:           { label: 'Wann-Frage',   emoji: '🕐', color: 'bg-teal-50 text-teal-800 border-teal-200 dark:bg-teal-900/30 dark:text-teal-300 dark:border-teal-800' },
  compare:        { label: 'Vergleich',    emoji: '⚖️', color: 'bg-violet-50 text-violet-800 border-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-800' },
  price:          { label: 'Preis/Kosten', emoji: '💰', color: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800' },
  recommendation: { label: 'Empfehlung',   emoji: '⭐', color: 'bg-yellow-50 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800' },
  other:          { label: 'Sonstige',     emoji: '💬', color: 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700' },
};

export const GENERIC_TERMS = new Set([
  'anwalt','kanzlei','praxis','firma','agentur','shop','store','online','web','site','page',
  'service','dienst','consulting','marketing','werbung','design','studio','büro',
  'datenrettung','rechtsanwalt','ehescheidungsanwalt','steuerberater',
  'carwash','autowäsche','uhren','schmuck','restaurant','hotel',
  'wien','graz','linz','salzburg','innsbruck','klagenfurt','bregenz','eisenstadt',
  'austria','österreich','germany','deutschland','switzerland','schweiz',
  'berlin','münchen','hamburg','köln','frankfurt',
  'mein','dein','sein','unser','für','with','the',
  '4you','4me','24','pro','plus','best','top',
]);

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function compactForBrandMatch(s: string): string {
  return s
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

export function isBrandedQuery(query: string, domain?: string, keywords?: string[] | null): boolean {
  const q = query.toLowerCase();
  const compactQuery = compactForBrandMatch(q);

  if (keywords && keywords.length > 0) {
    return keywords.some((kw) => {
      const k = kw.trim().toLowerCase();
      if (k.length < 2) return false;
      const re = new RegExp(`\\b${escapeRegex(k)}\\b`, 'i');
      if (re.test(q)) return true;

      const compactKeyword = compactForBrandMatch(k);
      if (compactKeyword.length >= 4 && compactQuery.includes(compactKeyword)) return true;

      return false;
    });
  }

  if (!domain) return false;
  const cleaned = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').toLowerCase();
  const baseDomain = cleaned.split('.')[0];
  if (baseDomain.length < 3) return false;

  const tokens = new Set<string>();
  tokens.add(baseDomain);
  if (baseDomain.includes('-')) {
    tokens.add(baseDomain.replace(/-/g, ''));
    tokens.add(baseDomain.replace(/-/g, ' '));
  }
  baseDomain.split('-').forEach((part) => {
    if (part.length >= 4 && !GENERIC_TERMS.has(part)) tokens.add(part);
  });
  if (GENERIC_TERMS.has(baseDomain)) tokens.delete(baseDomain);
  if (tokens.size === 0) return false;

  return Array.from(tokens).some((token) => {
    if (token.length < 3) return false;
    const re = new RegExp(`\\b${escapeRegex(token)}\\b`, 'i');
    if (re.test(q)) return true;

    const compactToken = compactForBrandMatch(token);
    return compactToken.length >= 4 && compactQuery.includes(compactToken);
  });
}

const GEO_TERMS = [
  'wien','graz','linz','salzburg','innsbruck','klagenfurt','bregenz','eisenstadt',
  'sankt pölten','st\\. pölten','villach','wels','dornbirn',
  'niederösterreich','oberösterreich','steiermark','tirol','vorarlberg','kärnten','burgenland',
  'österreich','austria',
  'berlin','hamburg','münchen','munich','köln','cologne','frankfurt','stuttgart','düsseldorf',
  'leipzig','dortmund','essen','bremen','hannover',
  'bayern','bavaria','sachsen','baden-württemberg','baden württemberg','nrw',
  'rheinland-pfalz','rheinland pfalz','thüringen','hessen','deutschland','germany',
  'zürich','zurich','bern','basel','genf','geneva','lausanne','luzern','schweiz','switzerland',
  'in der nähe','in meiner nähe','near me','in der umgebung','vor ort','lokal','regional',
];

const GEO_REGEX = new RegExp('\\b(' + GEO_TERMS.join('|') + ')\\b', 'i');
const POSTAL_CODE_REGEX = /\b\d{4,5}\s+[a-zäöü]{3,}/i;

export function hasGeoReference(query: string): boolean {
  if (GEO_REGEX.test(query)) return true;
  if (POSTAL_CODE_REGEX.test(query)) return true;
  return false;
}

export function detectQuestionType(query: string): QuestionType {
  const q = query.toLowerCase().trim();
  if (/\b(vs|versus)\b/.test(q) ||
      /\b(unterschied|differenz)\s+zwischen\b/.test(q) ||
      /\bvergleich\b/.test(q) ||
      /\b(\w+)\s+oder\s+(\w+)\b.*\b(besser|gut)\b/.test(q) ||
      /\bwhich\s+is\s+better\b/.test(q) ||
      /\bcompare\b/.test(q)) return 'compare';

  if (/\b(kostet|kosten|preis|gebühr|honorar|tarif|tarife|aufwand)\b/.test(q) ||
      /\bwie\s*viel\b/.test(q) || /\bwieviel\b/.test(q) ||
      /\bhow\s+much\b/.test(q) || /\bcost\b/.test(q) || /\bprice\b/.test(q)) return 'price';

  if (/\b(beste[rs]?|best|top|empfehlung|empfehlen|recommend)\b/.test(q) ||
      /\bwelche[rs]?\s+(ist|sind|wird|werden)\s+.*(am\s+besten|empfohlen)\b/.test(q)) return 'recommendation';

  if (/^(was|what)\b/.test(q) || /\bwas\s+(ist|sind|bedeutet|heißt)\b/.test(q) ||
      /\bwhat\s+(is|are|does|means)\b/.test(q)) return 'what';

  if (/^(wie|how)\b/.test(q) || /\bhow\s+to\b/.test(q) ||
      /\banleitung\b/.test(q) || /\bschritt\s+für\s+schritt\b/.test(q)) return 'how';

  if (/^(warum|weshalb|wieso|why)\b/.test(q) || /\bweshalb\b/.test(q)) return 'why';
  if (/^(wer|who)\b/.test(q) || /\bwer\s+(ist|sind|hat|war)\b/.test(q)) return 'who';
  if (/^(wo|where)\b/.test(q) || /\bwo\s+(ist|sind|finde|gibt)\b/.test(q) ||
      /\bwhere\s+(is|are|can)\b/.test(q)) return 'where';
  if (/^(wann|when)\b/.test(q) || /\bwann\s+(ist|war|kommt|wird)\b/.test(q)) return 'when';

  return 'other';
}
