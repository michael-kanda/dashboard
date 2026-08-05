'use client';

import type { DateRangeOption } from '@/components/DateRangeSelector';
import type { ProjectDashboardViewModel } from './view-model';
import TopQueriesList from '@/components/TopQueriesList';
import IndexingStatusWidget from '@/components/IndexingStatusWidget';
import { LandingPageChart } from './dynamic-widgets';

interface DashboardSearchWidgetsProps {
  model: ProjectDashboardViewModel;
  isLoading: boolean;
  dateRange: DateRangeOption;
  projectId?: string;
  userRole: string;
}

export default function DashboardSearchWidgets({
  model,
  isLoading,
  dateRange,
  projectId,
  userRole,
}: DashboardSearchWidgetsProps) {
  const { gsc, indexing } = model.modules;

  return (
    <>
      {(model.render.topQueries || model.render.landingPages) && (
        <div className={`grid grid-cols-1 ${model.render.topQueries && model.render.landingPages ? 'lg:grid-cols-2' : ''} gap-6 mt-8 lg:items-stretch`}>
          {model.render.topQueries && (
            <div id="section-top-queries" className="scroll-mt-20 print-queries-list lg:h-[816px]">
              <TopQueriesList
                queries={gsc.data.topQueries}
                isLoading={isLoading}
                className="h-full"
                dateRange={dateRange}
                error={gsc.data.displayError ?? undefined}
              />
            </div>
          )}

          {model.render.landingPages && (
            <div id="section-landingpages" className="scroll-mt-20 transition-all duration-300 lg:h-[816px]">
              <div className="print-landing-chart h-full">
                <LandingPageChart
                  data={model.cleanLandingPages}
                  isLoading={isLoading}
                  title="Top Landingpages"
                  dateRange={dateRange}
                  queryData={gsc.data.landingPageQueries}
                  projectId={projectId}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {model.render.indexing && indexing.data.report && projectId && (
        <div id="section-indexing-status" className="mt-8 scroll-mt-20 print:hidden">
          <IndexingStatusWidget
            initialData={indexing.data.report}
            projectId={projectId}
            userRole={userRole}
          />
        </div>
      )}
    </>
  );
}
