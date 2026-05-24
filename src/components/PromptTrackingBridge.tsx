// src/components/PromptTrackingBridge.tsx
'use client';

import React from 'react';
import { MessageSquareQuote, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Bridge zwischen KI-Traffic-Card und Prompt-Tracking.
 *
 * STATUS: Placeholder — wartet auf konkretes Datenmodell.
 *
 * WAS DIESE KOMPONENTE TUN SOLL:
 * - Top-3 Prompts anzeigen, für die der Kunde in KI-Antworten zitiert wurde
 * - Jeder Prompt: Text (truncated), Quelle (ChatGPT/Perplexity/...), Klicks/Visibility
 * - Click → öffnet das volle Prompt-Tracking Detail-Widget
 *
 * INTEGRATION:
 * Sobald das `PromptTrackingData`-Type bekannt ist:
 *   1. Import: `import type { PromptTrackingData } from '@/types/prompt-tracking'`
 *   2. Props erweitern um `data: PromptTrackingData | undefined`
 *   3. Render-Logik einfügen (siehe TODO-Block unten)
 *   4. In `AiTrafficCard.tsx` Daten via Props oder eigenen Hook reichen
 */

interface PromptTrackingBridgeProps {
  /** Callback wenn der User auf "Alle Prompts" klickt (öffnet PromptTrackingCard) */
  onOpenDetails?: () => void;
  /** Versteckt die Komponente komplett, wenn kein Prompt-Tracking konfiguriert */
  enabled?: boolean;
  className?: string;
  /**
   * Platzhalter — sobald Type bekannt: konkrete Daten reinreichen.
   * Erwartete Struktur (Vorschlag, anzupassen):
   *   topPrompts?: Array<{
   *     prompt: string;       // Prompt-Text
   *     source: string;       // chatgpt.com, perplexity.ai, ...
   *     visibility?: number;  // % oder Rang
   *     clicks?: number;
   *   }>;
   */
  topPrompts?: Array<{
    prompt: string;
    source: string;
    visibility?: number;
    clicks?: number;
  }>;
}

export default function PromptTrackingBridge({
  onOpenDetails,
  enabled = true,
  className,
  topPrompts,
}: PromptTrackingBridgeProps) {
  if (!enabled) return null;

  // Wenn keine Daten verfügbar → versteckt rendern
  // (Sobald Type bekannt: hier auf data.prompts.length === 0 prüfen)
  const hasPrompts = Array.isArray(topPrompts) && topPrompts.length > 0;
  if (!hasPrompts) return null;

  return (
    <div className={cn('rounded-md border border-border-subtle bg-surface-secondary/40 p-3', className)}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <MessageSquareQuote className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
          <span className="text-[11px] text-muted font-medium uppercase tracking-wide">
            Top-Prompts, für die du zitiert wurdest
          </span>
        </div>
        {onOpenDetails && (
          <button
            type="button"
            onClick={onOpenDetails}
            className="flex items-center gap-0.5 text-[10px] text-muted hover:text-body transition-colors"
          >
            Alle Prompts
            <ChevronRight className="w-3 h-3" />
          </button>
        )}
      </div>

      <div className="space-y-1">
        {topPrompts!.slice(0, 3).map((p, i) => (
          <div key={i} className="flex items-center justify-between gap-3 text-xs">
            <span className="text-body truncate flex-1 min-w-0" title={p.prompt}>
              <span className="text-faint mr-1.5">{i + 1}.</span>
              {p.prompt}
            </span>
            <div className="flex items-center gap-2 flex-shrink-0 tabular-nums">
              <span className="text-muted text-[10px] uppercase tracking-wide">{p.source}</span>
              {typeof p.clicks === 'number' && (
                <span className="text-heading font-medium">{p.clicks.toLocaleString('de-DE')}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
