'use client';

import type { DateRangeOption } from '@/components/DateRangeSelector';
import type { ProjectDashboardViewModel } from './view-model';
import GoogleAdsWidget from '@/components/GoogleAdsWidget';
import SemrushTopKeywords from '@/components/SemrushTopKeywords';
import SemrushTopKeywords02 from '@/components/SemrushTopKeywords02';
import { TableauPieChart } from './dynamic-widgets';

interface DashboardAcquisitionWidgetsProps {
  model: ProjectDashboardViewModel;
  isLoading: boolean;
  dateRange: DateRangeOption;
  projectId?: string;
}

export default function DashboardAcquisitionWidgets({
  model,
  isLoading,
  dateRange,
  projectId,
}: DashboardAcquisitionWidgetsProps) {
  const { trafficBreakdowns, trafficBreakdownCount } = model.render;
  const ga4 = model.modules.ga4.data;

  return (
    <>
      {trafficBreakdownCount > 0 && (
        <div
          id="section-zugriffe"
          className={`grid grid-cols-1 gap-6 mt-8 scroll-mt-20 print-pie-grid ${
            trafficBreakdownCount === 2
              ? 'lg:grid-cols-2'
              : trafficBreakdownCount === 3
                ? 'lg:grid-cols-3'
                : ''
          }`}
        >
          {trafficBreakdowns.channels && (
            <TableauPieChart
              data={ga4.breakdowns.channels}
              title="Zugriffe nach Channel"
              isLoading={isLoading}
              error={ga4.displayError ?? undefined}
              dateRange={dateRange}
            />
          )}
          {trafficBreakdowns.countries && (
            <TableauPieChart
              data={ga4.breakdowns.countries}
              title="Zugriffe nach Land"
              isLoading={isLoading}
              error={ga4.displayError ?? undefined}
              dateRange={dateRange}
            />
          )}
          {trafficBreakdowns.devices && (
            <TableauPieChart
              data={ga4.breakdowns.devices}
              title="Zugriffe nach Endgerät"
              isLoading={isLoading}
              error={ga4.displayError ?? undefined}
              dateRange={dateRange}
            />
          )}
        </div>
      )}

      {model.render.googleAds && model.modules.googleAds.data.report && (
        <div id="section-google-ads" className="mt-8 scroll-mt-20 transition-all duration-300">
          <GoogleAdsWidget
            data={model.modules.googleAds.data.report}
            isLoading={isLoading}
            dateRange={dateRange}
          />
        </div>
      )}

      {model.render.semrush && (
        <div
          id="section-semrush"
          className={`grid grid-cols-1 gap-6 mt-8 scroll-mt-20 print-semrush-grid ${
            model.render.semrushPrimary && model.render.semrushSecondary ? 'lg:grid-cols-2' : ''
          }`}
        >
          {model.render.semrushPrimary && (
            <div className="dashboard-widget-surface rounded-lg p-4 sm:p-6">
              <SemrushTopKeywords projectId={projectId} />
            </div>
          )}
          {model.render.semrushSecondary && (
            <div className="dashboard-widget-surface rounded-lg p-4 sm:p-6">
              <SemrushTopKeywords02 projectId={projectId} />
            </div>
          )}
        </div>
      )}
    </>
  );
}
