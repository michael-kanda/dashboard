// src/app/teilen/[token]/bericht/page.tsx
import type { Metadata } from 'next';
import ProjectPrintReport from '@/components/print/ProjectPrintReport';
import { loadProjectPageData } from '@/lib/project-page-data';
import { parseDateRange } from '@/lib/date-range-param';
import { parseComparisonMode } from '@/lib/comparison';
import { resolveShareLink } from '@/lib/share-links';
import { GUEST_ROLE } from '@/lib/share-link-token';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Bericht | Data Peak',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default async function SharedReportPage({
  params,
  searchParams,
}: {
  params: { token: string };
  searchParams: { range?: string; print?: string; vergleich?: string };
}) {
  const link = await resolveShareLink(params.token).catch(() => null);
  if (!link) {
    return <p className="flex min-h-[60vh] items-center justify-center px-4 text-center text-15 text-muted">Link abgelaufen oder ungültig</p>;
  }

  const data = await loadProjectPageData(link.projectId, parseDateRange(searchParams.range));
  if (!data?.dashboardData) {
    return <p className="flex min-h-[60vh] items-center justify-center px-4 text-center text-15 text-muted">Für diesen Zeitraum liegen noch keine Daten vor</p>;
  }

  const { projectUser, dashboardData, indexingStatus } = data;
  return (
    <ProjectPrintReport
      data={dashboardData}
      domain={projectUser.domain || ''}
      userRole={GUEST_ROLE}
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
