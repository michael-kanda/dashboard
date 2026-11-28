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
import { describeMissingYoy } from '@/lib/comparison';

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

  // Vercel Web Analytics kennt weder Sitzungsqualität noch neue Besucher; diese
  // Kennzahlen entfallen statt als 0 zu erscheinen. Conversions nur mit Events.
  const analyticsSource = data.analyticsSource === 'vercel' ? 'vercel' as const : 'ga4' as const;
  const isVercel = analyticsSource === 'vercel';
  const ga4Only = <T,>(value: T) => (isVercel ? undefined : value);
  // Seitenaufrufe liegen außerhalb von data.kpis; Vercel liefert keine Vorjahreswerte.
  const pageviewsKpi = (): KpiDatum => {
    const kpi = safeKpi(data.vercelAnalytics?.pageviews);
    if (data.comparison?.mode !== 'vorjahr') return kpi;
    return {
      ...kpi,
      comparison: { mode: 'vorjahr', previous: null, change: null, note: describeMissingYoy('not_supported', 'web') },
    };
  };
  const extendedKpis = data.kpis ? {
    clicks: modules.gsc.data.kpis.clicks,
    impressions: modules.gsc.data.kpis.impressions,
    sessions: modules.ga4.data.kpis.sessions,
    totalUsers: modules.ga4.data.kpis.totalUsers,
    conversions: isVercel && !data.vercelAnalytics?.conversionsConfigured ? undefined : modules.ga4.data.kpis.conversions,
    engagementRate: ga4Only(modules.ga4.data.kpis.engagementRate),
    bounceRate: ga4Only(modules.ga4.data.kpis.bounceRate),
    newUsers: ga4Only(modules.ga4.data.kpis.newUsers),
    avgEngagementTime: ga4Only(modules.ga4.data.kpis.avgEngagementTime),
    pageviews: isVercel ? pageviewsKpi() : undefined,
    genAiImpressions: safeKpi(data.kpis.genAiImpressions),
  } : undefined;

  const aiTrafficTrend: ChartPoint[] = modules.ga4.data.aiTraffic.trend.map((item) => ({
    date: item.date,
    value: item.sessions,
  }));
  const allChartData: Record<ActiveKpi, ChartPoint[]> & { pageviews?: ChartPoint[] } = {
    pageviews: data.vercelAnalytics?.pageviewsDaily ?? [],
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
    paidSearch: modules.ga4.data.charts.paidSearch ?? [],
  };

  const exportKpis: DashboardExportKpi[] = extendedKpis ? ([
    { label: 'Impressionen', kpi: extendedKpis.impressions },
    { label: 'Klicks', kpi: extendedKpis.clicks },
    { label: isVercel ? 'Besucher' : 'Nutzer', kpi: extendedKpis.totalUsers },
    { label: 'Sitzungen', kpi: ga4Only(extendedKpis.sessions) },
    { label: 'Seitenaufrufe', kpi: extendedKpis.pageviews },
    { label: 'Engagement', kpi: extendedKpis.engagementRate, unit: '%', decimals: 1 },
    { label: 'Conversions', kpi: extendedKpis.conversions },
    { label: 'KI-Traffic', kpi: { value: modules.ga4.data.aiTraffic.totalUsers, change: modules.ga4.data.aiTraffic.totalUsersChange ?? 0 } },
    { label: 'Google GenAI', kpi: { value: data.googleGenAi?.totalImpressions ?? 0, change: data.googleGenAi?.impressionsChange ?? 0 } },
    { label: 'Ø Zeit', kpi: extendedKpis.avgEngagementTime },
  ] as Array<{ label: string; kpi?: KpiDatum; unit?: string; decimals?: number }>)
    .filter((row): row is { label: string; kpi: KpiDatum; unit?: string; decimals?: number } => Boolean(row.kpi))
    .map(({ label, kpi, unit, decimals }) => ({
      label,
      value: decimals !== undefined ? kpi.value.toFixed(decimals) : kpi.value.toLocaleString('de-DE'),
      change: kpi.change,
      ...(unit ? { unit } : {}),
    })) : [];

  return {
    modules,
    reportingPeriod: data.reportingPeriod ?? data.metricMetadata?.['ga4.sessions']?.period,
    comparison: data.comparison,
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
    analyticsSource,
    // Mit Vercel nur Kennzahlen mit echten Daten im Trend-Diagramm anbieten.
    trendKpis: isVercel
      ? ['impressions', 'clicks', 'totalUsers', 'pageviews', 'aiTraffic', 'genAiImpressions',
        ...(data.vercelAnalytics?.conversionsConfigured ? ['conversions'] : [])]
      : undefined,
  };
}

export type ProjectDashboardViewModel = ReturnType<typeof buildDashboardViewModel>;
