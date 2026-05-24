// src/components/AiTrafficAnomalyBanner.tsx
'use client';

import React, { useMemo, useState } from 'react';
import { Rocket, AlertTriangle, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AiTrafficExtendedData } from '@/lib/ai-traffic-extended-v2';

interface AiTrafficAnomalyBannerProps {
  data?: AiTrafficExtendedData;
  className?: string;
  /** Maximale Anzahl Anomalien, die gleichzeitig angezeigt werden */
  maxItems?: number;
  /** Schwelle für Spike-Erkennung (%-Change), default +100% */
  spikeThreshold?: number;
  /** Schwelle für Drop-Erkennung (%-Change), default -50% */
  dropThreshold?: number;
}

interface Anomaly {
  source: string;
  change: number; // %
  recent: number; // Sessions letzte 7 Tage
  previous: number; // Sessions Tage 8-14
  type: 'spike' | 'drop';
  topPath?: string;
}

// Label-Mapping (passend zu MODEL_CONFIG anderer Komponenten)
const SOURCE_LABEL: Record<string, string> = {
  'chatgpt.com': 'ChatGPT',
  'claude.ai': 'Claude',
  'perplexity.ai': 'Perplexity',
  'gemini.google.com': 'Gemini',
  'copilot.microsoft.com': 'Copilot',
  'you.com': 'You.com',
  'poe.com': 'Poe',
  'character.ai': 'Character.AI',
};

function getLabel(source: string): string {
  return SOURCE_LABEL[source] || source;
}

function detectAnomalies(
  data: AiTrafficExtendedData,
  spikeThreshold: number,
  dropThreshold: number,
): Anomaly[] {
  const rows = data.trendBySource ?? [];
  if (rows.length === 0) return [];

  // Pro Source eine Zeitserie aufbauen
  const sourceTimeseries = new Map<string, Array<{ date: string; sessions: number }>>();
  for (const row of rows) {
    if (!sourceTimeseries.has(row.source)) {
      sourceTimeseries.set(row.source, []);
    }
    sourceTimeseries.get(row.source)!.push({ date: row.date, sessions: row.sessions });
  }

  // Lookup: top-Landingpage pro Source (aus Phase 2)
  const topPathBySource = new Map<string, string>();
  for (const src of data.sources ?? []) {
    if (src.topLandingPage?.path) {
      topPathBySource.set(src.source, src.topLandingPage.path);
    }
  }

  const anomalies: Anomaly[] = [];
  for (const [source, timeline] of sourceTimeseries.entries()) {
    if (timeline.length < 14) continue; // brauchen 2 Wochen für sinnvollen Vergleich

    timeline.sort((a, b) => a.date.localeCompare(b.date));
    const last14 = timeline.slice(-14);
    const recent = last14.slice(-7).reduce((sum, d) => sum + d.sessions, 0);
    const previous = last14.slice(0, 7).reduce((sum, d) => sum + d.sessions, 0);

    // Rauschen ausfiltern: beide Perioden müssen Substanz haben
    if (recent < 5 && previous < 5) continue;

    let change: number;
    if (previous === 0) {
      change = recent > 0 ? 999 : 0; // "aus dem Nichts"
    } else {
      change = ((recent - previous) / previous) * 100;
    }

    if (change >= spikeThreshold && recent >= 5) {
      anomalies.push({
        source,
        change,
        recent,
        previous,
        type: 'spike',
        topPath: topPathBySource.get(source),
      });
    } else if (change <= dropThreshold && previous >= 5) {
      anomalies.push({
        source,
        change,
        recent,
        previous,
        type: 'drop',
        topPath: topPathBySource.get(source),
      });
    }
  }

  // Stärkste zuerst
  anomalies.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
  return anomalies;
}

export default function AiTrafficAnomalyBanner({
  data,
  className,
  maxItems = 2,
  spikeThreshold = 100,
  dropThreshold = -50,
}: AiTrafficAnomalyBannerProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const anomalies = useMemo(() => {
    if (!data) return [];
    return detectAnomalies(data, spikeThreshold, dropThreshold);
  }, [data, spikeThreshold, dropThreshold]);

  const visible = anomalies
    .filter((a) => !dismissed.has(a.source))
    .slice(0, maxItems);

  if (visible.length === 0) return null;

  return (
    <div className={cn('space-y-1.5', className)}>
      {visible.map((a) => {
        const isSpike = a.type === 'spike';
        const Icon = isSpike ? Rocket : AlertTriangle;
        const colorClasses = isSpike
          ? 'bg-green-50 dark:bg-green-900/15 border-green-200 dark:border-green-800/50 text-green-800 dark:text-green-300'
          : 'bg-amber-50 dark:bg-amber-900/15 border-amber-200 dark:border-amber-800/50 text-amber-800 dark:text-amber-300';
        const iconColor = isSpike ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400';
        const label = getLabel(a.source);
        const changeStr = a.change >= 999 ? 'neu' : `${a.change >= 0 ? '+' : ''}${a.change.toFixed(0)}%`;
        const headline = isSpike
          ? `${label}-Traffic ${changeStr} diese Woche`
          : `${label}-Traffic ${changeStr} diese Woche`;

        return (
          <div
            key={a.source}
            className={cn(
              'flex items-start gap-2.5 rounded-md border px-3 py-2 text-xs',
              colorClasses,
            )}
            role="status"
          >
            <Icon className={cn('w-4 h-4 flex-shrink-0 mt-0.5', iconColor)} />
            <div className="flex-1 min-w-0">
              <p className="font-medium leading-snug">
                {headline}
                <span className="font-normal text-muted ml-1.5">
                  ({a.previous.toLocaleString('de-DE')} → {a.recent.toLocaleString('de-DE')} Sitzungen)
                </span>
              </p>
              {a.topPath && (
                <p className="text-[11px] text-muted mt-0.5 truncate">
                  v.a. auf <span className="font-mono">{a.topPath === '/' ? '/ (Startseite)' : a.topPath}</span>
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setDismissed((prev) => new Set(prev).add(a.source))}
              className="flex-shrink-0 text-muted hover:text-body transition-colors p-0.5 -m-0.5 rounded"
              aria-label="Hinweis schließen"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
