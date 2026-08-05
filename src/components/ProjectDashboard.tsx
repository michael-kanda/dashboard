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
    <div className="min-h-screen flex flex-col dashboard-gradient relative">
      {isUpdating && !isLoading && <DashboardLoadingOverlay />}

      <div className="flex-grow w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <GlobalHeader
          domain={domain}
          projectId={projectId}
          dateRange={dateRange}
          onDateRangeChange={handleDateRangeChange}
          userRole={userRole}
          userEmail={userEmail}
          userAnsprache={userAnsprache}
        />

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
