import type { ProjectIndexingStatus } from '../indexing-status';
import { createMetricMetadata } from '../metric-metadata.ts';
import {
  createDataIssue,
  nonNegativeInteger,
  resolveDataStatus,
  type DataModuleResult,
} from './contracts.ts';

const INDEXING_METRIC_KEYS = [
  'indexing.total',
  'indexing.indexed',
  'indexing.notIndexed',
  'indexing.actionRequired',
  'indexing.intentional',
  'indexing.stale',
] as const;

export interface IndexingDashboardData {
  report: ProjectIndexingStatus | null;
  counts: {
    total: number;
    indexed: number;
    notIndexed: number;
    pending: number;
    /** Nur ungewollte Ausschlüsse, Prüffehler und Canonical-Konflikte. */
    actionRequired: number;
    /** Beabsichtigte Ausschlüsse: noindex, Weiterleitung, alternative Seite mit Canonical. */
    intentional: number;
    /** URLs, deren letzte Google-Prüfung älter als das Re-Check-Intervall ist. */
    stale: number;
  };
  isRunning: boolean;
  hasCompletedSync: boolean;
  /** Alter der ältesten URL-Prüfung in Tagen. Kennzeichnet, wie weit der Stand zurückliegen kann. */
  maxInspectionAgeDays: number | null;
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
  const intentional = Math.min(total, nonNegativeInteger(report?.intentionalUrls));
  const stale = Math.min(total, nonNegativeInteger(report?.staleUrls));
  const issues = createDataIssue('indexing_sync_failed', report?.errorMessage);
  const hasData = total > 0 || (report?.rows.length ?? 0) > 0;
  const updatedAt = report?.lastSyncedAt ?? new Date(0).toISOString();
  const resolvedStatus = resolveDataStatus({ configured, hasData, issues });
  // Ein veralteter Prüfstand ist genauso "partial" wie eine unvollständige Erstabdeckung:
  // die Summen beschreiben dann nicht mehr den aktuellen Google-Index.
  const isPartial = Boolean(report) && hasData && (!report!.isVerificationComplete || stale > 0);
  const moduleStatus = isPartial ? 'partial' : resolvedStatus;
  const metrics = report ? Object.fromEntries(
    INDEXING_METRIC_KEYS.map((key) => [key, createMetricMetadata(key, 'snapshot', updatedAt, {
      status: key === 'indexing.total' || (report.isVerificationComplete && stale === 0)
        ? 'complete'
        : 'partial',
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
      counts: { total, indexed, notIndexed, pending, actionRequired, intentional, stale },
      isRunning: report?.status === 'running',
      hasCompletedSync: Boolean(report?.lastSyncedAt),
      maxInspectionAgeDays: report?.maxInspectionAgeDays ?? null,
    },
    metrics,
  };
}
