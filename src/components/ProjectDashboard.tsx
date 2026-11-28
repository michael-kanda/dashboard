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
import DashboardViewSwitch, { type DashboardViewMode } from '@/components/dashboard/DashboardViewSwitch';
import { buildDashboardViewModel } from '@/components/dashboard/view-model';
import type { ProjectDashboardProps } from '@/components/dashboard/types';
import { formatReportingPeriod } from '@/lib/reporting-period';
import { applyComparisonMode, parseComparisonMode, type ComparisonMode } from '@/lib/comparison';

export type { ProjectDashboardProps } from '@/components/dashboard/types';

export default function ProjectDashboard({
  data: snapshotData,
  isLoading,
  dateRange,
  onDateRangeChange,
  projectId,
  domain,
  semrushTrackingId,
  semrushTrackingId02,
  projectTimelineActive = false,
  userRole = 'USER',
  viewerRole,
  userEmail = '',
  userAnsprache = null,
  showLandingPages = false,
  showGoogleAds = false,
  showPromptTracking = false,
  widgetVisibility,
  dashboardInfoText = null,
  dataMaxEnabled = true,
  isDemo = false,
  indexingStatus,
}: ProjectDashboardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const chartRef = useRef<HTMLDivElement>(null);
  const [activeKpi, setActiveKpi] = useState<ActiveKpi>('clicks');
  const [isUpdating, setIsUpdating] = useState(false);
  // Die Vergleichsart wechselt ohne Neuladen: der Snapshot enthält Vorperiode und Vorjahr.
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>(
    () => parseComparisonMode(searchParams.get('vergleich')),
  );
  const data = useMemo(() => applyComparisonMode(snapshotData, comparisonMode), [snapshotData, comparisonMode]);
  const reportingPeriodLabel = formatReportingPeriod(data.reportingPeriod);
  const comparisonPeriodLabel = formatReportingPeriod(data.comparison?.period);

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
  }, [dateRange, snapshotData, isLoading]);

  const handleDateRangeChange = (range: ProjectDashboardProps['dateRange']) => {
    if (range === dateRange) return;
    setIsUpdating(true);
    const params = new URLSearchParams(window.location.search);
    params.set('range', range);
    router.push(`${pathname}?${params.toString()}`);
    onDateRangeChange?.(range);
  };

  const handleComparisonModeChange = (mode: ComparisonMode) => {
    if (mode === comparisonMode) return;
    setComparisonMode(mode);
    const params = new URLSearchParams(window.location.search);
    if (mode === 'vorjahr') params.set('vergleich', 'vorjahr');
    else params.delete('vergleich');
    const query = params.toString();
    // Nur die Adresse anpassen (für Teilen und Drucken), ohne die Seite neu zu laden.
    window.history.replaceState(window.history.state, '', query ? `${pathname}?${query}` : pathname);
  };

  const canSwitchView = viewerRole === 'ADMIN' || viewerRole === 'SUPERADMIN';
  const viewMode: DashboardViewMode = canSwitchView && userRole === 'BENUTZER' ? 'kunde' : 'admin';
  const handleViewModeChange = (mode: DashboardViewMode) => {
    if (mode === viewMode) return;
    setIsUpdating(true);
    const params = new URLSearchParams(window.location.search);
    if (mode === 'kunde') params.set('ansicht', 'kunde');
    else params.delete('ansicht');
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
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
          comparisonMode={comparisonMode}
          onComparisonModeChange={handleComparisonModeChange}
          userRole={userRole}
          userEmail={userEmail}
          userAnsprache={userAnsprache}
        />

        {canSwitchView && (
          <DashboardViewSwitch value={viewMode} onChange={handleViewModeChange} />
        )}

        {/* Nur im Ausdruck: der Kopf oben ist beim Drucken ausgeblendet. */}
        <div className="mb-4 hidden border-b-2 border-black pb-2 print:block">
          <h1>{domain || 'Projekt Dashboard'}</h1>
          <p className="text-11">
            {reportingPeriodLabel ? `Zeitraum: ${reportingPeriodLabel} · ` : ''}
            {data.comparison ? `Vergleich: ${data.comparison.label}${comparisonPeriodLabel ? ` (${comparisonPeriodLabel})` : ''} · ` : ''}
            Gedruckt am {new Date().toLocaleDateString('de-AT')}
          </p>
        </div>

        {data.cacheStale && (
          <p className="mt-4 text-14 text-muted" role="status">
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
          isDemo={isDemo}
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
        <DataMaxChat projectId={projectId} dateRange={dateRange} comparisonMode={comparisonMode} ansprache={isDemo ? null : userAnsprache} demo={isDemo} />
      )}
    </div>
  );
}
