// src/components/PromptTrackingBridge.tsx
'use client';

import React, { useMemo } from 'react';
import { MessageSquareQuote, ChevronRight, MapPin, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PromptTrackingResult, PromptQueryData } from '@/lib/dashboard-shared';

/**
 * Bridge zwischen KI-Traffic-Card und Prompt-Tracking.
 *
 * Zeigt die Top-Prompts (= Such-Anfragen aus GSC, die wie KI-Prompts aussehen — "AI Mode Proxy"),
 * mit denen Nutzer die Seite finden. Verlinkt zur vollen Prompt-Tracking-Card.
 *
 * Hinweis: Prompts haben kein "Quelle" (ChatGPT/Gemini) — sie kommen aus GSC und sind
 * Indikator für die KI-Sichtbarkeit in Googles AI Mode bzw. dass die Inhalte
 * Frage-Charakter haben (Long-Tail-Fragen, die KI typischerweise zitiert).
 */

interface PromptTrackingBridgeProps {
  /** Prompt-Tracking-Daten aus dem Dashboard */
  data?: PromptTrackingResult;
  /** Callback wenn der User auf "Alle Prompts" klickt (öffnet PromptTrackingCard) */
  onOpenDetails?: () => void;
  /** Versteckt die Komponente komplett, wenn kein Prompt-Tracking konfiguriert */
  enabled?: boolean;
  /** Maximale Anzahl Prompts in der Vorschau (default 3) */
  maxItems?: number;
  /** Nur Non-Brand-Prompts zeigen (interessanter weil "echte" Fragen) — default true */
  nonBrandedOnly?: boolean;
  className?: string;
}

function selectTopPrompts(
  data: PromptTrackingResult | undefined,
  maxItems: number,
  nonBrandedOnly: boolean,
): PromptQueryData[] {
  if (!data?.queries?.length) return [];
  let list = data.queries;
  if (nonBrandedOnly) {
    const filtered = list.filter((q) => !q.isBranded);
    // Fallback: wenn nur Brand-Queries da sind, zeige diese trotzdem
    list = filtered.length > 0 ? filtered : list;
  }
  return [...list].sort((a, b) => b.clicks - a.clicks).slice(0, maxItems);
}

export default function PromptTrackingBridge({
  data,
  onOpenDetails,
  enabled = true,
  maxItems = 3,
  nonBrandedOnly = true,
  className,
}: PromptTrackingBridgeProps) {
  const topPrompts = useMemo(
    () => selectTopPrompts(data, maxItems, nonBrandedOnly),
    [data, maxItems, nonBrandedOnly],
  );

  if (!enabled) return null;
  if (topPrompts.length === 0) return null;

  return (
    <div className={cn('rounded-md border border-border-subtle bg-surface-secondary/40 p-3', className)}>
      <div className="flex items-center justify-between mb-2 gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <MessageSquareQuote className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 flex-shrink-0" />
          <span className="text-[11px] text-muted font-medium uppercase tracking-wide truncate">
            Top-Fragen, mit denen Nutzer dich finden
          </span>
        </div>
        {onOpenDetails && (
          <button
            type="button"
            onClick={onOpenDetails}
            className="flex items-center gap-0.5 text-[10px] text-muted hover:text-body transition-colors flex-shrink-0"
          >
            Alle Prompts
            <ChevronRight className="w-3 h-3" />
          </button>
        )}
      </div>

      <div className="space-y-1">
        {topPrompts.map((q, i) => (
          <div key={`${q.query}-${i}`} className="flex items-center justify-between gap-3 text-xs py-0.5">
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <span className="text-faint flex-shrink-0">{i + 1}.</span>
              {q.hasGeoReference && (
                <MapPin className="w-3 h-3 text-emerald-500 flex-shrink-0" aria-label="Geo-Bezug" />
              )}
              <span className="text-body truncate" title={q.query}>
                {q.query}
              </span>
              {q.url && (
                <a
                  href={q.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-faint hover:text-body flex-shrink-0"
                  title={q.url}
                >
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 tabular-nums">
              <span className="text-heading font-medium">{q.clicks.toLocaleString('de-DE')}</span>
              <span className="text-[10px] text-muted">Klicks</span>
              <span className="text-faint">·</span>
              <span className="text-muted">Pos. {q.position.toFixed(0)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
