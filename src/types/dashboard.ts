// src/types/dashboard.ts

// Basis KPI-Typ ohne aiTraffic
export type KPI = {
  value: number;
  change: number;
};

// Spezielle Version mit aiTraffic (wird in dashboard-shared verwendet)
export type KpiDatum = KPI & {
  aiTraffic?: {
    value: number;
    percentage: number;
  };
};

// ChartPoint als eigenen Typ exportieren
export type ChartPoint = {
  date: number; // ✅ Timestamp (number) für Recharts
  value: number;
};

// ChartData verwendet jetzt ChartPoint
export type ChartData = ChartPoint[];

export type TopQueryData = {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  url?: string;
  landingPageConversions?: number;
};

export type ActiveKpi = 'clicks' | 'impressions' | 'sessions' | 'totalUsers' | 'conversions' | 'engagementRate';

export type KpiMetadata = {
  title: string;
  color: string;
};

// ✅ HIER GEÄNDERT: "Interaktionsrate" statt "Engagement Rate"
export const KPI_TAB_META: Record<ActiveKpi, KpiMetadata> = {
  clicks: { title: 'Klicks', color: '#3b82f6' },
  impressions: { title: 'Impressionen', color: '#8b5cf6' },
  sessions: { title: 'Sitzungen', color: '#10b981' },
  totalUsers: { title: 'Nutzer', color: '#f59e0b' },
  conversions: { title: 'Conversions', color: '#f59e0b' },
  engagementRate: { title: 'Interaktionsrate', color: '#ec4899' }, 
};
