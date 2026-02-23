// src/components/TableauKpiGrid.tsx
'use client';

import React, { useMemo } from 'react';
import TableauKpiCard from './tableau-kpi-card';
import { KpiDatum, ChartPoint, ApiErrorStatus } from '@/lib/dashboard-shared';
import { getRangeLabel, DateRangeOption } from '@/components/DateRangeSelector';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

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
}

export default function TableauKpiGrid({
  kpis,
  isLoading = false,
  allChartData,
  apiErrors,
  dateRange = '30d'
}: TableauKpiGridProps) {

  if (!kpis) return null;

  const gscError = apiErrors?.gsc;
  const ga4Error = apiErrors?.ga4;

  const formatPercent = (v: number) => `${v.toFixed(1)}%`;
  const formatTime = (v: number) => {
    const minutes = Math.floor(v / 60);
    const seconds = Math.floor(v % 60);
    return `${minutes}m ${seconds}s`;
  };

  const dateSubtitle = useMemo(() => {
    const dataPoints = allChartData?.sessions || allChartData?.clicks;
    if (dataPoints && dataPoints.length > 0) {
      const sorted = [...dataPoints].sort((a, b) => a.date - b.date);
      const startDate = sorted[0].date;
      const endDate = sorted[sorted.length - 1].date;
      try {
        return `${format(startDate, 'dd.MM.', { locale: de })} - ${format(endDate, 'dd.MM.yyyy', { locale: de })}`;
      } catch (e) { console.error(e); }
    }
    return 'Zeitraum';
  }, [allChartData]);

  const rangeLabel = getRangeLabel(dateRange as DateRangeOption);

  const getComparison = (kpi: KpiDatum) => {
    if (!kpi || typeof kpi.value !== 'number' || typeof kpi.change !== 'number') return undefined;
    if (kpi.change === -100) return { current: kpi.value, previous: 0 };
    return { current: kpi.value, previous: kpi.value / (1 + kpi.change / 100) };
  };

  return (
    <div className="space-y-8">
      
      {/* ZEILE 1: Traffic & Reichweite */}
      <div>
        <h3 className="text-xs font-bold text-faint uppercase tracking-widest mb-4 px-1 flex items-center gap-3">
          <span className="h-px flex-1 bg-theme-border-default"></span>
          <span>Traffic & Reichweite</span>
          <span className="h-px flex-1 bg-theme-border-default"></span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          
          <TableauKpiCard
            title="Impressionen"
            description="Wie oft Ihre Website in den Google-Suchergebnissen gesehen wurde."
            subtitle={dateSubtitle}
            valueLabel={rangeLabel}
            value={kpis.impressions.value}
            change={kpis.impressions.change}
            data={allChartData?.impressions}
            color="#8b5cf6"
            error={gscError}
            isLoading={isLoading}
            barComparison={getComparison(kpis.impressions)}
          />

          <TableauKpiCard
            title="Google Klicks"
            description="Wie oft Nutzer in der Google-Suche auf Ihre Website geklickt haben."
            subtitle={dateSubtitle}
            valueLabel={rangeLabel}
            value={kpis.clicks.value}
            change={kpis.clicks.change}
            data={allChartData?.clicks}
            color="#3b82f6"
            error={gscError}
            isLoading={isLoading}
            barComparison={getComparison(kpis.clicks)}
          />

          {kpis.newUsers && (
            <TableauKpiCard
              title="Neue Besucher"
              description="Anzahl der Nutzer, die Ihre Website zum ersten Mal besucht haben."
              subtitle={dateSubtitle}
              valueLabel={rangeLabel}
              value={kpis.newUsers.value}
              change={kpis.newUsers.change}
              data={allChartData?.newUsers}
              color="#6366f1"
              error={ga4Error}
              isLoading={isLoading}
              barComparison={getComparison(kpis.newUsers)}
            />
          )}

          <TableauKpiCard
            title="Besucher"
            description="Gesamtzahl der eindeutigen Nutzer (User), die Ihre Website besucht haben."
            subtitle={dateSubtitle}
            valueLabel={rangeLabel}
            value={kpis.totalUsers.value}
            change={kpis.totalUsers.change}
            data={allChartData?.totalUsers}
            color="#0ea5e9"
            error={ga4Error}
            isLoading={isLoading}
            barComparison={getComparison(kpis.totalUsers)}
          />

          {/* Sessions (Sitzungen) wurde hier entfernt */}

        </div>
      </div>

      {/* ZEILE 2: Qualität & Interaktion */}
      <div>
        <h3 className="text-xs font-bold text-faint uppercase tracking-widest mb-4 px-1 flex items-center gap-3">
          <span className="h-px flex-1 bg-theme-border-default"></span>
          <span>Qualität & Interaktion</span>
          <span className="h-px flex-1 bg-theme-border-default"></span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          
          {kpis.engagementRate && (
            <TableauKpiCard
              title="Interaktionsrate"
              description="Prozentsatz der Sitzungen mit Interaktion (länger als 10s, Conversion oder 2+ Seiten)."
              subtitle={dateSubtitle}
              valueLabel={rangeLabel}
              value={kpis.engagementRate.value}
              change={kpis.engagementRate.change}
              data={allChartData?.engagementRate}
              color="#ec4899"
              error={ga4Error}
              isLoading={isLoading}
              formatValue={formatPercent}
              barComparison={getComparison(kpis.engagementRate)}
            />
          )}

          {kpis.conversions && (
            <TableauKpiCard
              title="Conversions"
              description="Anzahl der erreichten Zielvorhaben (z.B. Kontaktanfragen, Käufe)."
              subtitle={dateSubtitle}
              valueLabel={rangeLabel}
              value={kpis.conversions.value}
              change={kpis.conversions.change}
              data={allChartData?.conversions}
              color="#10b981"
              error={ga4Error}
              isLoading={isLoading}
              barComparison={getComparison(kpis.conversions)}
            />
          )}

          {kpis.avgEngagementTime && (
            <TableauKpiCard
              title="Ø Verweildauer"
              description="Durchschnittliche Zeit, die die Website im Vordergrund des Browsers geöffnet war."
              subtitle={dateSubtitle}
              valueLabel={rangeLabel}
              value={kpis.avgEngagementTime.value}
              change={kpis.avgEngagementTime.change}
              data={allChartData?.avgEngagementTime}
              color="#f59e0b"
              error={ga4Error}
              isLoading={isLoading}
              formatValue={formatTime}
              barComparison={getComparison(kpis.avgEngagementTime)}
            />
          )}

          {kpis.bounceRate && (
            <TableauKpiCard
              title="Absprungrate"
              description="Prozentsatz der Sitzungen ohne Interaktion. (Hinweis: In GA4 oft durch Interaktionsrate ersetzt)."
              subtitle={dateSubtitle}
              valueLabel={rangeLabel}
              value={kpis.bounceRate.value}
              change={kpis.bounceRate.change}
              data={allChartData?.bounceRate}
              color="#f43f5e"
              error={ga4Error}
              isLoading={isLoading}
              formatValue={formatPercent}
              barComparison={getComparison(kpis.bounceRate)}
            />
          )}

        </div>
      </div>
    </div>
  );
}
