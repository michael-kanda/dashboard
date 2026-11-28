// src/app/projekt/[id]/bericht/page.tsx
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { canAccessProject } from '@/lib/project-access';
import { loadProjectPageData } from '@/lib/project-page-data';
import { parseDateRange } from '@/lib/date-range-param';
import { parseComparisonMode } from '@/lib/comparison';
import ProjectPrintReport from '@/components/print/ProjectPrintReport';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Bericht | Data Peak', robots: { index: false, follow: false } };

export default async function ProjectReportPage(
  props: {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ range?: string; print?: string; vergleich?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (!(await canAccessProject(session.user, params.id))) redirect('/');

  const data = await loadProjectPageData(params.id, parseDateRange(searchParams.range));
  if (!data?.dashboardData) {
    return <p className="flex min-h-[60vh] items-center justify-center px-4 text-center text-15 text-muted">Für diesen Zeitraum liegen noch keine Daten vor</p>;
  }

  const { projectUser, dashboardData, indexingStatus } = data;
  return (
    <ProjectPrintReport
      data={dashboardData}
      domain={projectUser.domain || ''}
      userRole={session.user.role || 'BENUTZER'}
      showLandingPages={projectUser.settings_show_landingpages !== false}
      showGoogleAds={projectUser.settings_show_google_ads === true}
      showPromptTracking={projectUser.settings_show_prompt_tracking === true}
      widgetVisibility={projectUser.dashboard_widget_visibility}
      indexingStatus={indexingStatus}
      comparisonMode={parseComparisonMode(searchParams.vergleich)}
      autoPrint={searchParams.print === '1'}
    />
  );
}
