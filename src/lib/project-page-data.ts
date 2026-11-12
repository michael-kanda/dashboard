// Lädt Projekt und Dashboard-Snapshot für die Projektseite und die Gastansicht (/teilen).
import { sql } from '@vercel/postgres';
import { getOrFetchGoogleData } from '@/lib/google-data-loader';
import { getProjectIndexingStatus } from '@/lib/indexing-status';
import { User } from '@/lib/schemas';

// Erweiterter Typ für unsere Query-Ergebnisse
export interface ExtendedUser extends User {
  assigned_admins?: string;
  creator_email?: string;
  data_max_enabled?: boolean; 
  settings_show_prompt_tracking: boolean | null;
  dashboard_info_text?: string | null;
  sitemap_url?: string | null;
  google_ads_sheet_id?: string;  // ← NEU
}

export async function loadProjectPageData(projectId: string, dateRange: string) {
  try {
    const { rows } = await sql`
      SELECT
        u.id::text as id, 
        u.email, 
        u.role, 
        u.domain,
        u.gsc_site_url, 
        u.sitemap_url,
        u.ga4_property_id,
        u.semrush_project_id, 
        u.semrush_tracking_id, 
        u.semrush_tracking_id_02,
        u.google_ads_sheet_id,
        u.is_demo,
        u.favicon_url, 
        u.project_timeline_active, 
        u.project_start_date, 
        u.project_duration_months,
        u.settings_show_landingpages,
        u.settings_show_google_ads,
        u.settings_show_prompt_tracking,
        COALESCE(u.dashboard_widget_visibility, '{}'::jsonb) as dashboard_widget_visibility,
        u.dashboard_info_text,
        u.google_genai_manual_data,
        u.data_max_enabled, 
        u.brand_keywords,
        COALESCE(u.project_locations, '[]'::jsonb) as project_locations,
        
        -- E-Mail des Erstellers holen
        creator.email as creator_email,
        
        -- Zugeordnete Admins holen (als String Liste)
        (
          SELECT string_agg(a.email, ', ')
          FROM project_assignments pa
          JOIN users a ON pa.user_id = a.id
          WHERE pa.project_id = u.id
        ) as assigned_admins

      FROM users u
      LEFT JOIN users creator ON u."createdByAdminId" = creator.id
      WHERE u.id = ${projectId}::uuid
    `;

    if (rows.length === 0) return null;

    const projectUser = rows[0] as ExtendedUser;
    
    const [dashboardData, indexingStatus] = await Promise.all([
      getOrFetchGoogleData(projectUser, dateRange, false, { enqueueIfMissing: false }),
      getProjectIndexingStatus(projectId),
    ]);

    const fallbackRange = dashboardData ? null : (await sql<{ date_range: string }>`
      SELECT date_range
      FROM google_data_cache
      WHERE user_id = ${projectId}::uuid
        AND date_range <> ${dateRange}
        AND date_range IN ('7d', '30d', '3m', '6m', '12m', '18m', '24m')
        AND data IS NOT NULL
      ORDER BY CASE WHEN date_range = '30d' THEN 0 ELSE 1 END, last_fetched DESC
      LIMIT 1
    `).rows[0]?.date_range ?? null;

    return { projectUser, dashboardData, indexingStatus, fallbackRange };
  } catch (e) {
    console.error('Error loading project data:', e);
    return null;
  }
}
