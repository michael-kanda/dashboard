import type {
  LocalSeoData,
  LocalSeoLocationData,
  ProjectDashboardData,
} from '../dashboard-shared';
import {
  finiteNumber,
  resolveDataStatus,
  type DataModuleResult,
} from './contracts.ts';

export interface LocalSeoDashboardData {
  report: LocalSeoData | null;
  locations: LocalSeoLocationData[];
  hasLocations: boolean;
  allocation: {
    ga4: 'landing-pages-or-city';
    gsc: 'landing-pages-and-keyword-aliases';
  };
}

function normalizeLocation(location: LocalSeoLocationData): LocalSeoLocationData {
  return {
    ...location,
    score: finiteNumber(location.score),
    clicks: finiteNumber(location.clicks),
    impressions: finiteNumber(location.impressions),
    ctr: finiteNumber(location.ctr),
    position: location.position === null ? null : finiteNumber(location.position),
    sessions: finiteNumber(location.sessions),
    newUsers: finiteNumber(location.newUsers),
    conversions: finiteNumber(location.conversions),
    topQueries: location.topQueries ?? [],
    topLandingPages: location.topLandingPages ?? [],
  };
}

export function createLocalSeoDataModule(
  input: ProjectDashboardData,
): DataModuleResult<LocalSeoDashboardData> {
  const report = input.localSeo ?? null;
  const locations = (report?.locations ?? []).map(normalizeLocation);
  const hasLocations = locations.length > 0;
  const normalizedReport = report ? { ...report, locations } : null;

  return {
    meta: {
      source: 'local-seo',
      status: resolveDataStatus({ configured: hasLocations, hasData: hasLocations, issues: [] }),
      configured: hasLocations,
      fromCache: input.fromCache === true,
      lastUpdatedAt: null,
      issues: [],
    },
    data: {
      report: normalizedReport,
      locations,
      hasLocations,
      allocation: {
        ga4: 'landing-pages-or-city',
        gsc: 'landing-pages-and-keyword-aliases',
      },
    },
  };
}
