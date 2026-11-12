import type { IndexingStatusRow, ExcludedSitemapUrl, ProjectIndexingStatus, ProjectIndexingProgress, ProjectConfig } from './types';
import { EMPTY_STATUS } from './types';
import { defaultSitemapUrl } from './sitemap';
import { getIndexingStatus } from './inspection';
import { sql } from '@vercel/postgres';
import { classifyIndexingRow, normalizeUrlForComparison, STALE_AFTER_DAYS } from '@/lib/indexing-status-constants';

export async function getProjectIndexingStatus(projectId: string): Promise<ProjectIndexingStatus> {
  try {
    const { rows: projectRows } = await sql<ProjectConfig>`
      SELECT id::text, domain, gsc_site_url, sitemap_url
      FROM users WHERE id = ${projectId}::uuid
    `;
    const config = projectRows[0];
    if (!config) return EMPTY_STATUS;
    const sitemapUrl = defaultSitemapUrl(config);

    const { rows: syncRows } = await sql<{
      status: ProjectIndexingStatus['status'];
      sitemap_url: string | null;
      completed_at: string | null;
      next_sync_at: string | null;
      sitemap_entry_count: number;
      excluded_url_count: number;
      excluded_urls: unknown;
      sync_warning: string | null;
      progress_stage: ProjectIndexingStatus['progressStage'];
      progress_total: number;
      progress_completed: number;
      progress_due_total: number;
      error_message: string | null;
    }>`
      SELECT
        status, sitemap_url, completed_at, next_sync_at, sitemap_entry_count,
        excluded_url_count, excluded_urls, sync_warning, progress_stage,
        progress_total, progress_completed, progress_due_total, error_message
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
    const { rows } = await sql`
      SELECT
        url, status, coverage_state, robots_txt_state, indexing_state, page_fetch_state,
        last_crawl_time, google_canonical, user_canonical,
        verdict, impressions, clicks, position, sitemap_lastmod, inspected_at,
        next_inspection_at, change_detected_at, inspection_error
      FROM project_indexing_urls
      WHERE user_id = ${projectId}::uuid AND is_in_sitemap = TRUE
      ORDER BY
        CASE status WHEN 'error' THEN 0 WHEN 'not_indexed' THEN 1 WHEN 'pending' THEN 2 ELSE 3 END,
        impressions DESC,
        url ASC
    `;
    const now = Date.now();
    const mapped: IndexingStatusRow[] = rows.map((row) => {
      const inspectedAt = row.inspected_at ? new Date(row.inspected_at).toISOString() : null;
      const resolvedStatus = row.status === 'pending' && row.verdict
        ? getIndexingStatus(row.verdict)
        : row.status;
      const nextInspectionAt = row.next_inspection_at
        ? new Date(row.next_inspection_at).getTime()
        : null;
      const changeDetectedAt = row.change_detected_at
        ? new Date(row.change_detected_at).getTime()
        : null;
      const hasCanonicalIssue = Boolean(
        row.google_canonical &&
        normalizeUrlForComparison(row.google_canonical)
          !== normalizeUrlForComparison(row.user_canonical || row.url),
      );
      const classification = classifyIndexingRow({
        status: resolvedStatus,
        coverageState: row.coverage_state,
        robotsTxtState: row.robots_txt_state,
        indexingState: row.indexing_state,
        pageFetchState: row.page_fetch_state,
        hasCanonicalIssue,
      });
      const inspectionAgeDays = inspectedAt
        ? Math.floor((now - new Date(inspectedAt).getTime()) / 86_400_000)
        : null;
      return {
        url: row.url,
        status: resolvedStatus,
        coverageState: row.coverage_state,
        robotsTxtState: row.robots_txt_state,
        indexingState: row.indexing_state,
        pageFetchState: row.page_fetch_state,
        lastCrawlTime: row.last_crawl_time ? new Date(row.last_crawl_time).toISOString() : null,
        googleCanonical: row.google_canonical,
        userCanonical: row.user_canonical,
        impressions: Number(row.impressions ?? 0),
        clicks: Number(row.clicks ?? 0),
        position: row.position === null ? null : Number(row.position),
        sitemapLastmod: row.sitemap_lastmod ? new Date(row.sitemap_lastmod).toISOString() : null,
        inspectedAt,
        inspectionPending: !inspectedAt || nextInspectionAt === null || nextInspectionAt <= now || (
          changeDetectedAt !== null && changeDetectedAt > new Date(inspectedAt).getTime()
        ),
        inspectionError: row.inspection_error,
        hasCanonicalIssue,
        category: classification.category,
        isIntentional: classification.isIntentional,
        needsAction: classification.needsAction,
        actionHint: classification.actionHint,
        inspectionAgeDays,
        isStale: inspectionAgeDays !== null && inspectionAgeDays > STALE_AFTER_DAYS,
      };
    });
    const sync = syncRows[0];
    const excludedUrls: ExcludedSitemapUrl[] = [];
    if (Array.isArray(sync?.excluded_urls)) {
      for (const item of sync.excluded_urls) {
        if (!item || typeof item !== 'object') continue;
        const raw = item as Record<string, unknown>;
        if (typeof raw.url === 'string' && typeof raw.reason === 'string') {
          excludedUrls.push({ url: raw.url, reason: raw.reason });
        }
      }
    }
    const resolvedSitemapUrl = sync?.sitemap_url || sitemapUrl;
    const storedSitemapEntryCount = Number(sync?.sitemap_entry_count ?? 0);
    const excludedUrlCount = Number(sync?.excluded_url_count ?? 0);
    const verifiedUrls = mapped.filter(
      (row) => row.status === 'indexed' || row.status === 'not_indexed',
    ).length;
    const unverifiedUrls = Math.max(0, mapped.length - verifiedUrls);
    const verificationCoverage = mapped.length > 0
      ? Math.round((verifiedUrls / mapped.length) * 100)
      : 0;
    const recheckPendingUrls = mapped.filter(
      (row) => (row.status === 'indexed' || row.status === 'not_indexed') && row.inspectionPending,
    ).length;
    const inspectionTimestamps = mapped
      .map((row) => row.inspectedAt)
      .filter((value): value is string => Boolean(value))
      .sort();
    const oldestInspectionAt = inspectionTimestamps[0] ?? null;
    const maxInspectionAgeDays = oldestInspectionAt
      ? Math.floor((now - new Date(oldestInspectionAt).getTime()) / 86_400_000)
      : null;
    return {
      configured: Boolean(resolvedSitemapUrl && config.gsc_site_url),
      sitemapUrl: resolvedSitemapUrl,
      status: sync?.status ?? 'idle',
      sitemapEntryCount: storedSitemapEntryCount > 0
        ? storedSitemapEntryCount
        : mapped.length + excludedUrlCount,
      excludedUrlCount,
      excludedUrls,
      warningMessage: sync?.sync_warning ?? null,
      progressStage: sync?.progress_stage ?? 'idle',
      progressTotal: Number(sync?.progress_total ?? 0),
      progressCompleted: Number(sync?.progress_completed ?? 0),
      progressDueTotal: Number(sync?.progress_due_total ?? 0),
      totalUrls: mapped.length,
      verifiedUrls,
      unverifiedUrls,
      verificationCoverage,
      isVerificationComplete: mapped.length > 0 && unverifiedUrls === 0,
      recheckPendingUrls,
      indexedUrls: mapped.filter((row) => row.status === 'indexed').length,
      notIndexedUrls: mapped.filter((row) => row.status === 'not_indexed').length,
      pendingUrls: mapped.filter((row) => row.status === 'pending').length,
      issueUrls: mapped.filter((row) => row.needsAction).length,
      intentionalUrls: mapped.filter((row) => row.isIntentional).length,
      staleUrls: mapped.filter((row) => row.isStale).length,
      oldestInspectionAt,
      maxInspectionAgeDays,
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

export async function getProjectIndexingProgress(
  projectId: string,
): Promise<ProjectIndexingProgress> {
  const { rows } = await sql<{
    status: ProjectIndexingStatus['status'];
    progress_stage: ProjectIndexingStatus['progressStage'];
    progress_total: number;
    progress_completed: number;
    progress_due_total: number;
  }>`
    SELECT status, progress_stage, progress_total, progress_completed, progress_due_total
    FROM project_indexing_sync
    WHERE user_id = ${projectId}::uuid
  `;
  const progress = rows[0];
  return {
    status: progress?.status ?? 'idle',
    progressStage: progress?.progress_stage ?? 'idle',
    progressTotal: Number(progress?.progress_total ?? 0),
    progressCompleted: Number(progress?.progress_completed ?? 0),
    progressDueTotal: Number(progress?.progress_due_total ?? 0),
  };
}
