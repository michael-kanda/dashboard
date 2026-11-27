'use client';

import { useMemo, useState } from 'react';
import { InfoCircleFill } from 'react-bootstrap-icons';
import ProjectDashboard from '@/components/ProjectDashboard';
import type { DateRangeOption } from '@/components/DateRangeSelector';
import { AiTrafficExtendedDemoContext } from '@/hooks/useAiTrafficExtended';
import { demoAiTrafficExtended } from './demo-extras';
import { demoData } from './demo-dashboard-data';

export default function DemoAnwaltDashboard() {
  const [dateRange, setDateRange] = useState<DateRangeOption>('30d');
  const dashboardData = useMemo(() => demoData, []);

  return (
    <AiTrafficExtendedDemoContext.Provider value={demoAiTrafficExtended}>
      <div className="px-[clamp(16px,3vw,40px)] pt-5 print:hidden">
        <div className="flex items-start gap-3 rounded-container border border-border bg-accent-tint px-4 py-3 text-[14px] leading-[1.5] text-body" role="note">
          <InfoCircleFill size={16} className="mt-0.5 flex-shrink-0 text-accent" aria-hidden="true" />
          <p>
            <span className="font-semibold text-heading">Demo mit Beispieldaten.</span>{' '}
            Der KI-Assistent DataMax, der die Zahlen in Klartext erklärt, ist in der Demo nicht aktiv. Fragen?{' '}
            <a href="mailto:michael@designare.at" className="font-medium text-accent hover:underline">michael@designare.at</a>
          </p>
        </div>
      </div>
      <ProjectDashboard
        data={dashboardData}
        isLoading={false}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        domain="kanzlei-demo.at"
        userRole="BENUTZER"
        userEmail="demo@datapeak.at"
        userAnsprache="Willkommen in der öffentlichen Demo"
        showLandingPages
        showGoogleAds
        showPromptTracking={false}
        dashboardInfoText="Demo-Hinweis: Diese öffentliche Ansicht verwendet ausschließlich fiktive Werte für eine Rechtsanwaltskanzlei. Es werden keine echten Kunden-, Google- oder Backend-Daten geladen. Der KI-Assistent DataMax ist in der Demo nicht aktiv. Fragen zur Demo: michael@designare.at"
        dataMaxEnabled={false}
      />
    </AiTrafficExtendedDemoContext.Provider>
  );
}
