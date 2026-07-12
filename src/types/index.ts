// src/types/index.ts

export interface User {
  id: string;
  email: string;
  password?: string;
  role: 'SUPERADMIN' | 'ADMIN' | 'BENUTZER';
  mandant_id?: string | null;
  ansprache?: string | null;
  permissions?: string[];
  domain?: string;
  gsc_site_url?: string;
  ga4_property_id?: string;
  semrush_project_id?: string | null;
  semrush_tracking_id?: string | null;
  semrush_tracking_id_02?: string | null;
  google_ads_sheet_id?: string | null;
  
  // Admin & Ersteller
  createdByAdminId?: string;
  creator_email?: string;
  assigned_admins?: string; // Für BENUTZER: Wer betreut mich?
  assigned_projects?: string; // ✅ NEU: Für ADMINS: Welche Projekte betreue ich?
  
  createdAt: Date;
  semrush_organic_keywords?: number;
  semrush_organic_traffic?: number;
  semrush_last_fetched?: string;
  favicon_url?: string;
  project_start_date?: Date | null;
  project_duration_months?: number | null;
  project_timeline_active?: boolean | null;
  maintenance_mode?: boolean; 
  brand_keywords?: string[] | null;
  dashboard_info_text?: string | null;
  settings_show_prompt_tracking?: boolean | null;
  project_locations?: ProjectLocation[] | null;

  // Landingpage Statistiken
  landingpages_count?: number;
  landingpages_offen?: number;
  landingpages_in_pruefung?: number;
  landingpages_freigegeben?: number;
  landingpages_gesperrt?: number;

  // Aggregierte Reichweiten-Änderung (Summe GSC Impression Change)
  total_impression_change?: number;
}

export interface ProjectLocation {
  id?: string;
  name: string;
  postalCode?: string;
  city?: string;
  country?: string;
  lat?: number | null;
  lng?: number | null;
  mapX?: number | null;
  mapY?: number | null;
  googlePlaceId?: string | null;
  googleBusinessProfileUrl?: string | null;
  googleBusinessProfileImageUrl?: string | null;
  landingPages?: string[];
  keywords?: string[];
}

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
