import { sql } from '@vercel/postgres';
import * as cheerio from 'cheerio';
import { getOrFetchGoogleData } from '@/lib/google-data-loader';
import type { User } from '@/lib/schemas';
import type { TopQueryData } from '@/types/dashboard';
import type {
  ContentBrief,
  ContentContext,
  ContentKeywordMetric,
  ExistingPageSnapshot,
  InternalLinkCandidate,
} from './types';

type IndexingRow = {
  url: string;
  status: string;
  google_canonical: string | null;
  user_canonical: string | null;
  clicks: number | string | null;
  impressions: number | string | null;
  position: number | string | null;
};

const STOP_WORDS = new Set([
  'aber', 'alle', 'auch', 'das', 'dass', 'dem', 'den', 'der', 'des', 'die', 'ein',
  'eine', 'einer', 'eines', 'fuer', 'für', 'ist', 'mit', 'oder', 'sich', 'und',
  'von', 'was', 'wie', 'wir', 'zum', 'zur', 'auf', 'bei', 'im', 'in', 'zu',
]);

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ß/g, 'ss');
}

export function tokenizeContentTopic(value: string): string[] {
  return Array.from(new Set(
    normalizeText(value)
      .split(/[^a-z0-9]+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 3 && !STOP_WORDS.has(token))
  ));
}

function normalizeComparableUrl(value: string): string {
  try {
    const parsed = new URL(value);
    const path = parsed.pathname === '/' ? '/' : parsed.pathname.replace(/\/$/, '');
    return `${parsed.origin.toLowerCase()}${path}`;
  } catch {
    return value.replace(/\/$/, '').toLowerCase();
  }
}

function normalizePath(value: string): string {
  try {
    const path = value.startsWith('http') ? new URL(value).pathname : value.split(/[?#]/, 1)[0];
    const withSlash = path.startsWith('/') ? path : `/${path}`;
    return withSlash === '/' ? '/' : withSlash.replace(/\/$/, '');
  } catch {
    return '/';
  }
}

function projectOrigin(project: User): string {
  const configured = project.domain || project.gsc_site_url || '';
  if (configured.startsWith('sc-domain:')) {
    return `https://${configured.slice('sc-domain:'.length).replace(/^www\./, '')}`;
  }
  const withProtocol = configured.startsWith('http') ? configured : `https://${configured}`;
  try {
    return new URL(withProtocol).origin;
  } catch {
    return withProtocol.replace(/\/$/, '');
  }
}

export function resolveProjectUrl(project: User, targetUrl: string): string {
  const origin = projectOrigin(project);
  const candidate = targetUrl.trim() || '/';
  const resolved = new URL(candidate, `${origin}/`);

  if (resolved.hostname.replace(/^www\./, '') !== new URL(origin).hostname.replace(/^www\./, '')) {
    throw new Error('Die Ziel-URL muss zur ausgewählten Projektdomain gehören.');
  }

  resolved.hash = '';
  return resolved.toString();
}

function urlLabel(value: string): string {
  const path = normalizePath(value);
  if (path === '/') return 'Startseite';
  const segment = path.split('/').filter(Boolean).pop() || path;
  return segment
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function numeric(value: number | string | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function canonicalMatches(row: IndexingRow): boolean {
  const expected = normalizeComparableUrl(row.user_canonical || row.url);
  return !row.google_canonical || normalizeComparableUrl(row.google_canonical) === expected;
}

export function rankInternalLinkCandidates(
  rows: IndexingRow[],
  topic: string,
  keywordQueries: string[],
  targetUrl: string
): InternalLinkCandidate[] {
  const topicTokens = tokenizeContentTopic(`${topic} ${keywordQueries.join(' ')}`);
  const normalizedTarget = normalizeComparableUrl(targetUrl);

  return rows
    .filter((row) => row.status === 'indexed' && canonicalMatches(row))
    .filter((row) => normalizeComparableUrl(row.url) !== normalizedTarget)
    .map((row) => {
      const pathTokens = tokenizeContentTopic(`${urlLabel(row.url)} ${normalizePath(row.url)}`);
      const overlap = pathTokens.filter((token) => topicTokens.includes(token)).length;
      const impressions = numeric(row.impressions);
      const clicks = numeric(row.clicks);
      const authorityScore = Math.min(24, Math.log10(impressions + 1) * 6 + Math.log10(clicks + 1) * 4);
      const relevance = Math.round(overlap * 28 + authorityScore);
      const reasonParts = [];
      if (overlap > 0) reasonParts.push(`${overlap} thematische Übereinstimmung${overlap === 1 ? '' : 'en'}`);
      if (impressions > 0) reasonParts.push(`${Math.round(impressions).toLocaleString('de-DE')} GSC-Impressionen`);

      return {
        url: row.url,
        path: normalizePath(row.url),
        label: urlLabel(row.url),
        clicks,
        impressions,
        position: row.position === null ? null : numeric(row.position),
        relevance,
        reason: reasonParts.join(' · ') || 'Indexierte Seite aus der Sitemap',
      };
    })
    .filter((candidate) => candidate.relevance >= 12)
    .sort((a, b) => b.relevance - a.relevance || b.impressions - a.impressions)
    .slice(0, 12);
}

async function loadExistingPage(url: string): Promise<ExistingPageSnapshot> {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'DataPeak-Content-Studio/1.0' },
      signal: AbortSignal.timeout(12_000),
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const html = await response.text();
    const $ = cheerio.load(html);
    $('script, style, noscript, iframe, svg, nav, footer').remove();
    const bodyText = $('main').text() || $('article').text() || $('body').text();
    const cleanText = bodyText.replace(/\s+/g, ' ').trim();
    const origin = new URL(url).origin;
    const internalLinks = Array.from(new Map(
      $('a[href]')
        .map((_, element) => {
          const href = $(element).attr('href');
          if (!href) return null;
          try {
            const resolved = new URL(href, url);
            if (resolved.origin !== origin) return null;
            return [normalizeComparableUrl(resolved.toString()), {
              anchor: $(element).text().replace(/\s+/g, ' ').trim() || urlLabel(resolved.toString()),
              url: resolved.toString(),
            }] as const;
          } catch {
            return null;
          }
        })
        .get()
        .filter((item): item is readonly [string, { anchor: string; url: string }] => Boolean(item))
    ).values()).slice(0, 30);

    return {
      reachable: true,
      title: $('title').first().text().trim(),
      description: $('meta[name="description"]').attr('content')?.trim() || '',
      h1: $('h1').first().text().replace(/\s+/g, ' ').trim(),
      headings: $('h2, h3').map((_, element) => $(element).text().replace(/\s+/g, ' ').trim()).get().filter(Boolean).slice(0, 40),
      wordCount: cleanText ? cleanText.split(/\s+/).length : 0,
      canonical: $('link[rel="canonical"]').attr('href') || null,
      internalLinks,
      textExcerpt: cleanText.slice(0, 12_000),
    };
  } catch (error) {
    return {
      reachable: false,
      title: '',
      description: '',
      h1: '',
      headings: [],
      wordCount: 0,
      canonical: null,
      internalLinks: [],
      textExcerpt: '',
      error: error instanceof Error ? error.message : 'Seite konnte nicht geladen werden',
    };
  }
}

function toKeywordMetric(query: TopQueryData): ContentKeywordMetric {
  return {
    query: query.query,
    clicks: numeric(query.clicks),
    impressions: numeric(query.impressions),
    ctr: Number.isFinite(query.ctr) ? numeric(query.ctr) : null,
    position: Number.isFinite(query.position) ? numeric(query.position) : null,
  };
}

function selectTopicQueries(queries: TopQueryData[], topic: string): TopQueryData[] {
  const tokens = tokenizeContentTopic(topic);
  const scored = queries.map((query) => {
    const normalizedQuery = normalizeText(query.query);
    const overlap = tokens.filter((token) => normalizedQuery.includes(token)).length;
    return { query, score: overlap * 100 + numeric(query.impressions) / Math.max(1, numeric(query.position)) };
  });
  const relevant = scored.filter((item) => item.score >= 100);
  return (relevant.length >= 3 ? relevant : scored)
    .sort((a, b) => b.score - a.score)
    .slice(0, 20)
    .map((item) => item.query);
}

export async function buildContentContext(project: User, brief: ContentBrief): Promise<ContentContext> {
  const targetUrl = resolveProjectUrl(project, brief.targetUrl);
  const targetPath = normalizePath(targetUrl);
  const dashboardData = await getOrFetchGoogleData(project, brief.dateRange);
  const topQueries = dashboardData?.topQueries || [];
  const pageQueries = dashboardData?.landingPageQueries?.[targetPath]
    || dashboardData?.landingPageQueries?.[`${targetPath}/`]
    || [];

  const selectedQueries: ContentKeywordMetric[] = pageQueries.length > 0
    ? pageQueries.slice(0, 20).map((query) => ({
        query: query.query,
        clicks: numeric(query.clicks),
        impressions: numeric(query.impressions),
        ctr: query.impressions > 0 ? query.clicks / query.impressions : null,
        position: topQueries.find((item) => item.query === query.query)?.position ?? null,
      }))
    : selectTopicQueries(topQueries, brief.topic).map(toKeywordMetric);

  const ga4Page = (dashboardData?.topConvertingPages || []).find(
    (page) => normalizePath(page.path) === targetPath
  );
  const gscClicks = selectedQueries.reduce((sum, query) => sum + query.clicks, 0);
  const gscImpressions = selectedQueries.reduce((sum, query) => sum + query.impressions, 0);
  const weightedPositionDenominator = selectedQueries.reduce((sum, query) => sum + (query.position === null ? 0 : query.impressions), 0);
  const weightedPosition = weightedPositionDenominator > 0
    ? selectedQueries.reduce((sum, query) => sum + (query.position ?? 0) * query.impressions, 0) / weightedPositionDenominator
    : null;

  const { rows } = await sql<IndexingRow>`
    SELECT url, status, google_canonical, user_canonical, clicks, impressions, position
    FROM project_indexing_urls
    WHERE user_id = ${project.id}::uuid
      AND is_in_sitemap = TRUE
  `;

  const internalLinkCandidates = rankInternalLinkCandidates(
    rows,
    brief.topic,
    selectedQueries.map((query) => query.query),
    targetUrl
  );
  const existingPage = brief.mode === 'optimize' ? await loadExistingPage(targetUrl) : null;
  const dataSources = ['Sitemap'];
  if (project.gsc_site_url) dataSources.unshift('GSC');
  if (project.ga4_property_id) dataSources.splice(project.gsc_site_url ? 1 : 0, 0, 'GA4');
  if (existingPage?.reachable) dataSources.push('Seiteninhalt');

  const notes: string[] = [];
  if (!project.gsc_site_url) notes.push('Für dieses Projekt ist keine GSC-Property konfiguriert.');
  if (!project.ga4_property_id) notes.push('Für dieses Projekt ist keine GA4-Property konfiguriert.');
  if (brief.mode === 'optimize' && existingPage && !existingPage.reachable) {
    notes.push(`Die bestehende Seite konnte nicht gelesen werden: ${existingPage.error}`);
  }
  if (pageQueries.length === 0) notes.push('Für die Ziel-URL wurden keine direkten GSC-Queries gefunden; das Cluster wurde thematisch aus Projektqueries gebildet.');

  return {
    project: {
      id: project.id,
      domain: project.domain || new URL(targetUrl).hostname,
      brandKeywords: project.brand_keywords || [],
    },
    targetUrl,
    targetPath,
    dataSources,
    keywords: selectedQueries,
    metrics: {
      clicks: gscClicks,
      impressions: gscImpressions,
      ctr: gscImpressions > 0 ? gscClicks / gscImpressions : null,
      position: weightedPosition,
      sessions: numeric(ga4Page?.sessions),
      newUsers: numeric(ga4Page?.newUsers),
      conversions: numeric(ga4Page?.conversions),
      engagementRate: ga4Page?.engagementRate === undefined ? null : numeric(ga4Page.engagementRate),
    },
    existingPage,
    sitemap: {
      totalUrls: rows.length,
      indexedUrls: rows.filter((row) => row.status === 'indexed').length,
      internalLinkCandidates,
    },
    cannibalizationCandidates: internalLinkCandidates
      .filter((candidate) => candidate.relevance >= 45)
      .slice(0, 5),
    notes,
  };
}
