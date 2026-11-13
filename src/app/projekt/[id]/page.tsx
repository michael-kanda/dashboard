// src/app/projekt/[id]/page.tsx

import { auth } from '@/lib/auth';
import { canAccessProject } from '@/lib/project-access';
import { redirect } from 'next/navigation';
import { loadProjectPageData } from '@/lib/project-page-data';
import ProjectDashboardClient from '@/components/ProjectDashboardClient';
import { DateRangeOption } from '@/components/DateRangeSelector';
import DashboardSyncPending from '@/components/DashboardSyncPending';

// Projektseiten lesen nur Neon-Snapshots. Externe Google-Aufrufe laufen
// ausschließlich im zentralen Sync-Dispatcher.
export const maxDuration = 30;

export default async function ProjectPage({ 
  params, 
  searchParams 
}: { 
  params: { id: string },
  searchParams: { range?: string; ansicht?: string }
}) {
  const projectId = params.id;
  const dateRange = (searchParams.range as DateRangeOption) || '30d';

  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  // Admins und Superadmins koennen das Dashboard so ansehen, wie es der Kunde sieht.
  const viewerRole = session.user.role;
  const isStaff = viewerRole === 'ADMIN' || viewerRole === 'SUPERADMIN';
  const customerView = isStaff && searchParams.ansicht === 'kunde';

  if (!(await canAccessProject(session.user, projectId))) {
    redirect('/');
  }

  const data = await loadProjectPageData(projectId, dateRange);

  if (!data) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-surface-secondary">
        <p className="text-muted">Projekt nicht gefunden.</p>
      </div>
    );
  }

  const { projectUser, dashboardData, indexingStatus, fallbackRange } = data;
  const supportEmail = projectUser.assigned_admins || projectUser.creator_email || '';
  const timelineActive = projectUser.project_timeline_active === true;
  const isDataMaxEnabled = projectUser.data_max_enabled !== false;
  const effectiveDashboardData = dashboardData ?? {};

  return (
    <>
      <ProjectDashboardClient
        data={effectiveDashboardData}
        isLoading={!dashboardData}
        dateRange={dateRange}
        projectId={projectUser.id}
        domain={projectUser.domain || ''}
        faviconUrl={projectUser.favicon_url || undefined}
        semrushTrackingId={projectUser.semrush_tracking_id || undefined}
        semrushTrackingId02={projectUser.semrush_tracking_id_02 || undefined}
        projectTimelineActive={timelineActive}
        countryData={effectiveDashboardData.countryData}
        channelData={effectiveDashboardData.channelData}
        deviceData={effectiveDashboardData.deviceData}
        userRole={customerView ? 'BENUTZER' : viewerRole}
        viewerRole={viewerRole}
        userEmail={supportEmail}
        userAnsprache={(customerView ? projectUser.ansprache : session.user.ansprache) || null}
        showLandingPages={projectUser.settings_show_landingpages !== false}
        showGoogleAds={projectUser.settings_show_google_ads === true}
        showPromptTracking={projectUser.settings_show_prompt_tracking === true}
        widgetVisibility={projectUser.dashboard_widget_visibility}
        dashboardInfoText={projectUser.dashboard_info_text || null}
        dataMaxEnabled={isDataMaxEnabled}
        indexingStatus={indexingStatus}
      />
      {(!dashboardData || dashboardData.cacheStale) && (
        <DashboardSyncPending
          projectId={projectUser.id}
          dateRange={dateRange}
          backgroundOnly={Boolean(dashboardData)}
          fallbackRange={fallbackRange}
        />
      )}
    </>
  );
}
