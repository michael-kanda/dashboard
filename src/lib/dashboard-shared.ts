// src/lib/dashboard-shared.ts

import { DateRangeOption } from "@/components/DateRangeSelector";
import type {
  KpiDatum,
  ChartPoint,
  TopQueryData,
  ActiveKpi as BaseActiveKpi
} from '@/types/dashboard';

import type { AiTrafficData } from '@/types/ai-traffic';
import type { DailyWeather } from '@/lib/weather';
import type { QuestionType } from '@/lib/prompt-tracking/query-classifier';

export type { KpiDatum, ChartPoint, TopQueryData, AiTrafficData };

export type ActiveKpi =
  | BaseActiveKpi
  | 'conversions'
  | 'engagementRate'
  | 'bounceRate'
  | 'newUsers'
  | 'avgEngagementTime'
  | 'aiTraffic'
  | 'genAiImpressions'
  | 'paidSearch';

export const KPI_TAB_META: Record<string, { label: string; color: string }> = {
  clicks:            { label: 'Klicks',          color: '#3b82f6' },
  impressions:       { label: 'Impressionen',    color: '#8b5cf6' },
  sessions:          { label: 'Sitzungen',       color: '#10b981' },
  totalUsers:        { label: 'Nutzer',          color: '#f97316' },
  conversions:       { label: 'Conversions',     color: '#f59e0b' },
  engagementRate:    { label: 'Engagement Rate', color: '#ec4899' },
  bounceRate:        { label: 'Bounce Rate',     color: '#ef4444' },
  newUsers:          { label: 'Neue Nutzer',     color: '#06b6d4' },
  avgEngagementTime: { label: 'Ø Zeit',          color: '#6366f1' },
  genAiImpressions:  { label: 'Google GenAI',    color: '#4285f4' },
  paidSearch:        { label: 'Paid Search',     color: '#14b8a6' },
};

export interface ChartEntry {
  name: string; value: number; fill?: string;
  subValue?: string; subLabel?: string;
  subValue2?: number; subLabel2?: string;
  newUsers?: number;
}

export interface BingDataPoint { date: string; clicks: number; impressions: number; }

export interface ApiErrorStatus {
  gsc?: string; ga4?: string; semrush?: string; bing?: string; genAi?: string;
}

export interface LandingPageQueryData { query: string; clicks: number; impressions: number; }
export interface LandingPageQueries { [path: string]: LandingPageQueryData[]; }

export interface FollowUpPath { path: string; sessions: number; percentage: number; }
export interface LandingPageFollowUpData {
  landingPage: string; totalSessions: number; followUpPaths: FollowUpPath[];
}

export interface ConvertingPageData {
  path: string; conversions: number; conversionRate: number;
  engagementRate?: number; sessions?: number; newUsers?: number; ctr?: number;
}

export interface GoogleAdsRow {
  campaign: string; adGroup: string; adName: string; keyword: string;
  searchQuery: string; landingPage: string; cost: number; clicks: number;
  impressions: number; cpc: number; roas: number; conversions: number;
  sessions: number; engagedSessions: number;
}

export interface GoogleAdsData {
  rows: GoogleAdsRow[];
  landingPageRows: GoogleAdsRow[];
  totals: {
    cost: number; clicks: number; avgCpc: number; roas: number;
    conversions: number; sessions: number; engagedSessions: number;
    impressions?: number; interactionRate?: number;
  };
  conversionsByCampaign?: Record<string, number>;
  conversionsByAdGroup?: Record<string, number>;
  conversionsByQuery?: Record<string, number>;
  metricsByCampaign?: Record<string, { cost: number; clicks: number; sessions: number; engagedSessions: number }>;
  metricsByAdGroup?: Record<string, { cost: number; clicks: number; sessions: number; engagedSessions: number }>;
  campaignRows?: GoogleAdsRow[];
  adGroupRows?: GoogleAdsRow[];
  adRows?: GoogleAdsRow[];
  searchQueryRows?: GoogleAdsRow[];
  source?: 'ga4' | 'sheet';
}

export interface GoogleGenAiTrendPoint {
  date: number;
  impressions: number;
}

export interface GoogleGenAiBreakdownItem {
  key: string;
  impressions: number;
}

export interface GoogleGenAiPerformanceData {
  status: 'available' | 'unavailable' | 'api_unsupported';
  message: string;
  totalImpressions: number;
  impressionsChange?: number;
  trend: GoogleGenAiTrendPoint[];
  topPages: GoogleGenAiBreakdownItem[];
  countries: GoogleGenAiBreakdownItem[];
  devices: GoogleGenAiBreakdownItem[];
  detectedAppearances: string[];
  source: 'gsc-search-appearance' | 'gsc-report-rollout' | 'gsc-manual-export';
  dataVersion?: number;
  manualSource?: {
    importedAt?: string;
    dateRange?: string;
  };
}

// ── Prompt Tracking Types ─────────────────────────────────────────

export interface PromptQueryData {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  url: string;
  wordCount: number;
  isBranded: boolean;
  hasGeoReference: boolean;          // NEU v4
  questionType: QuestionType;        // NEU v4
}

export interface PromptTrackingTrendPoint {
  date: number; clicks: number; impressions: number;
}

export interface PromptTrackingShareBucket {
  bucket: string; label: string;
  totalImpressions: number; promptImpressions: number; sharePercent: number;
}

export interface PromptWordCountBucket {
  range: string; minWords: number; count: number; impressions: number;
}

export interface PromptTrackingPrevious {
  totalQueries: number; totalImpressions: number;
  totalClicks: number; sharePercent: number;
}

export type PromptTrackingSignal = 'strong' | 'weak' | 'insufficient';

export interface QuestionTypeDistribution {
  what: number; how: number; why: number; who: number;
  where: number; when: number; compare: number; price: number;
  recommendation: number; other: number;
}

export interface PromptTrackingResult {
  queries: PromptQueryData[];
  totals: {
    totalQueries: number;
    totalClicks: number;
    totalImpressions: number;
    avgCtr: number;
    avgPosition: number;
    brandedShare: number;
    nonBrandedShare: number;
    sharePercent: number;
    totalImpressionsAll: number;
    geoShare: number;                                // NEU v4
    brandedImpressionShare: number;
    nonBrandedImpressionShare: number;
    geoImpressionShare: number;
    questionTypeDistribution: QuestionTypeDistribution; // NEU v4
    dominantQuestionType: QuestionType;              // NEU v4
  };
  trend: PromptTrackingTrendPoint[];
  shareTrend: PromptTrackingShareBucket[];
  wordCountDistribution: PromptWordCountBucket[];
  previous?: PromptTrackingPrevious;
  minWords: number;
  brandKeywordsUsed?: string[] | null;
  brandKeywordsSource?: 'configured' | 'auto-detected' | 'domain-heuristic' | 'none';
}

export interface ProjectDashboardData {
  kpis?: {
    clicks?: KpiDatum;
    impressions?: KpiDatum;
    sessions?: KpiDatum;
    totalUsers?: KpiDatum;
    conversions?: KpiDatum;
    engagementRate?: KpiDatum;
    bounceRate?: KpiDatum;
    newUsers?: KpiDatum;
    avgEngagementTime?: KpiDatum;
    genAiImpressions?: KpiDatum;
    paidSearch?: KpiDatum;
  };
  charts?: {
    clicks?: ChartPoint[];
    impressions?: ChartPoint[];
    sessions?: ChartPoint[];
    totalUsers?: ChartPoint[];
    conversions?: ChartPoint[];
    engagementRate?: ChartPoint[];
    bounceRate?: ChartPoint[];
    newUsers?: ChartPoint[];
    avgEngagementTime?: ChartPoint[];
    aiTraffic?: ChartPoint[];
    genAiImpressions?: ChartPoint[];
    paidSearch?: ChartPoint[];
  };
  topQueries?: TopQueryData[];
  topConvertingPages?: ConvertingPageData[];
  aiTraffic?: AiTrafficData;
  bingData?: BingDataPoint[];
  landingPageQueries?: LandingPageQueries;
  weatherData?: Record<string, DailyWeather>;
  googleAdsData?: GoogleAdsData;
  googleGenAi?: GoogleGenAiPerformanceData;
  promptTracking?: PromptTrackingResult;
  localSeo?: LocalSeoData;
  countryData?: ChartEntry[];
  channelData?: ChartEntry[];
  deviceData?: ChartEntry[];
  apiErrors?: ApiErrorStatus;
  fromCache?: boolean;
}

export interface LocalSeoLocationConfig {
  id?: string;
  name: string;
  postalCode?: string;
  city?: string;
  country?: string;
  lat?: number | null;
  lng?: number | null;
  mapX?: number | null;
  mapY?: number | null;
  landingPages?: string[];
  keywords?: string[];
}

export interface LocalSeoLocationData extends LocalSeoLocationConfig {
  score: number;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number | null;
  sessions: number;
  newUsers: number;
  conversions: number;
  topQueries: TopQueryData[];
  topLandingPages: ConvertingPageData[];
}

export interface LocalSeoData {
  calculationVersion?: number;
  locations: LocalSeoLocationData[];
  totals: {
    clicks: number;
    impressions: number;
    sessions: number;
    newUsers?: number;
    conversions: number;
  };
}

export const ZERO_KPI: KpiDatum = { value: 0, change: 0 };

export function normalizeFlatKpis(input?: ProjectDashboardData['kpis']) {
  return {
    clicks:            input?.clicks            ?? ZERO_KPI,
    impressions:       input?.impressions       ?? ZERO_KPI,
    sessions:          input?.sessions          ?? ZERO_KPI,
    totalUsers:        input?.totalUsers        ?? ZERO_KPI,
    conversions:       input?.conversions       ?? ZERO_KPI,
    engagementRate:    input?.engagementRate    ?? ZERO_KPI,
    bounceRate:        input?.bounceRate        ?? ZERO_KPI,
    newUsers:          input?.newUsers          ?? ZERO_KPI,
    avgEngagementTime: input?.avgEngagementTime ?? ZERO_KPI,
    genAiImpressions:  input?.genAiImpressions  ?? ZERO_KPI,
    paidSearch:        input?.paidSearch        ?? ZERO_KPI,
  };
}

export function hasDashboardData(data: ProjectDashboardData): boolean {
  if (
    data.apiErrors?.gsc &&
    data.apiErrors?.ga4 &&
    (!data.bingData || data.bingData.length === 0)
  ) {
    return false;
  }
  const k = normalizeFlatKpis(data.kpis);
  if (
    k.clicks.value > 0 ||
    k.sessions.value > 0 ||
    (data.bingData && data.bingData.length > 0)
  ) {
    return true;
  }
  return false;
}

export function calculatePromptTrackingSignal(
  pt: PromptTrackingResult
): { signal: PromptTrackingSignal; reasons: string[] } {
  const reasons: string[] = [];
  const total = pt.totals.totalQueries;
  const share = pt.totals.sharePercent;

  if (total < 30) {
    reasons.push(`Nur ${total} prompt-artige Queries (< 30) – Aussagekraft begrenzt`);
    return { signal: 'insufficient', reasons };
  }

  let isRising = false;
  let isSignificantTrend = false;
  if (pt.previous && pt.previous.sharePercent > 0) {
    const prevShare = pt.previous.sharePercent;
    const change = share - prevShare;
    isRising = change > 0;
    isSignificantTrend = prevShare > 0 && Math.abs(change / prevShare) >= 0.2;
  }

  if (share >= 10 && total >= 50 && isRising && isSignificantTrend) {
    reasons.push(`Hoher Anteil (${share.toFixed(1)} %)`);
    reasons.push(`Viele Treffer (${total})`);
    reasons.push(`Anstieg vs. Vorperiode`);
    return { signal: 'strong', reasons };
  }

  if (share >= 15 && total >= 80) {
    reasons.push(`Sehr hoher Anteil (${share.toFixed(1)} %)`);
    reasons.push(`Viele Treffer (${total})`);
    return { signal: 'strong', reasons };
  }

  if (share < 3) {
    reasons.push(`Niedriger Anteil (${share.toFixed(1)} %)`);
  }
  if (pt.previous && !isRising) {
    reasons.push(`Anteil sinkt oder stagniert vs. Vorperiode`);
  }
  if (reasons.length === 0) {
    reasons.push(`Erkennbare Tendenz, aber kein klares Signal`);
  }

  return { signal: 'weak', reasons };
}
