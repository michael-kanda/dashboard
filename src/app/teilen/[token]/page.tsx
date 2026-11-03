// src/app/teilen/[token]/page.tsx
import type { Metadata } from 'next';
import { Eye } from 'react-bootstrap-icons';
import ProjectDashboardClient from '@/components/ProjectDashboardClient';
import type { DateRangeOption } from '@/types/date-range';
import { loadProjectPageData } from '@/lib/project-page-data';
import { resolveShareLink } from '@/lib/share-links';
import { GUEST_ROLE } from '@/lib/share-link-token';
import GuestPrintButton from './GuestPrintButton';

export const dynamic = 'force-dynamic';

// Gastlinks nie indexieren und den Token nicht als Referrer weitergeben.
export const metadata: Metadata = {
  title: 'Gastansicht | Data Peak',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

const DATE_RANGES: DateRangeOption[] = ['30d', '3m', '6m', '12m', '18m', '24m'];

function Notice({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-page px-4">
      <div className="max-w-md text-center">
        <h1 className="text-[22px] font-semibold text-heading">{title}</h1>
        <p className="mt-2 text-[15px] text-muted">{text}</p>
      </div>
    </div>
  );
}

export default async function SharedProjectPage({
  params,
  searchParams,
}: {
  params: { token: string };
  searchParams: { range?: string };
}) {
  const link = await resolveShareLink(params.token).catch((error) => {
    console.error('[Gastlink] Auflösen fehlgeschlagen:', error);
    return null;
  });

  if (!link) {
    return (
      <Notice
        title="Link abgelaufen oder ungültig"
        text="Gastlinks gelten 24 Stunden. Bitte fordern Sie bei Ihrer Ansprechperson einen neuen Link an."
      />
    );
  }

  const dateRange = DATE_RANGES.includes(searchParams.range as DateRangeOption)
    ? (searchParams.range as DateRangeOption)
    : '30d';
  const data = await loadProjectPageData(link.projectId, dateRange);

  if (!data) {
    return <Notice title="Projekt nicht verfügbar" text="Die Daten können gerade nicht geladen werden." />;
  }

  const { projectUser, dashboardData, indexingStatus } = data;
  const expiresLabel = link.expiresAt.toLocaleString('de-AT', {
    timeZone: 'Europe/Vienna',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <>
      <div className="flex items-center justify-center gap-2 border-b border-border bg-accent-tint px-4 py-2 text-[14px] text-heading print:hidden" role="status">
        <Eye size={15} aria-hidden="true" className="text-accent" />
        <span>Gastansicht, nur lesen. Gültig bis {expiresLabel} Uhr.</span>
        <GuestPrintButton />
      </div>
      <ProjectDashboardClient
        data={dashboardData ?? {}}
        isLoading={!dashboardData}
        dateRange={dateRange}
        projectId={projectUser.id}
        domain={projectUser.domain || ''}
        semrushTrackingId={projectUser.semrush_tracking_id || undefined}
        semrushTrackingId02={projectUser.semrush_tracking_id_02 || undefined}
        projectTimelineActive={projectUser.project_timeline_active === true}
        userRole={GUEST_ROLE}
        userEmail={projectUser.assigned_admins || projectUser.creator_email || ''}
        showLandingPages={projectUser.settings_show_landingpages !== false}
        showGoogleAds={projectUser.settings_show_google_ads === true}
        showPromptTracking={projectUser.settings_show_prompt_tracking === true}
        widgetVisibility={projectUser.dashboard_widget_visibility}
        dashboardInfoText={projectUser.dashboard_info_text || null}
        dataMaxEnabled={false}
        indexingStatus={indexingStatus}
      />
    </>
  );
}
