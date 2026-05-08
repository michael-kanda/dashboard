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

export type ActiveKpi =
  | BaseActiveKpi
  | 'conversions'
  | 'engagementRate'
  | 'bounceRate'
  | 'newUsers'
  | 'avgEngagementTime'
  | 'aiTraffic'
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
  paidSearch:        { label: 'Paid Search',     color: '#14b8a6' },
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

// ── Landing Page Query Interfaces ──────────────────────────────────
export interface LandingPageQueryData {
  query: string;
  clicks: number;
  impressions: number;
}

export interface LandingPageQueries {
  [path: string]: LandingPageQueryData[];
}

// ── Folgepfade Interfaces ─────────────────────────────────────────
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

// ── Google Ads Types ──────────────────────────────────────────────
export interface GoogleAdsRow {
  campaign: string;
  adGroup: string;
  adName: string;
  keyword: string;
  searchQuery: string;
  landingPage: string;
  cost: number;
  clicks: number;
  impressions: number;
  cpc: number;
  roas: number;
  conversions: number;
  sessions: number;
  engagedSessions: number;
}

export interface GoogleAdsData {
  rows: GoogleAdsRow[];
  landingPageRows: GoogleAdsRow[];
  totals: {
    cost: number;
    clicks: number;
    avgCpc: number;
    roas: number;
    conversions: number;
    sessions: number;
    engagedSessions: number;
    impressions?: number;
    interactionRate?: number;
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

// ── Prompt Tracking Types ─────────────────────────────────────────
// Methodik nach Seybold (2026):
// https://seybold.de/prompt-tracking-in-google-search-console/

export interface PromptQueryData {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  url: string;
  wordCount: number;
  isBranded: boolean;
}

export interface PromptTrackingTrendPoint {
  date: number; // Timestamp
  clicks: number;
  impressions: number;
}

/**
 * Aggregierter Trend des prompt-Anteils über die Zeit
 * (z.B. wochen- oder monatsweise – je nach Date Range)
 */
export interface PromptTrackingShareBucket {
  /** ISO-Date des Bucket-Starts (z.B. '2026-01' bei monatlicher Aggregation) */
  bucket: string;
  /** Lesbares Label (z.B. 'Jan 2026' oder 'KW 03') */
  label: string;
  /** Impressionen aller Queries in diesem Bucket */
  totalImpressions: number;
  /** Impressionen nur prompt-artiger Queries */
  promptImpressions: number;
  /** Anteil in Prozent (0–100) */
  sharePercent: number;
}

/** Wortzahl-Distribution für Histogramm */
export interface PromptWordCountBucket {
  /** Wortzahl-Range, z.B. '10-12' oder '20+' */
  range: string;
  /** Min-Wortzahl der Range (für Sortierung) */
  minWords: number;
  /** Anzahl Queries in dieser Range */
  count: number;
  /** Impressionen-Summe in dieser Range */
  impressions: number;
}

/** Vergleichsdaten Vorperiode */
export interface PromptTrackingPrevious {
  totalQueries: number;
  totalImpressions: number;
  totalClicks: number;
  sharePercent: number;
}

/** Confidence-Bewertung für die UI */
export type PromptTrackingSignal = 'strong' | 'weak' | 'insufficient';

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
    /** Anteil der prompt-Impressionen an allen GSC-Impressionen (%) */
    sharePercent: number;
    /** Gesamtimpressionen ALLER Queries im Zeitraum (für Anteils-Kalkulation) */
    totalImpressionsAll: number;
  };

  /** Tagestrend aller Prompt-Queries (existing) */
  trend: PromptTrackingTrendPoint[];

  /** Aggregierter Anteils-Trend über Wochen oder Monate */
  shareTrend: PromptTrackingShareBucket[];

  /** Wortzahl-Verteilung */
  wordCountDistribution: PromptWordCountBucket[];

  /** Vergleichswerte zur Vorperiode (gleichlanger Zeitraum davor) */
  previous?: PromptTrackingPrevious;

  /** Mindestwortzahl, die gefiltert wurde */
  minWords: number;

  /** Tatsächlich verwendete Brand-Keywords (für UI-Anzeige) */
  brandKeywordsUsed?: string[];
}

// ── Hauptinterface: Dashboard Data ────────────────────────────────
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
  promptTracking?: PromptTrackingResult;
  countryData?: ChartEntry[];
  channelData?: ChartEntry[];
  deviceData?: ChartEntry[];
  apiErrors?: ApiErrorStatus;
  fromCache?: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────
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

// ──────────────────────────────────────────────────────────────────
// Confidence-Signal-Berechnung (clientseitig)
//
// Schwellen bewusst konservativ – wir wollen nicht zu schnell
// "starkes Signal" anzeigen, weil das die Glaubwürdigkeit kostet.
// ──────────────────────────────────────────────────────────────────
export function calculatePromptTrackingSignal(
  pt: PromptTrackingResult
): { signal: PromptTrackingSignal; reasons: string[] } {
  const reasons: string[] = [];
  const total = pt.totals.totalQueries;
  const share = pt.totals.sharePercent;

  // Insufficient data – brauchen Mindestmenge
  if (total < 30) {
    reasons.push(`Nur ${total} prompt-artige Queries (< 30) – Aussagekraft begrenzt`);
    return { signal: 'insufficient', reasons };
  }

  // Trend-Vergleich (falls Vorperiode verfügbar)
  let isRising = false;
  let isSignificantTrend = false;
  if (pt.previous && pt.previous.sharePercent > 0) {
    const prevShare = pt.previous.sharePercent;
    const change = share - prevShare;
    isRising = change > 0;
    // Anstieg um relativ ≥ 20%
    isSignificantTrend = prevShare > 0 && Math.abs(change / prevShare) >= 0.2;
  }

  // Strong Signal: hoher Anteil + viele absolute + steigender Trend
  if (share >= 10 && total >= 50 && isRising && isSignificantTrend) {
    reasons.push(`Hoher Anteil (${share.toFixed(1)} %)`);
    reasons.push(`Viele Treffer (${total})`);
    reasons.push(`Anstieg vs. Vorperiode`);
    return { signal: 'strong', reasons };
  }

  // Strong Signal alternative: sehr hoher Anteil ohne Trend-Vergleich
  if (share >= 15 && total >= 80) {
    reasons.push(`Sehr hoher Anteil (${share.toFixed(1)} %)`);
    reasons.push(`Viele Treffer (${total})`);
    return { signal: 'strong', reasons };
  }

  // Weak Signal
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
