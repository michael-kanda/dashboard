// src/app/demo-anwalt/bericht/page.tsx
// PDF-Bericht der öffentlichen Demo mit denselben fiktiven Daten wie das Demo-Dashboard.
import type { Metadata } from 'next';
import ProjectPrintReport from '@/components/print/ProjectPrintReport';
import { demoData } from '../demo-dashboard-data';
import { parseComparisonMode } from '@/lib/comparison';

export const metadata: Metadata = { title: 'Demo-Bericht | Data Peak', robots: { index: false, follow: false } };

export default function DemoReportPage({ searchParams }: { searchParams: { print?: string; vergleich?: string } }) {
  return (
    <ProjectPrintReport
      data={demoData}
      domain="kanzlei-demo.at"
      userRole="BENUTZER"
      showLandingPages
      showGoogleAds
      showPromptTracking={false}
      comparisonMode={parseComparisonMode(searchParams.vergleich)}
      autoPrint={searchParams.print === '1'}
    />
  );
}
