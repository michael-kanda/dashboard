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

// Re-exportiere die Basis-Typen
export type { KpiDatum, ChartPoint, TopQueryData, AiTrafficData };

export type ActiveKpi = BaseActiveKpi | 'conversions' | 'engagementRate' | 'bounceRate' | 'newUsers' | 'avgEngagementTime' | 'aiTraffic' | 'paidSearch';

// Metadaten für KPI Tabs (Farben & Labels)
export const KPI_TAB_META: Record<string, { label: string; color: string }> = {
  clicks: { label: 'Klicks', color: '#3b82f6' },          
  impressions: { label: 'Impressionen', color: '#8b5cf6' }, 
  sessions: { label: 'Sitzungen', color: '#10b981' },      
  totalUsers: { label: 'Nutzer', color: '#f97316' },       
  conversions: { label: 'Conversions', color: '#f59e0b' }, 
  engagementRate: { label: 'Engagement Rate', color: '#ec4899' }, 
  bounceRate: { label: 'Bounce Rate', color: '#ef4444' },  
  newUsers: { label: 'Neue Nutzer', color: '#06b6d4' },    
  avgEngagementTime: { label: 'Ø Zeit', color: '#6366f1' },
  paidSearch: { label: 'Paid Search', color: '#14b8a6' },
};

export interface ChartEntry {
  name: string;
  value: number;
  fill?: string;
  subValue?: string;
  subLabel?: string;
  subValue2?: number;
  subLabel2?: string;
}

// Bing Datenstruktur
export interface BingDataPoint {
  date: string;
  clicks: number;
  impressions: number;
}

export interface ApiErrorStatus {
  gsc?: string;
  ga4?: string;
  semrush?: string;
  bing?: string;
}

// Landing Page Query Interfaces
export interface LandingPageQueryData {
  query: string;
  clicks: number;
  impressions: number;
}

export interface LandingPageQueries {
  [path: string]: LandingPageQueryData[];
}

// Folgepfade Interfaces
export interface FollowUpPath {
  path: string;
  sessions: number;
  percentage: number;
}

export interface LandingPageFollowUpData {
  landingPage: string;
  totalSessions: number;
  followUpPaths: FollowUpPath[];
}

export interface ConvertingPageData {
  path: string;
  conversions: number;
  conversionRate: number; 
  engagementRate?: number;
  sessions?: number; 
  newUsers?: number;
  ctr?: number;
}

// ── Google Ads Types ──

export interface GoogleAdsRow {
  campaign: string;
  adGroup: string;
  keyword: string;
  searchQuery: string;
  landingPage: string;
  cost: number;
  clicks: number;
  cpc: number;
  roas: number;
  conversions: number;
  sessions: number;
  engagedSessions: number;
}

export interface GoogleAdsData {
  /** Kampagne + Anzeigengruppe + Suchanfrage (GA4 Call 1) */
  rows: GoogleAdsRow[];
  /** Landingpages pro Kampagne (GA4 Call 2) */
  landingPageRows: GoogleAdsRow[];
  totals: {
    cost: number;
    clicks: number;
    avgCpc: number;
    roas: number;
    conversions: number;
    sessions: number;
    engagedSessions: number;
  };
  /** Echte Conversions pro Kampagne (1-Dimension-Call, kein Thresholding) */
  conversionsByCampaign?: Record<string, number>;
  /** Echte Conversions pro Anzeigengruppe (1-Dimension-Call, kein Thresholding) */
  conversionsByAdGroup?: Record<string, number>;
  /** Echte Conversions pro Suchanfrage */
  conversionsByQuery?: Record<string, number>;
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
    paidSearch?: ChartPoint[];
  };
  topQueries?: TopQueryData[];
  topConvertingPages?: ConvertingPageData[];
  aiTraffic?: AiTrafficData;
  bingData?: BingDataPoint[];
  landingPageQueries?: LandingPageQueries;
  weatherData?: Record<string, DailyWeather>;
  googleAdsData?: GoogleAdsData;
  countryData?: ChartEntry[];
  channelData?: ChartEntry[];
  deviceData?: ChartEntry[];
  apiErrors?: ApiErrorStatus;
  fromCache?: boolean;
}

export const ZERO_KPI: KpiDatum = { value: 0, change: 0 };

export function normalizeFlatKpis(input?: ProjectDashboardData['kpis']) {
  return {
    clicks: input?.clicks ?? ZERO_KPI,
    impressions: input?.impressions ?? ZERO_KPI,
    sessions: input?.sessions ?? ZERO_KPI,
    totalUsers: input?.totalUsers ?? ZERO_KPI,
    conversions: input?.conversions ?? ZERO_KPI,
    engagementRate: input?.engagementRate ?? ZERO_KPI,
    bounceRate: input?.bounceRate ?? ZERO_KPI,
    newUsers: input?.newUsers ?? ZERO_KPI,
    avgEngagementTime: input?.avgEngagementTime ?? ZERO_KPI,
    paidSearch: input?.paidSearch ?? ZERO_KPI,
  };
}

export function hasDashboardData(data: ProjectDashboardData): boolean {
  if (data.apiErrors?.gsc && data.apiErrors?.ga4 && (!data.bingData || data.bingData.length === 0)) return false;
  
  const k = normalizeFlatKpis(data.kpis);
  
  if (k.clicks.value > 0 || k.sessions.value > 0 || (data.bingData && data.bingData.length > 0)) return true;
  
  return false;
}
