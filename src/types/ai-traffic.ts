// src/types/ai-traffic.ts

import type { ChartPoint } from './dashboard';

export interface AiTrafficData {
  totalSessions: number;
  totalUsers: number;

  totalSessionsChange?: number; 
  totalUsersChange?: number;
  
  sessionsBySource: {
    [key: string]: number;
  };
  topAiSources: Array<{
    source: string;
    sessions: number;
    users: number;
    percentage: number;
  }>;
  trend: Array<{
    date: number; // ✅ Timestamp (number) für Recharts
    sessions: number;
  }>;
}

// Props für AiTrafficCard Komponente
export interface AiTrafficCardProps {
  totalSessions: number;
  totalUsers: number;
  percentage: number;
  totalSessionsChange?: number;
  totalUsersChange?: number;
  trend: ChartPoint[];
  topAiSources: Array<{
    source: string;
    sessions: number;
    users: number;
    percentage: number;
  }>;
  className?: string;
  isLoading?: boolean;
  dateRange?: string;
  error?: string;
  onDetailClick?: () => void;
  onPromptTrackingClick?: () => void;
}
