// src/components/AiTrafficCard.tsx
'use client';

import React, { useMemo, useState } from 'react';
import {
  Cpu,
  TrendingUp,
  Users,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  Minus,
  Plus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AiTrafficCardProps } from '@/types/ai-traffic';
import AiTrafficModelTrendChart from '@/components/AiTrafficModelTrendChart';
import SourceMiniSparkline from '@/components/SourceMiniSparkline';
import AiTrafficAnomalyBanner from '@/components/AiTrafficAnomalyBanner';
import PromptTrackingBridge from '@/components/PromptTrackingBridge';
import { useAiTrafficExtended } from '@/hooks/useAiTrafficExtended';

// Brand-Farben für KI-Quellen-Dots (konsistent mit AiTrafficModelTrendChart)
const SOURCE_DOT_COLORS: Record<string, string> = {
  chatgpt: '#10a37f',
  claude: '#d97706',
  perplexity: '#6366f1',
  gemini: '#4285f4',
  bard: '#4285f4',
  copilot: '#00a4ef',
  bing: '#00a4ef',
  you: '#8b5cf6',
  poe: '#7c3aed',
  character: '#ec4899',
};

function getSourceDotColor(source: string): string {
  const lower = source.toLowerCase();
  for (const [key, color] of Object.entries(SOURCE_DOT_COLORS)) {
    if (lower.includes(key)) return color;
  }
  return '#9ca3af'; // Neutral grau für unbekannte Quellen
}

/** Normalisiert einen rohen Quellnamen auf den kanonischen Modell-Key. */
function normalizeSourceKey(source: string): string {
  const lower = source.toLowerCase();
  if (lower.includes('chatgpt') || lower.includes('openai')) return 'chatgpt.com';
  if (lower.includes('claude') || lower.includes('anthropic')) return 'claude.ai';
  if (lower.includes('perplexity')) return 'perplexity.ai';
  if (lower.includes('gemini') || lower.includes('bard')) return 'gemini.google.com';
  if (lower.includes('copilot') || lower.includes('bing')) return 'copilot.microsoft.com';
  if (lower.includes('you.com')) return 'you.com';
  if (lower.includes('poe')) return 'poe.com';
  if (lower.includes('character')) return 'character.ai';
  return source;
}

/** Vorperiodenwert aus Current + %-Change rückrechnen. */
function calcPreviousValue(current: number, change?: number): number | null {
  if (typeof change !== 'number' || !isFinite(change)) return null;
  if (change === -100) return null; // war 0 davor
  const previous = current / (1 + change / 100);
  return Math.round(previous);
}

// Hilfskomponente für Änderungsindikator mit Vorperiode-Tooltip
const ChangeIndicator: React.FC<{ change?: number; current: number; label: string }> = ({ change, current, label }) => {
  if (!change) {
    return null;
  }
  const isPositive = change >= 0;
  const color = isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
  const Icon = isPositive ? ArrowUp : ArrowDown;
  const previous = calcPreviousValue(current, change);

  return (
    <span
      className={cn('flex items-center text-xs font-medium ml-2 cursor-help', color)}
      title={previous !== null ? `${label} Vorperiode: ${previous.toLocaleString('de-DE')}` : undefined}
    >
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
  detailOpen = false,
  promptTrackingOpen = false,
  projectId,
  promptTracking,
  promptTrackingEnabled = true,
}: AiTrafficCardProps) {

  const safePercentage = typeof percentage === 'number' && !isNaN(percentage) ? percentage : 0;
  const safeTotalSessions = typeof totalSessions === 'number' && !isNaN(totalSessions) ? totalSessions : 0;
  const safeTotalUsers = typeof totalUsers === 'number' && !isNaN(totalUsers) ? totalUsers : 0;
  const safeTopAiSources = Array.isArray(topAiSources) ? topAiSources : [];
  // Hinweis: trend-Prop wird nicht mehr verwendet — AiTrafficModelTrendChart holt eigene Daten
  void trend;

  // Klick-State: synchronisiert Liste ↔ Trend-Chart
  const [selectedModel, setSelectedModel] = useState<string | undefined>(undefined);

  // Geteilte Extended-Daten (Hook deduped via Module-Cache)
  const { data: extendedData } = useAiTrafficExtended(projectId, dateRange);

  // Sparkline-Daten pro normalisiertem Modell-Key vorbereiten (letzte ~14 Tage)
  const sparklinesByModel = useMemo<Record<string, number[]>>(() => {
    if (!extendedData?.trendBySource?.length) return {};
    const result: Record<string, Map<string, number>> = {};
    for (const row of extendedData.trendBySource) {
      if (!result[row.source]) result[row.source] = new Map();
      const existing = result[row.source].get(row.date) || 0;
      result[row.source].set(row.date, existing + row.sessions);
    }
    const out: Record<string, number[]> = {};
    for (const [src, dayMap] of Object.entries(result)) {
      const sortedDates = Array.from(dayMap.keys()).sort();
      out[src] = sortedDates.slice(-14).map((d) => dayMap.get(d) || 0);
    }
    return out;
  }, [extendedData]);

  // Extended-Source-Daten (conversions, topLandingPage) pro normalisiertem Modell-Key
  type ExtendedSource = NonNullable<typeof extendedData>['sources'][number];
  const extendedSourceMap = useMemo<Map<string, ExtendedSource>>(() => {
    const map = new Map<string, ExtendedSource>();
    for (const src of extendedData?.sources ?? []) {
      map.set(normalizeSourceKey(src.source), src);
    }
    return map;
  }, [extendedData]);

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
      <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-heading">KI-Traffic</h3>
          <div className="mt-1 h-[12px] max-w-[220px]" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 12" width="100%" height="12">
              <defs>
                <linearGradient id="google-clean-gradient-ai-traffic" x1="0" y1="0" x2="1" y2="0">
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
              <rect width="100%" height="12" rx="6" fill="url(#google-clean-gradient-ai-traffic)" />
            </svg>
          </div>
        </div>
        {!error && (
          <span className="tone-pill tone-pill--soft tone--purple text-xs px-2.5 py-1 whitespace-nowrap flex-shrink-0">
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
        <div className="flex flex-col gap-6 flex-1">

          {/* Anomalie-Banner — nur wenn ungewöhnliche Bewegungen erkannt */}
          <AiTrafficAnomalyBanner data={extendedData} />

          {/* Metriken + Quellen (links) und Top-Fragen (rechts) im Stil der Vorlage */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">

            {/* Linke Spalte: Sitzungen + Nutzer + Top KI-Quellen */}
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-muted" />
                    <p className="text-[11px] text-muted font-medium uppercase tracking-wide">Sitzungen</p>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <p className="text-2xl font-bold text-heading tabular-nums">
                      {safeTotalSessions.toLocaleString('de-DE')}
                    </p>
                    <ChangeIndicator change={totalSessionsChange} current={safeTotalSessions} label="Sitzungen" />
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Users className="w-3.5 h-3.5 text-muted" />
                    <p className="text-[11px] text-muted font-medium uppercase tracking-wide">Nutzer</p>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <p className="text-2xl font-bold text-heading tabular-nums">
                      {safeTotalUsers.toLocaleString('de-DE')}
                    </p>
                    <ChangeIndicator change={totalUsersChange} current={safeTotalUsers} label="Nutzer" />
                  </div>
                </div>
              </div>

              {/* Top KI-Quellen */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] text-muted font-medium uppercase tracking-wide">
                    Top KI-Quellen
                  </p>
                  {selectedModel && (
                    <button
                      type="button"
                      onClick={() => setSelectedModel(undefined)}
                      className="text-[10px] text-muted hover:text-body underline underline-offset-2 transition-colors"
                    >
                      Auswahl zurücksetzen
                    </button>
                  )}
                </div>
                <div className="space-y-0.5">
                  {safeTopAiSources.length > 0 ? (
                    safeTopAiSources.map((source, index) => {
                      const sourcePercentage = typeof source.percentage === 'number' && !isNaN(source.percentage) ? source.percentage : 0;
                      const sourceSessions = typeof source.sessions === 'number' && !isNaN(source.sessions) ? source.sessions : 0;
                      const sourceName = source.source || 'Unbekannt';
                      const dotColor = getSourceDotColor(sourceName);
                      const modelKey = normalizeSourceKey(sourceName);
                      const isSelected = selectedModel === modelKey;
                      const sparklineValues = sparklinesByModel[modelKey] ?? [];
                      const extSource = extendedSourceMap.get(modelKey);
                      const topLp = extSource?.topLandingPage;
                      const convRate = extSource?.conversionRate ?? 0;
                      const convCount = extSource?.conversions ?? 0;
                      const hasSubRow = !!topLp || convCount > 0;

                      return (
                        <button
                          key={index}
                          type="button"
                          onClick={() => setSelectedModel(isSelected ? undefined : modelKey)}
                          className={cn(
                            'w-full flex flex-col gap-0.5 text-sm px-2 py-1.5 rounded-md transition-colors text-left',
                            isSelected
                              ? 'bg-surface-tertiary ring-1 ring-border'
                              : 'hover:bg-surface-tertiary/60'
                          )}
                          title={`Im Trend-Chart unten anzeigen: ${sourceName}`}
                        >
                          <div className="flex items-center justify-between gap-3 w-full">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <div
                                className="w-2 h-2 rounded-full flex-shrink-0"
                                style={{ backgroundColor: dotColor }}
                              />
                              <span className={cn('truncate', isSelected ? 'text-heading font-medium' : 'text-body')}>
                                {sourceName}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 flex-shrink-0 tabular-nums">
                              {sparklineValues.length >= 2 && (
                                <SourceMiniSparkline
                                  values={sparklineValues}
                                  color={dotColor}
                                  width={50}
                                  height={18}
                                  className="opacity-80"
                                />
                              )}
                              <span className="font-medium text-heading">
                                {sourceSessions.toLocaleString('de-DE')}
                              </span>
                              <span className="text-xs text-muted min-w-[3rem] text-right">
                                {sourcePercentage.toFixed(1)}%
                              </span>
                            </div>
                          </div>

                          {hasSubRow && (
                            <div className="flex items-center justify-between gap-2 pl-4 text-[11px] text-muted">
                              {topLp ? (
                                <span className="truncate font-mono" title={topLp.path}>
                                  {topLp.path === '/' ? '/ (Startseite)' : topLp.path}
                                </span>
                              ) : (
                                <span />
                              )}
                              {convCount > 0 && (
                                <span className="flex-shrink-0 tabular-nums">
                                  <span className="text-heading font-medium">{convCount.toLocaleString('de-DE')}</span>
                                  <span className="ml-1">Conv</span>
                                  <span className="text-faint mx-1">·</span>
                                  <span className={cn(
                                    'font-medium',
                                    convRate >= 3 ? 'text-green-600 dark:text-green-400' :
                                    convRate >= 1 ? 'text-amber-600 dark:text-amber-400' :
                                    'text-muted'
                                  )}>
                                    {convRate.toFixed(1)}%
                                  </span>
                                </span>
                              )}
                            </div>
                          )}
                        </button>
                      );
                    })
                  ) : (
                    <p className="text-sm text-muted italic">Keine KI-Traffic-Daten verfügbar</p>
                  )}
                </div>
              </div>
            </div>

            <PromptTrackingBridge
              data={promptTracking}
              enabled={promptTrackingEnabled && !!onPromptTrackingClick}
              onOpenDetails={onPromptTrackingClick}
              maxItems={5}
              className="self-start"
            />

          </div>

          {/* Trend Chart pro KI-Modell (Multi-Line, im Stil von KpiTrendChart) */}
          <AiTrafficModelTrendChart
            projectId={projectId}
            dateRange={dateRange}
            externalPrimaryModel={selectedModel}
            onPrimaryModelChange={setSelectedModel}
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
            className="group w-full py-2 px-4 bg-purple-600 hover:bg-purple-700 dark:bg-purple-600 dark:hover:bg-purple-500 text-white text-sm font-medium rounded-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            KI-Traffic Analyse
            {detailOpen ? <Minus className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          </button>
          <button
            type="button"
            onClick={onPromptTrackingClick}
            disabled={!onPromptTrackingClick}
            className="group w-full py-2 px-4 bg-surface hover:bg-surface-tertiary border border-border text-body text-sm font-medium rounded-md transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-surface"
          >
            Prompt Tracking
            {promptTrackingOpen ? <Minus className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
}
