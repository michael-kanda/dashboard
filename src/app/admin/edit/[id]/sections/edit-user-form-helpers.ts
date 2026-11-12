// src/app/admin/edit/[id]/sections/edit-user-form-helpers.ts
// Reine Hilfsfunktionen und Typen für EditUserForm und seine Sektionen.

import type { ChangeEvent } from 'react';
import type { ProjectLocation } from '@/types';
import type { DashboardWidgetVisibility } from '@/lib/dashboard-widget-visibility';

// Form-State von EditUserForm (entspricht dem Initialwert von useState dort).
export interface EditUserFormData {
  email: string;
  mandantId: string;
  ansprache: string;
  permissions: string;
  domain: string;
  gscSiteUrl: string;
  sitemapUrl: string;
  ga4PropertyId: string;
  semrushProjectId: string;
  semrushTrackingId: string;
  semrushTrackingId02: string;
  googleAdsSheetId: string;
  favicon_url: string;
  project_start_date: string;
  project_duration_months: string;
  project_timeline_active: boolean;
  settings_show_landingpages: boolean;
  settings_show_google_ads: boolean;
  settings_show_prompt_tracking: boolean;
  maintenance_mode: boolean;
}

export type InputChangeHandler = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;

export const formatDateForInput = (date: Date | string | null | undefined): string => {
  if (!date) return '';
  try {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch {
    return '';
  }
};

export interface ApiPayload {
  email: string;
  mandant_id: string | null;
  ansprache: string | null;
  permissions?: string[] | null;
  domain: string | null;
  gsc_site_url: string | null;
  sitemap_url: string | null;
  ga4_property_id: string | null;
  favicon_url: string | null;
  semrush_project_id: string | null;
  semrush_tracking_id: string | null;
  semrush_tracking_id_02: string | null;
  google_ads_sheet_id: string | null;
  project_start_date: string | null;
  project_duration_months: number | null;
  project_timeline_active: boolean;
  settings_show_landingpages: boolean;
  settings_show_google_ads: boolean;
  settings_show_prompt_tracking: boolean;
  dashboard_widget_visibility: DashboardWidgetVisibility;
  project_locations: ProjectLocation[];
  maintenance_mode: boolean; // NEU
  password?: string;
}

export const createEmptyLocation = (): ProjectLocation => ({
  id: `location-${Date.now()}`,
  name: '',
  postalCode: '',
  city: '',
  country: 'AT',
  lat: null,
  lng: null,
  mapX: null,
  mapY: null,
  googlePlaceId: null,
  googleBusinessProfileUrl: null,
  googleBusinessProfileImageUrl: null,
  landingPages: [],
  keywords: [],
});

export function normalizeLocations(locations?: ProjectLocation[] | null): ProjectLocation[] {
  if (!Array.isArray(locations)) return [];
  return locations.map((location, index) => ({
    id: location.id || `location-${index + 1}`,
    name: location.name || '',
    postalCode: location.postalCode || '',
    city: location.city || '',
    country: location.country || 'AT',
    lat: typeof location.lat === 'number' ? location.lat : null,
    lng: typeof location.lng === 'number' ? location.lng : null,
    mapX: typeof location.mapX === 'number' ? location.mapX : null,
    mapY: typeof location.mapY === 'number' ? location.mapY : null,
    googlePlaceId: location.googlePlaceId || null,
    googleBusinessProfileUrl: location.googleBusinessProfileUrl || null,
    googleBusinessProfileImageUrl: location.googleBusinessProfileImageUrl || null,
    landingPages: Array.isArray(location.landingPages) ? location.landingPages : [],
    keywords: Array.isArray(location.keywords) ? location.keywords : [],
  }));
}

export function listToCsv(items?: string[]) {
  return Array.isArray(items) ? items.join(', ') : '';
}

export function csvToList(value: string) {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

export function extractGoogleSpreadsheetId(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';

  const sheetUrlMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (sheetUrlMatch?.[1]) return sheetUrlMatch[1];

  return trimmed;
}
