// src/components/ProjectDashboard.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { ActiveKpi } from '@/lib/dashboard-shared';
import GlobalHeader from '@/components/GlobalHeader';
import { DataMaxChat } from '@/components/datamax';
import DashboardAcquisitionWidgets from '@/components/dashboard/DashboardAcquisitionWidgets';
import DashboardAiWidgets from '@/components/dashboard/DashboardAiWidgets';
import DashboardInfoWidget from '@/components/dashboard/DashboardInfoWidget';
import DashboardLoadingOverlay from '@/components/dashboard/DashboardLoadingOverlay';
import DashboardOverviewWidgets from '@/components/dashboard/DashboardOverviewWidgets';
import DashboardSearchWidgets from '@/components/dashboard/DashboardSearchWidgets';
import { buildDashboardViewModel } from '@/components/dashboard/view-model';
import type { ProjectDashboardProps } from '@/components/dashboard/types';
import { formatReportingPeriod } from '@/lib/reporting-period';

export type { ProjectDashboardProps } from '@/components/dashboard/types';

export default function ProjectDashboard({
  data,
  isLoading,
  dateRange,
  onDateRangeChange,
  projectId,
  domain,
  semrushTrackingId,
  semrushTrackingId02,
  projectTimelineActive = false,
  userRole = 'USER',
  userEmail = '',
  userAnsprache = null,
  showLandingPages = false,
  showGoogleAds = false,
  showPromptTracking = false,
  widgetVisibility,
  dashboardInfoText = null,
  dataMaxEnabled = true,
  indexingStatus,
}: ProjectDashboardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const chartRef = useRef<HTMLDivElement>(null);
  const [activeKpi, setActiveKpi] = useState<ActiveKpi>('clicks');
  const [isUpdating, setIsUpdating] = useState(false);
  const reportingPeriodLabel = formatReportingPeriod(data.reportingPeriod);

  const model = useMemo(() => buildDashboardViewModel({
    data,
    indexingStatus,
    userRole,
    showLandingPages,
    showGoogleAds,
    showPromptTracking,
    widgetVisibility,
    semrushTrackingId,
    semrushTrackingId02,
  }), [
    data,
    indexingStatus,
    userRole,
    showLandingPages,
    showGoogleAds,
    showPromptTracking,
    widgetVisibility,
    semrushTrackingId,
    semrushTrackingId02,
  ]);

  useEffect(() => {
    setIsUpdating(false);
  }, [dateRange, data, isLoading]);

  const handleDateRangeChange = (range: ProjectDashboardProps['dateRange']) => {
    if (range === dateRange) return;
    setIsUpdating(true);
    const params = new URLSearchParams(searchParams.toString());
    params.set('range', range);
    router.push(`${pathname}?${params.toString()}`);
    onDateRangeChange?.(range);
  };

  return (
    <div className="relative flex min-h-screen flex-col bg-page">
      {isUpdating && !isLoading && <DashboardLoadingOverlay />}

      <div className="w-full flex-grow px-[clamp(16px,3vw,40px)] pt-7 pb-12">
        <GlobalHeader
          domain={domain}
          projectId={projectId}
          dateRange={dateRange}
          onDateRangeChange={handleDateRangeChange}
          userRole={userRole}
          userEmail={userEmail}
          userAnsprache={userAnsprache}
        />

        {/* Nur im Ausdruck: der Kopf oben ist beim Drucken ausgeblendet. */}
        <div className="mb-4 hidden border-b-2 border-black pb-2 print:block">
          <h1>{domain || 'Projekt Dashboard'}</h1>
          <p className="text-[11px]">
            {reportingPeriodLabel ? `Zeitraum: ${reportingPeriodLabel} · ` : ''}Gedruckt am {new Date().toLocaleDateString('de-AT')}
          </p>
        </div>

        {data.cacheStale && (
          <p className="mt-4 text-[14px] text-muted" role="status">
            Gespeicherte Daten{reportingPeriodLabel ? ` für ${reportingPeriodLabel}` : ''}. Aktualisierung ausstehend.
          </p>
        )}

        <DashboardOverviewWidgets
          data={data}
          model={model}
          isLoading={isLoading}
          dateRange={dateRange}
          projectId={projectId}
          domain={domain}
          userRole={userRole}
          projectTimelineActive={projectTimelineActive}
          activeKpi={activeKpi}
          onActiveKpiChange={setActiveKpi}
          chartRef={chartRef}
        />

        <DashboardAiWidgets
          data={data}
          model={model}
          isLoading={isLoading}
          dateRange={dateRange}
          projectId={projectId}
          domain={domain}
        />

        <DashboardSearchWidgets
          model={model}
          isLoading={isLoading}
          dateRange={dateRange}
          projectId={projectId}
          userRole={userRole}
        />

        <DashboardAcquisitionWidgets
          model={model}
          isLoading={isLoading}
          dateRange={dateRange}
          projectId={projectId}
        />

        {model.canShow('dataInfo') && (
          <DashboardInfoWidget
            projectId={projectId}
            initialText={dashboardInfoText}
            isAdmin={model.isAdmin}
          />
        )}
      </div>

      {dataMaxEnabled && model.canShow('dataMaxChat') && (
        <DataMaxChat projectId={projectId} dateRange={dateRange} ansprache={userAnsprache} />
      )}

      <style jsx global>{`
        @keyframes indeterminate-bar {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
        .animate-indeterminate-bar {
          animation: indeterminate-bar 1.5s infinite linear;
        }
      `}</style>
    </div>
  );
}
