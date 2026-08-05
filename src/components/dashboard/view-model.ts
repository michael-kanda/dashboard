import type {
  ActiveKpi,
  ChartPoint,
  KpiDatum,
  ProjectDashboardData,
} from '@/lib/dashboard-shared';
import type { ProjectIndexingStatus } from '@/lib/indexing-status';
import {
  normalizeDashboardWidgetVisibility,
  type DashboardWidgetVisibility,
} from '@/lib/dashboard-widget-visibility';
import { createDashboardDataModules } from '@/lib/data-modules';
import { aggregateLandingPages } from '@/lib/utils';
import { buildDashboardRenderPolicy } from './render-policy';

export interface DashboardExportKpi {
  label: string;
  value: string;
  change: number;
  unit?: string;
}

interface BuildDashboardViewModelInput {
  data: ProjectDashboardData;
  indexingStatus?: ProjectIndexingStatus;
  userRole: string;
  showLandingPages: boolean;
  showGoogleAds: boolean;
  showPromptTracking: boolean;
  widgetVisibility?: Partial<DashboardWidgetVisibility> | null;
  semrushTrackingId?: string | null;
  semrushTrackingId02?: string | null;
}

function safeKpi(kpi?: KpiDatum): KpiDatum {
  return kpi ?? { value: 0, change: 0 };
}

export function buildDashboardViewModel({
  data,
  indexingStatus,
  userRole,
  showLandingPages,
  showGoogleAds,
  showPromptTracking,
  widgetVisibility,
  semrushTrackingId,
  semrushTrackingId02,
}: BuildDashboardViewModelInput) {
  const modules = createDashboardDataModules(data, indexingStatus);
  const visibility = normalizeDashboardWidgetVisibility(widgetVisibility, {
    landingPages: showLandingPages,
    googleAds: showGoogleAds,
    promptTracking: showPromptTracking,
  });
  const policy = buildDashboardRenderPolicy({
    userRole,
    visibility,
    hasGoogleAds: modules.googleAds.data.hasRenderableData,
    hasLocalSeo: modules.localSeo.data.hasLocations,
    hasIndexingStatus: Boolean(modules.indexing.data.report),
    hasPromptTracking: Boolean(data.promptTracking),
    semrushTrackingId,
    semrushTrackingId02,
  });

  const extendedKpis = data.kpis ? {
    clicks: modules.gsc.data.kpis.clicks,
    impressions: modules.gsc.data.kpis.impressions,
    sessions: modules.ga4.data.kpis.sessions,
    totalUsers: modules.ga4.data.kpis.totalUsers,
    conversions: modules.ga4.data.kpis.conversions,
    engagementRate: modules.ga4.data.kpis.engagementRate,
    bounceRate: modules.ga4.data.kpis.bounceRate,
    newUsers: modules.ga4.data.kpis.newUsers,
    avgEngagementTime: modules.ga4.data.kpis.avgEngagementTime,
    genAiImpressions: safeKpi(data.kpis.genAiImpressions),
  } : undefined;

  const aiTrafficTrend: ChartPoint[] = modules.ga4.data.aiTraffic.trend.map((item) => ({
    date: item.date,
    value: item.sessions,
  }));
  const allChartData: Record<ActiveKpi, ChartPoint[]> = {
    clicks: data.charts?.clicks ?? [],
    impressions: data.charts?.impressions ?? [],
    sessions: data.charts?.sessions ?? [],
    totalUsers: data.charts?.totalUsers ?? [],
    conversions: data.charts?.conversions ?? [],
    engagementRate: data.charts?.engagementRate ?? [],
    bounceRate: data.charts?.bounceRate ?? [],
    newUsers: data.charts?.newUsers ?? [],
    avgEngagementTime: data.charts?.avgEngagementTime ?? [],
    genAiImpressions: (data.googleGenAi?.trend ?? []).map((item) => ({
      date: item.date,
      value: item.impressions,
    })),
    aiTraffic: aiTrafficTrend,
    paidSearch: data.charts?.paidSearch ?? [],
  };

  const exportKpis: DashboardExportKpi[] = extendedKpis ? [
    { label: 'Impressionen', value: extendedKpis.impressions.value.toLocaleString('de-DE'), change: extendedKpis.impressions.change },
    { label: 'Klicks', value: extendedKpis.clicks.value.toLocaleString('de-DE'), change: extendedKpis.clicks.change },
    { label: 'Nutzer', value: extendedKpis.totalUsers.value.toLocaleString('de-DE'), change: extendedKpis.totalUsers.change },
    { label: 'Sitzungen', value: extendedKpis.sessions.value.toLocaleString('de-DE'), change: extendedKpis.sessions.change },
    { label: 'Engagement', value: extendedKpis.engagementRate.value.toFixed(1), change: extendedKpis.engagementRate.change, unit: '%' },
    { label: 'Conversions', value: extendedKpis.conversions.value.toLocaleString('de-DE'), change: extendedKpis.conversions.change },
    { label: 'KI-Traffic', value: modules.ga4.data.aiTraffic.totalUsers.toLocaleString('de-DE'), change: modules.ga4.data.aiTraffic.totalUsersChange ?? 0 },
    { label: 'Google GenAI', value: (data.googleGenAi?.totalImpressions ?? 0).toLocaleString('de-DE'), change: data.googleGenAi?.impressionsChange ?? 0 },
    { label: 'Ø Zeit', value: extendedKpis.avgEngagementTime.value.toLocaleString('de-DE'), change: extendedKpis.avgEngagementTime.change },
  ] : [];

  return {
    modules,
    isAdmin: policy.isAdmin,
    visibility,
    canShow: policy.canShow,
    extendedKpis,
    allChartData,
    aiTrafficTrend,
    exportKpis,
    cleanLandingPages: aggregateLandingPages(modules.ga4.data.landingPages),
    errors: {
      ...data.apiErrors,
      ga4: modules.ga4.data.displayError ?? undefined,
      gsc: modules.gsc.data.displayError ?? undefined,
    },
    render: policy.render,
    hasAiTraffic: modules.ga4.data.aiTraffic.totalSessions > 0,
  };
}

export type ProjectDashboardViewModel = ReturnType<typeof buildDashboardViewModel>;
