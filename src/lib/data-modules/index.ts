import type { ProjectDashboardData } from '../dashboard-shared';
import type { ProjectIndexingStatus } from '../indexing-status';
import { createGoogleAdsDataModule } from './google-ads.ts';
import { createGa4DataModule } from './ga4.ts';
import { createGscDataModule } from './gsc.ts';
import { createIndexingDataModule } from './indexing.ts';
import { createLocalSeoDataModule } from './local-seo.ts';

export function createDashboardDataModules(
  data: ProjectDashboardData,
  indexingStatus?: ProjectIndexingStatus | null,
) {
  return {
    gsc: createGscDataModule(data),
    ga4: createGa4DataModule(data),
    googleAds: createGoogleAdsDataModule(data),
    localSeo: createLocalSeoDataModule(data),
    indexing: createIndexingDataModule(indexingStatus),
  } as const;
}

export type DashboardDataModules = ReturnType<typeof createDashboardDataModules>;

export * from './contracts.ts';
export * from './gsc.ts';
export * from './ga4.ts';
export * from './google-ads.ts';
export * from './local-seo.ts';
export * from './indexing.ts';
