import type { ProjectIndexingStatus } from '../indexing-status';
import { createMetricMetadata } from '../metric-metadata.ts';
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
  const updatedAt = report?.lastSyncedAt ?? new Date(0).toISOString();
  const resolvedStatus = resolveDataStatus({ configured, hasData, issues });
  const moduleStatus = hasData && report && !report.isVerificationComplete
    ? 'partial'
    : resolvedStatus;
  const metrics = report ? Object.fromEntries(
    ['indexing.total', 'indexing.indexed', 'indexing.notIndexed', 'indexing.actionRequired']
      .map((key) => [key, createMetricMetadata(key, 'snapshot', updatedAt, {
        status: key === 'indexing.total' || report.isVerificationComplete ? 'complete' : 'partial',
      })]),
  ) : {};

  return {
    meta: {
      source: 'indexing',
      status: moduleStatus,
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
    metrics,
  };
}
