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
import type { DailyWeather, WeatherIcon } from '@/lib/weather';

// --- KONFIGURATION ---
const KPI_CONFIG: Record<string, { label: string; color: string; gradientId: string }> = {
  impressions: { label: 'Impressionen', color: '#8b5cf6', gradientId: 'gradPurple' }, 
  clicks: { label: 'Google Klicks', color: '#3b82f6', gradientId: 'gradBlue' },       
  newUsers: { label: 'Neue Besucher', color: '#6366f1', gradientId: 'gradIndigo' }, 
  totalUsers: { label: 'Besucher', color: '#0ea5e9', gradientId: 'gradSky' },     
  sessions: { label: 'Sessions', color: '#06b6d4', gradientId: 'gradCyan' },       
  aiTraffic: { label: 'KI-Traffic', color: '#7c3aed', gradientId: 'gradAi' },
  engagementRate: { label: 'Interaktionsrate', color: '#ec4899', gradientId: 'gradPink' },
  conversions: { label: 'Conversions', color: '#10b981', gradientId: 'gradEmerald' },   
  avgEngagementTime: { label: 'Ø Verweildauer', color: '#f59e0b', gradientId: 'gradAmber' },
  bounceRate: { label: 'Absprungrate', color: '#f43f5e', gradientId: 'gradRose' },
  paidSearch: { label: 'Paid Search', color: '#14b8a6', gradientId: 'gradTeal' },
};

const WEEKDAY_SHORT: Record<number, string> = {
  0: 'So', 1: 'Mo', 2: 'Di', 3: 'Mi', 4: 'Do', 5: 'Fr', 6: 'Sa'
};

// --- INLINE SVG ICONS (14x14, stroke-based, passend zum Dashboard) ---
const WeatherSvgIcon = ({ type }: { type: WeatherIcon }) => {
  const size = 14;
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

  switch (type) {
    case 'sun':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      );
    case 'partly-cloudy':
      return (
        <svg {...common}>
          <path d="M12 2v2M4.93 4.93l1.41 1.41M20 12h2M17.66 17.66l1.41 1.41M2 12h2M6.34 17.66l-1.41 1.41M17.07 4.93l1.41-1.41" />
          <circle cx="12" cy="10" r="4" />
          <path d="M8 16a5 5 0 0 1 8.54-3.54A4 4 0 0 1 20 16H8z" fill="currentColor" fillOpacity="0.1" />
        </svg>
      );
    case 'cloudy':
      return (
        <svg {...common}>
          <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
        </svg>
      );
    case 'fog':
      return (
        <svg {...common}>
          <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" opacity="0.4" />
          <line x1="3" y1="20" x2="21" y2="20" /><line x1="3" y1="17" x2="21" y2="17" />
        </svg>
      );
    case 'rain':
      return (
        <svg {...common}>
          <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
          <line x1="8" y1="21" x2="8" y2="23" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="16" y1="21" x2="16" y2="23" />
        </svg>
      );
    case 'snow':
      return (
        <svg {...common}>
          <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
          <line x1="8" y1="22" x2="8.01" y2="22" strokeWidth="3" /><line x1="12" y1="22" x2="12.01" y2="22" strokeWidth="3" /><line x1="16" y1="22" x2="16.01" y2="22" strokeWidth="3" />
        </svg>
      );
    case 'thunderstorm':
      return (
        <svg {...common}>
          <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
          <polyline points="13 16 11 21 15 21 13 24" fill="currentColor" fillOpacity="0.2" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
        </svg>
      );
  }
};

const HolidayIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
    <path d="M12 14l-2 4h4l-2-4" fill="currentColor" fillOpacity="0.15" />
  </svg>
);

// (FlagDot entfernt – wir nutzen einfache Text-Labels)

// --- Props & Helpers ---

interface KpiTrendChartProps {
  activeKpi: ActiveKpi | string;
  onKpiChange: (kpi: string) => void;
  allChartData?: Record<string, ChartPoint[]>;
  weatherData?: Record<string, DailyWeather>;
  isLoading?: boolean;
  className?: string;
}

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

// --- CUSTOM TOOLTIP ---

const CustomTooltip = ({ active, payload, label, kpi1, kpi2, holidayMap, weatherData }: any) => {
  if (active && payload && payload.length) {
    const dateObj = label ? new Date(label) : null;
    const dateLabel = dateObj 
      ? format(dateObj, 'EEEE, dd. MMMM yyyy', { locale: de }) 
      : '';
    
    const dateKey = dateObj ? dateObj.toISOString().split('T')[0] : '';
    const holiday: HolidayInfo | undefined = holidayMap?.get(dateKey);
    const weather: DailyWeather | undefined = weatherData?.[dateKey];
    
    return (
      <div className="bg-surface px-4 py-3 rounded-xl shadow-xl border border-border text-sm z-50 min-w-[220px] max-w-[300px]">
        {/* Datum */}
        <p className="text-faint font-medium text-xs tracking-wide uppercase mb-2">
          {dateLabel}
        </p>
        
        {/* Wetter & Feiertag — kompakte Zeile */}
        {(weather || holiday) && (
          <div className="flex items-center gap-3 mb-2.5 pb-2.5 border-b border-border-subtle">
            {weather && (
              <div className="flex items-center gap-1.5 text-secondary">
                <WeatherSvgIcon type={weather.icon} />
                <span className="text-xs font-medium text-body">
                  {weather.tempMax}°<span className="text-faint mx-0.5">/</span>{weather.tempMin}°
                </span>
              </div>
            )}
            
            {holiday && (
              <div className="flex items-center gap-1.5 text-secondary">
                <HolidayIcon />
                <span className="text-xs font-medium text-body truncate max-w-[130px]">
                  {holiday.name}
                </span>
                <span className="text-[10px] font-semibold text-faint tracking-wide ml-1">
                  {holiday.countries.join(' · ')}
                </span>
              </div>
            )}
          </div>
        )}
        
        {/* KPI-Werte */}
        {payload.map((entry: any, index: number) => {
          const kpiKey = entry.dataKey === 'value' ? kpi1 : kpi2;
          const conf = KPI_CONFIG[kpiKey] || { label: kpiKey, color: '#888' };
          
          return (
            <div key={index} className="flex items-center justify-between gap-4 mb-1.5 last:mb-0">
              <div className="flex items-center gap-2">
                <div 
                  className="w-2 h-2 rounded-full shrink-0" 
                  style={{ backgroundColor: entry.stroke || conf.color }}
                />
                <span className="text-secondary text-xs">{conf.label}</span>
              </div>
              <span className="font-semibold text-heading text-sm tabular-nums">
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

// --- MAIN COMPONENT ---

export default function KpiTrendChart({
  activeKpi,
  onKpiChange,
  allChartData,
  weatherData,
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

  const formatXAxisTick = (date: string) => {
    const d = new Date(date);
    const weekday = WEEKDAY_SHORT[d.getDay()];
    const dayMonth = format(d, 'd.MMM', { locale: de });
    return `${weekday} ${dayMonth}`;
  };

  if (isLoading) {
    return (
      <div className={cn("dashboard-widget-surface rounded-lg p-6 h-[400px] animate-pulse flex items-center justify-center", className)}>
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 bg-surface-tertiary rounded-full animate-bounce"></div>
          <span className="text-faint text-sm">Lade Trend-Daten...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("dashboard-widget-surface rounded-lg p-6 transition-all", className)}>
      
      {/* HEADER & CONTROLS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-lg font-semibold text-heading">
            Verlauf & Analyse
          </h3>
          <div className="mt-1 h-[12px] max-w-[220px]" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 12" width="100%" height="12">
              <defs>
                <linearGradient id="google-clean-gradient-verlauf" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#4285F4" />
                  <stop offset="25%" stopColor="#4285F4" />
                  <stop offset="25%" stopColor="#EA4335" />
                  <stop offset="50%" stopColor="#EA4335" />
                  <stop offset="50%" stopColor="#FBBC05" />
                  <stop offset="75%" stopColor="#FBBC05" />
                  <stop offset="75%" stopColor="#34A853" />
                  <stop offset="100%" stopColor="#34A853" />
                </linearGradient>
              </defs>
              <rect width="100%" height="12" rx="6" fill="url(#google-clean-gradient-verlauf)" />
            </svg>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative group">
            <select
              value={activeKpi}
              onChange={(e) => onKpiChange(e.target.value)}
              className="appearance-none bg-surface-secondary hover:bg-surface border border-border hover:border-border text-body text-sm rounded-md focus:ring-blue-500 focus:border-blue-500 block w-full pl-3 pr-10 py-2 cursor-pointer transition-colors"
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
              className="appearance-none bg-surface border border-border hover:border-border text-secondary text-sm rounded-md focus:ring-purple-500 focus:border-purple-500 block w-full pl-9 pr-8 py-2 cursor-pointer transition-colors"
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
            
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--dp-chart-grid)" />
            
            <XAxis
              dataKey="date"
              tickFormatter={formatXAxisTick}
              tick={{ fontSize: 11, fill: 'var(--dp-chart-text)' }}
              axisLine={false}
              tickLine={false}
              dy={10}
              minTickGap={50}
            />
            
            <YAxis
              yAxisId="left"
              tickFormatter={(val) => formatYAxis(val, activeKpi)}
              tick={{ fontSize: 11, fill: 'var(--dp-chart-text)' }}
              axisLine={false}
              tickLine={false}
              dx={-10}
            />

            {compareKpi !== 'none' && (
              <YAxis
                yAxisId="right"
                orientation="right"
                tickFormatter={(val) => formatYAxis(val, compareKpi)}
                tick={{ fontSize: 11, fill: 'var(--dp-chart-text)' }}
                axisLine={false}
                tickLine={false}
                dx={10}
              />
            )}

            <Tooltip 
              content={
                <CustomTooltip 
                  kpi1={activeKpi} 
                  kpi2={compareKpi !== 'none' ? compareKpi : undefined}
                  holidayMap={holidayMap}
                  weatherData={weatherData}
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
                       <div key={index} className="flex items-center gap-2 text-xs font-medium text-secondary bg-surface-secondary px-2 py-1 rounded-full border border-border-subtle">
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
