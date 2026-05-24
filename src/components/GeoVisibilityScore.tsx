// src/components/GeoVisibilityScore.tsx
'use client';

import React, { useMemo } from 'react';
import { Sparkles, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GeoVisibilityScoreProps {
  /** KI-Sessions im aktuellen Zeitraum */
  aiSessions: number;
  /** Gesamt-Sessions im aktuellen Zeitraum */
  totalSessions: number;
  /** %-Änderung der KI-Sessions vs. Vorperiode */
  aiSessionsChange?: number;
  /** Anzahl unique KI-Quellen mit nennenswertem Traffic (≥ 5 Sessions) */
  uniqueAiSources: number;
  className?: string;
}

interface ScoreResult {
  score: number;
  label: string;
  bandColor: string;
  textColor: string;
  bgClass: string;
  components: {
    share: number;
    diversity: number;
    growth: number;
  };
}

/**
 * Berechnet einen GEO-Sichtbarkeits-Score von 0-100 aus drei Faktoren:
 *   1. Anteil-KI-Traffic (40%)  — wie hoch ist der KI-Anteil am Gesamt-Traffic?
 *   2. Vielfalt-KI-Quellen (30%) — wie viele verschiedene KI-Plattformen liefern Traffic?
 *   3. Wachstum (30%)            — wie entwickelt sich der KI-Traffic?
 *
 * Skalen sind pragmatisch für DACH-Websites kalibriert. Bei 5%+ KI-Anteil + 3+ Quellen
 * + leichtem Wachstum erreicht eine Site ~75 Punkte.
 */
function calculateGeoScore(
  aiSessions: number,
  totalSessions: number,
  aiSessionsChange: number | undefined,
  uniqueAiSources: number,
): ScoreResult {
  const aiShare = totalSessions > 0 ? (aiSessions / totalSessions) * 100 : 0;

  // Anteil-Score: linear, capped bei 10% Anteil = 100 Punkte
  const shareScore = Math.min(100, aiShare * 10);

  // Vielfalt-Score: 5+ Quellen = 100 Punkte
  const diversityScore = Math.min(100, (uniqueAiSources / 5) * 100);

  // Wachstum-Score: 0% Change = 50 Punkte, +100%+ = 100, -100%+ = 0
  const change = typeof aiSessionsChange === 'number' ? aiSessionsChange : 0;
  const growthScore = Math.max(0, Math.min(100, 50 + change / 2));

  const score = Math.round(shareScore * 0.4 + diversityScore * 0.3 + growthScore * 0.3);

  let label = 'Schwach';
  let bandColor = '#ef4444'; // red
  let textColor = 'text-red-600 dark:text-red-400';
  let bgClass = 'bg-red-50 dark:bg-red-900/15';

  if (score >= 75) {
    label = 'Stark';
    bandColor = '#10b981';
    textColor = 'text-green-700 dark:text-green-400';
    bgClass = 'bg-green-50 dark:bg-green-900/15';
  } else if (score >= 55) {
    label = 'Gut';
    bandColor = '#22c55e';
    textColor = 'text-green-700 dark:text-green-400';
    bgClass = 'bg-green-50 dark:bg-green-900/15';
  } else if (score >= 35) {
    label = 'Mittel';
    bandColor = '#f59e0b';
    textColor = 'text-amber-700 dark:text-amber-400';
    bgClass = 'bg-amber-50 dark:bg-amber-900/15';
  } else if (score >= 15) {
    label = 'Mäßig';
    bandColor = '#f97316';
    textColor = 'text-orange-700 dark:text-orange-400';
    bgClass = 'bg-orange-50 dark:bg-orange-900/15';
  }

  return {
    score,
    label,
    bandColor,
    textColor,
    bgClass,
    components: {
      share: Math.round(shareScore),
      diversity: Math.round(diversityScore),
      growth: Math.round(growthScore),
    },
  };
}

export default function GeoVisibilityScore({
  aiSessions,
  totalSessions,
  aiSessionsChange,
  uniqueAiSources,
  className,
}: GeoVisibilityScoreProps) {
  const result = useMemo(
    () => calculateGeoScore(aiSessions, totalSessions, aiSessionsChange, uniqueAiSources),
    [aiSessions, totalSessions, aiSessionsChange, uniqueAiSources],
  );

  // Trend-Pfeil
  const change = typeof aiSessionsChange === 'number' ? aiSessionsChange : 0;
  const TrendIcon = change > 5 ? TrendingUp : change < -5 ? TrendingDown : Minus;
  const trendColor = change > 5 ? 'text-green-600' : change < -5 ? 'text-red-600' : 'text-muted';

  // Tooltip mit Komponenten-Aufschlüsselung
  const tooltipText = `Score-Zusammensetzung:
• Anteil (40%): ${result.components.share}/100
• Vielfalt (30%): ${result.components.diversity}/100 (${uniqueAiSources} Quellen)
• Wachstum (30%): ${result.components.growth}/100`;

  return (
    <div
      className={cn(
        'rounded-md border border-border-subtle px-3 py-2 flex items-center gap-3',
        result.bgClass,
        className,
      )}
      title={tooltipText}
    >
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <Sparkles className={cn('w-3.5 h-3.5', result.textColor)} />
        <span className="text-[11px] text-muted font-medium uppercase tracking-wide whitespace-nowrap">
          GEO-Score
        </span>
      </div>

      <div className="flex items-baseline gap-1 flex-shrink-0">
        <span className={cn('text-xl font-bold tabular-nums', result.textColor)}>
          {result.score}
        </span>
        <span className="text-xs text-muted">/100</span>
      </div>

      <div className="flex-1 min-w-0">
        <div className="h-1.5 bg-surface-tertiary rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${result.score}%`,
              backgroundColor: result.bandColor,
            }}
          />
        </div>
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        <span className={cn('text-xs font-semibold', result.textColor)}>{result.label}</span>
        <TrendIcon className={cn('w-3.5 h-3.5', trendColor)} />
      </div>
    </div>
  );
}
