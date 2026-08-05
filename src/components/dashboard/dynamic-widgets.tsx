'use client';

import dynamic from 'next/dynamic';

function WidgetLoading({ label, className = '' }: { label: string; className?: string }) {
  return (
    <div className={`dashboard-widget-surface rounded-lg p-6 ${className}`}>
      <div className="animate-pulse text-muted text-sm">{label} lädt…</div>
    </div>
  );
}

export const PromptTrackingCard = dynamic(
  () => import('@/components/PromptTrackingCard'),
  {
    ssr: false,
    loading: () => <WidgetLoading label="Prompt-Tracking" />,
  },
);

export const TableauKpiGrid = dynamic(
  () => import('@/components/TableauKpiGrid'),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-8">
        <div className="dashboard-widget-surface rounded-xl p-5">
          <div className="animate-pulse space-y-4">
            <div className="h-4 w-48 rounded bg-surface-tertiary" />
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-40 rounded-lg bg-surface-tertiary" />
              ))}
            </div>
          </div>
        </div>
      </div>
    ),
  },
);

export const AiTrafficCard = dynamic(
  () => import('@/components/AiTrafficCard'),
  {
    ssr: false,
    loading: () => <WidgetLoading label="KI-Traffic" />,
  },
);

export const GoogleGenAiVisibilityCard = dynamic(
  () => import('@/components/GoogleGenAiVisibilityCard'),
  {
    ssr: false,
    loading: () => <WidgetLoading label="Google GenAI Sichtbarkeit" />,
  },
);

export const KpiTrendChart = dynamic(
  () => import('@/components/charts/KpiTrendChart'),
  {
    ssr: false,
    loading: () => <WidgetLoading label="Verlauf" className="h-[400px]" />,
  },
);

export const LandingPageChart = dynamic(
  () => import('@/components/charts/LandingPageChart'),
  {
    ssr: false,
    loading: () => <WidgetLoading label="Landingpages" className="h-[500px]" />,
  },
);

export const TableauPieChart = dynamic(
  () => import('@/components/charts/TableauPieChart'),
  {
    ssr: false,
    loading: () => <WidgetLoading label="Diagramm" className="h-80" />,
  },
);
