import { sql } from '@vercel/postgres';
import type { User } from '../schemas';
import type { ProjectDashboardData } from '../dashboard-shared';
import { getDemoAnalyticsData } from '../demo-data';
import { attachDashboardMetricMetadata } from '../metric-metadata';
import { isDemoProject } from '../demo-project';
import { enqueueProjectSyncJob } from './job-queue';
import { INVALIDATED_CACHE_TIMESTAMP, isDashboardSnapshotBehind, isDashboardSnapshotStale } from './cache-policy';
import { isDashboardSnapshotCompatible } from './dashboard-snapshot-contract';

export interface DashboardSnapshotResult {
  data: ProjectDashboardData | null;
  lastFetchedAt: string | null;
  stale: boolean;
  queued: boolean;
}

export { DASHBOARD_SNAPSHOT_VERSION } from './dashboard-snapshot-contract';

export { getDashboardCacheDurationHours } from './cache-policy';

export async function readDashboardSnapshot(
  user: Pick<User, 'id' | 'email' | 'domain' | 'is_demo' | 'google_ads_sheet_id'>,
  dateRange: string,
  options: {
    enqueueIfStale?: boolean;
    enqueueIfMissing?: boolean;
    priority?: number;
  } = {},
): Promise<DashboardSnapshotResult> {
  if (!user.id) return { data: null, lastFetchedAt: null, stale: true, queued: false };
  if (isDemoProject(user)) {
    const updatedAt = new Date().toISOString();
    return {
      data: attachDashboardMetricMetadata(getDemoAnalyticsData(dateRange), dateRange, updatedAt),
      lastFetchedAt: updatedAt,
      stale: false,
      queued: false,
    };
  }

  const { rows } = await sql`
    SELECT data, last_fetched
    FROM google_data_cache
    WHERE user_id = ${user.id}::uuid AND date_range = ${dateRange}
    LIMIT 1
  `;
  const row = rows[0];
  const lastFetchedAt = row?.last_fetched
    ? new Date(String(row.last_fetched)).toISOString()
    : null;
  const cachedData = row?.data as ProjectDashboardData | undefined;
  const configuredSheetId = user.google_ads_sheet_id?.trim() || null;
  const versionMismatch = Boolean(cachedData)
    && !isDashboardSnapshotCompatible(cachedData, configuredSheetId);
  const stale = versionMismatch
    || isDashboardSnapshotStale(dateRange, lastFetchedAt)
    || (Boolean(cachedData) && isDashboardSnapshotBehind(dateRange, cachedData?.reportingPeriod?.to));
  let queued = false;

  const shouldEnqueue = stale
    && options.enqueueIfStale !== false
    && (Boolean(cachedData) || options.enqueueIfMissing !== false);
  if (shouldEnqueue) {
    try {
      await enqueueProjectSyncJob({
        userId: user.id,
        jobType: 'dashboard',
        dateRange,
        payload: { dateRange },
        priority: options.priority ?? (row ? 20 : 100),
        restartFailed: false,
        preservePending: true,
      });
      queued = true;
    } catch (error) {
      console.warn('[Dashboard Snapshot] Sync-Auftrag konnte nicht eingereiht werden:', error);
    }
  }

  if (!cachedData) return { data: null, lastFetchedAt, stale, queued };
  const data = cachedData.metricMetadata
    ? cachedData
    : attachDashboardMetricMetadata(cachedData, dateRange, lastFetchedAt ?? new Date().toISOString());

  return {
    data: { ...data, fromCache: true, cacheStale: stale },
    lastFetchedAt,
    stale,
    queued,
  };
}

// Markiert alle Snapshots eines Projekts als fällig, ohne ihre Daten zu löschen:
// Der letzte gültige Stand bleibt bis zur erfolgreichen Synchronisierung sichtbar.
// Ohne userId bzw. dateRange gilt die Markierung für alle Projekte bzw. Zeiträume.
export async function markDashboardSnapshotsStale({
  userId,
  dateRange,
}: { userId?: string; dateRange?: string } = {}) {
  const result = await sql`
    UPDATE google_data_cache
    SET last_fetched = ${INVALIDATED_CACHE_TIMESTAMP}::timestamptz
    WHERE (${userId ?? null}::uuid IS NULL OR user_id = ${userId ?? null}::uuid)
      AND (${dateRange ?? null}::text IS NULL OR date_range = ${dateRange ?? null})
      AND last_fetched IS DISTINCT FROM ${INVALIDATED_CACHE_TIMESTAMP}::timestamptz
  `;
  return result.rowCount ?? 0;
}
