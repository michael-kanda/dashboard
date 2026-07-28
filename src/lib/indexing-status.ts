import { load } from 'cheerio';
import { createHash } from 'crypto';
import { JWT } from 'google-auth-library';
import { google } from 'googleapis';
import { sql } from '@vercel/postgres';

export type IndexingUrlStatus = 'indexed' | 'not_indexed' | 'pending' | 'error';

export interface IndexingStatusRow {
  url: string;
  status: IndexingUrlStatus;
  coverageState: string | null;
  lastCrawlTime: string | null;
  googleCanonical: string | null;
  userCanonical: string | null;
  impressions: number;
  clicks: number;
  position: number | null;
  sitemapLastmod: string | null;
  inspectedAt: string | null;
  inspectionError: string | null;
  hasCanonicalIssue: boolean;
}

export interface ProjectIndexingStatus {
  configured: boolean;
  sitemapUrl: string | null;
  status: 'idle' | 'running' | 'completed' | 'partial' | 'error';
  totalUrls: number;
  indexedUrls: number;
  notIndexedUrls: number;
  pendingUrls: number;
  issueUrls: number;
  lastSyncedAt: string | null;
  nextSyncAt: string | null;
  errorMessage: string | null;
  performanceRange: string;
  rows: IndexingStatusRow[];
}

type ProjectConfig = {
  id: string;
  domain: string | null;
  gsc_site_url: string | null;
  sitemap_url: string | null;
};

type SitemapEntry = {
  url: string;
  lastmod: string | null;
  source: string;
};

const EMPTY_STATUS: ProjectIndexingStatus = {
  configured: false,
  sitemapUrl: null,
  status: 'idle',
  totalUrls: 0,
  indexedUrls: 0,
  notIndexedUrls: 0,
  pendingUrls: 0,
  issueUrls: 0,
  lastSyncedAt: null,
  nextSyncAt: null,
  errorMessage: null,
  performanceRange: 'Letzte 90 Tage',
  rows: [],
};

export async function ensureIndexingStatusSchema() {
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS sitemap_url TEXT NULL`;
  await sql`
    CREATE TABLE IF NOT EXISTS project_indexing_sync (
      user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      sitemap_url TEXT,
      status VARCHAR(20) NOT NULL DEFAULT 'idle',
      started_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      next_sync_at TIMESTAMPTZ,
      sitemap_fingerprint TEXT,
      sitemap_checked_at TIMESTAMPTZ,
      lock_until TIMESTAMPTZ,
      error_message TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS project_indexing_urls (
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      url TEXT NOT NULL,
      source_sitemap TEXT,
      sitemap_lastmod TIMESTAMPTZ,
      is_in_sitemap BOOLEAN NOT NULL DEFAULT TRUE,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      verdict TEXT,
      coverage_state TEXT,
      robots_txt_state TEXT,
      indexing_state TEXT,
      page_fetch_state TEXT,
      google_canonical TEXT,
      user_canonical TEXT,
      last_crawl_time TIMESTAMPTZ,
      inspected_at TIMESTAMPTZ,
      next_inspection_at TIMESTAMPTZ,
      inspection_attempts INTEGER NOT NULL DEFAULT 0,
      change_detected_at TIMESTAMPTZ,
      inspection_error TEXT,
      clicks DOUBLE PRECISION NOT NULL DEFAULT 0,
      impressions DOUBLE PRECISION NOT NULL DEFAULT 0,
      ctr DOUBLE PRECISION NOT NULL DEFAULT 0,
      position DOUBLE PRECISION,
      discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, url)
    )
  `;
  await sql`
    ALTER TABLE project_indexing_sync
      ADD COLUMN IF NOT EXISTS sitemap_fingerprint TEXT,
      ADD COLUMN IF NOT EXISTS sitemap_checked_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS lock_until TIMESTAMPTZ
  `;
  await sql`
    ALTER TABLE project_indexing_urls
      ADD COLUMN IF NOT EXISTS next_inspection_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS inspection_attempts INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS change_detected_at TIMESTAMPTZ
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_indexing_urls_project_status ON project_indexing_urls(user_id, status)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_indexing_urls_inspected ON project_indexing_urls(user_id, inspected_at)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_indexing_urls_due ON project_indexing_urls(user_id, next_inspection_at) WHERE is_in_sitemap = TRUE`;
}

function createGscAuth() {
  if (process.env.GOOGLE_CREDENTIALS) {
    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
    return new JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
    });
  }

  const privateKeyBase64 = process.env.GOOGLE_PRIVATE_KEY_BASE64;
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  if (!privateKeyBase64 || !clientEmail) {
    throw new Error('Google Search Console Zugangsdaten fehlen.');
  }

  return new JWT({
    email: clientEmail,
    key: Buffer.from(privateKeyBase64, 'base64').toString('utf-8'),
    scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
  });
}

function normalizeDomain(value: string) {
  return value.toLowerCase().replace(/^www\./, '');
}

function propertyAllowsUrl(siteUrl: string, candidate: string) {
  try {
    const candidateUrl = new URL(candidate);
    if (siteUrl.startsWith('sc-domain:')) {
      const propertyDomain = normalizeDomain(siteUrl.slice('sc-domain:'.length).trim());
      const hostname = normalizeDomain(candidateUrl.hostname);
      return hostname === propertyDomain || hostname.endsWith(`.${propertyDomain}`);
    }
    return candidateUrl.href.startsWith(new URL(siteUrl).href);
  } catch {
    return false;
  }
}

function defaultSitemapUrl(config: ProjectConfig) {
  const configured = config.sitemap_url?.trim();
  if (configured) return configured;
  if (config.gsc_site_url?.startsWith('http')) {
    return new URL('/sitemap.xml', config.gsc_site_url).href;
  }
  if (config.domain) {
    const domain = config.domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    return `https://${domain}/sitemap.xml`;
  }
  return null;
}

function assertSafeSitemapUrl(value: string, expectedHost?: string) {
  const parsed = new URL(value);
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Die Sitemap muss über HTTP oder HTTPS erreichbar sein.');
  }
  const hostname = parsed.hostname.toLowerCase();
  if (
    hostname === 'localhost' ||
    hostname === '0.0.0.0' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    /^10\./.test(hostname) ||
    /^192\.168\./.test(hostname) ||
    /^169\.254\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
  ) {
    throw new Error('Lokale oder private Sitemap-Adressen sind nicht erlaubt.');
  }
  if (expectedHost && normalizeDomain(hostname) !== normalizeDomain(expectedHost)) {
    throw new Error('Unter-Sitemaps müssen auf derselben Domain liegen.');
  }
  return parsed;
}

function getRequestTimeout(deadlineAt: number, maximumMs: number, reserveMs: number) {
  const remaining = deadlineAt - Date.now() - reserveMs;
  if (remaining < 1_000) {
    throw new Error('Das Zeitbudget für diesen Indexierungsabgleich ist aufgebraucht.');
  }
  return Math.min(maximumMs, remaining);
}

async function fetchXml(url: string, deadlineAt: number) {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    getRequestTimeout(deadlineAt, 15_000, 10_000),
  );
  try {
    const response = await fetch(url, {
      headers: { 'user-agent': 'DataPeak-IndexMonitor/1.0' },
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!response.ok) {
      throw new Error(`Sitemap antwortet mit HTTP ${response.status}.`);
    }
    const text = await response.text();
    if (text.length > 25_000_000) {
      throw new Error('Die Sitemap ist größer als 25 MB.');
    }
    return text;
  } finally {
    clearTimeout(timeout);
  }
}

async function readSitemapTree(
  rootUrl: string,
  deadlineAt: number,
  maxUrls = 5_000,
): Promise<SitemapEntry[]> {
  const root = assertSafeSitemapUrl(rootUrl);
  const queue: Array<{ url: string; depth: number }> = [{ url: root.href, depth: 0 }];
  const visited = new Set<string>();
  const entries = new Map<string, SitemapEntry>();

  while (queue.length && entries.size < maxUrls) {
    if (Date.now() + 10_000 >= deadlineAt) {
      throw new Error('Das Zeitbudget für das Lesen der Sitemap ist aufgebraucht.');
    }
    const current = queue.shift()!;
    if (visited.has(current.url) || current.depth > 4) continue;
    visited.add(current.url);

    const xml = await fetchXml(current.url, deadlineAt);
    const $ = load(xml, { xmlMode: true });
    const childSitemaps = $('sitemap > loc').map((_, element) => $(element).text().trim()).get();
    if (childSitemaps.length) {
      for (const child of childSitemaps) {
        try {
          const parsed = assertSafeSitemapUrl(child, root.hostname);
          queue.push({ url: parsed.href, depth: current.depth + 1 });
        } catch (error) {
          console.warn('[Indexing] Unter-Sitemap übersprungen:', child, error);
        }
      }
      continue;
    }

    $('url').each((_, element) => {
      if (entries.size >= maxUrls) return false;
      const url = $(element).find('loc').first().text().trim();
      if (!url) return;
      const lastmodValue = $(element).find('lastmod').first().text().trim();
      entries.set(url, {
        url,
        lastmod: lastmodValue && !Number.isNaN(Date.parse(lastmodValue)) ? new Date(lastmodValue).toISOString() : null,
        source: current.url,
      });
    });
  }
  return [...entries.values()];
}

function createSitemapFingerprint(entries: SitemapEntry[]) {
  const normalized = entries
    .map((entry) => `${entry.url}|${entry.lastmod ?? ''}`)
    .sort()
    .join('\n');
  return createHash('sha256').update(normalized).digest('hex');
}

function dateString(date: Date) {
  return date.toISOString().slice(0, 10);
}

async function loadPagePerformance(siteUrl: string, deadlineAt: number) {
  const auth = createGscAuth();
  const searchconsole = google.searchconsole({ version: 'v1', auth });
  const end = new Date();
  end.setDate(end.getDate() - 2);
  const start = new Date(end);
  start.setDate(start.getDate() - 89);
  const response = await searchconsole.searchanalytics.query({
    siteUrl,
    requestBody: {
      startDate: dateString(start),
      endDate: dateString(end),
      dimensions: ['page'],
      rowLimit: 25_000,
      dataState: 'all',
      type: 'web',
    },
  }, { timeout: getRequestTimeout(deadlineAt, 30_000, 15_000) });
  const result = new Map<string, { clicks: number; impressions: number; ctr: number; position: number }>();
  for (const row of response.data.rows ?? []) {
    const url = row.keys?.[0];
    if (!url) continue;
    result.set(url, {
      clicks: row.clicks ?? 0,
      impressions: row.impressions ?? 0,
      ctr: row.ctr ?? 0,
      position: row.position ?? 0,
    });
  }
  return result;
}

function getIndexingStatus(verdict?: string | null): IndexingUrlStatus {
  if (verdict === 'PASS') return 'indexed';
  if (verdict === 'FAIL' || verdict === 'NEUTRAL') return 'not_indexed';
  return 'pending';
}

async function mapWithConcurrency<T>(
  values: T[],
  concurrency: number,
  canStart: () => boolean,
  worker: (value: T) => Promise<void>,
) {
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (cursor < values.length && canStart()) {
      const value = values[cursor++];
      await worker(value);
    }
  }));
}

export async function syncProjectIndexingStatus(
  projectId: string,
  options: { force?: boolean; maxInspections?: number; deadlineAt?: number } = {},
) {
  const deadlineAt = options.deadlineAt ?? Date.now() + 240_000;
  await ensureIndexingStatusSchema();
  const { rows } = await sql<ProjectConfig>`
    SELECT id::text, domain, gsc_site_url, sitemap_url
    FROM users
    WHERE id = ${projectId}::uuid AND role = 'BENUTZER'
  `;
  const config = rows[0];
  if (!config?.gsc_site_url) throw new Error('Für das Projekt ist keine GSC Site URL konfiguriert.');
  const sitemapUrl = defaultSitemapUrl(config);
  if (!sitemapUrl) throw new Error('Für das Projekt konnte keine Sitemap-URL ermittelt werden.');

  const { rows: syncRows } = await sql<{ next_sync_at: string | null; lock_until: string | null }>`
    SELECT next_sync_at, lock_until FROM project_indexing_sync WHERE user_id = ${projectId}::uuid
  `;
  if (!options.force && syncRows[0]?.next_sync_at && new Date(syncRows[0].next_sync_at) > new Date()) {
    return getProjectIndexingStatus(projectId);
  }
  if (syncRows[0]?.lock_until && new Date(syncRows[0].lock_until) > new Date()) {
    return getProjectIndexingStatus(projectId);
  }

  const { rows: lockRows } = await sql<{ user_id: string }>`
    INSERT INTO project_indexing_sync (
      user_id, sitemap_url, status, started_at, next_sync_at, lock_until, error_message, updated_at
    )
    VALUES (
      ${projectId}::uuid, ${sitemapUrl}, 'running', NOW(), NOW(), NOW() + INTERVAL '8 minutes', NULL, NOW()
    )
    ON CONFLICT (user_id) DO UPDATE SET
      sitemap_url = EXCLUDED.sitemap_url,
      status = 'running',
      started_at = NOW(),
      lock_until = NOW() + INTERVAL '8 minutes',
      error_message = NULL,
      updated_at = NOW()
    WHERE project_indexing_sync.lock_until IS NULL OR project_indexing_sync.lock_until <= NOW()
    RETURNING user_id::text
  `;
  if (!lockRows.length) return getProjectIndexingStatus(projectId);

  try {
    const entries = (await readSitemapTree(sitemapUrl, deadlineAt))
      .filter((entry) => propertyAllowsUrl(config.gsc_site_url!, entry.url));
    if (!entries.length) throw new Error('In der Sitemap wurden keine URLs der GSC-Property gefunden.');

    const sitemapFingerprint = createSitemapFingerprint(entries);
    const performance = await loadPagePerformance(config.gsc_site_url, deadlineAt);
    const sitemapPayload = entries.map((entry) => {
      const metrics = performance.get(entry.url);
      return {
        url: entry.url,
        source: entry.source,
        lastmod: entry.lastmod,
        clicks: metrics?.clicks ?? 0,
        impressions: metrics?.impressions ?? 0,
        ctr: metrics?.ctr ?? 0,
        position: metrics?.position ?? null,
      };
    });

    await sql`
      INSERT INTO project_indexing_urls (
        user_id, url, source_sitemap, sitemap_lastmod, is_in_sitemap, last_seen_at,
        clicks, impressions, ctr, position, next_inspection_at, change_detected_at
      )
      SELECT
        ${projectId}::uuid, incoming.url, incoming.source, incoming.lastmod, TRUE, NOW(),
        incoming.clicks, incoming.impressions, incoming.ctr, incoming.position, NOW(), NOW()
      FROM jsonb_to_recordset(${JSON.stringify(sitemapPayload)}::jsonb) AS incoming(
        url TEXT,
        source TEXT,
        lastmod TIMESTAMPTZ,
        clicks DOUBLE PRECISION,
        impressions DOUBLE PRECISION,
        ctr DOUBLE PRECISION,
        position DOUBLE PRECISION
      )
      ON CONFLICT (user_id, url) DO UPDATE SET
        source_sitemap = EXCLUDED.source_sitemap,
        is_in_sitemap = TRUE,
        last_seen_at = NOW(),
        clicks = EXCLUDED.clicks,
        impressions = EXCLUDED.impressions,
        ctr = EXCLUDED.ctr,
        position = EXCLUDED.position,
        status = CASE
          WHEN project_indexing_urls.is_in_sitemap = FALSE
            OR project_indexing_urls.sitemap_lastmod IS DISTINCT FROM EXCLUDED.sitemap_lastmod
            THEN 'pending'
          ELSE project_indexing_urls.status
        END,
        change_detected_at = CASE
          WHEN project_indexing_urls.is_in_sitemap = FALSE
            OR project_indexing_urls.sitemap_lastmod IS DISTINCT FROM EXCLUDED.sitemap_lastmod
            THEN NOW()
          ELSE project_indexing_urls.change_detected_at
        END,
        next_inspection_at = CASE
          WHEN project_indexing_urls.is_in_sitemap = FALSE
            OR project_indexing_urls.sitemap_lastmod IS DISTINCT FROM EXCLUDED.sitemap_lastmod
            THEN NOW()
          ELSE project_indexing_urls.next_inspection_at
        END,
        sitemap_lastmod = EXCLUDED.sitemap_lastmod
      WHERE
        project_indexing_urls.is_in_sitemap = FALSE
        OR project_indexing_urls.source_sitemap IS DISTINCT FROM EXCLUDED.source_sitemap
        OR project_indexing_urls.sitemap_lastmod IS DISTINCT FROM EXCLUDED.sitemap_lastmod
        OR project_indexing_urls.clicks IS DISTINCT FROM EXCLUDED.clicks
        OR project_indexing_urls.impressions IS DISTINCT FROM EXCLUDED.impressions
        OR project_indexing_urls.ctr IS DISTINCT FROM EXCLUDED.ctr
        OR project_indexing_urls.position IS DISTINCT FROM EXCLUDED.position
    `;
    await sql`
      UPDATE project_indexing_urls AS stored
      SET is_in_sitemap = FALSE, last_seen_at = NOW()
      WHERE stored.user_id = ${projectId}::uuid
        AND stored.is_in_sitemap = TRUE
        AND NOT EXISTS (
          SELECT 1
          FROM jsonb_to_recordset(${JSON.stringify(sitemapPayload)}::jsonb) AS incoming(url TEXT)
          WHERE incoming.url = stored.url
        )
    `;

    const maxInspections = options.maxInspections ?? 120;
    const { rows: candidates } = await sql<{ url: string }>`
      SELECT url
      FROM project_indexing_urls
      WHERE user_id = ${projectId}::uuid
        AND is_in_sitemap = TRUE
        AND (
          inspected_at IS NULL
          OR next_inspection_at IS NULL
          OR next_inspection_at <= NOW()
          OR status = 'pending'
          OR (sitemap_lastmod IS NOT NULL AND sitemap_lastmod > inspected_at)
        )
      ORDER BY
        CASE
          WHEN inspected_at IS NULL THEN 0
          WHEN status = 'pending' THEN 1
          WHEN status = 'error' THEN 2
          WHEN status = 'not_indexed' THEN 3
          ELSE 4
        END,
        impressions DESC,
        next_inspection_at ASC NULLS FIRST,
        inspected_at ASC NULLS FIRST
      LIMIT ${maxInspections}
    `;

    const searchconsole = google.searchconsole({ version: 'v1', auth: createGscAuth() });
    await mapWithConcurrency(
      candidates,
      2,
      () => Date.now() + 25_000 < deadlineAt,
      async ({ url }) => {
        try {
          const response = await searchconsole.urlInspection.index.inspect({
            requestBody: {
              inspectionUrl: url,
              siteUrl: config.gsc_site_url!,
              languageCode: 'de-DE',
            },
          }, { timeout: getRequestTimeout(deadlineAt, 15_000, 8_000) });
          const result = response.data.inspectionResult?.indexStatusResult;
          const status = getIndexingStatus(result?.verdict);
          await sql`
            UPDATE project_indexing_urls
            SET status = ${status},
                verdict = ${result?.verdict ?? null},
                coverage_state = ${result?.coverageState ?? null},
                robots_txt_state = ${result?.robotsTxtState ?? null},
                indexing_state = ${result?.indexingState ?? null},
                page_fetch_state = ${result?.pageFetchState ?? null},
                google_canonical = ${result?.googleCanonical ?? null},
                user_canonical = ${result?.userCanonical ?? null},
                last_crawl_time = ${result?.lastCrawlTime ?? null},
                inspected_at = NOW(),
                next_inspection_at = CASE
                  WHEN ${status} = 'indexed' AND impressions >= 100 THEN NOW() + INTERVAL '7 days'
                  WHEN ${status} = 'indexed' THEN NOW() + INTERVAL '30 days'
                  WHEN ${status} = 'not_indexed' THEN NOW() + INTERVAL '7 days'
                  ELSE NOW() + INTERVAL '24 hours'
                END,
                inspection_attempts = 0,
                inspection_error = NULL
            WHERE user_id = ${projectId}::uuid AND url = ${url}
          `;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'URL Inspection fehlgeschlagen';
          await sql`
            UPDATE project_indexing_urls
            SET status = 'error',
                inspected_at = NOW(),
                inspection_attempts = inspection_attempts + 1,
                next_inspection_at = NOW() + CASE
                  WHEN inspection_attempts = 0 THEN INTERVAL '2 hours'
                  WHEN inspection_attempts = 1 THEN INTERVAL '12 hours'
                  ELSE INTERVAL '48 hours'
                END,
                inspection_error = ${message}
            WHERE user_id = ${projectId}::uuid AND url = ${url}
          `;
        }
      },
    );

    const { rows: pendingRows } = await sql<{ count: number }>`
      SELECT COUNT(*)::int AS count
      FROM project_indexing_urls
      WHERE user_id = ${projectId}::uuid AND is_in_sitemap = TRUE
        AND (inspected_at IS NULL OR status = 'pending')
    `;
    const partial = (pendingRows[0]?.count ?? 0) > 0;
    await sql`
      UPDATE project_indexing_sync
      SET status = ${partial ? 'partial' : 'completed'},
          completed_at = NOW(),
          next_sync_at = CASE
            WHEN ${partial} THEN NOW() + INTERVAL '24 hours'
            ELSE NOW() + INTERVAL '48 hours'
          END,
          sitemap_fingerprint = ${sitemapFingerprint},
          sitemap_checked_at = NOW(),
          lock_until = NULL,
          error_message = NULL,
          updated_at = NOW()
      WHERE user_id = ${projectId}::uuid
    `;
    return getProjectIndexingStatus(projectId);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Indexierungsabgleich fehlgeschlagen';
    await sql`
      UPDATE project_indexing_sync
      SET status = 'error', completed_at = NOW(), next_sync_at = NOW() + INTERVAL '48 hours',
          lock_until = NULL, error_message = ${message}, updated_at = NOW()
      WHERE user_id = ${projectId}::uuid
    `;
    throw error;
  }
}

export async function getProjectIndexingStatus(projectId: string): Promise<ProjectIndexingStatus> {
  try {
    await ensureIndexingStatusSchema();
    const { rows: projectRows } = await sql<ProjectConfig>`
      SELECT id::text, domain, gsc_site_url, sitemap_url
      FROM users WHERE id = ${projectId}::uuid
    `;
    const config = projectRows[0];
    if (!config) return EMPTY_STATUS;
    const sitemapUrl = defaultSitemapUrl(config);

    const { rows: syncRows } = await sql<{
      status: ProjectIndexingStatus['status'];
      completed_at: string | null;
      next_sync_at: string | null;
      error_message: string | null;
    }>`
      SELECT status, completed_at, next_sync_at, error_message
      FROM project_indexing_sync WHERE user_id = ${projectId}::uuid
    `;
    if (!syncRows.length && sitemapUrl && config.gsc_site_url) {
      await sql`
        INSERT INTO project_indexing_sync (
          user_id, sitemap_url, status, next_sync_at, updated_at
        )
        VALUES (${projectId}::uuid, ${sitemapUrl}, 'idle', NOW(), NOW())
        ON CONFLICT (user_id) DO NOTHING
      `;
    }
    const { rows } = await sql<any>`
      SELECT
        url, status, coverage_state, last_crawl_time, google_canonical, user_canonical,
        impressions, clicks, position, sitemap_lastmod, inspected_at, inspection_error
      FROM project_indexing_urls
      WHERE user_id = ${projectId}::uuid AND is_in_sitemap = TRUE
      ORDER BY
        CASE status WHEN 'error' THEN 0 WHEN 'not_indexed' THEN 1 WHEN 'pending' THEN 2 ELSE 3 END,
        impressions DESC,
        url ASC
    `;
    const mapped: IndexingStatusRow[] = rows.map((row) => ({
      url: row.url,
      status: row.status,
      coverageState: row.coverage_state,
      lastCrawlTime: row.last_crawl_time ? new Date(row.last_crawl_time).toISOString() : null,
      googleCanonical: row.google_canonical,
      userCanonical: row.user_canonical,
      impressions: Number(row.impressions ?? 0),
      clicks: Number(row.clicks ?? 0),
      position: row.position === null ? null : Number(row.position),
      sitemapLastmod: row.sitemap_lastmod ? new Date(row.sitemap_lastmod).toISOString() : null,
      inspectedAt: row.inspected_at ? new Date(row.inspected_at).toISOString() : null,
      inspectionError: row.inspection_error,
      hasCanonicalIssue: Boolean(
        row.google_canonical &&
        row.google_canonical.replace(/\/$/, '') !== (row.user_canonical || row.url).replace(/\/$/, '')
      ),
    }));
    const sync = syncRows[0];
    return {
      configured: Boolean(sitemapUrl && config.gsc_site_url),
      sitemapUrl,
      status: sync?.status ?? 'idle',
      totalUrls: mapped.length,
      indexedUrls: mapped.filter((row) => row.status === 'indexed').length,
      notIndexedUrls: mapped.filter((row) => row.status === 'not_indexed').length,
      pendingUrls: mapped.filter((row) => row.status === 'pending').length,
      issueUrls: mapped.filter((row) => row.status === 'error' || row.status === 'not_indexed' || row.hasCanonicalIssue).length,
      lastSyncedAt: sync?.completed_at ? new Date(sync.completed_at).toISOString() : null,
      nextSyncAt: sync?.next_sync_at ? new Date(sync.next_sync_at).toISOString() : null,
      errorMessage: sync?.error_message ?? null,
      performanceRange: 'Letzte 90 Tage',
      rows: mapped,
    };
  } catch (error) {
    console.error('[Indexing] Status konnte nicht geladen werden:', error);
    return EMPTY_STATUS;
  }
}
