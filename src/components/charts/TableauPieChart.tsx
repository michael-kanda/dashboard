// src/components/charts/TableauPieChart.tsx
'use client';

import React, { useMemo, useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  PieLabelRenderProps,
} from 'recharts';
import { ChartEntry } from '@/lib/dashboard-shared';
import { cn } from '@/lib/utils';
import { ExclamationTriangleFill, GraphUp, CheckCircleFill } from 'react-bootstrap-icons'; 
import NoDataState from '@/components/NoDataState';

// Farben definieren
const KPI_COLORS = [
  '#3b82f6', // Blue
  '#8b5cf6', // Purple
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ec4899', // Pink
  '#6366f1', // Indigo
  '#06b6d4', // Cyan
];

const LIGHT_COLORS = ['#f59e0b', '#06b6d4', '#10b981', '#fcd34d'];

// Hilfsfunktion für Datumsbereich-Anzeige
const getDateRangeLabel = (dateRange?: string): string => {
  if (!dateRange) return '';
  
  const today = new Date();
  const formatDate = (date: Date) => date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  
  let startDate: Date;
  let endDate = today;
  
  switch (dateRange) {
    case '7d':
      startDate = new Date(today);
      startDate.setDate(today.getDate() - 7);
      break;
    case '28d':
    case '30d':
      startDate = new Date(today);
      startDate.setDate(today.getDate() - (dateRange === '30d' ? 30 : 28));
      break;
    case '3m':
    case '90d':
      startDate = new Date(today);
      startDate.setMonth(today.getMonth() - 3);
      break;
    case '6m':
      startDate = new Date(today);
      startDate.setMonth(today.getMonth() - 6);
      break;
    case '12m':
      startDate = new Date(today);
      startDate.setFullYear(today.getFullYear() - 1);
      break;
    case '18m':
      startDate = new Date(today);
      startDate.setMonth(today.getMonth() - 18);
      break;
    case '24m':
      startDate = new Date(today);
      startDate.setFullYear(today.getFullYear() - 2);
      break;
    default:
      startDate = new Date(today);
      startDate.setDate(today.getDate() - 30);
  }
  
  return `${formatDate(startDate)} - ${formatDate(endDate)}`;
};

interface TableauPieChartProps {
  data?: ChartEntry[];
  title: string;
  isLoading?: boolean;
  className?: string;
  error?: string | null;
  dateRange?: string;
}

interface TooltipPayload {
  payload: ChartEntry;
  percent?: number;
  value: number;
  fill?: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
  totalValue?: number; // ✅ NEU: Gesamt-Wert für manuelle %-Berechnung
}

const CustomTooltip = ({ active, payload, totalValue }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    
    // ✅ FIX: Prozentsatz sicher selbst berechnen
    let percentValue = 0;
    if (totalValue && totalValue > 0) {
      percentValue = (data.value / totalValue) * 100;
    } else if (typeof payload[0].percent === 'number') {
      // Fallback auf Recharts Wert (falls vorhanden)
      percentValue = payload[0].percent * 100;
    }
    
    const color = payload[0].fill || data.fill;

    return (
      <div className="bg-surface px-3 py-2 rounded-lg shadow-xl border border-border min-w-[160px]">
        {/* Header */}
        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-border-subtle">
          <div 
            className="w-2.5 h-2.5 rounded-full shadow-sm" 
            style={{ backgroundColor: color }}
          />
          <span className="text-sm font-semibold text-body">{data.name}</span>
        </div>

        {/* Standard Werte */}
        <div className="flex justify-between items-center mb-1 gap-4">
          <span className="text-xs text-muted">Anteil:</span>
          <span className="text-xs font-bold text-heading">{percentValue.toFixed(1)}%</span>
        </div>
        <div className="flex justify-between items-center mb-2 gap-4">
          <span className="text-xs text-muted">Sitzungen:</span>
          <span className="text-sm font-bold text-heading">
            {new Intl.NumberFormat('de-DE').format(data.value)}
          </span>
        </div>

        {/* Footer Bereich für Extra Metrics */}
        <div className="mt-2 pt-2 border-t border-border-subtle bg-surface-secondary -mx-3 px-3 py-1 space-y-1.5">
          
          {/* 1. Interaktionsrate */}
          {data.subValue && (
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-1.5">
                <GraphUp size={11} className="text-purple-500" />
                <span className="text-[11px] font-medium text-secondary">{data.subLabel}:</span>
              </div>
              <span className="text-[11px] font-bold text-purple-700">
                {data.subValue}
              </span>
            </div>
          )}

          {/* 2. Conversions */}
          {data.subValue2 !== undefined && (
             <div className="flex justify-between items-center">
              <div className="flex items-center gap-1.5">
                <CheckCircleFill size={11} className="text-emerald-600" />
                <span className="text-[11px] font-medium text-secondary">{data.subLabel2}:</span>
              </div>
              <span className="text-[11px] font-bold text-emerald-700">
                {new Intl.NumberFormat('de-DE').format(data.subValue2)}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }
  return null;
};

const renderCustomLabel = (props: PieLabelRenderProps & { index?: number }) => {
  const { cx, cy, midAngle, innerRadius, outerRadius, percent, index } = props;

  if (typeof midAngle !== 'number') return null;
  if ((percent || 0) < 0.05) return null;

  const RADIAN = Math.PI / 180;
  const radius = Number(innerRadius) + (Number(outerRadius) - Number(innerRadius)) * 0.5;
  const x = Number(cx) + radius * Math.cos(-midAngle * RADIAN);
  const y = Number(cy) + radius * Math.sin(-midAngle * RADIAN);

  const fillColor = (typeof index === 'number') ? KPI_COLORS[index % KPI_COLORS.length] : '#000';
  const textColor = LIGHT_COLORS.includes(fillColor) ? '#0f172a' : '#ffffff';

  return (
    <text 
      x={x} 
      y={y} 
      fill={textColor} 
      textAnchor="middle" 
      dominantBaseline="central"
      className="text-[11px] font-bold pointer-events-none"
      style={{ textShadow: textColor === '#ffffff' ? '0px 0px 2px rgba(0,0,0,0.3)' : 'none' }}
    >
      {`${((percent || 0) * 100).toFixed(0)}%`}
    </text>
  );
};

export default function TableauPieChart({
  data,
  title,
  isLoading,
  className,
  error,
  dateRange
}: TableauPieChartProps) {

  // ✅ FIX: Datum nur Client-seitig berechnen um Hydration-Mismatch zu vermeiden
  const [dateLabel, setDateLabel] = useState<string>('');
  
  useEffect(() => {
    setDateLabel(getDateRangeLabel(dateRange));
  }, [dateRange]);

  const chartData = useMemo(() => {
    if (!data) return [];
    const validData = data.filter(d => d.value > 0);
    return validData.map((entry, index) => ({
      ...entry,
      fill: KPI_COLORS[index % KPI_COLORS.length]
    }));
  }, [data]);

  // ✅ NEU: Gesamtwert berechnen für %-Berechnung im Tooltip
  const totalValue = useMemo(() => {
    return chartData.reduce((acc, curr) => acc + curr.value, 0);
  }, [chartData]);

  if (isLoading) {
    return (
      <div className={cn('dashboard-widget-surface rounded-lg p-6 flex flex-col h-[350px] animate-pulse', className)}>
        <div className="h-6 bg-surface-tertiary rounded w-1/3 mb-4"></div>
        <div className="flex-grow flex items-center justify-center">
          <div className="w-48 h-48 bg-surface-tertiary rounded-full"></div>
        </div>
      </div>
    );
  }

  if (error) {
     return (
      <div className={cn('dashboard-widget-surface rounded-lg p-6 flex flex-col h-[350px]', className)}>
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-heading">{title}</h3>
          <div className="mt-1 h-[12px] max-w-[220px]" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 12" width="100%" height="12">
              <defs>
                <linearGradient id="google-clean-gradient-pie-error" x1="0" y1="0" x2="1" y2="0">
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
              <rect width="100%" height="12" rx="6" fill="url(#google-clean-gradient-pie-error)" />
            </svg>
          </div>
        </div>
        <div className="flex-grow flex flex-col items-center justify-center text-red-500 gap-2">
          <ExclamationTriangleFill size={24} />
          <p className="text-sm font-medium text-center">{error}</p>
        </div>
      </div>
    );
  }

  if (!chartData || chartData.length === 0) {
    return (
      <div className={cn('dashboard-widget-surface rounded-lg p-6 flex flex-col h-[350px]', className)}>
        <div className="mb-4 self-start">
          <h3 className="text-lg font-semibold text-heading">{title}</h3>
          <div className="mt-1 h-[12px] max-w-[220px]" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 12" width="100%" height="12">
              <defs>
                <linearGradient id="google-clean-gradient-pie-empty" x1="0" y1="0" x2="1" y2="0">
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
              <rect width="100%" height="12" rx="6" fill="url(#google-clean-gradient-pie-empty)" />
            </svg>
          </div>
        </div>
        <div className="flex-grow">
           <NoDataState message="Keine Daten für diesen Zeitraum" />
        </div>
      </div>
    );
  }

  return (
    <div className={cn('dashboard-widget-surface rounded-lg p-6 flex flex-col h-[350px] transition-shadow', className)}>
      <div className="mb-1 flex-shrink-0">
        <h3 className="text-lg font-semibold text-heading">{title}</h3>
        <div className="mt-1 h-[12px] max-w-[220px]" aria-hidden="true">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 12" width="100%" height="12">
            <defs>
              <linearGradient id="google-clean-gradient-pie-default" x1="0" y1="0" x2="1" y2="0">
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
            <rect width="100%" height="12" rx="6" fill="url(#google-clean-gradient-pie-default)" />
          </svg>
        </div>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted mb-2 flex-shrink-0">
        <span className="bg-surface-tertiary px-1.5 py-0.5 rounded text-secondary font-medium">Quelle: GA4</span>
        {dateLabel && (
          <>
            <span className="text-faint">•</span>
            <span>{dateLabel}</span>
          </>
        )}
      </div>
      <div className="flex-grow min-h-0 relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={45} 
              outerRadius={90}
              paddingAngle={2} 
              labelLine={false}
              label={renderCustomLabel}
            >
              {chartData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.fill} 
                  stroke="var(--dp-bg-primary)" 
                  strokeWidth={2} 
                />
              ))}
            </Pie>
            {/* ✅ FIX: totalValue an Tooltip übergeben */}
            <Tooltip content={<CustomTooltip totalValue={totalValue} />} />
            <Legend 
              verticalAlign="bottom" 
              height={36} 
              iconType="circle"
              formatter={(value) => <span className="text-xs text-secondary font-medium ml-1">{value}</span>}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
