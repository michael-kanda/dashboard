import type {
  DashboardWidgetKey,
  DashboardWidgetVisibility,
} from '../../lib/dashboard-widget-visibility';

interface DashboardRenderPolicyInput {
  userRole: string;
  visibility: DashboardWidgetVisibility;
  hasGoogleAds: boolean;
  hasLocalSeo: boolean;
  hasIndexingStatus: boolean;
  hasPromptTracking: boolean;
  semrushTrackingId?: string | null;
  semrushTrackingId02?: string | null;
}

export function buildDashboardRenderPolicy({
  userRole,
  visibility,
  hasGoogleAds,
  hasLocalSeo,
  hasIndexingStatus,
  hasPromptTracking,
  semrushTrackingId,
  semrushTrackingId02,
}: DashboardRenderPolicyInput) {
  const isAdmin = userRole === 'ADMIN' || userRole === 'SUPERADMIN';
  const canShow = (key: DashboardWidgetKey) => isAdmin || visibility[key];
  const semrushPrimary = Boolean(semrushTrackingId) && canShow('semrushPrimary');
  const semrushSecondary = Boolean(semrushTrackingId02) && canShow('semrushSecondary');
  const trafficBreakdowns = {
    channels: canShow('channelTraffic'),
    countries: canShow('countryTraffic'),
    devices: canShow('deviceTraffic'),
  };

  return {
    isAdmin,
    canShow,
    render: {
      topQueries: canShow('topQueries'),
      landingPages: canShow('landingPages'),
      googleAds: hasGoogleAds && canShow('googleAds'),
      localSeo: hasLocalSeo && canShow('localSeo'),
      indexing: hasIndexingStatus && canShow('indexingStatus'),
      promptTracking: hasPromptTracking
        && canShow('aiTraffic')
        && canShow('promptTracking'),
      semrushPrimary,
      semrushSecondary,
      semrush: semrushPrimary || semrushSecondary,
      trafficBreakdowns,
      trafficBreakdownCount: Object.values(trafficBreakdowns).filter(Boolean).length,
    },
  };
}
