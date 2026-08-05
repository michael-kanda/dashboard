import { sql } from '@vercel/postgres';
import type { User } from '../schemas';
import type { ProjectDashboardData } from '../dashboard-shared';
import { getDemoAnalyticsData } from '../demo-data';
import {
  attachDashboardMetricMetadata,
  DASHBOARD_SNAPSHOT_VERSION,
} from '../metric-metadata';
import { enqueueProjectSyncJob } from './job-queue';

export interface DashboardSnapshotResult {
  data: ProjectDashboardData | null;
  lastFetchedAt: string | null;
  stale: boolean;
  queued: boolean;
}

export function getDashboardCacheDurationHours(dateRange: string) {
  if (dateRange === '18m' || dateRange === '24m') return 72;
  if (dateRange === '12m') return 48;
  return 24;
}

function isDemoProject(user: Pick<User, 'email' | 'domain'>) {
  return user.email?.includes('demo') || user.domain?.includes('demo-shop');
}

export async function readDashboardSnapshot(
  user: Pick<User, 'id' | 'email' | 'domain'>,
  dateRange: string,
  options: { enqueueIfStale?: boolean; priority?: number } = {},
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
  const maxAgeMs = getDashboardCacheDurationHours(dateRange) * 60 * 60 * 1000;
  const cachedData = row?.data as ProjectDashboardData | undefined;
  const stale = !lastFetchedAt
    || Date.now() - new Date(lastFetchedAt).getTime() >= maxAgeMs
    || cachedData?.snapshotVersion !== DASHBOARD_SNAPSHOT_VERSION;
  let queued = false;

  if (stale && options.enqueueIfStale !== false) {
    try {
      await enqueueProjectSyncJob({
        userId: user.id,
        jobType: 'dashboard',
        dateRange,
        payload: { dateRange },
        priority: options.priority ?? (row ? 20 : 100),
        restartFailed: false,
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
