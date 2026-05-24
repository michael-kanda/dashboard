// src/components/AiTrafficModelTrendChart.tsx
'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { ArrowLeftRight, Cpu, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AiTrafficExtendedData } from '@/lib/ai-traffic-extended-v2';

// ============================================================================
// KI-MODELL KONFIGURATION (Farben + Labels, zentral)
// ============================================================================

interface ModelConfig {
  label: string;
  color: string;
  gradientId: string;
}

const MODEL_CONFIG: Record<string, ModelConfig> = {
  'chatgpt.com':            { label: 'ChatGPT',     color: '#10a37f', gradientId: 'gradChatgpt' },
  'claude.ai':              { label: 'Claude',      color: '#d97706', gradientId: 'gradClaude' },
  'perplexity.ai':          { label: 'Perplexity',  color: '#6366f1', gradientId: 'gradPerplexity' },
  'gemini.google.com':      { label: 'Gemini',      color: '#4285f4', gradientId: 'gradGemini' },
  'copilot.microsoft.com':  { label: 'Copilot',     color: '#00a4ef', gradientId: 'gradCopilot' },
  'you.com':                { label: 'You.com',     color: '#8b5cf6', gradientId: 'gradYou' },
  'poe.com':                { label: 'Poe',         color: '#7c3aed', gradientId: 'gradPoe' },
  'character.ai':           { label: 'Character.AI',color: '#ec4899', gradientId: 'gradCharacter' },
};

const FALLBACK_CONFIG: ModelConfig = { label: 'Sonstige', color: '#6b7280', gradientId: 'gradFallback' };

function getModelConfig(source: string): ModelConfig {
  return MODEL_CONFIG[source] || { ...FALLBACK_CONFIG, label: source };
}

const WEEKDAY_SHORT: Record<number, string> = {
  0: 'So', 1: 'Mo', 2: 'Di', 3: 'Mi', 4: 'Do', 5: 'Fr', 6: 'Sa',
};

// ============================================================================
// CUSTOM TOOLTIP
// ============================================================================

interface TooltipPayload {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number; stroke?: string }>;
  label?: string;
  modelPrimary: string;
  modelCompare: string | 'none';
}

const CustomTooltip: React.FC<TooltipPayload> = ({ active, payload, label, modelPrimary, modelCompare }) => {
  if (!active || !payload || !payload.length) return null;

  const dateObj = label ? new Date(label) : null;
  const dateLabel = dateObj ? format(dateObj, 'EEEE, dd. MMMM yyyy', { locale: de }) : '';

  return (
    <div className="bg-surface px-4 py-3 rounded-xl shadow-xl border border-border text-sm z-50 min-w-[220px] max-w-[300px]">
      <p className="text-faint font-medium text-xs tracking-wide uppercase mb-2">
        {dateLabel}
      </p>
      {payload.map((entry, index) => {
        const modelKey = entry.dataKey === 'primary' ? modelPrimary : modelCompare;
        if (!modelKey || modelKey === 'none') return null;
        const conf = getModelConfig(modelKey);
        return (
          <div key={index} className="flex items-center justify-between gap-4 mb-1.5 last:mb-0">
            <div className="flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: entry.stroke || conf.color }}
              />
              <span className="text-secondary text-xs">{conf.label}</span>
            </div>
            <span className="text-heading font-semibold text-xs tabular-nums">
              {new Intl.NumberFormat('de-DE').format(entry.value)}
            </span>
          </div>
        );
      })}
    </div>
  );
};

// ============================================================================
// HAUPTKOMPONENTE
// ============================================================================

interface AiTrafficModelTrendChartProps {
  projectId?: string;
  dateRange?: string;
  className?: string;
}

export default function AiTrafficModelTrendChart({
  projectId,
  dateRange = '30d',
  className,
}: AiTrafficModelTrendChartProps) {
  const [data, setData] = useState<AiTrafficExtendedData | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);

  // Modell-Auswahl: Default = stärkstes Modell, Vergleich aus
  const [primaryModel, setPrimaryModel] = useState<string>('');
  const [compareModel, setCompareModel] = useState<string>('none');

  // -------- FETCH ----------------------------------------------------------
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(undefined);
    try {
      const params = new URLSearchParams({ dateRange });
      if (projectId) params.set('projectId', projectId);
      const response = await fetch(`/api/ai-traffic-detail-v2?${params.toString()}`);

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error(`Server lieferte kein JSON (Status: ${response.status})`);
      }
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
      setData(result.data || undefined);
    } catch (err) {
      console.error('[AiTrafficModelTrendChart] Fetch Error:', err);
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
    } finally {
      setIsLoading(false);
    }
  }, [projectId, dateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // -------- VERFÜGBARE MODELLE (sortiert nach Gesamt-Sessions) -------------
  const availableModels = useMemo(() => {
    if (!data?.trendBySource?.length) return [];
    const totals = new Map<string, number>();
    for (const row of data.trendBySource) {
      totals.set(row.source, (totals.get(row.source) || 0) + row.sessions);
    }
    return Array.from(totals.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([source]) => source);
  }, [data]);

  // Default-Modell setzen (stärkstes), sobald Daten da sind
  useEffect(() => {
    if (!primaryModel && availableModels.length > 0) {
      setPrimaryModel(availableModels[0]);
    }
  }, [availableModels, primaryModel]);

  // -------- CHART-DATA (long → pivot) --------------------------------------
  const chartData = useMemo(() => {
    if (!data?.trendBySource?.length || !primaryModel) return [];

    const byDate = new Map<string, { primary: number; compare: number }>();

    // Alle Tage aus dem Trend abdecken (auch wenn ein Modell an dem Tag 0 hatte)
    for (const day of data.trend) {
      byDate.set(day.date, { primary: 0, compare: 0 });
    }
    for (const row of data.trendBySource) {
      const point = byDate.get(row.date) || { primary: 0, compare: 0 };
      if (row.source === primaryModel) point.primary += row.sessions;
      if (compareModel !== 'none' && row.source === compareModel) point.compare += row.sessions;
      byDate.set(row.date, point);
    }
    return Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, vals]) => ({ date, ...vals }));
  }, [data, primaryModel, compareModel]);

  // -------- FORMATTERS -----------------------------------------------------
  const formatYAxis = (val: number) => {
    if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `${(val / 1000).toFixed(0)}k`;
    return String(val);
  };

  const formatXAxisTick = (date: string) => {
    const d = new Date(date);
    const weekday = WEEKDAY_SHORT[d.getDay()];
    const dayMonth = format(d, 'd.MMM', { locale: de });
    return `${weekday} ${dayMonth}`;
  };

  // -------- RENDER ---------------------------------------------------------
  const primaryConfig = primaryModel ? getModelConfig(primaryModel) : null;
  const compareConfig = compareModel !== 'none' ? getModelConfig(compareModel) : null;

  if (isLoading) {
    return (
      <div className={cn('dashboard-widget-surface rounded-lg p-4 h-[400px] animate-pulse flex items-center justify-center', className)}>
        <span className="text-faint text-sm">Lade KI-Trend-Daten…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('dashboard-widget-surface rounded-lg p-4', className)}>
        <p className="text-sm text-red-600 dark:text-red-400">
          Fehler beim Laden der KI-Trend-Daten: {error}
        </p>
      </div>
    );
  }

  if (availableModels.length === 0) {
    return (
      <div className={cn('dashboard-widget-surface rounded-lg p-4 h-[200px] flex items-center justify-center', className)}>
        <span className="text-xs text-faint italic">Keine KI-Trend-Daten verfügbar</span>
      </div>
    );
  }

  return (
    <div className={cn('transition-all', className)}>
      {/* HEADER & CONTROLS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Cpu className="text-purple-600 dark:text-purple-400 w-4 h-4" />
          <h4 className="text-sm font-semibold text-heading">Sitzungs-Trend nach KI-Modell</h4>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          {/* Primary Model Picker */}
          <div className="relative group">
            <select
              value={primaryModel}
              onChange={(e) => setPrimaryModel(e.target.value)}
              className="appearance-none bg-surface-secondary hover:bg-surface border border-border text-body text-xs rounded-md focus:ring-purple-500 focus:border-purple-500 block w-full pl-3 pr-9 py-1.5 cursor-pointer transition-colors"
            >
              {availableModels.map((m) => (
                <option key={m} value={m}>{getModelConfig(m).label}</option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-faint group-hover:text-purple-500 transition-colors">
              <Filter size={11} />
            </div>
          </div>

          {/* Compare Picker */}
          <div className="relative group">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5 text-faint">
              <ArrowLeftRight size={11} />
            </div>
            <select
              value={compareModel}
              onChange={(e) => setCompareModel(e.target.value)}
              className="appearance-none bg-surface border border-border text-secondary text-xs rounded-md focus:ring-purple-500 focus:border-purple-500 block w-full pl-7 pr-7 py-1.5 cursor-pointer transition-colors"
            >
              <option value="none">Kein Vergleich</option>
              {availableModels
                .filter((m) => m !== primaryModel)
                .map((m) => (
                  <option key={m} value={m}>vs. {getModelConfig(m).label}</option>
                ))}
            </select>
          </div>
        </div>
      </div>

      {/* CHART */}
      <div className="h-[320px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              {availableModels.map((m) => {
                const conf = getModelConfig(m);
                return (
                  <linearGradient key={conf.gradientId} id={conf.gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={conf.color} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={conf.color} stopOpacity={0} />
                  </linearGradient>
                );
              })}
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
              tickFormatter={formatYAxis}
              tick={{ fontSize: 11, fill: 'var(--dp-chart-text)' }}
              axisLine={false}
              tickLine={false}
              dx={-10}
            />

            <Tooltip
              content={
                <CustomTooltip
                  modelPrimary={primaryModel}
                  modelCompare={compareModel}
                />
              }
            />

            <Legend
              verticalAlign="top"
              height={36}
              content={() => (
                <div className="flex flex-wrap justify-center gap-2 mb-3">
                  {primaryConfig && (
                    <div className="flex items-center gap-2 text-xs font-medium text-secondary bg-surface-secondary px-2 py-1 rounded-full border border-border-subtle">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: primaryConfig.color }} />
                      {primaryConfig.label}
                    </div>
                  )}
                  {compareConfig && (
                    <div className="flex items-center gap-2 text-xs font-medium text-secondary bg-surface-secondary px-2 py-1 rounded-full border border-border-subtle">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: compareConfig.color }} />
                      {compareConfig.label}
                    </div>
                  )}
                </div>
              )}
            />

            {primaryConfig && (
              <Area
                type="monotone"
                dataKey="primary"
                name="primary"
                stroke={primaryConfig.color}
                strokeWidth={3}
                fillOpacity={1}
                fill={`url(#${primaryConfig.gradientId})`}
                activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff', fill: primaryConfig.color }}
                animationDuration={800}
              />
            )}

            {compareConfig && (
              <Area
                type="monotone"
                dataKey="compare"
                name="compare"
                stroke={compareConfig.color}
                strokeWidth={2}
                strokeDasharray="5 5"
                fillOpacity={0}
                activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff', fill: compareConfig.color }}
                animationDuration={800}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
