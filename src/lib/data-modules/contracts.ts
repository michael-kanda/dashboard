import type { MetricMetadata } from '../metric-metadata';

export type DashboardDataSource = 'gsc' | 'ga4' | 'google-ads' | 'local-seo' | 'indexing';

export type DataModuleStatus =
  | 'available'
  | 'partial'
  | 'empty'
  | 'error'
  | 'not_configured';

export type DataModuleIssueSeverity = 'warning' | 'error';

export interface DataModuleIssue {
  code: string;
  message: string;
  severity: DataModuleIssueSeverity;
  retryable: boolean;
}

export interface DataModuleMeta {
  source: DashboardDataSource;
  status: DataModuleStatus;
  configured: boolean;
  fromCache: boolean;
  lastUpdatedAt: string | null;
  issues: DataModuleIssue[];
}

export interface DataModuleResult<T> {
  meta: DataModuleMeta;
  data: T;
  metrics: Record<string, MetricMetadata>;
}

export function selectMetricMetadata(
  metadata: Record<string, MetricMetadata> | undefined,
  prefixes: string[],
) {
  return Object.fromEntries(
    Object.entries(metadata ?? {}).filter(([key]) => (
      prefixes.some((prefix) => key.startsWith(prefix))
    )),
  );
}

export function isTransientDataError(message?: string | null) {
  if (!message) return false;
  const normalized = message.toLowerCase();
  return [
    'aborted',
    'timeout',
    'timed out',
    'econnreset',
    'socket hang up',
    'fetch failed',
    'quota',
    'temporarily unavailable',
  ].some((fragment) => normalized.includes(fragment));
}

export function createDataIssue(
  code: string,
  message?: string | null,
): DataModuleIssue[] {
  if (!message) return [];
  const retryable = isTransientDataError(message);
  return [{
    code,
    message,
    severity: retryable ? 'warning' : 'error',
    retryable,
  }];
}

export function resolveDataStatus({
  configured = true,
  hasData,
  issues,
}: {
  configured?: boolean;
  hasData: boolean;
  issues: DataModuleIssue[];
}): DataModuleStatus {
  if (!configured) return 'not_configured';
  if (hasData && issues.length > 0) return 'partial';
  if (hasData) return 'available';
  if (issues.some((issue) => issue.severity === 'error')) return 'error';
  if (issues.length > 0) return 'partial';
  return 'empty';
}

export function finiteNumber(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function nonNegativeInteger(value: unknown) {
  return Math.max(0, Math.round(finiteNumber(value)));
}
