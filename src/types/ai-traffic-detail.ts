export interface AiLandingPageData {
  path: string;
  sessions: number;
  users: number;
  avgEngagementTime: number;
  bounceRate: number;
  conversions: number;
  sources: Array<{
    source: string;
    sessions: number;
    users: number;
  }>;
}

export interface AiSourceData {
  source: string;
  sessions: number;
  users: number;
  percentage: number;
  conversions: number;
  conversionRate: number;
  topLandingPage?: { path: string; sessions: number; conversions: number };
  topPages: Array<{
    path: string;
    sessions: number;
    conversions?: number;
  }>;
}

export interface AiTrafficDetailData {
  totalSessions: number;
  totalUsers: number;
  totalSessionsChange?: number;
  totalUsersChange?: number;
  avgEngagementTime: number;
  bounceRate: number;
  conversions: number;
  sources: AiSourceData[];
  landingPages: AiLandingPageData[];
  trend: Array<{ date: string; sessions: number; users: number }>;
}
