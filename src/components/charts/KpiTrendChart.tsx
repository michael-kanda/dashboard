// src/components/KpiTrendChart.tsx
'use client';

import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { ChartPoint, ActiveKpi } from '@/lib/dashboard-shared'; 
import { ArrowLeftRight, CalendarEvent, Filter } from 'react-bootstrap-icons';
import { cn } from '@/lib/utils';
import { buildHolidayMap, type HolidayInfo } from '@/lib/holidays';

// --- KONFIGURATION ---
const KPI_CONFIG: Record<string, { label: string; color: string; gradientId: string }> = {
  // Traffic
  impressions: { label: 'Impressionen', color: '#8b5cf6', gradientId: 'gradPurple' }, 
  clicks: { label: 'Google Klicks', color: '#3b82f6', gradientId: 'gradBlue' },       
  newUsers: { label: 'Neue Besucher', color: '#6366f1', gradientId: 'gradIndigo' }, 
  totalUsers: { label: 'Besucher', color: '#0ea5e9', gradientId: 'gradSky' },     
  sessions: { label: 'Sessions', color: '#06b6d4', gradientId: 'gradCyan' },       
  
  aiTraffic: { label: 'KI-Traffic', color: '#7c3aed', gradientId: 'gradAi' },

  // Engagement
  engagementRate: { label: 'Interaktionsrate', color: '#ec4899', gradientId: 'gradPink' },
  conversions: { label: 'Conversions', color: '#10b981', gradientId: 'gradEmerald' },   
  avgEngagementTime: { label: 'Ø Verweildauer', color: '#f59e0b', gradientId: 'gradAmber' },
  bounceRate: { label: 'Absprungrate', color: '#f43f5e', gradientId: 'gradRose' },
  
  paidSearch: { label: 'Paid Search', color: '#14b8a6', gradientId: 'gradTeal' },
};

// Wochentag-Kürzel auf Deutsch
const WEEKDAY_SHORT: Record<number, string> = {
  0: 'So', 1: 'Mo', 2: 'Di', 3: 'Mi', 4: 'Do', 5: 'Fr', 6: 'Sa'
};

// Flaggen-Emoji für Tooltip
const COUNTRY_FLAG: Record<string, string> = {
  DE: '🇩🇪',
  AT: '🇦🇹'
};

interface KpiTrendChartProps {
  activeKpi: ActiveKpi | string;
  onKpiChange: (kpi: string) => void;
  allChartData?: Record<string, ChartPoint[]>;
  isLoading?: boolean;
  className?: string;
}

// Helper: Prüfen ob KPI ein Prozentwert ist
const isPercentageKpi = (kpi: string) => ['engagementRate', 'bounceRate'].includes(kpi);

const formatValue = (value: number, kpi: string) => {
  if (isPercentageKpi(kpi)) return `${value.toFixed(1)}%`;
  if (kpi === 'avgEngagementTime') {
    const mins = Math.floor(value / 60);
    const secs = Math.floor(value % 60);
    return `${mins}m ${secs}s`;
  }
  return new Intl.NumberFormat('de-DE').format(value);
};

const CustomTooltip = ({ active, payload, label, kpi1, kpi2, holidayMap }: any) => {
  if (active && payload && payload.length) {
    const dateObj = label ? new Date(label) : null;
    const dateLabel = dateObj 
      ? format(dateObj, 'EEEE, dd. MMMM yyyy', { locale: de }) 
      : '';
    
    // Feiertag nachschlagen
    const dateKey = dateObj ? dateObj.toISOString().split('T')[0] : '';
    const holiday: HolidayInfo | undefined = holidayMap?.get(dateKey);
    
    return (
      <div className="bg-surface px-3 py-2 rounded-lg shadow-xl border border-theme-border-default text-sm z-50 max-w-[280px]">
        {/* Datum mit vollem Wochentag */}
        <p className="text-faint font-medium mb-1 border-b border-theme-border-subtle pb-1">
          {dateLabel}
        </p>
        
        {/* Feiertags-Badge */}
        {holiday && (
          <div className="flex items-center gap-1.5 mb-2 px-1.5 py-1 bg-amber-50 dark:bg-amber-950/30 rounded text-xs border border-amber-200 dark:border-amber-800">
            <span className="text-amber-600 dark:text-amber-400 font-semibold">
              📅 {holiday.name}
            </span>
            <span className="text-amber-500 dark:text-amber-500 ml-auto">
              {holiday.countries.map(c => COUNTRY_FLAG[c]).join(' ')}
            </span>
          </div>
        )}
        
        {payload.map((entry: any, index: number) => {
          const kpiKey = entry.dataKey === 'value' ? kpi1 : kpi2;
          const conf = KPI_CONFIG[kpiKey] || { label: kpiKey, color: '#888' };
          
          return (
            <div key={index} className="flex items-center gap-3 mb-1 last:mb-0">
              <div className="flex items-center gap-2 min-w-[120px]">
                <div 
                  className="w-2 h-2 rounded-full" 
                  style={{ backgroundColor: entry.stroke || conf.color }}
                />
                <span className="text-secondary font-medium">{conf.label}:</span>
              </div>
              <span className="font-bold text-heading">
                {formatValue(entry.value, kpiKey)}
              </span>
            </div>
          );
        })}
      </div>
    );
  }
  return null;
};

export default function KpiTrendChart({
  activeKpi,
  onKpiChange,
  allChartData,
  isLoading,
  className
}: KpiTrendChartProps) {
  
  const [compareKpi, setCompareKpi] = useState<string>('none');

  const chartData = useMemo(() => {
    if (!allChartData) return [];
    
    const primaryData = allChartData[activeKpi] || [];
    const secondaryData = compareKpi !== 'none' ? allChartData[compareKpi] || [] : [];

    const dataMap = new Map<string, any>();

    primaryData.forEach(p => {
      const dStr = new Date(p.date).toISOString();
      let val = p.value;
      if (isPercentageKpi(activeKpi) && val <= 1) {
        val = val * 100;
      }
      dataMap.set(dStr, { date: p.date, value: val });
    });

    if (secondaryData.length > 0) {
      secondaryData.forEach(p => {
        const dStr = new Date(p.date).toISOString();
        const existing = dataMap.get(dStr) || { date: p.date };
        let compVal = p.value;
        if (isPercentageKpi(compareKpi) && compVal <= 1) {
          compVal = compVal * 100;
        }
        existing.compareValue = compVal;
        dataMap.set(dStr, existing);
      });
    }

    return Array.from(dataMap.values()).sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }, [allChartData, activeKpi, compareKpi]);

  // ✅ NEU: Feiertags-Map einmal für den sichtbaren Zeitraum berechnen
  const holidayMap = useMemo(() => {
    if (chartData.length === 0) return new Map();
    const firstDate = chartData[0].date;
    const lastDate = chartData[chartData.length - 1].date;
    return buildHolidayMap(firstDate, lastDate);
  }, [chartData]);

  const activeConfig = KPI_CONFIG[activeKpi] || KPI_CONFIG['sessions'];
  const compareConfig = compareKpi !== 'none' ? KPI_CONFIG[compareKpi] : null;

  const formatYAxis = (val: number, kpiContext: string) => {
    if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `${(val / 1000).toFixed(0)}k`;
    if (isPercentageKpi(kpiContext)) return `${val}%`;
    return String(val);
  };

  // ✅ NEU: X-Achsen-Formatter mit Wochentag
  const formatXAxisTick = (date: string) => {
    const d = new Date(date);
    const weekday = WEEKDAY_SHORT[d.getDay()];
    const dayMonth = format(d, 'd.MMM', { locale: de });
    return `${weekday} ${dayMonth}`;
  };

  if (isLoading) {
    return (
      <div className={cn("bg-surface rounded-lg shadow-sm border border-theme-border-default p-6 h-[400px] animate-pulse flex items-center justify-center", className)}>
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 bg-surface-tertiary rounded-full animate-bounce"></div>
          <span className="text-faint text-sm">Lade Trend-Daten...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("bg-surface rounded-lg shadow-sm border border-theme-border-default p-6 transition-all hover:shadow-md", className)}>
      
      {/* HEADER & CONTROLS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
            <CalendarEvent size={18} />
          </div>
          <h3 className="text-lg font-semibold text-heading">
            Verlauf & Analyse
          </h3>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative group">
            <select
              value={activeKpi}
              onChange={(e) => onKpiChange(e.target.value)}
              className="appearance-none bg-surface-secondary hover:bg-surface border border-theme-border-default hover:border-theme-border-default text-body text-sm rounded-md focus:ring-blue-500 focus:border-blue-500 block w-full pl-3 pr-10 py-2 cursor-pointer transition-colors"
            >
              {Object.keys(KPI_CONFIG).map((key) => (
                <option key={key} value={key}>
                  {KPI_CONFIG[key].label}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-faint group-hover:text-blue-500 transition-colors">
              <Filter size={12} />
            </div>
          </div>

          <div className="relative group">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-faint">
              <ArrowLeftRight size={12} />
            </div>
            <select
              value={compareKpi}
              onChange={(e) => setCompareKpi(e.target.value)}
              className="appearance-none bg-surface border border-theme-border-default hover:border-theme-border-default text-secondary text-sm rounded-md focus:ring-purple-500 focus:border-purple-500 block w-full pl-9 pr-8 py-2 cursor-pointer transition-colors"
            >
              <option value="none">Kein Vergleich</option>
              {Object.keys(KPI_CONFIG)
                .filter((k) => k !== activeKpi)
                .map((key) => (
                  <option key={key} value={key}>
                     vs. {KPI_CONFIG[key].label}
                  </option>
                ))}
            </select>
          </div>
        </div>
      </div>

      {/* CHART AREA */}
      <div className="h-[320px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              {Object.values(KPI_CONFIG).map((conf) => (
                <linearGradient key={conf.gradientId} id={conf.gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={conf.color} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={conf.color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
            
            {/* ✅ UPDATED: Wochentag im Tick */}
            <XAxis
              dataKey="date"
              tickFormatter={formatXAxisTick}
              tick={{ fontSize: 11, fill: '#6b7280' }}
              axisLine={false}
              tickLine={false}
              dy={10}
              minTickGap={50}
            />
            
            <YAxis
              yAxisId="left"
              tickFormatter={(val) => formatYAxis(val, activeKpi)}
              tick={{ fontSize: 11, fill: '#6b7280' }}
              axisLine={false}
              tickLine={false}
              dx={-10}
            />

            {compareKpi !== 'none' && (
              <YAxis
                yAxisId="right"
                orientation="right"
                tickFormatter={(val) => formatYAxis(val, compareKpi)}
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                axisLine={false}
                tickLine={false}
                dx={10}
              />
            )}

            {/* ✅ UPDATED: Tooltip mit holidayMap */}
            <Tooltip 
              content={
                <CustomTooltip 
                  kpi1={activeKpi} 
                  kpi2={compareKpi !== 'none' ? compareKpi : undefined}
                  holidayMap={holidayMap}
                />
              } 
            />

            <Legend 
              verticalAlign="top" 
              height={36}
              content={({ payload }) => (
                <div className="flex justify-center gap-6 mb-4">
                  {payload?.map((entry: any, index) => {
                     const isPrimary = index === 0;
                     const conf = isPrimary ? activeConfig : compareConfig;
                     if (!conf) return null;

                     return (
                       <div key={index} className="flex items-center gap-2 text-xs font-medium text-secondary bg-surface-secondary px-2 py-1 rounded-full border border-theme-border-subtle">
                         <span 
                           className="w-2.5 h-2.5 rounded-full" 
                           style={{ backgroundColor: conf.color }}
                         />
                         {conf.label}
                       </div>
                     );
                  })}
                </div>
              )}
            />

            <Area
              yAxisId="left"
              type="monotone"
              dataKey="value"
              name="value"
              stroke={activeConfig.color}
              strokeWidth={3}
              fillOpacity={1}
              fill={`url(#${activeConfig.gradientId})`}
              activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff', fill: activeConfig.color }}
              animationDuration={1000}
            />

            {compareKpi !== 'none' && compareConfig && (
              <Area
                yAxisId="right"
                type="monotone"
                dataKey="compareValue"
                name="compareValue"
                stroke={compareConfig.color}
                strokeWidth={2}
                strokeDasharray="5 5"
                fillOpacity={0}
                activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff', fill: compareConfig.color }}
                animationDuration={1000}
              />
            )}

          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
