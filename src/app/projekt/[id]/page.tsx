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

// Erweiterter Typ für unsere Query-Ergebnisse
interface ExtendedUser extends User {
  assigned_admins?: string;
  creator_email?: string;
  data_max_enabled?: boolean; 
  settings_show_google_ads?: boolean;
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
        u.data_max_enabled, 
        
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

  if (!data || !data.dashboardData) {
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

  return (
    <Suspense fallback={<DashboardSkeleton />}>
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
        showLandingPages={projectUser.settings_show_landingpages !== false}
        showGoogleAds={projectUser.settings_show_google_ads === true}
        dataMaxEnabled={isDataMaxEnabled}
      />
    </Suspense>
  );
}
