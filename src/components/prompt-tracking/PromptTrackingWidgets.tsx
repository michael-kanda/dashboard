// src/components/prompt-tracking/PromptTrackingWidgets.tsx
//
// Präsentations-Komponenten der Prompt-Tracking-Card (ohne eigenen State).

import React from 'react';
import {
  Sparkles, ExternalLink, Info, TrendingUp, TrendingDown, Minus, MapPin,
  MessageCircleQuestionMark,
} from 'lucide-react';
import type {
  PromptQueryData,
  PromptTrackingShareBucket,
  PromptWordCountBucket,
  QuestionTypeDistribution,
} from '@/lib/dashboard-shared';
import { QUESTION_TYPE_LABELS, type QuestionType } from '@/lib/prompt-tracking/query-classifier';

// ════════════════════════════════════════════════════════════════════
// ClassificationRow
// ════════════════════════════════════════════════════════════════════

export function ClassificationRow({
  brandShare, brandKeywordsSource, geoShare,
  questionTypeDistribution, dominantQuestionType, totalQueries,
}: {
  brandShare: number;
  brandKeywordsSource?: 'configured' | 'auto-detected' | 'domain-heuristic' | 'none';
  geoShare: number;
  questionTypeDistribution: QuestionTypeDistribution;
  dominantQuestionType: QuestionType;
  totalQueries: number;
}) {
  const dominantPct = totalQueries > 0
    ? (questionTypeDistribution[dominantQuestionType] / totalQueries) * 100
    : 0;

  const sourceTooltip =
    brandKeywordsSource === 'configured'       ? 'Brand-Keywords manuell konfiguriert' :
    brandKeywordsSource === 'auto-detected'    ? 'Brand-Keywords automatisch erkannt (Domain + Page-Title)' :
    brandKeywordsSource === 'domain-heuristic' ? 'Heuristik aus Domain-Wurzel. Brand-Keywords im Settings setzen für bessere Erkennung.' :
                                                 'Keine Brand-Erkennung möglich';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
      <div className="rounded-md bg-surface-secondary p-3">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted mb-1">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Brand-Impressions</span>
          <span title={sourceTooltip} className="cursor-help ml-auto">
            <Info className="w-3 h-3 opacity-60" />
          </span>
        </div>
        <div className="text-base font-semibold tabular-nums text-heading">
          {brandShare.toFixed(1)} %
        </div>
        <div className="text-[11px] text-muted mt-0.5 leading-tight">
          {brandShare < 5
            ? 'Long-Tail ist meist generisch — bei B2B normal'
            : brandShare < 30
              ? 'Mischung aus Brand- und Themen-Suche'
              : 'Hohe Markenbekanntheit erkennbar'}
        </div>
      </div>

      <div className="rounded-md bg-surface-secondary p-3">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted mb-1">
          <MapPin className="w-3.5 h-3.5" />
          <span>Geo-Impressions</span>
          <span
            title='Anteil der Prompt-Impressions mit Stadt-, Bundesland- oder Lokalbezug.'
            className="cursor-help ml-auto"
          >
            <Info className="w-3 h-3 opacity-60" />
          </span>
        </div>
        <div className="text-base font-semibold tabular-nums text-heading">
          {geoShare.toFixed(1)} %
        </div>
        <div className="text-[11px] text-muted mt-0.5 leading-tight">
          {geoShare > 30 ? 'Stark lokalbezogene Suchen' :
           geoShare > 10 ? 'Teilweise mit Ortsbezug' :
           'Überwiegend ortsunabhängig'}
        </div>
      </div>

      <div className="rounded-md bg-surface-secondary p-3">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted mb-1">
          <MessageCircleQuestionMark className="w-3.5 h-3.5" />
          <span>Dominanter Frage-Typ</span>
          <span
            title="Welcher Frage-Typ in deinen Long-Tail-Queries dominiert."
            className="cursor-help ml-auto"
          >
            <Info className="w-3 h-3 opacity-60" />
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-base">{QUESTION_TYPE_LABELS[dominantQuestionType].emoji}</span>
          <span className="text-base font-semibold text-heading">
            {QUESTION_TYPE_LABELS[dominantQuestionType].label}
          </span>
        </div>
        <div className="text-[11px] text-muted mt-0.5 leading-tight tabular-nums">
          {dominantPct.toFixed(0)} % der Queries
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// Sub-Components
// ════════════════════════════════════════════════════════════════════

export function SignalBadge({ signal, reasons }: { signal: 'strong' | 'weak' | 'insufficient'; reasons: string[] }) {
  const cfg = {
    strong:       { label: 'Starkes Signal', icon: '🟢' },
    weak:         { label: 'Schwaches Signal', icon: '🟡' },
    insufficient: { label: 'Zu wenig Daten', icon: '⚪' },
  }[signal];

  return (
    <div className={`prompt-signal prompt-signal-${signal}`}>
      <div className="flex items-start gap-2 text-sm">
        <span className="shrink-0 leading-5">{cfg.icon}</span>
        <div className="flex-1">
          <div className="font-semibold text-body">{cfg.label}</div>
          {reasons.length > 0 && (
            <ul className="text-xs mt-0.5 leading-relaxed text-muted">
              {reasons.map((r, i) => <li key={i}>· {r}</li>)}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export function ShareTrendChart({ trend }: { trend: PromptTrackingShareBucket[] }) {
  const max = Math.max(...trend.map((b) => b.sharePercent), 0.1);
  const last = trend[trend.length - 1];
  const first = trend[0];
  const direction =
    last.sharePercent > first.sharePercent * 1.05 ? 'up' :
    last.sharePercent < first.sharePercent * 0.95 ? 'down' : 'flat';

  return (
    <div className="mb-4 rounded-md bg-surface-secondary p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted">
          <Info className="w-3 h-3" />
          Anteil prompt-Queries über Zeit
        </div>
        <div className="flex items-center gap-1 text-xs">
          {direction === 'up' && <><TrendingUp className="w-3 h-3 text-success" /><span className="text-success font-medium">steigend</span></>}
          {direction === 'down' && <><TrendingDown className="w-3 h-3 text-danger" /><span className="text-danger font-medium">fallend</span></>}
          {direction === 'flat' && <><Minus className="w-3 h-3 text-muted" /><span className="text-muted">stabil</span></>}
        </div>
      </div>
      <div className="flex items-end gap-1 h-20">
        {trend.map((bucket) => {
          const height = max > 0 ? (bucket.sharePercent / max) * 100 : 0;
          return (
            <div
              key={bucket.bucket}
              className="flex-1 flex flex-col items-center justify-end gap-1 group"
              title={`${bucket.label}: ${bucket.sharePercent.toFixed(1)} %`}
            >
              <div
                className="w-full rounded-t bg-purple-400 group-hover:bg-purple-500 transition relative"
                style={{ height: `${Math.max(height, 4)}%`, minHeight: '4px' }}
              >
                <span className="hidden group-hover:block absolute -top-5 left-1/2 -translate-x-1/2 text-[11px] tabular-nums whitespace-nowrap text-body">
                  {bucket.sharePercent.toFixed(1)}%
                </span>
              </div>
              <span className="text-[11px] text-muted tabular-nums truncate w-full text-center">
                {bucket.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function WordCountHistogram({ buckets }: { buckets: PromptWordCountBucket[] }) {
  const maxCount = Math.max(...buckets.map((b) => b.count), 1);
  return (
    <div className="mb-4 rounded-md bg-surface-secondary p-3">
      <div className="flex items-center gap-1.5 mb-2 text-xs font-medium text-muted">
        <Info className="w-3 h-3" />
        Wortzahl-Verteilung
      </div>
      <div className="space-y-1.5">
        {buckets.map((b) => {
          const pct = (b.count / maxCount) * 100;
          return (
            <div key={b.range} className="flex items-center gap-2 text-xs">
              <span className="w-12 text-muted tabular-nums shrink-0">{b.range} W</span>
              <div className="flex-1 h-4 bg-surface-tertiary rounded overflow-hidden">
                <div className="h-full bg-purple-400/70 rounded" style={{ width: `${pct}%` }} />
              </div>
              <span className="w-12 text-right tabular-nums text-body">{b.count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function KpiTile({ label, value, sub, delta, deltaSuffix = '', tooltip, highlight }:
  { label: string; value: string; sub?: string; delta?: number; deltaSuffix?: string; tooltip?: string; highlight?: boolean; }
) {
  return (
    <div className={`rounded-lg border bg-surface p-3 relative ${highlight ? 'border-purple-300 ring-1 ring-purple-200' : 'border-border'}`}>
      <div className="flex items-center gap-1 text-xs text-muted">
        <span>{label}</span>
        {tooltip && <span title={tooltip} className="cursor-help"><Info className="w-3 h-3 opacity-60" /></span>}
      </div>
      <div className="widget-metric-sm mt-0.5 text-heading">{value}</div>
      {delta !== undefined && (
        <div className={`text-[12px] mt-0.5 tabular-nums flex items-center gap-0.5 ${delta > 0 ? 'text-success' : delta < 0 ? 'text-danger' : 'text-muted'}`}>
          {delta > 0 ? <TrendingUp className="w-3 h-3" /> : delta < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
          {delta > 0 ? '+' : ''}{delta.toFixed(1)}{deltaSuffix} vs. Vorperiode
        </div>
      )}
      {sub && !delta && <div className="text-[12px] text-muted mt-0.5">{sub}</div>}
    </div>
  );
}

export function PromptRow({ q }: { q: PromptQueryData }) {
  const qtMeta = QUESTION_TYPE_LABELS[q.questionType];
  return (
    <tr className="border-b border-border-subtle hover:bg-surface-tertiary transition">
      <td className="px-2 py-2 max-w-[380px]">
        <div className="flex items-center gap-1.5">
          {q.hasGeoReference && <MapPin className="w-3 h-3 text-success shrink-0" aria-label="Geo-Bezug" />}
          <span className="truncate text-body" title={q.query}>{q.query}</span>
        </div>
      </td>
      <td className="px-2 py-2 text-center">
        <span className="prompt-table-pill prompt-table-pill-count">{q.wordCount}</span>
      </td>
      <td className="px-2 py-2 text-center">
        {q.isBranded
          ? <span className="prompt-table-pill prompt-table-pill-brand">Brand</span>
          : <span className="prompt-table-pill prompt-table-pill-nonbrand">Non-Brand</span>}
      </td>
      <td className="px-2 py-2 text-center">
        <span className={qtMeta.className} title={qtMeta.label}>
          {qtMeta.emoji}
        </span>
      </td>
      <td className="px-2 py-2 text-right tabular-nums text-body">{q.impressions.toLocaleString('de-DE')}</td>
      <td className="px-2 py-2 text-right tabular-nums text-body">{q.clicks.toLocaleString('de-DE')}</td>
      <td className="px-2 py-2 text-right tabular-nums text-body">{(q.ctr * 100).toFixed(1)}%</td>
      <td className="px-2 py-2 text-right tabular-nums text-body">{q.position.toFixed(1)}</td>
      <td className="px-2 py-2">
        {q.url && (
          <a href={q.url} target="_blank" rel="noopener noreferrer" className="text-muted hover:text-heading" title={q.url}>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </td>
    </tr>
  );
}
