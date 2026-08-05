import type { ProjectIndexingStatus } from '../indexing-status';
import {
  createDataIssue,
  nonNegativeInteger,
  resolveDataStatus,
  type DataModuleResult,
} from './contracts.ts';

export interface IndexingDashboardData {
  report: ProjectIndexingStatus | null;
  counts: {
    total: number;
    indexed: number;
    notIndexed: number;
    pending: number;
    actionRequired: number;
  };
  isRunning: boolean;
  hasCompletedSync: boolean;
}

export function createIndexingDataModule(
  report?: ProjectIndexingStatus | null,
): DataModuleResult<IndexingDashboardData> {
  const configured = report?.configured === true;
  const total = nonNegativeInteger(report?.totalUrls);
  const indexed = Math.min(total, nonNegativeInteger(report?.indexedUrls));
  const notIndexed = Math.min(total, nonNegativeInteger(report?.notIndexedUrls));
  const pending = Math.min(total, nonNegativeInteger(report?.pendingUrls));
  const actionRequired = Math.min(total, nonNegativeInteger(report?.issueUrls));
  const issues = createDataIssue('indexing_sync_failed', report?.errorMessage);
  const hasData = total > 0 || (report?.rows.length ?? 0) > 0;

  return {
    meta: {
      source: 'indexing',
      status: resolveDataStatus({ configured, hasData, issues }),
      configured,
      fromCache: false,
      lastUpdatedAt: report?.lastSyncedAt ?? null,
      issues,
    },
    data: {
      report: report ?? null,
      counts: { total, indexed, notIndexed, pending, actionRequired },
      isRunning: report?.status === 'running',
      hasCompletedSync: Boolean(report?.lastSyncedAt),
    },
  };
}
