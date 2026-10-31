import { persistInspectionResult } from './inspection-repository';
import type { ExcludedSitemapUrl, ProjectIndexingStatus, ProjectConfig, SitemapEntry, IndexingSyncOptions } from './types';
import { createGscAuth, loadPagePerformance, mapWithConcurrency } from './inspection';
import { propertyAllowsUrl, defaultSitemapUrl, getTechnicalUrlReason, getSitemapCandidates, readSitemapTree, createSitemapFingerprint } from './sitemap';
import { InspectionBudgetExceededError, getRequestTimeout } from './request-budget';
import { getProjectIndexingStatus } from './repository';
import { google } from 'googleapis';
import { sql } from '@vercel/postgres';
import { reserveInspectionQuota, releaseInspectionQuota } from '@/lib/sync/inspection-budget';
import { classifyGoogleApiError } from '@/lib/sync/google-api-error';
import { getInspectionCandidates } from './candidates';
import { persistSitemapEntries } from './sitemap-repository';

export async function syncProjectIndexingStatus(
  projectId: string,
  options: IndexingSyncOptions = {},
) {
  const deadlineAt = options.deadlineAt ?? Date.now() + 240_000;
  const inspectionReserveMs = options.inspectionReserveMs ?? 12_000;
  const inspectionConcurrency = Math.max(1, Math.min(10, options.inspectionConcurrency ?? 6));
  const { rows } = await sql<ProjectConfig>`
    SELECT id::text, domain, gsc_site_url, sitemap_url
    FROM users
    WHERE id = ${projectId}::uuid AND role = 'BENUTZER'
  `;
  const config = rows[0];
  if (!config?.gsc_site_url) throw new Error('Für das Projekt ist keine GSC Site URL konfiguriert.');
  const gscSiteUrl = config.gsc_site_url;
  let sitemapUrl = defaultSitemapUrl(config);
  if (!sitemapUrl) throw new Error('Für das Projekt konnte keine Sitemap-URL ermittelt werden.');

  const { rows: syncRows } = await sql<{
    status: ProjectIndexingStatus['status'];
    next_sync_at: string | null;
    lock_until: string | null;
    sitemap_checked_at: string | null;
  }>`
    SELECT status, next_sync_at, lock_until, sitemap_checked_at
    FROM project_indexing_sync
    WHERE user_id = ${projectId}::uuid
  `;
  if (!options.force && syncRows[0]?.next_sync_at && new Date(syncRows[0].next_sync_at) > new Date()) {
    return { ...(await getProjectIndexingStatus(projectId)), skipped: 'not-due' as const };
  }
  if (syncRows[0]?.lock_until && new Date(syncRows[0].lock_until) > new Date()) {
    return { ...(await getProjectIndexingStatus(projectId)), skipped: 'locked' as const };
  }
  const sitemapCheckedAt = syncRows[0]?.sitemap_checked_at
    ? new Date(syncRows[0].sitemap_checked_at).getTime()
    : 0;
  const continueStoredInspectionQueue = !options.force
    && syncRows[0]?.status === 'partial'
    && sitemapCheckedAt > Date.now() - 6 * 60 * 60 * 1000;

  const { rows: lockRows } = await sql<{ user_id: string }>`
    INSERT INTO project_indexing_sync (
      user_id, sitemap_url, status, started_at, next_sync_at, lock_until,
      progress_stage, progress_total, progress_completed, progress_due_total,
      error_message, updated_at
    )
    VALUES (
      ${projectId}::uuid, ${sitemapUrl}, 'running', NOW(), NOW(), NOW() + INTERVAL '8 minutes',
      ${continueStoredInspectionQueue ? 'inspection' : 'sitemap'}, 0, 0, 0, NULL, NOW()
    )
    ON CONFLICT (user_id) DO UPDATE SET
      sitemap_url = EXCLUDED.sitemap_url,
      status = 'running',
      started_at = NOW(),
      lock_until = NOW() + INTERVAL '8 minutes',
      progress_stage = ${continueStoredInspectionQueue ? 'inspection' : 'sitemap'},
      progress_total = 0,
      progress_completed = 0,
      progress_due_total = 0,
      error_message = NULL,
      updated_at = NOW()
    WHERE project_indexing_sync.lock_until IS NULL OR project_indexing_sync.lock_until <= NOW()
    RETURNING user_id::text
  `;
  if (!lockRows.length) {
    return { ...(await getProjectIndexingStatus(projectId)), skipped: 'locked' as const };
  }

  try {
    const sourceSnapshot = continueStoredInspectionQueue ? null : await (async () => {
    const sitemapCandidates = await getSitemapCandidates(config, deadlineAt);
    let selected: {
      sitemapUrl: string;
      propertyEntries: SitemapEntry[];
      entries: SitemapEntry[];
      excludedUrls: ExcludedSitemapUrl[];
    } | null = null;
    const sitemapErrors: string[] = [];

    for (const candidate of sitemapCandidates) {
      try {
        const propertyEntries = (await readSitemapTree(candidate, deadlineAt))
          .filter((entry) => propertyAllowsUrl(gscSiteUrl, entry.url));
        if (!propertyEntries.length) continue;

        const excludedUrls: ExcludedSitemapUrl[] = [];
        const entries = propertyEntries.filter((entry) => {
          const reason = getTechnicalUrlReason(entry.url);
          if (!reason) return true;
          excludedUrls.push({ url: entry.url, reason });
          return false;
        });
        const candidateResult = { sitemapUrl: candidate, propertyEntries, entries, excludedUrls };
        if (entries.length) {
          selected = candidateResult;
          break;
        }
        selected ??= candidateResult;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Sitemap konnte nicht gelesen werden';
        sitemapErrors.push(`${candidate}: ${message}`);
      }
    }

    if (!selected) {
      const detail = sitemapErrors[0] ? ` ${sitemapErrors[0]}` : '';
      throw new Error(`In keiner erkannten Sitemap wurden URLs der GSC-Property gefunden.${detail}`);
    }

    sitemapUrl = selected.sitemapUrl;
    const { propertyEntries, entries, excludedUrls } = selected;
    const excludedUrlCount = excludedUrls.length;
    const warningMessage = excludedUrlCount > 0 && excludedUrlCount >= propertyEntries.length / 2
      ? 'Die Sitemap enthält überwiegend technische Feed- oder System-URLs. Diese werden nicht als SEO-relevante Seiten bewertet.'
      : null;
    const sitemapFingerprint = createSitemapFingerprint(propertyEntries);
    await sql`
      UPDATE project_indexing_sync
      SET progress_stage = 'gsc', sitemap_url = ${sitemapUrl}, updated_at = NOW()
      WHERE user_id = ${projectId}::uuid
    `;
    const performance = entries.length
      ? await loadPagePerformance(gscSiteUrl, deadlineAt)
      : new Map<string, { clicks: number; impressions: number; ctr: number; position: number }>();
    await persistSitemapEntries(projectId, entries, performance);
    return {
      sitemapFingerprint,
      sitemapEntryCount: propertyEntries.length,
      excludedUrlCount,
      excludedUrls,
      warningMessage,
    };
    })();

    const requestedInspections = options.maxInspections ?? 120;
    const grantedInspections = await reserveInspectionQuota(gscSiteUrl, requestedInspections);
    if (grantedInspections === 0) {
      await sql`
        UPDATE project_indexing_sync
        SET status = 'partial',
            progress_stage = 'paused',
            next_sync_at = GREATEST(next_sync_at, NOW() + INTERVAL '1 hour'),
            lock_until = NULL,
            sync_warning = 'Tageskontingent der URL Inspection API ausgeschöpft.',
            updated_at = NOW()
        WHERE user_id = ${projectId}::uuid
      `;
      return { ...(await getProjectIndexingStatus(projectId)), skipped: 'quota' as const };
    }
    const maxInspections = grantedInspections;
    const candidates = await getInspectionCandidates(projectId, maxInspections);
    const dueTotal = Number(candidates[0]?.due_total ?? 0);
    await sql`
      UPDATE project_indexing_sync
      SET progress_stage = 'inspection',
          progress_total = ${candidates.length},
          progress_completed = 0,
          progress_due_total = ${dueTotal},
          updated_at = NOW()
      WHERE user_id = ${projectId}::uuid
    `;

    const searchconsole = google.searchconsole({ version: 'v1', auth: createGscAuth() });
    let attemptedInspections = 0;
    let quotaExhausted = false;
    let fatalInspectionError: unknown = null;
    try {
      await mapWithConcurrency(
        candidates,
        inspectionConcurrency,
        () => !quotaExhausted
          && fatalInspectionError === null
          && Date.now() + inspectionReserveMs < deadlineAt,
        async ({ url }) => {
          let skippedByBudget = false;
          try {
            const requestTimeout = getRequestTimeout(
              deadlineAt,
              15_000,
              Math.max(4_000, inspectionReserveMs - 4_000),
            );
            attemptedInspections += 1;
            const response = await searchconsole.urlInspection.index.inspect({
              requestBody: {
                inspectionUrl: url,
                siteUrl: gscSiteUrl,
                languageCode: 'de-DE',
              },
            }, { timeout: requestTimeout });
            const result = response.data.inspectionResult?.indexStatusResult;
            await persistInspectionResult(projectId, url, result);
          } catch (error) {
            if (error instanceof InspectionBudgetExceededError) {
              skippedByBudget = true;
              return;
            }
            const classified = classifyGoogleApiError(error);
            const message = classified.message || 'URL Inspection fehlgeschlagen';
            if (classified.kind === 'quota') {
              quotaExhausted = true;
              skippedByBudget = true;
              return;
            }
            if (classified.status === 401 || classified.status === 403) {
              fatalInspectionError = error;
              skippedByBudget = true;
              return;
            }
            await sql`
              UPDATE project_indexing_urls
              SET status = CASE
                    WHEN verdict IN ('PASS', 'FAIL', 'NEUTRAL') THEN status
                    ELSE 'error'
                  END,
                  inspected_at = CASE
                    WHEN verdict IN ('PASS', 'FAIL', 'NEUTRAL') THEN inspected_at
                    ELSE NOW()
                  END,
                  inspection_attempts = inspection_attempts + 1,
                  next_inspection_at = NOW() + CASE
                    WHEN ${classified.kind === 'permanent'} THEN INTERVAL '7 days'
                    WHEN inspection_attempts = 0 THEN INTERVAL '2 hours'
                    WHEN inspection_attempts = 1 THEN INTERVAL '12 hours'
                    ELSE INTERVAL '48 hours'
                  END,
                  inspection_error = ${message}
              WHERE user_id = ${projectId}::uuid AND url = ${url}
            `;
          } finally {
            if (!skippedByBudget) {
              try {
                await sql`
                  UPDATE project_indexing_sync
                  SET progress_completed = LEAST(progress_completed + 1, progress_total),
                      updated_at = NOW()
                  WHERE user_id = ${projectId}::uuid
                `;
              } catch (progressError) {
                console.warn('[Indexing] Fortschritt konnte nicht aktualisiert werden:', progressError);
              }
            }
          }
        },
      );
    } finally {
      await releaseInspectionQuota(
        gscSiteUrl,
        Math.max(0, grantedInspections - attemptedInspections),
      );
    }
    if (fatalInspectionError !== null) throw fatalInspectionError;

    const { rows: remainingRows } = await sql<{
      due_count: number;
      unresolved_count: number;
      next_unresolved_at: string | null;
    }>`
      SELECT
        COUNT(*) FILTER (
          WHERE inspected_at IS NULL
            OR next_inspection_at IS NULL
            OR next_inspection_at <= NOW()
            OR status = 'pending'
        )::int AS due_count,
        COUNT(*) FILTER (
          WHERE verdict IS NULL OR verdict NOT IN ('PASS', 'FAIL', 'NEUTRAL')
        )::int AS unresolved_count,
        MIN(next_inspection_at) FILTER (
          WHERE verdict IS NULL OR verdict NOT IN ('PASS', 'FAIL', 'NEUTRAL')
        ) AS next_unresolved_at
      FROM project_indexing_urls
      WHERE user_id = ${projectId}::uuid AND is_in_sitemap = TRUE
    `;
    const dueCount = Number(remainingRows[0]?.due_count ?? 0);
    const unresolvedCount = Number(remainingRows[0]?.unresolved_count ?? 0);
    const nextUnresolvedAt = remainingRows[0]?.next_unresolved_at ?? null;
    const partial = dueCount > 0 || unresolvedCount > 0;
    await sql`
      UPDATE project_indexing_sync
      SET status = ${partial ? 'partial' : 'completed'},
          progress_stage = ${quotaExhausted ? 'paused' : (partial ? 'queued' : 'completed')},
          completed_at = NOW(),
          next_sync_at = CASE
            WHEN ${quotaExhausted} THEN NOW() + INTERVAL '1 hour'
            WHEN ${dueCount} > 0 THEN NOW() + INTERVAL '5 minutes'
            WHEN ${unresolvedCount} > 0 AND ${nextUnresolvedAt}::timestamptz IS NOT NULL
              THEN GREATEST(${nextUnresolvedAt}::timestamptz, NOW() + INTERVAL '5 minutes')
            WHEN ${unresolvedCount} > 0 THEN NOW() + INTERVAL '2 hours'
            ELSE NOW() + INTERVAL '48 hours'
          END,
          sitemap_fingerprint = CASE
            WHEN ${sourceSnapshot !== null} THEN ${sourceSnapshot?.sitemapFingerprint ?? null}
            ELSE sitemap_fingerprint
          END,
          sitemap_checked_at = CASE
            WHEN ${sourceSnapshot !== null} THEN NOW()
            ELSE sitemap_checked_at
          END,
          sitemap_url = CASE
            WHEN ${sourceSnapshot !== null} THEN ${sitemapUrl}
            ELSE sitemap_url
          END,
          sitemap_entry_count = CASE
            WHEN ${sourceSnapshot !== null} THEN ${sourceSnapshot?.sitemapEntryCount ?? 0}
            ELSE sitemap_entry_count
          END,
          excluded_url_count = CASE
            WHEN ${sourceSnapshot !== null} THEN ${sourceSnapshot?.excludedUrlCount ?? 0}
            ELSE excluded_url_count
          END,
          excluded_urls = CASE
            WHEN ${sourceSnapshot !== null}
              THEN ${JSON.stringify(sourceSnapshot?.excludedUrls.slice(0, 500) ?? [])}::jsonb
            ELSE excluded_urls
          END,
          sync_warning = CASE
            WHEN ${quotaExhausted} THEN 'Tageskontingent der URL Inspection API ausgeschöpft.'
            WHEN ${sourceSnapshot !== null} THEN ${sourceSnapshot?.warningMessage ?? null}
            ELSE sync_warning
          END,
          lock_until = NULL,
          error_message = NULL,
          updated_at = NOW()
      WHERE user_id = ${projectId}::uuid
    `;
    // Auch bei unterwegs ausgeschöpfter Quote sind die geprüften URLs gespeichert;
    // next_sync_at und sync_warning planen die Fortsetzung bereits ein.
    return getProjectIndexingStatus(projectId);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Indexierungsabgleich fehlgeschlagen';
    await sql`
      UPDATE project_indexing_sync
      SET status = 'error',
          completed_at = NOW(),
          next_sync_at = NOW() + INTERVAL '2 hours',
          progress_stage = 'error',
          lock_until = NULL,
          error_message = ${message},
          updated_at = NOW()
      WHERE user_id = ${projectId}::uuid
    `;
    throw error;
  }
}
