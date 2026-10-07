'use client';

import { useMemo } from 'react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import TableauKpiCard from './tableau-kpi-card';
import GoogleCleanUnderline from '@/components/ui/GoogleCleanUnderline';
import type { DateRangeOption } from '@/components/DateRangeSelector';
import { getRangeLabel } from '@/components/DateRangeSelector';
import type { ApiErrorStatus, ChartPoint, KpiDatum } from '@/lib/dashboard-shared';
import { formatReportingPeriod, type ReportingPeriod } from '@/lib/reporting-period';

export interface ExtendedKpis {
  clicks: KpiDatum;
  impressions: KpiDatum;
  sessions: KpiDatum;
  totalUsers: KpiDatum;
  newUsers?: KpiDatum;
  conversions?: KpiDatum;
  engagementRate?: KpiDatum;
  bounceRate?: KpiDatum;
  avgEngagementTime?: KpiDatum;
}

export interface TableauKpiGridProps {
  kpis: ExtendedKpis;
  isLoading?: boolean;
  allChartData?: Record<string, ChartPoint[]>;
  apiErrors?: ApiErrorStatus;
  dateRange?: string;
  reportingPeriod?: ReportingPeriod;
}

function KpiSectionHeader({
  index,
  title,
  rangeLabel,
}: {
  index: string;
  title: string;
  rangeLabel: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-y border-border-subtle bg-surface-secondary px-4 py-3 sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <span className="text-[11px] font-medium text-faint">{index}</span>
        <h3 className="truncate text-sm font-semibold text-heading">{title}</h3>
      </div>
      <span className="shrink-0 text-[11px] font-medium uppercase text-faint">{rangeLabel}</span>
    </div>
  );
}

export default function TableauKpiGrid({
  kpis,
  isLoading = false,
  allChartData,
  apiErrors,
  dateRange = '30d',
  reportingPeriod,
}: TableauKpiGridProps) {
  const dateSubtitle = useMemo(() => {
    const storedPeriod = formatReportingPeriod(reportingPeriod);
    if (storedPeriod) return storedPeriod;

    const dataPoints = allChartData?.sessions || allChartData?.clicks;
    if (!dataPoints?.length) return '';

    const sorted = [...dataPoints].sort((a, b) => a.date - b.date);
    try {
      return `${format(sorted[0].date, 'dd.MM.', { locale: de })} – ${format(sorted[sorted.length - 1].date, 'dd.MM.yyyy', { locale: de })}`;
    } catch {
      return '';
    }
  }, [allChartData, reportingPeriod]);

  if (!kpis) return null;

  const gscError = apiErrors?.gsc;
  const ga4Error = apiErrors?.ga4;
  const rangeLabel = getRangeLabel(dateRange as DateRangeOption);
  const formatPercent = (value: number) => `${value.toFixed(1)} %`;
  const formatTime = (value: number) => `${Math.floor(value / 60)}m ${Math.floor(value % 60)}s`;
  const getComparison = (kpi: KpiDatum) => {
    if (!Number.isFinite(kpi.value) || !Number.isFinite(kpi.change)) return undefined;
    if (kpi.change === -100) return { current: kpi.value, previous: 0 };
    return { current: kpi.value, previous: kpi.value / (1 + kpi.change / 100) };
  };

  return (
    <section className="dashboard-widget-surface rounded-lg">
      <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-6 sm:py-5">
        <div>
          <p className="text-[11px] font-medium uppercase text-faint">Performance Dashboard</p>
          <h2 className="text-lg font-semibold text-heading">Kennzahlen im Überblick</h2>
          <GoogleCleanUnderline id="google-clean-gradient-kpi-grid" />
        </div>
        <p className="text-xs text-muted sm:pt-1">
          Quelle: GSC + GA4{dateSubtitle ? ` · ${dateSubtitle}` : ''}
        </p>
      </div>

      <KpiSectionHeader index="01" title="Traffic & Reichweite" rangeLabel={rangeLabel} />
      <div className="grid grid-cols-1 gap-px bg-border-subtle sm:grid-cols-2 lg:grid-cols-4">
        <TableauKpiCard
          title="Impressionen"
          description="Wie oft Ihre Website in den Google-Suchergebnissen gesehen wurde."
          value={kpis.impressions.value}
          change={kpis.impressions.change}
          data={allChartData?.impressions}
          color="#8b5cf6"
          error={gscError}
          isLoading={isLoading}
          comparison={getComparison(kpis.impressions)}
          source="GSC"
        />
        <TableauKpiCard
          title="Google Klicks"
          description="Wie oft Nutzer in der Google-Suche auf Ihre Website geklickt haben."
          value={kpis.clicks.value}
          change={kpis.clicks.change}
          data={allChartData?.clicks}
          color="#3b82f6"
          error={gscError}
          isLoading={isLoading}
          comparison={getComparison(kpis.clicks)}
          source="GSC"
        />
        {kpis.newUsers ? (
          <TableauKpiCard
            title="Neue Besucher"
            description="Anzahl der Nutzer, die Ihre Website zum ersten Mal besucht haben."
            value={kpis.newUsers.value}
            change={kpis.newUsers.change}
            data={allChartData?.newUsers}
            color="#6366f1"
            error={ga4Error}
            isLoading={isLoading}
            comparison={getComparison(kpis.newUsers)}
            source="GA4"
          />
        ) : null}
        <TableauKpiCard
          title="Besucher"
          description="Gesamtzahl der eindeutigen Nutzer, die Ihre Website besucht haben."
          value={kpis.totalUsers.value}
          change={kpis.totalUsers.change}
          data={allChartData?.totalUsers}
          color="#0ea5e9"
          error={ga4Error}
          isLoading={isLoading}
          comparison={getComparison(kpis.totalUsers)}
          source="GA4"
        />
      </div>

      <KpiSectionHeader index="02" title="Qualität & Interaktion" rangeLabel={rangeLabel} />
      <div className="grid grid-cols-1 gap-px bg-border-subtle sm:grid-cols-2 lg:grid-cols-4">
        {kpis.engagementRate ? (
          <TableauKpiCard
            title="Interaktionsrate"
            description="Anteil der Sitzungen mit Interaktion: länger als zehn Sekunden, mit Conversion oder mindestens zwei Seitenaufrufen."
            value={kpis.engagementRate.value}
            change={kpis.engagementRate.change}
            data={allChartData?.engagementRate}
            color="#ec4899"
            error={ga4Error}
            isLoading={isLoading}
            formatValue={formatPercent}
            comparison={getComparison(kpis.engagementRate)}
            source="GA4"
          />
        ) : null}
        {kpis.conversions ? (
          <TableauKpiCard
            title="Conversions"
            description="Anzahl der erreichten Zielvorhaben, beispielsweise Kontaktanfragen oder Käufe."
            value={kpis.conversions.value}
            change={kpis.conversions.change}
            data={allChartData?.conversions}
            color="#10b981"
            error={ga4Error}
            isLoading={isLoading}
            comparison={getComparison(kpis.conversions)}
            source="GA4"
          />
        ) : null}
        {kpis.avgEngagementTime ? (
          <TableauKpiCard
            title="Ø Verweildauer"
            description="Durchschnittliche Zeit, in der die Website aktiv im Vordergrund genutzt wurde."
            value={kpis.avgEngagementTime.value}
            change={kpis.avgEngagementTime.change}
            data={allChartData?.avgEngagementTime}
            color="#f59e0b"
            error={ga4Error}
            isLoading={isLoading}
            formatValue={formatTime}
            comparison={getComparison(kpis.avgEngagementTime)}
            source="GA4"
          />
        ) : null}
        {kpis.bounceRate ? (
          <TableauKpiCard
            title="Absprungrate"
            description="Anteil der Sitzungen ohne Interaktion. In GA4 ist dies der Gegenwert zur Interaktionsrate."
            value={kpis.bounceRate.value}
            change={kpis.bounceRate.change}
            data={allChartData?.bounceRate}
            color="#f43f5e"
            error={ga4Error}
            isLoading={isLoading}
            formatValue={formatPercent}
            comparison={getComparison(kpis.bounceRate)}
            source="GA4"
          />
        ) : null}
      </div>
    </section>
  );
}
