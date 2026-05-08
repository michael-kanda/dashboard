// src/components/PromptTrackingCard.tsx
'use client';

import React, { useMemo, useState } from 'react';
import {
  Sparkles,
  Download,
  Search,
  ExternalLink,
  Wand2,
  Loader2,
  X,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  AlertCircle,
} from 'lucide-react';
import type { PromptTrackingResult, PromptQueryData } from '@/lib/dashboard-shared';
import {
  type PromptClusterApiResponse,
  type PromptClusterEntry,
  INTENT_LABELS,
} from '@/lib/prompt-cluster-schema';

interface PromptTrackingCardProps {
  data?: PromptTrackingResult;
  /** Optional: an die API für besseren Kontext im Prompt */
  domain?: string;
  /** Optional: an die API für besseren Kontext im Prompt */
  dateRange?: string;
}

type FilterMode = 'all' | 'branded' | 'nonBranded';
type SortMode = 'impressions' | 'clicks' | 'ctr' | 'position' | 'wordCount';

// Maximalanzahl an Queries, die wir an das LLM schicken (Token-Limit)
const MAX_QUERIES_FOR_AI = 200;
const MIN_QUERIES_FOR_AI = 5;

export default function PromptTrackingCard({
  data,
  domain,
  dateRange,
}: PromptTrackingCardProps) {
  // ─── State (Hooks IMMER vor Early Returns!) ──────────────────────
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [sortMode, setSortMode] = useState<SortMode>('impressions');
  const [limit, setLimit] = useState(25);

  // AI-Cluster-State
  const [isClustering, setIsClustering] = useState(false);
  const [clusterResult, setClusterResult] = useState<PromptClusterApiResponse | null>(null);
  const [clusterError, setClusterError] = useState<string | null>(null);
  const [expandedClusterIdx, setExpandedClusterIdx] = useState<number | null>(null);

  // ─── Filter + Sort + Search ──────────────────────────────────────
  const filtered = useMemo(() => {
    if (!data) return [] as PromptQueryData[];

    let list = data.queries;

    if (filterMode === 'branded') list = list.filter((q) => q.isBranded);
    if (filterMode === 'nonBranded') list = list.filter((q) => !q.isBranded);

    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter((q) => q.query.toLowerCase().includes(s));
    }

    list = [...list].sort((a, b) => {
      switch (sortMode) {
        case 'clicks':
          return b.clicks - a.clicks;
        case 'ctr':
          return b.ctr - a.ctr;
        case 'position':
          return a.position - b.position;
        case 'wordCount':
          return b.wordCount - a.wordCount;
        case 'impressions':
        default:
          return b.impressions - a.impressions;
      }
    });

    return list;
  }, [data, filterMode, sortMode, search]);

  // ─── Empty State ─────────────────────────────────────────────────
  if (!data || data.totals.totalQueries === 0) {
    return (
      <div className="card-glass p-6">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-5 h-5 text-purple-500" />
          <h3 className="text-lg font-semibold">Prompt Tracking (GSC)</h3>
          <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
            AI Mode Proxy
          </span>
        </div>
        <p className="text-muted text-sm">
          Keine prompt-ähnlichen Suchanfragen (≥10 Wörter) im gewählten Zeitraum gefunden.
        </p>
      </div>
    );
  }

  // ─── CSV Export ──────────────────────────────────────────────────
  const handleExport = () => {
    const header = ['Query', 'Wortzahl', 'Brand', 'Klicks', 'Impressions', 'CTR', 'Position', 'Top URL'];
    const rows = filtered.map((q) => [
      `"${q.query.replace(/"/g, '""')}"`,
      q.wordCount,
      q.isBranded ? 'Brand' : 'Non-Brand',
      q.clicks,
      q.impressions,
      (q.ctr * 100).toFixed(2) + '%',
      q.position.toFixed(1),
      q.url,
    ]);
    const csv = [header.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `prompt-tracking-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  // ─── AI Cluster-Analyse ──────────────────────────────────────────
  const queriesForAi = useMemo(
    () => filtered.slice(0, MAX_QUERIES_FOR_AI),
    [filtered]
  );

  const canCluster = queriesForAi.length >= MIN_QUERIES_FOR_AI;

  const handleCluster = async () => {
    if (!canCluster || isClustering) return;

    setIsClustering(true);
    setClusterError(null);
    setExpandedClusterIdx(null);

    try {
      const res = await fetch('/api/prompt-tracking/cluster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain,
          dateRange,
          queries: queriesForAi.map((q) => ({
            query: q.query,
            clicks: q.clicks,
            impressions: q.impressions,
          })),
        }),
      });

      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({}));
        throw new Error(
          errorBody?.error ||
          errorBody?.details ||
          `HTTP ${res.status}: Cluster-Analyse fehlgeschlagen`
        );
      }

      const result: PromptClusterApiResponse = await res.json();
      setClusterResult(result);
    } catch (err: any) {
      console.error('[PromptTracking] Cluster error:', err);
      setClusterError(err?.message || 'Unbekannter Fehler');
    } finally {
      setIsClustering(false);
    }
  };

  const handleClearCluster = () => {
    setClusterResult(null);
    setClusterError(null);
    setExpandedClusterIdx(null);
  };

  return (
    <div className="card-glass p-6">
      {/* ─── Header ─────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <Sparkles className="w-5 h-5 text-purple-500" />
            <h3 className="text-lg font-semibold">Prompt Tracking</h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
              GSC Proxy
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-muted/70 text-muted-foreground">
              ≥{data.minWords} Wörter
            </span>
          </div>
          <p className="text-muted text-xs mt-1">
            Konversationsartige Suchanfragen – möglicher AI-Mode-Indikator
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleCluster}
            disabled={!canCluster || isClustering}
            className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-md bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition print:hidden"
            title={
              !canCluster
                ? `Mindestens ${MIN_QUERIES_FOR_AI} Queries für AI-Analyse benötigt`
                : `${queriesForAi.length} Queries mit Gemini analysieren`
            }
          >
            {isClustering ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Analysiere...
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4" />
                Mit AI clustern
              </>
            )}
          </button>

          <button
            onClick={handleExport}
            className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-md border border-border hover:bg-muted/50 transition"
            title="Aktuelle Auswahl als CSV exportieren"
          >
            <Download className="w-4 h-4" />
            CSV
          </button>
        </div>
      </div>

      {/* ─── KPI Row ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <KpiTile
          label="Prompts gefunden"
          value={data.totals.totalQueries.toLocaleString('de-DE')}
        />
        <KpiTile
          label="Impressions"
          value={data.totals.totalImpressions.toLocaleString('de-DE')}
        />
        <KpiTile
          label="Klicks"
          value={data.totals.totalClicks.toLocaleString('de-DE')}
          sub={`Ø CTR ${(data.totals.avgCtr * 100).toFixed(1)}%`}
        />
        <KpiTile
          label="Brand-Anteil"
          value={`${data.totals.brandedShare.toFixed(1)}%`}
          sub={`${data.totals.nonBrandedShare.toFixed(1)}% Non-Brand`}
        />
      </div>

      {/* ─── AI Cluster Result (falls vorhanden) ───────────────── */}
      {clusterError && (
        <div className="mb-5 rounded-lg border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20 p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-900 dark:text-red-200">
              KI-Analyse fehlgeschlagen
            </p>
            <p className="text-xs text-red-700 dark:text-red-300 mt-0.5">{clusterError}</p>
          </div>
          <button
            onClick={() => setClusterError(null)}
            className="text-red-600 dark:text-red-400 hover:opacity-70"
            aria-label="Fehler schließen"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {clusterResult && (
        <ClusterDisplay
          result={clusterResult}
          allQueries={queriesForAi}
          expandedIdx={expandedClusterIdx}
          onToggleExpand={(idx) =>
            setExpandedClusterIdx((current) => (current === idx ? null : idx))
          }
          onClose={handleClearCluster}
        />
      )}

      {/* ─── Filter Bar ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Suchen in Prompts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-purple-500/30"
          />
        </div>

        <select
          value={filterMode}
          onChange={(e) => setFilterMode(e.target.value as FilterMode)}
          className="px-3 py-2 text-sm rounded-md border border-border bg-background"
        >
          <option value="all">Alle Queries</option>
          <option value="branded">Nur Brand</option>
          <option value="nonBranded">Nur Non-Brand</option>
        </select>

        <select
          value={sortMode}
          onChange={(e) => setSortMode(e.target.value as SortMode)}
          className="px-3 py-2 text-sm rounded-md border border-border bg-background"
        >
          <option value="impressions">Sort: Impressions</option>
          <option value="clicks">Sort: Klicks</option>
          <option value="ctr">Sort: CTR</option>
          <option value="position">Sort: Position</option>
          <option value="wordCount">Sort: Wortzahl</option>
        </select>
      </div>

      {/* ─── Tabelle ────────────────────────────────────────────── */}
      <div className="overflow-x-auto -mx-2">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
              <th className="px-2 py-2 font-medium">Query</th>
              <th className="px-2 py-2 font-medium text-center">Wörter</th>
              <th className="px-2 py-2 font-medium text-center">Typ</th>
              <th className="px-2 py-2 font-medium text-right">Impr.</th>
              <th className="px-2 py-2 font-medium text-right">Klicks</th>
              <th className="px-2 py-2 font-medium text-right">CTR</th>
              <th className="px-2 py-2 font-medium text-right">Pos.</th>
              <th className="px-2 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, limit).map((q, idx) => (
              <PromptRow key={`${q.query}-${idx}`} q={q} />
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center text-muted py-6 text-sm">
                  Keine Treffer für die aktuellen Filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ─── Footer / Mehr anzeigen ─────────────────────────────── */}
      {filtered.length > limit && (
        <div className="mt-4 text-center">
          <button
            onClick={() => setLimit((l) => l + 25)}
            className="text-sm text-purple-600 dark:text-purple-400 hover:underline"
          >
            +25 weitere anzeigen ({filtered.length - limit} verbleiben)
          </button>
        </div>
      )}

      {/* ─── Hinweistext ────────────────────────────────────────── */}
      <p className="text-xs text-muted mt-4 leading-relaxed">
        💡 <strong>Hinweis:</strong> Lange Queries deuten auf konversationsartige Suchen hin und sind ein
        möglicher Proxy für AI-Mode- bzw. LLM-Anfragen. Kein direkter Beweis für AI-Herkunft – Methodik nach{' '}
        <a
          href="https://seybold.de/prompt-tracking-in-google-search-console/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-purple-600"
        >
          Seybold (2026)
        </a>
        .
      </p>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// Cluster-Display
// ════════════════════════════════════════════════════════════════════

interface ClusterDisplayProps {
  result: PromptClusterApiResponse;
  allQueries: PromptQueryData[];
  expandedIdx: number | null;
  onToggleExpand: (idx: number) => void;
  onClose: () => void;
}

function ClusterDisplay({
  result,
  allQueries,
  expandedIdx,
  onToggleExpand,
  onClose,
}: ClusterDisplayProps) {
  const { clusters, insights, meta } = result;

  return (
    <div className="mb-5 rounded-lg border border-purple-200 dark:border-purple-800 bg-gradient-to-br from-purple-50/50 to-blue-50/50 dark:from-purple-950/20 dark:to-blue-950/20 p-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Wand2 className="w-5 h-5 text-purple-600" />
          <h4 className="font-semibold">KI-Analyse: {clusters.length} Cluster erkannt</h4>
          <span className="text-xs text-muted-foreground">
            {meta.queriesAnalyzed} Queries · {(meta.elapsedMs / 1000).toFixed(1)}s · {meta.model}
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Cluster-Analyse schließen"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Insights Box */}
      <div className="mb-5 rounded-md bg-background/60 border border-border p-4">
        <div className="flex items-center gap-2 mb-2">
          <Lightbulb className="w-4 h-4 text-amber-500" />
          <span className="font-medium text-sm">Gesamtbild</span>
        </div>
        <p className="text-sm leading-relaxed mb-3">{insights.summary}</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div>
            <div className="font-medium text-muted-foreground mb-1">Dominanter Intent</div>
            <div>{insights.dominantIntent}</div>
          </div>
          <div>
            <div className="font-medium text-muted-foreground mb-1">Top-Attribute</div>
            <div className="flex flex-wrap gap-1">
              {insights.dominantAttributes.map((attr, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 rounded-full bg-muted/70 text-foreground"
                >
                  {attr}
                </span>
              ))}
            </div>
          </div>
        </div>

        {insights.contentGaps.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border">
            <div className="font-medium text-muted-foreground text-xs mb-1.5">
              Content-Lücken & Empfehlungen
            </div>
            <ul className="text-xs space-y-1 list-disc list-inside marker:text-purple-500">
              {insights.contentGaps.map((gap, i) => (
                <li key={i}>{gap}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Cluster Grid */}
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

interface ClusterCardProps {
  cluster: PromptClusterEntry;
  allQueries: PromptQueryData[];
  isExpanded: boolean;
  onToggleExpand: () => void;
}

function ClusterCard({ cluster, allQueries, isExpanded, onToggleExpand }: ClusterCardProps) {
  const intentMeta = INTENT_LABELS[cluster.intent];

  // Cluster-Statistik aus den referenzierten Queries
  const clusterQueries = cluster.queryIndices
    .map((i) => allQueries[i])
    .filter((q): q is PromptQueryData => Boolean(q));

  const totalImpressions = clusterQueries.reduce((s, q) => s + q.impressions, 0);
  const totalClicks = clusterQueries.reduce((s, q) => s + q.clicks, 0);

  return (
    <div className="rounded-md bg-background/60 border border-border p-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`text-[10px] px-2 py-0.5 rounded-full ${intentMeta.color}`}>
              {intentMeta.emoji} {intentMeta.label}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted/70 tabular-nums">
              {clusterQueries.length} Queries
            </span>
          </div>
          <h5 className="font-semibold text-sm leading-tight">{cluster.theme}</h5>
        </div>
      </div>

      {/* Description */}
      <p className="text-xs text-muted-foreground leading-relaxed mb-3">
        {cluster.description}
      </p>

      {/* Stats */}
      <div className="flex gap-4 text-xs mb-3 tabular-nums">
        <div>
          <span className="text-muted-foreground">Impr.:</span>{' '}
          <span className="font-medium">{totalImpressions.toLocaleString('de-DE')}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Klicks:</span>{' '}
          <span className="font-medium">{totalClicks.toLocaleString('de-DE')}</span>
        </div>
      </div>

      {/* Top Attributes */}
      <div className="flex flex-wrap gap-1 mb-3">
        {cluster.topAttributes.map((attr, i) => (
          <span
            key={i}
            className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
          >
            {attr}
          </span>
        ))}
      </div>

      {/* Expand-Toggle */}
      <button
        onClick={onToggleExpand}
        className="flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400 hover:underline"
      >
        {isExpanded ? (
          <>
            <ChevronUp className="w-3 h-3" /> Queries verbergen
          </>
        ) : (
          <>
            <ChevronDown className="w-3 h-3" /> {clusterQueries.length} Queries anzeigen
          </>
        )}
      </button>

      {/* Expanded Query-Liste */}
      {isExpanded && (
        <ul className="mt-3 pt-3 border-t border-border space-y-1.5">
          {clusterQueries
            .sort((a, b) => b.impressions - a.impressions)
            .map((q, i) => (
              <li key={i} className="text-xs flex items-start gap-2">
                <span className="text-muted-foreground tabular-nums shrink-0">
                  {q.impressions.toLocaleString('de-DE')}
                </span>
                <span className="text-foreground/90 leading-snug">{q.query}</span>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// Sub-Components
// ════════════════════════════════════════════════════════════════════

function KpiTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-border bg-background/50 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold mt-0.5 tabular-nums">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

function PromptRow({ q }: { q: PromptQueryData }) {
  return (
    <tr className="border-b border-border/50 hover:bg-muted/30 transition">
      <td className="px-2 py-2 max-w-[420px]">
        <div className="truncate" title={q.query}>
          {q.query}
        </div>
      </td>
      <td className="px-2 py-2 text-center">
        <span className="inline-block min-w-[28px] text-xs px-2 py-0.5 rounded-full bg-muted/70 tabular-nums">
          {q.wordCount}
        </span>
      </td>
      <td className="px-2 py-2 text-center">
        {q.isBranded ? (
          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
            Brand
          </span>
        ) : (
          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
            Non-Brand
          </span>
        )}
      </td>
      <td className="px-2 py-2 text-right tabular-nums">
        {q.impressions.toLocaleString('de-DE')}
      </td>
      <td className="px-2 py-2 text-right tabular-nums">
        {q.clicks.toLocaleString('de-DE')}
      </td>
      <td className="px-2 py-2 text-right tabular-nums">
        {(q.ctr * 100).toFixed(1)}%
      </td>
      <td className="px-2 py-2 text-right tabular-nums">
        {q.position.toFixed(1)}
      </td>
      <td className="px-2 py-2">
        {q.url && (
          <a
            href={q.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground"
            title={q.url}
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </td>
    </tr>
  );
}
