// src/components/AiTrafficTopQuestions.tsx
'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export interface TopQuestionItem {
  query: string;
  clicks: number;
  position: number;
}

/**
 * Farbcodierter Positions-Chip — spiegelt die grün/amber/grau-Logik
 * der Conversion-Rate in der AiTrafficCard:
 *   Top 3   → grün   (sehr gute Platzierung)
 *   4 – 10  → amber  (erste Seite, ausbaufähig)
 *   > 10    → neutral
 */
function positionChipClass(position: number): string {
  const p = Math.round(position);
  if (p > 0 && p <= 3) {
    return 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400';
  }
  if (p > 0 && p <= 10) {
    return 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400';
  }
  return 'bg-surface-tertiary text-muted';
}

interface AiTrafficTopQuestionsProps {
  items: TopQuestionItem[];
  title?: string;
  className?: string;
}

export default function AiTrafficTopQuestions({
  items,
  title = 'Top-Fragen, mit denen Nutzer dich finden',
  className,
}: AiTrafficTopQuestionsProps) {
  return (
    <div className={className}>
      <p className="text-[11px] text-muted font-medium uppercase tracking-wide mb-2 leading-snug">
        {title}
      </p>

      {items.length > 0 ? (
        <div className="flex flex-col">
          {items.map((item, index) => (
            <div
              key={index}
              className="flex items-center gap-2.5 px-1.5 py-1.5 rounded-md transition-colors hover:bg-surface-tertiary/60"
            >
              {/* Rang */}
              <span className="w-3 flex-shrink-0 text-right text-xs text-muted tabular-nums">
                {index + 1}
              </span>

              {/* Suchanfrage */}
              <span
                className="flex-1 min-w-0 truncate text-[13px] text-body"
                title={item.query}
              >
                {item.query}
              </span>

              {/* Klicks */}
              <span className="flex-shrink-0 text-[13px] font-medium text-heading tabular-nums">
                {item.clicks.toLocaleString('de-DE')}
                <span className="ml-1 text-[11px] font-normal text-muted">Klicks</span>
              </span>

              {/* Position-Chip — Position ist ein GSC-Float, daher hier fürs Display gerundet */}
              <span
                className={cn(
                  'flex-shrink-0 min-w-[46px] text-center text-[11px] font-medium px-1.5 py-0.5 rounded-md tabular-nums whitespace-nowrap',
                  positionChipClass(item.position)
                )}
              >
                Pos. {Math.round(item.position)}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted italic">Keine Suchanfragen verfügbar</p>
      )}
    </div>
  );
}
