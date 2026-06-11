import { z } from 'zod';

// Basis-Schema für einen Benutzer (wie in der DB)
export const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  role: z.enum(['SUPERADMIN', 'ADMIN', 'BENUTZER']),
  domain: z.string().nullable().optional(),
  mandant_id: z.string().nullable().optional(),
  ansprache: z.string().nullable().optional(),
  // Permissions können null, ein Array oder ein String sein - wir normalisieren es zu Array
  permissions: z.union([
    z.array(z.string()), 
    z.string().transform((str) => str.split(',').map(s => s.trim()).filter(Boolean)),
    z.null()
  ]).transform(val => val || []),
  favicon_url: z.string().nullable().optional(),
  
  // API-Konfiguration (Google & Semrush)
  gsc_site_url: z.string().nullable().optional(),
  ga4_property_id: z.string().nullable().optional(),
  semrush_project_id: z.string().nullable().optional(),
  semrush_tracking_id: z.string().nullable().optional(),
  semrush_tracking_id_02: z.string().nullable().optional(),
  google_ads_sheet_id: z.string().nullable().optional(),
  
  // Metadaten für Dashboard/Admin
  assigned_admins: z.string().nullable().optional(),
  assigned_projects: z.string().nullable().optional(),
  creator_email: z.string().nullable().optional(),
  
  // Projekt-Timeline
  project_timeline_active: z.boolean().nullable().optional().default(false),
  project_start_date: z.date().nullable().optional(), // Postgres Date objekt
  project_duration_months: z.number().nullable().optional(),
  createdAt: z.date().nullable().optional(),
  
// Einstellungen
  settings_show_landingpages: z.boolean().nullable().optional().default(false),

  // Prompt-Tracking: konfigurierbare Brand-Keywords (Migration 001)
  // null = Heuristik (Domain-Wurzel) wird verwendet
  brand_keywords: z.array(z.string()).nullable().optional(),
  dashboard_info_text: z.string().nullable().optional(),
  settings_show_prompt_tracking: z.boolean().nullable().optional().default(false),
  project_locations: z.array(z.object({
    id: z.string().optional(),
    name: z.string(),
    postalCode: z.string().optional(),
    city: z.string().optional(),
    country: z.string().optional(),
    lat: z.number().nullable().optional(),
    lng: z.number().nullable().optional(),
    mapX: z.number().nullable().optional(),
    mapY: z.number().nullable().optional(),
    landingPages: z.array(z.string()).optional(),
    keywords: z.array(z.string()).optional(),
  })).nullable().optional(),
});

// Schema für die Projekt-Übersicht (User + KPIs)
export const ProjectStatsSchema = UserSchema.extend({
  // Zod.coerce.number() wandelt Strings aus der DB ("10") automatisch in Zahlen (10) um
  landingpages_count: z.coerce.number().default(0),
  landingpages_offen: z.coerce.number().default(0),
  landingpages_in_pruefung: z.coerce.number().default(0),
  landingpages_freigegeben: z.coerce.number().default(0),
  landingpages_gesperrt: z.coerce.number().default(0),
  total_impression_change: z.coerce.number().default(0),
});

// Typen aus den Schemas ableiten (statt manuell in types.ts)
export type User = z.infer<typeof UserSchema>;
export type ProjectStats = z.infer<typeof ProjectStatsSchema>;
