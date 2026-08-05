'use client';

import { useState } from 'react';
import type { DateRangeOption } from '@/components/DateRangeSelector';
import type { ProjectDashboardData } from '@/lib/dashboard-shared';
import type { ProjectDashboardViewModel } from './view-model';
import AiTrafficDetailWidgetV2 from '@/components/AiTrafficDetailWidgetV2';
import { AiTrafficCard, PromptTrackingCard } from './dynamic-widgets';

interface DashboardAiWidgetsProps {
  data: ProjectDashboardData;
  model: ProjectDashboardViewModel;
  isLoading: boolean;
  dateRange: DateRangeOption;
  projectId?: string;
  domain?: string;
}

export default function DashboardAiWidgets({
  data,
  model,
  isLoading,
  dateRange,
  projectId,
  domain,
}: DashboardAiWidgetsProps) {
  const [showTrafficDetail, setShowTrafficDetail] = useState(false);
  const [showPromptTracking, setShowPromptTracking] = useState(false);
  const aiTraffic = model.modules.ga4.data.aiTraffic;

  const handlePromptTrackingClick = () => {
    setShowPromptTracking((current) => {
      const next = !current;
      if (next) {
        window.setTimeout(() => {
          document.getElementById('section-prompt-tracking')?.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
          });
        }, 0);
      }
      return next;
    });
  };

  return (
    <>
      {model.canShow('aiTraffic') && (
        <div id="section-ki-traffic" className="grid grid-cols-1 gap-6 mt-8 scroll-mt-20 print-traffic-grid">
          <div className="print-ai-card">
            <AiTrafficCard
              projectId={projectId}
              totalSessions={aiTraffic.totalSessions}
              totalUsers={aiTraffic.totalUsers}
              percentage={model.extendedKpis?.sessions.value
                ? (aiTraffic.totalSessions / model.extendedKpis.sessions.value) * 100
                : 0}
              totalSessionsChange={aiTraffic.totalSessionsChange}
              totalUsersChange={aiTraffic.totalUsersChange}
              trend={model.aiTrafficTrend}
              topAiSources={aiTraffic.topAiSources}
              className="h-full"
              isLoading={isLoading}
              dateRange={dateRange}
              error={model.modules.ga4.data.displayError ?? undefined}
              onDetailClick={projectId ? () => setShowTrafficDetail((current) => !current) : undefined}
              onPromptTrackingClick={model.render.promptTracking ? handlePromptTrackingClick : undefined}
              detailOpen={showTrafficDetail}
              promptTrackingOpen={showPromptTracking}
              promptTracking={data.promptTracking}
              promptTrackingEnabled={model.render.promptTracking}
            />
          </div>
        </div>
      )}

      {model.canShow('aiTraffic') && showTrafficDetail && model.hasAiTraffic && projectId && (
        <div className="mt-8 animate-in slide-in-from-top-4 duration-300 print:hidden">
          <AiTrafficDetailWidgetV2 projectId={projectId} dateRange={dateRange} />
        </div>
      )}

      {showPromptTracking && model.render.promptTracking && data.promptTracking && (
        <div
          id="section-prompt-tracking"
          className="mt-8 scroll-mt-20 transition-all duration-300 print-prompt-tracking"
        >
          <PromptTrackingCard
            data={data.promptTracking}
            dashboardData={data}
            domain={domain}
            dateRange={dateRange}
            isAdmin={model.isAdmin}
          />
        </div>
      )}
    </>
  );
}
