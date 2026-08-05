'use client';

import type { RefObject } from 'react';
import type { DateRangeOption } from '@/components/DateRangeSelector';
import type { ActiveKpi, ProjectDashboardData } from '@/lib/dashboard-shared';
import type { ProjectDashboardViewModel } from './view-model';
import ProjectTimelineWidget from '@/components/ProjectTimelineWidget';
import AiAnalysisWidget from '@/components/AiAnalysisWidget';
import LocalSeoMapWidget from '@/components/LocalSeoMapWidget';
import {
  GoogleGenAiVisibilityCard,
  KpiTrendChart,
  TableauKpiGrid,
} from './dynamic-widgets';

interface DashboardOverviewWidgetsProps {
  data: ProjectDashboardData;
  model: ProjectDashboardViewModel;
  isLoading: boolean;
  dateRange: DateRangeOption;
  projectId?: string;
  domain?: string;
  userRole: string;
  projectTimelineActive: boolean;
  activeKpi: ActiveKpi;
  onActiveKpiChange: (kpi: ActiveKpi) => void;
  chartRef: RefObject<HTMLDivElement>;
}

export default function DashboardOverviewWidgets({
  data,
  model,
  isLoading,
  dateRange,
  projectId,
  domain,
  userRole,
  projectTimelineActive,
  activeKpi,
  onActiveKpiChange,
  chartRef,
}: DashboardOverviewWidgetsProps) {
  return (
    <>
      {projectId && projectTimelineActive && model.canShow('projectTimeline') && (
        <div className="mb-6 print-timeline">
          <ProjectTimelineWidget projectId={projectId} />
        </div>
      )}

      {projectId && model.canShow('aiAnalysis') && (
        <div id="section-ai-analyse" className="mt-8 scroll-mt-20 print:hidden">
          <AiAnalysisWidget
            projectId={projectId}
            domain={domain}
            dateRange={dateRange}
            chartRef={chartRef}
            kpis={model.exportKpis}
            googleAdsData={model.modules.googleAds.data.report ?? undefined}
          />
        </div>
      )}

      {model.canShow('kpis') && (
        <div id="section-kpis" className="mt-8 scroll-mt-20 print-kpi-grid">
          {model.extendedKpis && (
            <TableauKpiGrid
              kpis={model.extendedKpis}
              isLoading={isLoading}
              allChartData={model.allChartData}
              apiErrors={model.errors}
              dateRange={dateRange}
            />
          )}
        </div>
      )}

      {model.canShow('trend') && (
        <div id="section-verlauf" className="mt-8 scroll-mt-20 print-trend-chart" ref={chartRef}>
          <KpiTrendChart
            activeKpi={activeKpi}
            onKpiChange={(kpi) => onActiveKpiChange(kpi as ActiveKpi)}
            allChartData={model.allChartData}
            weatherData={data.weatherData}
          />
        </div>
      )}

      {model.render.localSeo && model.modules.localSeo.data.report && (
        <div id="section-local-seo" className="mt-8 scroll-mt-20 print:hidden">
          <LocalSeoMapWidget
            data={model.modules.localSeo.data.report}
            projectId={projectId}
            userRole={userRole}
          />
        </div>
      )}

      {model.canShow('googleGenAi') && (
        <div id="section-google-genai" className="mt-8 scroll-mt-20 print:hidden">
          <GoogleGenAiVisibilityCard
            data={data.googleGenAi}
            projectId={projectId}
            userRole={userRole}
          />
        </div>
      )}
    </>
  );
}
