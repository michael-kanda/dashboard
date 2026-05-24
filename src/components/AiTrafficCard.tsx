// src/components/AiTrafficCard.tsx
'use client';

import React, { useMemo } from 'react';
import {
  Cpu,
  TrendingUp,
  Users,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AiTrafficCardProps } from '@/types/ai-traffic';
import AiTrafficModelTrendChart from '@/components/AiTrafficModelTrendChart';

// Hilfskomponente für Änderungsindikator
const ChangeIndicator: React.FC<{ change?: number }> = ({ change }) => {
  if (!change) {
    return null;
  }
  const isPositive = change >= 0;
  const color = isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
  const Icon = isPositive ? ArrowUp : ArrowDown;

  return (
    <span className={cn('flex items-center text-xs font-medium ml-2', color)}>
      <Icon className="mr-0.5 w-3 h-3" />
      {Math.abs(change).toFixed(1)}%
    </span>
  );
};

export default function AiTrafficCard({
  totalSessions = 0,
  totalUsers = 0,
  percentage = 0,
  totalSessionsChange,
  totalUsersChange,
  trend = [],
  topAiSources = [],
  isLoading = false,
  dateRange = '30d',
  className,
  error,
  onDetailClick,
  onPromptTrackingClick,
  projectId,
}: AiTrafficCardProps) {

  const safePercentage = typeof percentage === 'number' && !isNaN(percentage) ? percentage : 0;
  const safeTotalSessions = typeof totalSessions === 'number' && !isNaN(totalSessions) ? totalSessions : 0;
  const safeTotalUsers = typeof totalUsers === 'number' && !isNaN(totalUsers) ? totalUsers : 0;
  const safeTopAiSources = Array.isArray(topAiSources) ? topAiSources : [];
  // Hinweis: trend-Prop wird nicht mehr verwendet — AiTrafficModelTrendChart holt eigene Daten
  void trend;

  // Dynamische Datumsberechnung
  const formattedDateRange = useMemo(() => {
    const endDate = new Date();
    const startDate = new Date();

    switch (dateRange) {
      case '30d':
        startDate.setDate(endDate.getDate() - 30);
        break;
      case '3m':
        startDate.setMonth(endDate.getMonth() - 3);
        break;
      case '6m':
        startDate.setMonth(endDate.getMonth() - 6);
        break;
      case '12m':
        startDate.setFullYear(endDate.getFullYear() - 1);
        break;
      default:
        startDate.setDate(endDate.getDate() - 30);
    }

    const formatDate = (date: Date) =>
      date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

    return `${formatDate(startDate)} - ${formatDate(endDate)}`;
  }, [dateRange]);

  // Ladezustand
  if (isLoading) {
    return (
      <div className={cn("dashboard-widget-surface rounded-lg p-6", className)}>
        <div className="animate-pulse">
          <div className="h-6 bg-surface-tertiary rounded w-1/3 mb-4"></div>
          <div className="h-16 bg-surface-tertiary rounded mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-surface-tertiary rounded"></div>
            <div className="h-4 bg-surface-tertiary rounded"></div>
            <div className="h-4 bg-surface-tertiary rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("dashboard-widget-surface rounded-lg p-6 flex flex-col", className)}>

      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Cpu className="text-purple-600 dark:text-purple-400 w-6 h-6" />
          <h3 className="text-lg font-semibold text-heading">KI-Traffic</h3>
        </div>
        {!error && (
          <span className="tone-pill tone-pill--soft tone--purple text-xs px-3 py-1">
            {safePercentage.toFixed(1)}%
            <span className="hidden sm:inline ml-1">Anteil</span>
          </span>
        )}
      </div>

      {/* Meta-Info: Quelle und Datum */}
      <div className="flex items-center gap-2 mb-5 text-sm">
        <span className="bg-surface-tertiary text-body px-2 py-0.5 rounded text-xs font-semibold">
          Quelle: GA4
        </span>
        <span className="text-faint text-xs">•</span>
        <span className="text-muted text-xs">
          {formattedDateRange}
        </span>
      </div>

      {/* Fehler-Zustand */}
      {error ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center my-4">
          <AlertTriangle className="text-red-500 w-8 h-8 mb-3" />
          <p className="text-sm text-red-700 dark:text-red-400 font-semibold">Fehler bei GA4-Daten</p>
          <p className="text-xs text-muted mt-1" title={error}>
            Die KI-Traffic-Daten konnten nicht geladen werden.
          </p>
        </div>
      ) : (
        // Normaler Inhalt
        <div className="flex flex-col gap-4 flex-1">

          {/* Metriken */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <p className="text-sm text-purple-700 dark:text-purple-300 font-medium">Sitzungen</p>
              </div>
              <div className="flex items-baseline">
                <p className="text-2xl font-bold text-purple-900 dark:text-purple-200">
                  {safeTotalSessions.toLocaleString('de-DE')}
                </p>
                <ChangeIndicator change={totalSessionsChange} />
              </div>
            </div>

            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <Users className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <p className="text-sm text-purple-700 dark:text-purple-300 font-medium">Nutzer</p>
              </div>
              <div className="flex items-baseline">
                <p className="text-2xl font-bold text-purple-900 dark:text-purple-200">
                  {safeTotalUsers.toLocaleString('de-DE')}
                </p>
                <ChangeIndicator change={totalUsersChange} />
              </div>
            </div>
          </div>

          {/* Top KI-Quellen */}
          <div>
            <h4 className="text-sm font-semibold text-body mb-3">Top KI-Quellen</h4>
            <div className="space-y-2">
              {safeTopAiSources.length > 0 ? (
                safeTopAiSources.map((source, index) => {
                  const sourcePercentage = typeof source.percentage === 'number' && !isNaN(source.percentage) ? source.percentage : 0;
                  const sourceSessions = typeof source.sessions === 'number' && !isNaN(source.sessions) ? source.sessions : 0;

                  return (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          index === 0 ? 'bg-purple-600' :
                          index === 1 ? 'bg-purple-500' :
                          index === 2 ? 'bg-purple-400' :
                          'bg-purple-300'
                        }`}></div>
                        <span className="text-sm text-body truncate">{source.source || 'Unbekannt'}</span>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="text-sm font-medium text-heading">
                          {sourceSessions.toLocaleString('de-DE')}
                        </span>
                        <span className="text-xs text-muted min-w-[3rem] text-right">
                          {sourcePercentage.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-muted italic">Keine KI-Traffic-Daten verfügbar</p>
              )}
            </div>
          </div>

          {/* Trend Chart pro KI-Modell (Multi-Line, im Stil von KpiTrendChart) */}
          <AiTrafficModelTrendChart
            projectId={projectId}
            dateRange={dateRange}
          />

        </div>
      )}

      {/* Footer Info-Text & Action-Buttons
       *
       * Buttons sind bewusst klar hierarchisiert:
       *  - Primary (KI-Traffic Analyse): solid lila auf weiß → Haupt-Aktion
       *  - Secondary (Prompt Tracking):  outline mit semibold-Text → optional
       */}
      <div className="mt-4 pt-4 border-t border-border-subtle flex flex-col gap-3">
        <p className="text-xs text-muted">
          KI-Traffic umfasst Besuche von bekannten KI-Bots wie ChatGPT, Claude, Perplexity und Google Gemini.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onDetailClick}
            className="w-full py-2.5 px-4 bg-purple-600 hover:bg-purple-700 dark:bg-purple-600 dark:hover:bg-purple-500 text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer"
          >
            KI-Traffic Analyse
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onPromptTrackingClick}
            disabled={!onPromptTrackingClick}
            className="w-full py-2.5 px-4 bg-transparent border-2 border-sky-500 dark:border-sky-400 text-sky-700 dark:text-sky-300 text-sm font-semibold rounded-lg hover:bg-sky-50 dark:hover:bg-sky-900/20 transition-colors flex items-center justify-center gap-1 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
          >
            Prompt Tracking
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
