// src/lib/ai-traffic-v2/types.ts
// Typen der erweiterten KI-Traffic-Analyse (V2)

// ============================================================================
// TYPEN
// ============================================================================

export interface IntentCategory {
  key: string;
  label: string;
  icon: string; // Lucide Icon Name (z.B. 'book-open', 'shopping-cart')
  color: string;
  patterns: RegExp[];
}

export interface PageIntent {
  path: string;
  intent: IntentCategory;
  sessions: number;
  users: number;
  conversions: number;
  avgEngagementTime: number;
  engagementRate: number;
}

export interface UserJourneyStep {
  step: number;
  pagePath: string;
  sessions: number;
  dropoffRate: number;
}

export interface UserJourneyData {
  landingPage: string;
  totalSessions: number;
  avgPagesPerSession: number;
  avgSessionDuration: number;
  conversionRate: number;
  engagementRate: number;
  nextPages: Array<{
    path: string;
    sessions: number;
    percentage: number;
  }>;
  exitPages: Array<{
    path: string;
    sessions: number;
    percentage: number;
  }>;
  journeySteps: UserJourneyStep[];
}

export interface AiTrafficExtendedData {
  // Basis-Daten
  totalSessions: number;
  totalUsers: number;
  totalSessionsChange?: number;
  totalUsersChange?: number;
  avgEngagementTime: number;
  bounceRate: number;
  engagementRate: number; // Globale Interaktionsrate
  conversions: number;
  
  // Intent-Analyse
  intentBreakdown: Array<{
    intent: IntentCategory;
    sessions: number;
    users: number;
    conversions: number;
    conversionRate: number;
    avgEngagementTime: number;
    engagementRate: number;
    percentage: number;
    topPages: Array<{
      path: string;
      sessions: number;
    }>;
  }>;
  
  // User-Journey Daten
  userJourney: {
    avgPagesPerSession: number;
    avgSessionDuration: number;
    avgEngagementRate: number;
    topJourneys: UserJourneyData[];
    interactionEvents: Array<{
      eventName: string;
      count: number;
      percentage: number;
    }>;
    scrollDepth: {
      reached25: number;
      reached50: number;
      reached75: number;
      reached100: number;
    };
  };
  
  // Quellen-Daten
  sources: Array<{
    source: string;
    sessions: number;
    users: number;
    engagementRate: number;
    percentage: number;
    conversions: number;
    conversionRate: number; // in % (conversions / sessions * 100)
    topPages: Array<{ path: string; sessions: number; conversions: number }>;
    topLandingPage?: { path: string; sessions: number; conversions: number };
  }>;
  
  // Landingpages
  landingPages: Array<{
    path: string;
    intent: IntentCategory;
    sessions: number;
    users: number;
    avgEngagementTime: number;
    bounceRate: number;
    engagementRate: number;
    conversions: number;
    sources: Array<{ source: string; sessions: number; users: number }>;
  }>;
  
  trend: Array<{ date: string; sessions: number; users: number }>;

  // Trend pro KI-Quelle (long format) — für Multi-Line-Chart im Frontend
  trendBySource: Array<{ date: string; source: string; sessions: number; users: number }>;
}
