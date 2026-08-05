import type {
  KpiDatum,
  ChartPoint,
  TopQueryData,
} from '../../types/dashboard';
import type {
  LandingPageQueries,
  ProjectDashboardData,
} from '../dashboard-shared';
import {
  createDataIssue,
  finiteNumber,
  resolveDataStatus,
  selectMetricMetadata,
  type DataModuleResult,
} from './contracts.ts';

export interface GscDashboardData {
  kpis: {
    clicks: KpiDatum;
    impressions: KpiDatum;
  };
  charts: {
    clicks: ChartPoint[];
    impressions: ChartPoint[];
  };
  topQueries: TopQueryData[];
  landingPageQueries: LandingPageQueries;
  dataVersion: number | null;
  displayError: string | null;
}

function normalizeKpi(value?: KpiDatum): KpiDatum {
  return {
    value: finiteNumber(value?.value),
    change: finiteNumber(value?.change),
  };
}

export function createGscDataModule(
  input: ProjectDashboardData,
): DataModuleResult<GscDashboardData> {
  const error = input.apiErrors?.gsc ?? null;
  const issues = createDataIssue('gsc_request_failed', error);
  const topQueries = input.topQueries ?? [];
  const clicks = normalizeKpi(input.kpis?.clicks);
  const impressions = normalizeKpi(input.kpis?.impressions);
  const hasData = topQueries.length > 0
    || clicks.value > 0
    || impressions.value > 0
    || (input.charts?.clicks?.length ?? 0) > 0
    || (input.charts?.impressions?.length ?? 0) > 0;

  return {
    meta: {
      source: 'gsc',
      status: resolveDataStatus({ hasData, issues }),
      configured: true,
      fromCache: input.fromCache === true,
      lastUpdatedAt: input.metricMetadata?.['gsc.clicks']?.updatedAt ?? null,
      issues,
    },
    data: {
      kpis: { clicks, impressions },
      charts: {
        clicks: input.charts?.clicks ?? [],
        impressions: input.charts?.impressions ?? [],
      },
      topQueries,
      landingPageQueries: input.landingPageQueries ?? {},
      dataVersion: typeof input.topQueriesDataVersion === 'number'
        ? input.topQueriesDataVersion
        : null,
      displayError: error,
    },
    metrics: selectMetricMetadata(input.metricMetadata, ['gsc.']),
  };
}
