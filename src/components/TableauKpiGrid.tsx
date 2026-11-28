'use client';

import { useMemo } from 'react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { InfoCircle } from 'react-bootstrap-icons';
import TableauKpiCard from './tableau-kpi-card';
import type { DateRangeOption } from '@/components/DateRangeSelector';
import { getRangeLabel } from '@/components/DateRangeSelector';
import type { ApiErrorStatus, ChartPoint, KpiDatum } from '@/lib/dashboard-shared';
import { formatReportingPeriod, type ReportingPeriod } from '@/lib/reporting-period';
import type { DashboardComparison } from '@/lib/comparison';

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
  /** Nur bei Vercel Web Analytics. */
  pageviews?: KpiDatum;
}

export interface TableauKpiGridProps {
  kpis: ExtendedKpis;
  isLoading?: boolean;
  allChartData?: Record<string, ChartPoint[]>;
  apiErrors?: ApiErrorStatus;
  dateRange?: string;
  reportingPeriod?: ReportingPeriod;
  analyticsSource?: 'ga4' | 'vercel';
  /** Gewählte Vergleichsart samt Hinweisen; ohne Angabe gilt die Vorperiode. */
  comparison?: DashboardComparison;
}

function KpiSectionHeader({
  index,
  title,
  rangeLabel,
  comparisonLabel,
}: {
  index: string;
  title: string;
  rangeLabel: string;
  comparisonLabel: string;
}) {
  return (
    <div className="kpi-quiet-grid__section flex items-center justify-between gap-4 border-y px-4 py-[13px] sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <span className="text-12 font-medium text-faint">{index}</span>
        <h3 className="widget-section-title truncate text-heading">{title}</h3>
      </div>
      <span className="shrink-0 text-12 font-medium text-faint">
        {rangeLabel}
        {/* Auf schmalen Bildschirmen steht der Vergleich nur im Kopf der Kachel. */}
        <span className="hidden sm:inline"> · vs. {comparisonLabel}</span>
      </span>
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
  analyticsSource = 'ga4',
  comparison,
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
  // Website-Kennzahlen stammen aus GA4 oder Vercel Web Analytics.
  const webSource = analyticsSource === 'vercel' ? 'Vercel' : 'GA4';
  const hasQualityKpis = Boolean(kpis.engagementRate || kpis.conversions || kpis.avgEngagementTime || kpis.bounceRate);
  const isYearOverYear = comparison?.mode === 'vorjahr';
  const comparisonPeriod = formatReportingPeriod(comparison?.period);
  const rangeLabel = getRangeLabel(dateRange as DateRangeOption);
  const comparisonLabel = comparison?.label ?? 'Vorperiode';
  const formatPercent = (value: number) => `${value.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
  const formatTime = (value: number) => `${Math.floor(value / 60)}m ${Math.floor(value % 60)}s`;
  // Veränderung und Vergleichswert der gewählten Vergleichsart. Ohne applyComparisonMode
  // (ältere Aufrufer) wie bisher: Vorher-Wert gespeichert oder aus der Änderung zurückgerechnet.
  const compareProps = (kpi: KpiDatum) => {
    const selected = kpi.comparison;
    if (!selected) {
      const previous = !Number.isFinite(kpi.value) || !Number.isFinite(kpi.change)
        ? null
        : kpi.previous ?? (kpi.change === -100 ? 0 : kpi.value / (1 + kpi.change / 100));
      return { change: kpi.change, previousValue: previous };
    }
    return {
      change: selected.change ?? undefined,
      previousValue: selected.previous,
      comparisonLabel: isYearOverYear ? 'Vorjahr' : 'Vorher',
      missingComparisonLabel: isYearOverYear ? 'Kein Vorjahreswert' : 'Kein Vergleichswert',
      comparisonNote: selected.note,
    };
  };

  return (
    <section className="dashboard-widget-surface kpi-quiet-grid rounded-lg">
      <div className="flex flex-col gap-3 px-4 pb-[18px] pt-[22px] sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div>
          <p className="widget-eyebrow text-faint">Performance Dashboard</p>
          <h2 className="widget-title text-heading">Kennzahlen im Überblick</h2>
          <div className="mt-[7px] flex h-1 w-[152px] overflow-hidden rounded-sm" aria-hidden="true">
            <span className="w-1/4 bg-accent-solid" />
            <span className="w-1/4 bg-danger-bar" />
            <span className="w-1/4 bg-warning-bar" />
            <span className="w-1/4 bg-success-bar" />
          </div>
        </div>
        <div className="widget-meta text-muted sm:pt-1 sm:text-right">
          <p className="whitespace-nowrap">
            Quelle: GSC + {analyticsSource === 'vercel' ? 'Vercel Analytics' : 'GA4'}{dateSubtitle ? ` · ${dateSubtitle}` : ''}
          </p>
          {comparison && comparisonPeriod && (
            <p className="whitespace-nowrap">Vergleich: {comparison.label} · {comparisonPeriod}</p>
          )}
        </div>
      </div>

      {comparison && comparison.notices.length > 0 && (
        <div className="mx-4 mb-[18px] flex items-start gap-2 rounded-md border border-border-subtle bg-surface-secondary px-3 py-2 text-13 leading-[1.5] text-body sm:mx-6" role="note">
          <InfoCircle size={14} className="mt-[3px] shrink-0 text-faint" aria-hidden="true" />
          <div className="space-y-1">
            {comparison.notices.map((notice) => <p key={notice}>{notice}</p>)}
          </div>
        </div>
      )}

      <KpiSectionHeader index="01" title="Traffic & Reichweite" rangeLabel={rangeLabel} comparisonLabel={comparisonLabel} />
      <div className="kpi-quiet-grid__metrics grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <TableauKpiCard
          title="Impressionen"
          description="Wie oft Ihre Website in den Google-Suchergebnissen gesehen wurde."
          value={kpis.impressions.value}
          {...compareProps(kpis.impressions)}
          data={allChartData?.impressions}
          color="var(--dp-chart-5)"
          error={gscError}
          isLoading={isLoading}
          source="GSC"
        />
        <TableauKpiCard
          title="Google Klicks"
          description="Wie oft Nutzer in der Google-Suche auf Ihre Website geklickt haben."
          value={kpis.clicks.value}
          {...compareProps(kpis.clicks)}
          data={allChartData?.clicks}
          color="var(--dp-chart-1)"
          error={gscError}
          isLoading={isLoading}
          source="GSC"
        />
        {kpis.newUsers ? (
          <TableauKpiCard
            title="Neue Besucher"
            description="Anzahl der Nutzer, die Ihre Website zum ersten Mal besucht haben."
            value={kpis.newUsers.value}
            {...compareProps(kpis.newUsers)}
            data={allChartData?.newUsers}
            color="var(--dp-chart-1)"
            error={ga4Error}
            isLoading={isLoading}
            source={webSource}
          />
        ) : null}
        {kpis.pageviews ? (
          <TableauKpiCard
            title="Seitenaufrufe"
            description="Wie oft Seiten Ihrer Website aufgerufen wurden."
            value={kpis.pageviews.value}
            {...compareProps(kpis.pageviews)}
            data={allChartData?.pageviews}
            color="var(--dp-chart-1)"
            error={ga4Error}
            isLoading={isLoading}
            source={webSource}
          />
        ) : null}
        <TableauKpiCard
          title="Besucher"
          description="Gesamtzahl der eindeutigen Nutzer, die Ihre Website besucht haben."
          value={kpis.totalUsers.value}
          {...compareProps(kpis.totalUsers)}
          data={allChartData?.totalUsers}
          color="#0ea5e9"
          error={ga4Error}
          isLoading={isLoading}
          source={webSource}
        />
      </div>

      {hasQualityKpis && <KpiSectionHeader index="02" title="Qualität & Interaktion" rangeLabel={rangeLabel} comparisonLabel={comparisonLabel} />}
      {hasQualityKpis && <div className="kpi-quiet-grid__metrics grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.engagementRate ? (
          <TableauKpiCard
            title="Interaktionsrate"
            description="Anteil der Sitzungen mit Interaktion: länger als zehn Sekunden, mit Conversion oder mindestens zwei Seitenaufrufen."
            value={kpis.engagementRate.value}
            {...compareProps(kpis.engagementRate)}
            data={allChartData?.engagementRate}
            color="var(--dp-chart-5)"
            error={ga4Error}
            isLoading={isLoading}
            formatValue={formatPercent}
            source={webSource}
          />
        ) : null}
        {kpis.conversions ? (
          <TableauKpiCard
            title="Conversions"
            description="Anzahl der erreichten Zielvorhaben, beispielsweise Kontaktanfragen oder Käufe."
            value={kpis.conversions.value}
            {...compareProps(kpis.conversions)}
            data={allChartData?.conversions}
            color="var(--dp-chart-2)"
            error={ga4Error}
            isLoading={isLoading}
            source={webSource}
          />
        ) : null}
        {kpis.avgEngagementTime ? (
          <TableauKpiCard
            title="Ø Verweildauer"
            description="Durchschnittliche Zeit, in der die Website aktiv im Vordergrund genutzt wurde."
            value={kpis.avgEngagementTime.value}
            {...compareProps(kpis.avgEngagementTime)}
            data={allChartData?.avgEngagementTime}
            color="var(--dp-chart-3)"
            error={ga4Error}
            isLoading={isLoading}
            formatValue={formatTime}
            source={webSource}
          />
        ) : null}
        {kpis.bounceRate ? (
          <TableauKpiCard
            title="Absprungrate"
            description="Anteil der Sitzungen ohne Interaktion. In GA4 ist dies der Gegenwert zur Interaktionsrate."
            value={kpis.bounceRate.value}
            {...compareProps(kpis.bounceRate)}
            data={allChartData?.bounceRate}
            color="var(--dp-chart-4)"
            error={ga4Error}
            isLoading={isLoading}
            formatValue={formatPercent}
            source={webSource}
          />
        ) : null}
      </div>}
    </section>
  );
}
