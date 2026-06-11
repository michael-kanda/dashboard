// src/app/projekt/[id]/page.tsx

import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { getOrFetchGoogleData } from '@/lib/google-data-loader';
import { sql } from '@vercel/postgres';
import { User } from '@/lib/schemas';
import ProjectDashboard from '@/components/ProjectDashboard';
import { DateRangeOption } from '@/components/DateRangeSelector';
import { DashboardSkeleton } from '@/components/skeletons/DashboardSkeleton';

// Vercel-Function-Timeout für diese Seite hochsetzen.
// 120 s, abgestimmt auf die GA4-Cache-Schicht in lib/google-api.ts:
// Beim Cold-Load (Cache leer) darf ein einzelner GA4-Report bis zu 55 s
// brauchen (sehr langsame Properties), und Hintergrund-Refreshes via
// waitUntil zählen ebenfalls zur Function-Laufzeit. Mit 60 s wurde die
// Function gekillt, bevor langsame Reports fertig waren ("Task timed out
// after 60 seconds"). Hinweis: Mit Fluid Compute (Standard) erlaubt der
// Pro-Plan bis zu 300 s — 60 s ist NICHT mehr das Maximum.
export const maxDuration = 120;

// Erweiterter Typ für unsere Query-Ergebnisse
interface ExtendedUser extends User {
  assigned_admins?: string;
  creator_email?: string;
  data_max_enabled?: boolean; 
  settings_show_google_ads?: boolean;
  settings_show_prompt_tracking: boolean | null;
  dashboard_info_text?: string | null;
  project_locations?: any[] | null;
  google_ads_sheet_id?: string;  // ← NEU
}

async function loadData(projectId: string, dateRange: string) {
  try {
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS dashboard_info_text TEXT NULL`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS project_locations JSONB DEFAULT '[]'::jsonb`;

    const { rows } = await sql`
      SELECT
        u.id::text as id, 
        u.email, 
        u.role, 
        u.domain,
        u.gsc_site_url, 
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
        u.dashboard_info_text,
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
    
    const dashboardData = await getOrFetchGoogleData(projectUser, dateRange);

    return { projectUser, dashboardData };
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
  console.log('[PAGE-TRACE] ProjectPage ENTRY');
  
  const projectId = params.id;
  const dateRange = (searchParams.range as DateRangeOption) || '30d';

  const session = await auth();
  console.log('[PAGE-TRACE] after auth, role=', session?.user?.role, 'projectId=', projectId);

  if (!session?.user) {
    redirect('/login');
  }

  if (session.user.role === 'BENUTZER' && session.user.id !== projectId) {
    redirect('/');
  }

  console.log('[PAGE-TRACE] before loadData');
  const data = await loadData(projectId, dateRange);
  console.log('[PAGE-TRACE] after loadData, hasData=', !!data, 'hasDashboardData=', !!data?.dashboardData);

  if (!data || !data.dashboardData) {
    console.log('[PAGE-TRACE] returning early: no data');
    return (
      <div className="flex justify-center items-center min-h-screen bg-surface-secondary">
        <p className="text-muted">Projekt nicht gefunden oder keine Daten verfügbar.</p>
      </div>
    );
  }

  const { projectUser, dashboardData } = data;

  const supportEmail = projectUser.assigned_admins || projectUser.creator_email || '';
  const timelineActive = projectUser.project_timeline_active === true;
  const isDataMaxEnabled = projectUser.data_max_enabled !== false;

  console.log('[PAGE-TRACE] computed flags: timelineActive=', timelineActive, 'isDataMaxEnabled=', isDataMaxEnabled);
  console.log('[PAGE-TRACE] about to create JSX elements');

  let skeletonEl, dashboardEl, suspenseEl;
  try {
    skeletonEl = <DashboardSkeleton />;
    console.log('[PAGE-TRACE] ✓ created DashboardSkeleton element');
  } catch (e) {
    console.error('[PAGE-TRACE] ✗ FAILED creating DashboardSkeleton element:', e);
    throw e;
  }
  
  try {
    dashboardEl = (
      <ProjectDashboard
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
        dashboardInfoText={projectUser.dashboard_info_text || null}
        dataMaxEnabled={isDataMaxEnabled}
      />
    );
    console.log('[PAGE-TRACE] ✓ created ProjectDashboard element');
  } catch (e) {
    console.error('[PAGE-TRACE] ✗ FAILED creating ProjectDashboard element:', e);
    throw e;
  }
  
  try {
    suspenseEl = (
      <Suspense fallback={skeletonEl}>
        {dashboardEl}
      </Suspense>
    );
    console.log('[PAGE-TRACE] ✓ created Suspense element');
  } catch (e) {
    console.error('[PAGE-TRACE] ✗ FAILED creating Suspense element:', e);
    throw e;
  }
  
  console.log('[PAGE-TRACE] returning JSX tree');
  return suspenseEl;
}
