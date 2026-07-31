// src/types/index.ts

import type { User as SchemaUser } from '@/lib/schemas';

export type User = SchemaUser;
export type ProjectLocation = NonNullable<SchemaUser['project_locations']>[number];

// Rest bleibt gleich...
export interface Landingpage {
  id: number;
  url: string;
  status: 'Offen' | 'In Prüfung' | 'Gesperrt' | 'Freigegeben';
  haupt_keyword?: string;
  weitere_keywords?: string;
  comment?: string | null;
  gsc_klicks: number | null;
  gsc_klicks_change: number | null;
  gsc_impressionen: number | null;
  gsc_impressionen_change: number | null;
  gsc_position: number | string | null; 
  gsc_position_change: number | string | null; 
  gsc_last_updated: string | null;
  gsc_last_range: string | null;
  created_at: string; 
  updated_at?: string; 
}

export type LandingpageStatus = Landingpage['status'];

export type {
  KPI, KpiDatum, ChartPoint, ChartData, TopQueryData, ActiveKpi, KpiMetadata
} from './dashboard';

export type {
  AiTrafficData, AiTrafficCardProps
} from './ai-traffic';
