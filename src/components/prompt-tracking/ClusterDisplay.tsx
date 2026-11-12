// src/components/prompt-tracking/ClusterDisplay.tsx
'use client';

import React from 'react';
import { WandSparkles, X, ChevronDown, ChevronUp, Lightbulb, FileText } from 'lucide-react';
import type { PromptQueryData } from '@/lib/dashboard-shared';
import {
  type PromptClusterApiResponse,
  type PromptClusterEntry,
  INTENT_LABELS,
} from '@/lib/prompt-cluster-schema';
import { buildMarkdown } from '@/lib/prompt-tracking/format';

interface ClusterDisplayProps {
  result: PromptClusterApiResponse;
  allQueries: PromptQueryData[];
  expandedIdx: number | null;
  onToggleExpand: (idx: number) => void;
  onClose: () => void;
}

export function ClusterDisplay({
  result, allQueries, expandedIdx, onToggleExpand, onClose,
}: ClusterDisplayProps) {
  const { clusters, insights, meta } = result;

  const handleMarkdownExport = () => {
    const md = buildMarkdown(result, allQueries);
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `prompt-cluster-briefing-${new Date().toISOString().split('T')[0]}.md`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className="mb-5 rounded-lg border border-border p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <WandSparkles className="w-5 h-5 text-accent" />
          <h4 className="widget-section-title text-heading">KI-Analyse: {clusters.length} Cluster erkannt</h4>
          <span className="text-xs text-muted">
            {meta.queriesAnalyzed} Queries · {(meta.elapsedMs / 1000).toFixed(1)}s · {meta.model}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={handleMarkdownExport} className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-border text-body hover:bg-surface-secondary transition" title="Markdown-Briefing exportieren">
            <FileText className="w-3.5 h-3.5" />
            MD
          </button>
          <button onClick={onClose} className="text-muted hover:text-heading">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="mb-5 rounded-md bg-surface p-4">
        <div className="flex items-center gap-2 mb-2">
          <Lightbulb className="w-4 h-4 text-warning" />
          <span className="font-medium text-sm text-heading">Gesamtbild</span>
        </div>
        <p className="text-sm leading-relaxed mb-3 text-body">{insights.summary}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div>
            <div className="font-medium text-muted mb-1">Dominanter Intent</div>
            <div className="text-body">{insights.dominantIntent}</div>
          </div>
          <div>
            <div className="font-medium text-muted mb-1">Top-Attribute</div>
            <div className="flex flex-wrap gap-1">
              {insights.dominantAttributes.map((attr, i) => (
                <span key={i} className="px-2 py-0.5 rounded-full bg-surface-tertiary text-body">{attr}</span>
              ))}
            </div>
          </div>
        </div>
        {insights.contentGaps.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border">
            <div className="font-medium text-muted text-xs mb-1.5">Content-Lücken & Empfehlungen</div>
            <ul className="text-xs space-y-1 list-disc list-inside marker:text-purple-500">
              {insights.contentGaps.map((gap, i) => <li key={i} className="text-body">{gap}</li>)}
            </ul>
          </div>
        )}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {clusters.map((cluster, idx) => (
          <ClusterCard
            key={idx}
            cluster={cluster}
            allQueries={allQueries}
            isExpanded={expandedIdx === idx}
            onToggleExpand={() => onToggleExpand(idx)}
          />
        ))}
      </div>
    </div>
  );
}

function ClusterCard({ cluster, allQueries, isExpanded, onToggleExpand }: {
  cluster: PromptClusterEntry;
  allQueries: PromptQueryData[];
  isExpanded: boolean;
  onToggleExpand: () => void;
}) {
  const intentMeta = INTENT_LABELS[cluster.intent];
  const clusterQueries = cluster.queryIndices
    .map((i) => allQueries[i])
    .filter((q): q is PromptQueryData => Boolean(q));

  const totalImpressions = clusterQueries.reduce((s, q) => s + q.impressions, 0);
  const totalClicks = clusterQueries.reduce((s, q) => s + q.clicks, 0);

  return (
    <div className="rounded-md bg-surface p-4">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={intentMeta.className}>
              {intentMeta.emoji} {intentMeta.label}
            </span>
            <span className="tone-pill tone-pill--soft tone--slate tabular-nums">
              {clusterQueries.length} Queries
            </span>
          </div>
          <h5 className="font-semibold text-sm leading-tight text-heading">{cluster.theme}</h5>
        </div>
      </div>
      <p className="text-xs text-muted leading-relaxed mb-3">{cluster.description}</p>
      <div className="flex gap-4 text-xs mb-3 tabular-nums">
        <div><span className="text-muted">Impr.:</span> <span className="font-medium text-body">{totalImpressions.toLocaleString('de-DE')}</span></div>
        <div><span className="text-muted">Klicks:</span> <span className="font-medium text-body">{totalClicks.toLocaleString('de-DE')}</span></div>
      </div>
      <div className="flex flex-wrap gap-1 mb-3">
        {cluster.topAttributes.map((attr, i) => (
          <span key={i} className="tone-pill tone-pill--soft tone--purple">
            {attr}
          </span>
        ))}
      </div>
      <button onClick={onToggleExpand} className="flex items-center gap-1 text-xs text-accent hover:underline">
        {isExpanded ? <><ChevronUp className="w-3 h-3" /> verbergen</> : <><ChevronDown className="w-3 h-3" /> {clusterQueries.length} Queries anzeigen</>}
      </button>
      {isExpanded && (
        <ul className="mt-3 pt-3 border-t border-border space-y-1.5">
          {clusterQueries
            .sort((a, b) => b.impressions - a.impressions)
            .map((q, i) => (
              <li key={i} className="text-xs flex items-start gap-2">
                <span className="text-muted tabular-nums shrink-0">{q.impressions.toLocaleString('de-DE')}</span>
                <span className="text-body leading-snug">{q.query}</span>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
