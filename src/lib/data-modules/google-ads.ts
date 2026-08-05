import type { GoogleAdsData, ProjectDashboardData } from '../dashboard-shared';
import {
  createDataIssue,
  resolveDataStatus,
  type DataModuleResult,
} from './contracts.ts';

export interface GoogleAdsDashboardData {
  report: GoogleAdsData | null;
  source: 'ga4' | 'sheet' | null;
  configuredSheetId: string | null;
  hasRows: boolean;
  hasRenderableData: boolean;
}

export function hasGoogleAdsRows(data?: GoogleAdsData | null) {
  if (!data) return false;
  return data.rows.length > 0
    || (data.campaignRows?.length ?? 0) > 0;
}

export function createGoogleAdsDataModule(
  input: ProjectDashboardData,
): DataModuleResult<GoogleAdsDashboardData> {
  const report = input.googleAdsData ?? null;
  const error = input.apiErrors?.googleAds ?? null;
  const issues = createDataIssue('google_ads_request_failed', error);
  const configured = Boolean(report?.configuredSheetId || report);
  const hasRows = hasGoogleAdsRows(report);
  const hasRenderableData = hasRows || report?.source === 'sheet';

  return {
    meta: {
      source: 'google-ads',
      status: resolveDataStatus({ configured, hasData: hasRows, issues }),
      configured,
      fromCache: input.fromCache === true,
      lastUpdatedAt: null,
      issues,
    },
    data: {
      report,
      source: report?.source ?? null,
      configuredSheetId: report?.configuredSheetId ?? null,
      hasRows,
      hasRenderableData,
    },
  };
}
