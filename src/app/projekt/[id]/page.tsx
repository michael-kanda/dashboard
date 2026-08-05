// src/app/projekt/[id]/page.tsx

import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getOrFetchGoogleData } from '@/lib/google-data-loader';
import { sql } from '@vercel/postgres';
import { User } from '@/lib/schemas';
import ProjectDashboardClient from '@/components/ProjectDashboardClient';
import { DateRangeOption } from '@/components/DateRangeSelector';
import { getProjectIndexingStatus } from '@/lib/indexing-status';
import DashboardSyncPending from '@/components/DashboardSyncPending';

// Projektseiten lesen nur Neon-Snapshots. Externe Google-Aufrufe laufen
// ausschließlich im zentralen Sync-Dispatcher.
export const maxDuration = 30;

// Erweiterter Typ für unsere Query-Ergebnisse
interface ExtendedUser extends User {
  assigned_admins?: string;
  creator_email?: string;
  data_max_enabled?: boolean; 
  settings_show_prompt_tracking: boolean | null;
  dashboard_info_text?: string | null;
  google_genai_manual_data?: any | null;
  project_locations?: any[] | null;
  sitemap_url?: string | null;
  google_ads_sheet_id?: string;  // ← NEU
}

async function loadData(projectId: string, dateRange: string) {
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
      getOrFetchGoogleData(projectUser, dateRange),
      getProjectIndexingStatus(projectId),
    ]);

    return { projectUser, dashboardData, indexingStatus };
  } catch (e) {
    console.error('Error loading project data:', e);
    return null;
  }
}

export default async function ProjectPage({ 
  params, 
  searchParams 
}: { 
  params: { id: string },
  searchParams: { range?: string }
}) {
  const projectId = params.id;
  const dateRange = (searchParams.range as DateRangeOption) || '30d';

  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  if (session.user.role === 'BENUTZER' && session.user.id !== projectId) {
    redirect('/');
  }

  const data = await loadData(projectId, dateRange);

  if (!data) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-surface-secondary">
        <p className="text-muted">Projekt nicht gefunden.</p>
      </div>
    );
  }

  const { projectUser, dashboardData, indexingStatus } = data;

  if (!dashboardData) {
    return (
      <DashboardSyncPending
        domain={projectUser.domain}
        dateRange={dateRange}
      />
    );
  }

  const supportEmail = projectUser.assigned_admins || projectUser.creator_email || '';
  const timelineActive = projectUser.project_timeline_active === true;
  const isDataMaxEnabled = projectUser.data_max_enabled !== false;

  return (
    <ProjectDashboardClient
      data={dashboardData}
      isLoading={false}
      dateRange={dateRange}
      projectId={projectUser.id}
      domain={projectUser.domain || ''}
      faviconUrl={projectUser.favicon_url || undefined}
      semrushTrackingId={projectUser.semrush_tracking_id || undefined}
      semrushTrackingId02={projectUser.semrush_tracking_id_02 || undefined}
      projectTimelineActive={timelineActive}
      countryData={dashboardData.countryData}
      channelData={dashboardData.channelData}
      deviceData={dashboardData.deviceData}
      userRole={session.user.role}
      userEmail={supportEmail}
      userAnsprache={session.user.ansprache || null}
      showLandingPages={projectUser.settings_show_landingpages !== false}
      showGoogleAds={projectUser.settings_show_google_ads === true}
      showPromptTracking={projectUser.settings_show_prompt_tracking === true}
      widgetVisibility={projectUser.dashboard_widget_visibility}
      dashboardInfoText={projectUser.dashboard_info_text || null}
      dataMaxEnabled={isDataMaxEnabled}
      indexingStatus={indexingStatus}
    />
  );
}
