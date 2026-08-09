/**
 * Reine Konstanten und Klassifizierungslogik für den Indexierungsstatus.
 *
 * Dieses Modul hat bewusst keine Server-Abhängigkeiten (kein @vercel/postgres,
 * kein googleapis, kein cheerio), damit Client-Komponenten es importieren können,
 * ohne den Server-Code in das Browser-Bundle zu ziehen.
 */

export type IndexingUrlStatus = 'indexed' | 'not_indexed' | 'pending' | 'error';

export type IndexingExclusionCategory =
  | 'indexed'
  | 'noindex'
  | 'redirect'
  | 'alternate_canonical'
  | 'blocked_by_robots'
  | 'duplicate_canonical'
  | 'crawled_not_indexed'
  | 'discovered_not_indexed'
  | 'not_found'
  | 'server_error'
  | 'soft_404'
  | 'access_denied'
  | 'crawl_error'
  | 'canonical_mismatch'
  | 'inspection_error'
  | 'unknown';

/** Re-Check-Intervall für indexierte URLs mit nennenswerten Impressionen. */
export const INDEXED_HOT_RECHECK_DAYS = 7;
/** Re-Check-Intervall für alle übrigen indexierten URLs. Vorher 30 Tage. */
export const INDEXED_RECHECK_DAYS = 14;
/** Re-Check-Intervall für nicht indexierte URLs. */
export const NOT_INDEXED_RECHECK_DAYS = 7;
/** Ab diesem Alter gilt ein Prüfergebnis als veraltet. */
export const STALE_AFTER_DAYS = INDEXED_RECHECK_DAYS + 7;

/**
 * Vergleichsform für Canonical-Abgleiche: ignoriert Protokoll, www und
 * abschließende Slashes, behält aber Query-Parameter.
 */
export function normalizeUrlForComparison(value: string) {
  try {
    const parsed = new URL(value);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    const path = parsed.pathname.replace(/\/{2,}/g, '/').replace(/\/+$/, '') || '/';
    return `${host}${path}${parsed.search}`;
  } catch {
    return value.trim().toLowerCase().replace(/\/+$/, '');
  }
}

/**
 * coverageState wird von der API lokalisiert ausgeliefert (wir fragen de-DE an).
 * Die Muster decken daher deutsche und englische Schreibweisen ab.
 */
const COVERAGE_PATTERNS: Array<{ category: IndexingExclusionCategory; match: RegExp }> = [
  { category: 'alternate_canonical', match: /(alternative seite|alternate page)/ },
  { category: 'duplicate_canonical', match: /(duplikat|duplicate)/ },
  { category: 'redirect', match: /(weiterleitung|redirect)/ },
  { category: 'noindex', match: /noindex/ },
  { category: 'blocked_by_robots', match: /robots\.txt/ },
  { category: 'soft_404', match: /soft.?404/ },
  { category: 'not_found', match: /(nicht gefunden|not found|404)/ },
  { category: 'access_denied', match: /(401|403|unauthorized|forbidden|zugriff)/ },
  { category: 'server_error', match: /(serverfehler|server error|5xx)/ },
  { category: 'crawled_not_indexed', match: /(gecrawlt|crawled)/ },
  { category: 'discovered_not_indexed', match: /(gefunden|discovered)/ },
];

export const CATEGORY_LABELS: Record<IndexingExclusionCategory, string> = {
  indexed: 'Indexiert',
  noindex: 'Per noindex ausgeschlossen',
  redirect: 'Weiterleitung',
  alternate_canonical: 'Alternative Seite mit Canonical',
  blocked_by_robots: 'Durch robots.txt blockiert',
  duplicate_canonical: 'Duplikat, anderes Canonical',
  crawled_not_indexed: 'Gecrawlt, nicht indexiert',
  discovered_not_indexed: 'Gefunden, nicht gecrawlt',
  not_found: '404 / nicht gefunden',
  server_error: 'Serverfehler',
  soft_404: 'Soft 404',
  access_denied: 'Zugriff verweigert',
  crawl_error: 'Crawling-Fehler',
  canonical_mismatch: 'Canonical-Abweichung',
  inspection_error: 'Prüffehler',
  unknown: 'Ursache unklar',
};

const CATEGORY_HINTS: Record<IndexingExclusionCategory, string | null> = {
  indexed: null,
  noindex: 'Per noindex ausgeschlossen. Prüfen, ob der Eintrag aus der Sitemap entfernt werden sollte.',
  redirect: 'Die URL leitet weiter. In die Sitemap gehört das Weiterleitungsziel.',
  alternate_canonical: 'Google indexiert stattdessen die kanonische URL. In der Regel korrekt.',
  blocked_by_robots: 'Widerspruch: URL steht in der Sitemap, ist aber per robots.txt gesperrt.',
  duplicate_canonical: 'Google hat eine andere Seite als kanonisch gewählt. Canonical und interne Links prüfen.',
  crawled_not_indexed: 'Gecrawlt, aber nicht indexiert. Meist ein Qualitäts- oder Dubletten-Signal.',
  discovered_not_indexed: 'Gefunden, aber noch nicht gecrawlt. Crawl-Budget und interne Verlinkung prüfen.',
  not_found: 'Die URL liefert 404. Aus der Sitemap entfernen oder Inhalt wiederherstellen.',
  server_error: 'Serverfehler beim Abruf durch Google. Hosting und Logs prüfen.',
  soft_404: 'Soft 404: Seite antwortet mit 200, wirkt für Google aber leer.',
  access_denied: 'Google wird der Zugriff verweigert (401/403). Zugriffsschutz prüfen.',
  crawl_error: 'Google konnte die Seite nicht korrekt abrufen.',
  canonical_mismatch: 'Google verwendet eine andere kanonische URL als angegeben.',
  inspection_error: 'Die Prüfung über die URL-Inspection-API ist fehlgeschlagen.',
  unknown: 'Kein eindeutiges Signal von Google. Einzelprüfung in der Search Console empfohlen.',
};

/** Ausschlüsse, die in aller Regel gewollt sind und keinen Handlungsbedarf auslösen. */
const INTENTIONAL_CATEGORIES = new Set<IndexingExclusionCategory>([
  'noindex',
  'redirect',
  'alternate_canonical',
]);

function matchCoverageState(coverageState: string | null): IndexingExclusionCategory | null {
  if (!coverageState) return null;
  const normalized = coverageState.toLocaleLowerCase('de-DE');
  if (/(indexiert|indexed)/.test(normalized) && !/(nicht|not|kein)/.test(normalized)) {
    return 'indexed';
  }
  for (const pattern of COVERAGE_PATTERNS) {
    if (pattern.match.test(normalized)) return pattern.category;
  }
  return null;
}

export interface IndexingClassification {
  category: IndexingExclusionCategory;
  isIntentional: boolean;
  needsAction: boolean;
  actionHint: string | null;
}

/**
 * Bewertet eine URL anhand der lokalisierungsunabhängigen Enum-Felder der
 * URL-Inspection-API und erst nachrangig anhand von coverageState.
 */
export function classifyIndexingRow(input: {
  status: IndexingUrlStatus;
  coverageState: string | null;
  robotsTxtState: string | null;
  indexingState: string | null;
  pageFetchState: string | null;
  hasCanonicalIssue: boolean;
}): IndexingClassification {
  const resolve = (category: IndexingExclusionCategory): IndexingClassification => {
    const isIntentional = INTENTIONAL_CATEGORIES.has(category);
    return {
      category,
      isIntentional,
      needsAction: category !== 'indexed' && !isIntentional,
      actionHint: CATEGORY_HINTS[category],
    };
  };

  if (input.status === 'error') return resolve('inspection_error');

  if (input.status === 'indexed') {
    return input.hasCanonicalIssue ? resolve('canonical_mismatch') : resolve('indexed');
  }

  if (input.status === 'pending') {
    return { category: 'unknown', isIntentional: false, needsAction: false, actionHint: null };
  }

  switch (input.pageFetchState) {
    case 'NOT_FOUND':
    case 'BLOCKED_4XX':
      return resolve('not_found');
    case 'ACCESS_DENIED':
    case 'ACCESS_FORBIDDEN':
      return resolve('access_denied');
    case 'SERVER_ERROR':
      return resolve('server_error');
    case 'SOFT_404':
      return resolve('soft_404');
    case 'REDIRECT_ERROR':
    case 'INTERNAL_CRAWL_ERROR':
    case 'INVALID_URL':
      return resolve('crawl_error');
    default:
      break;
  }

  if (input.indexingState === 'BLOCKED_BY_META_TAG' || input.indexingState === 'BLOCKED_BY_HTTP_HEADER') {
    return resolve('noindex');
  }
  if (input.indexingState === 'BLOCKED_BY_ROBOTS_TXT' || input.robotsTxtState === 'DISALLOWED') {
    return resolve('blocked_by_robots');
  }

  const fromCoverage = matchCoverageState(input.coverageState);
  if (fromCoverage && fromCoverage !== 'indexed') return resolve(fromCoverage);

  if (input.hasCanonicalIssue) return resolve('alternate_canonical');

  return resolve('unknown');
}
