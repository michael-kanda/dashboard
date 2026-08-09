import { sql } from '@vercel/postgres';
import type { User } from '../schemas';
import type { ProjectDashboardData } from '../dashboard-shared';
import { getDemoAnalyticsData } from '../demo-data';
import {
  attachDashboardMetricMetadata,
} from '../metric-metadata';
import { enqueueProjectSyncJob } from './job-queue';
import { isDashboardSnapshotStale } from './cache-policy';

export interface DashboardSnapshotResult {
  data: ProjectDashboardData | null;
  lastFetchedAt: string | null;
  stale: boolean;
  queued: boolean;
}

const DASHBOARD_SNAPSHOT_VERSION = 2;

export { getDashboardCacheDurationHours } from './cache-policy';

function isDemoProject(user: Pick<User, 'email' | 'domain'>) {
  return user.email?.includes('demo') || user.domain?.includes('demo-shop');
}

export async function readDashboardSnapshot(
  user: Pick<User, 'id' | 'email' | 'domain'>,
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
  const versionMismatch = cachedData?.snapshotVersion !== DASHBOARD_SNAPSHOT_VERSION;
  const stale = versionMismatch
    || isDashboardSnapshotStale(dateRange, lastFetchedAt);
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
        restartFailed: versionMismatch,
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
    data: { ...data, fromCache: true },
    lastFetchedAt,
    stale,
    queued,
  };
}
