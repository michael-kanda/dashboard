import type { ChartPoint, KpiDatum } from '../../types/dashboard';
import type {
  ChartEntry,
  ConvertingPageData,
  ProjectDashboardData,
} from '../dashboard-shared';
import type { AiTrafficData } from '../../types/ai-traffic';
import {
  createDataIssue,
  finiteNumber,
  isTransientDataError,
  resolveDataStatus,
  selectMetricMetadata,
  type DataModuleResult,
} from './contracts.ts';

export type Ga4KpiKey =
  | 'sessions'
  | 'totalUsers'
  | 'conversions'
  | 'engagementRate'
  | 'bounceRate'
  | 'newUsers'
  | 'avgEngagementTime'
  | 'paidSearch';

export interface Ga4DashboardData {
  kpis: Record<Ga4KpiKey, KpiDatum>;
  charts: Partial<Record<Ga4KpiKey, ChartPoint[]>>;
  landingPages: ConvertingPageData[];
  aiTraffic: AiTrafficData;
  breakdowns: {
    channels: ChartEntry[];
    countries: ChartEntry[];
    devices: ChartEntry[];
  };
  displayError: string | null;
}

const GA4_KPI_KEYS: Ga4KpiKey[] = [
  'sessions',
  'totalUsers',
  'conversions',
  'engagementRate',
  'bounceRate',
  'newUsers',
  'avgEngagementTime',
  'paidSearch',
];

function normalizeKpi(value?: KpiDatum): KpiDatum {
  return {
    value: finiteNumber(value?.value),
    change: finiteNumber(value?.change),
  };
}

function normalizeAiTraffic(value?: AiTrafficData): AiTrafficData {
  return value ?? {
    totalSessions: 0,
    totalUsers: 0,
    sessionsBySource: {},
    topAiSources: [],
    trend: [],
  };
}

export function createGa4DataModule(
  input: ProjectDashboardData,
): DataModuleResult<Ga4DashboardData> {
  const error = input.apiErrors?.ga4 ?? null;
  const issues = createDataIssue('ga4_request_failed', error);
  const kpis = Object.fromEntries(
    GA4_KPI_KEYS.map((key) => [key, normalizeKpi(input.kpis?.[key])]),
  ) as Record<Ga4KpiKey, KpiDatum>;
  const aiTraffic = normalizeAiTraffic(input.aiTraffic);
  const hasData = GA4_KPI_KEYS.some((key) => kpis[key].value > 0)
    || (input.topConvertingPages?.length ?? 0) > 0
    || aiTraffic.totalSessions > 0
    || (input.channelData?.length ?? 0) > 0
    || (input.countryData?.length ?? 0) > 0
    || (input.deviceData?.length ?? 0) > 0;

  return {
    meta: {
      source: 'ga4',
      status: resolveDataStatus({ hasData, issues }),
      configured: true,
      fromCache: input.fromCache === true,
      lastUpdatedAt: input.metricMetadata?.['ga4.sessions']?.updatedAt ?? null,
      issues,
    },
    data: {
      kpis,
      charts: Object.fromEntries(
        GA4_KPI_KEYS.map((key) => [key, input.charts?.[key] ?? []]),
      ),
      landingPages: input.topConvertingPages ?? [],
      aiTraffic,
      breakdowns: {
        channels: input.channelData ?? [],
        countries: input.countryData ?? [],
        devices: input.deviceData ?? [],
      },
      displayError: isTransientDataError(error) ? null : error,
    },
    metrics: selectMetricMetadata(input.metricMetadata, ['ga4.']),
  };
}
