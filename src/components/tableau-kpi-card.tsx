// src/components/tableau-kpi-card.tsx
'use client';

import React, { useMemo } from 'react';
import { ExclamationTriangleFill, InfoCircle } from 'react-bootstrap-icons';
import { ResponsiveContainer, AreaChart, Area, YAxis } from 'recharts';
import { ChartPoint } from '@/lib/dashboard-shared';

interface TableauKpiCardProps {
  title: string;
  subtitle?: string; 
  value: number;
  valueLabel?: string; 
  change?: number;
  changeLabel?: string; 
  isLoading?: boolean;
  data?: ChartPoint[];
  color?: string;
  error?: string | null;
  className?: string;
  barComparison?: {
    current: number;
    previous: number;
  };
  goalMet?: boolean; 
  formatValue?: (value: number) => string; 
  description?: string;
}

export default function TableauKpiCard({
  title,
  subtitle = 'vs Vorjahr',
  value,
  valueLabel = 'Aktueller Monat',
  change,
  changeLabel = 'Veränderung',
  isLoading = false,
  data,
  color = '#3b82f6',
  error = null,
  className = '',
  barComparison,
  goalMet,
  formatValue = (v) => v.toLocaleString('de-DE'),
  description
}: TableauKpiCardProps) {

  const isPositive = change !== undefined && change >= 0;
  
  // ✅ FIX: Eindeutige ID mit Timestamp/Random für garantierte Einzigartigkeit
  const uniqueId = useMemo(() => {
    const sanitizedTitle = title.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    return `tableau-grad-${sanitizedTitle}-${randomSuffix}`;
  }, [title]);

  // ✅ FIX: Berechne min/max mit Puffer für korrekte Skalierung
  const yDomain = useMemo(() => {
    if (!data || data.length === 0) return [0, 100];
    
    const values = data.map(d => d.value).filter(v => typeof v === 'number' && !isNaN(v));
    if (values.length === 0) return [0, 100];
    
    const min = Math.min(...values);
    const max = Math.max(...values);
    
    // Falls alle Werte gleich sind, kleinen Bereich erstellen
    if (min === max) {
      if (min === 0) return [0, 1];
      return [min * 0.9, max * 1.1];
    }
    
    // 10% Puffer oben und unten hinzufügen
    const padding = (max - min) * 0.15;
    return [
      Math.max(0, min - padding), // Nicht unter 0 gehen
      max + padding
    ];
  }, [data]);

  const InfoIcon = ({ iconClass = "text-gray-400 hover:text-blue-600" }: { iconClass?: string }) => {
    if (!description) return null;
    return (
      <div className="group relative inline-flex items-center align-middle z-20">
        <InfoCircle size={14} className={`${iconClass} cursor-help transition-colors`} />
        <div className="absolute left-0 bottom-full mb-2 w-52 p-3 
                        bg-gray-800 text-white text-xs leading-snug rounded-md shadow-xl 
                        opacity-0 invisible group-hover:opacity-100 group-hover:visible 
                        transition-all duration-200 pointer-events-none text-center font-normal normal-case z-50">
          {description}
          <div className="absolute top-full left-4 -translate-x-1/2 border-4 border-transparent border-t-gray-800"></div>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className={`bg-white dark:bg-gray-900/80 rounded-xl border border-gray-200 dark:border-gray-700/50 p-5 ${className}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/3"></div>
          <div className="h-3 bg-gray-200 rounded w-1/2"></div>
          <div className="h-8 bg-gray-200 rounded w-2/3 mt-4"></div>
          <div className="h-16 bg-gray-100 rounded w-full mt-2"></div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white dark:bg-gray-900/80 rounded-xl border border-gray-200 dark:border-gray-700/50 p-5 transition-all duration-300 hover:shadow-lg hover:border-gray-300 dark:hover:border-gray-600 relative overflow-visible flex flex-col ${className}`}>
      
      {/* Hintergrund-Balken */}
      {barComparison && (
        <div 
          className="absolute left-0 top-0 bottom-0 opacity-15 pointer-events-none rounded-l-xl"
          style={{ 
            width: `${Math.min((barComparison.current / Math.max(barComparison.current, barComparison.previous)) * 100, 100)}%`,
            backgroundColor: color 
          }}
        />
      )}

      {/* Content Container */}
      <div className="relative z-10 flex flex-col h-full">
        
        {/* --- OBERER BEREICH (Fallback) --- */}
        {(error || !barComparison) && (
          <div className="mb-4">
            <div className="flex items-center mb-1">
              <div className="mr-2">
                <InfoIcon />
              </div>
              <h3 className="text-lg font-bold text-gray-600 tracking-tight leading-none">
                {title}
              </h3>
            </div>
          </div>
        )}

        {/* Goal Indicator */}
        {goalMet !== undefined && (
          <div className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${goalMet ? 'text-green-600' : 'text-red-600'}`}>
            {goalMet ? 'Ziel erreicht' : 'Ziel verfehlt'}
          </div>
        )}

        {/* --- MITTE: Balken mit Titel (Weiß) & Wert --- */}
        {barComparison && !error && (
          <div className="flex items-center gap-2 mb-3">
            <div 
              className="flex-1 h-7 rounded-sm flex items-center justify-between pl-2 pr-2 text-white text-sm font-bold shadow-sm"
              style={{ backgroundColor: color }}
            >
              {/* Titel LINKS im Balken */}
              <div className="flex items-center">
                <div className="mr-2 flex items-center">
                   <InfoIcon iconClass="text-white opacity-80 hover:opacity-100 hover:text-white" />
                </div>
                <span>{title}</span>
              </div>
              
              {/* Wert RECHTS im Balken */}
              <span>{formatValue(barComparison.current)}</span>
            </div>
            
            <div className="w-px h-7 bg-gray-300"></div>
            
            <div className="w-auto min-w-[3rem] text-right text-sm text-gray-500 font-medium">
              {formatValue(barComparison.previous)}
            </div>
          </div>
        )}

        {/* --- CONTENT ODER ERROR --- */}
        {error ? (
          <div className="flex flex-col justify-center py-4">
            <div className="flex items-center gap-2 text-red-600 mb-1">
              <ExclamationTriangleFill size={16} />
              <span className="text-sm font-semibold">Fehler</span>
            </div>
            <p className="text-xs text-gray-500">{error}</p>
          </div>
        ) : (
          <div className="flex-grow flex flex-col justify-end">
            <div className="mb-2">
              <div className="text-3xl font-extrabold text-gray-900 tracking-tight">
                {formatValue(value)}
              </div>
              <div className="text-xs text-gray-400 font-medium uppercase tracking-wide">
                {valueLabel}
              </div>
            </div>

            {change !== undefined && (
              <div className="flex items-center gap-2 mb-4">
                <div className={`text-lg font-bold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                  {isPositive ? '+' : ''}{change.toFixed(1)}%
                </div>
                <div className="text-xs text-gray-400 uppercase tracking-wide font-medium">
                  {changeLabel}
                </div>
              </div>
            )}

            {/* ✅ FIX: Chart mit korrekter Y-Achsen-Skalierung */}
            <div className="h-[65px] -mx-2 opacity-90 hover:opacity-100 transition-opacity">
              {data && data.length > 1 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart 
                    data={data}
                    margin={{ top: 4, right: 4, bottom: 4, left: 4 }}
                  >
                    <defs>
                      <linearGradient id={uniqueId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={color} stopOpacity={0.25} />
                        <stop offset="100%" stopColor={color} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    
                    {/* ✅ FIX: Versteckte Y-Achse mit korrekter Domain */}
                    <YAxis 
                      domain={yDomain}
                      hide={true}
                      allowDataOverflow={false}
                    />
                    
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke={color}
                      strokeWidth={2.5}
                      fill={`url(#${uniqueId})`}
                      animationDuration={1000}
                      isAnimationActive={true}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-end pb-1 px-2">
                  <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full" 
                      style={{ width: '50%', backgroundColor: color, opacity: 0.3 }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- FOOTER --- */}
        <div className="mt-3 pt-2 border-t border-gray-100 dark:border-gray-700/50 text-xs text-gray-400 dark:text-gray-500 text-left font-medium">
          {subtitle}
        </div>

      </div>
    </div>
  );
}
