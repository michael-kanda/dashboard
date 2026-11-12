// src/components/PromptTrackingCard.tsx
'use client';

import React, { useMemo, useState } from 'react';
import { Download, Search, WandSparkles, X, AlertCircle } from 'lucide-react';
import type {
  ProjectDashboardData,
  PromptTrackingResult,
  PromptQueryData,
} from '@/lib/dashboard-shared';
import { calculatePromptTrackingSignal } from '@/lib/dashboard-shared';
import { QUESTION_TYPE_LABELS, type QuestionType } from '@/lib/prompt-tracking/query-classifier';
import type { PromptClusterApiResponse } from '@/lib/prompt-cluster-schema';
import { calcChange } from '@/lib/prompt-tracking/format';
import GoogleCleanUnderline from '@/components/ui/GoogleCleanUnderline';
import { Spinner } from '@/components/ui/Spinner';
import { PromptResearchTool } from '@/components/prompt-tracking/PromptResearchTool';
import { ClusterDisplay } from '@/components/prompt-tracking/ClusterDisplay';
import {
  ClassificationRow,
  SignalBadge,
  ShareTrendChart,
  WordCountHistogram,
  KpiTile,
  PromptRow,
} from '@/components/prompt-tracking/PromptTrackingWidgets';

interface PromptTrackingCardProps {
  data?: PromptTrackingResult;
  dashboardData?: ProjectDashboardData;
  domain?: string;
  dateRange?: string;
  isAdmin?: boolean;
}

type FilterMode = 'all' | 'branded' | 'nonBranded' | 'geo' | 'noGeo';
type SortMode = 'impressions' | 'clicks' | 'ctr' | 'position' | 'wordCount';

const MAX_QUERIES_FOR_AI = 200;
const MIN_QUERIES_FOR_AI = 5;

export default function PromptTrackingCard({
  data, dashboardData, domain, dateRange, isAdmin = false,
}: PromptTrackingCardProps) {
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [sortMode, setSortMode] = useState<SortMode>('clicks');
  const [questionTypeFilter, setQuestionTypeFilter] = useState<QuestionType | 'all'>('all');
  const [limit, setLimit] = useState(25);

  const [isClustering, setIsClustering] = useState(false);
  const [clusterResult, setClusterResult] = useState<PromptClusterApiResponse | null>(null);
  const [clusterError, setClusterError] = useState<string | null>(null);
  const [expandedClusterIdx, setExpandedClusterIdx] = useState<number | null>(null);

  const signalInfo = useMemo(
    () => (data ? calculatePromptTrackingSignal(data) : null),
    [data]
  );

  const filtered = useMemo(() => {
    if (!data) return [] as PromptQueryData[];
    let list = data.queries;

    if (filterMode === 'branded') list = list.filter((q) => q.isBranded);
    if (filterMode === 'nonBranded') list = list.filter((q) => !q.isBranded);
    if (filterMode === 'geo') list = list.filter((q) => q.hasGeoReference);
    if (filterMode === 'noGeo') list = list.filter((q) => !q.hasGeoReference);

    if (questionTypeFilter !== 'all') {
      list = list.filter((q) => q.questionType === questionTypeFilter);
    }

    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter((q) => q.query.toLowerCase().includes(s));
    }

    list = [...list].sort((a, b) => {
      switch (sortMode) {
        case 'clicks':       return b.clicks - a.clicks;
        case 'ctr':          return b.ctr - a.ctr;
        case 'position':     return a.position - b.position;
        case 'wordCount':    return b.wordCount - a.wordCount;
        case 'impressions':
        default:             return b.impressions - a.impressions;
      }
    });

    return list;
  }, [data, filterMode, sortMode, questionTypeFilter, search]);
  const queriesForAi = useMemo(() => filtered.slice(0, MAX_QUERIES_FOR_AI), [filtered]); // vor dem fruehen return

  if (!data || data.totals.totalQueries === 0) {
    return (
      <div className="dashboard-widget-surface prompt-tracking-card rounded-lg p-6">
        <div className="mb-3">
          <h3 className="widget-title text-heading">Prompt Tracking</h3>
          <GoogleCleanUnderline id="google-clean-gradient-prompt-tracking-empty" />
        </div>
        <p className="text-muted text-sm">
          Keine prompt-ähnlichen Suchanfragen im gewählten Zeitraum gefunden.
        </p>
      </div>
    );
  }

  const t = data.totals;
  const prev = data.previous;

  const handleExport = () => {
    const header = ['Query', 'Wortzahl', 'Brand', 'Geo', 'Frage-Typ', 'Klicks', 'Impressions', 'CTR', 'Position', 'Top URL'];
    const rows = filtered.map((q) => [
      `"${q.query.replace(/"/g, '""')}"`,
      q.wordCount,
      q.isBranded ? 'Brand' : 'Non-Brand',
      q.hasGeoReference ? 'ja' : 'nein',
      QUESTION_TYPE_LABELS[q.questionType].label,
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
          domain, dateRange,
          queries: queriesForAi.map((q) => ({
            query: q.query, clicks: q.clicks, impressions: q.impressions,
          })),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || err?.details || `HTTP ${res.status}`);
      }
      const result: PromptClusterApiResponse = await res.json();
      setClusterResult(result);
    } catch (err: any) {
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
    <div className="dashboard-widget-surface prompt-tracking-card rounded-lg p-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start gap-4 mb-6">
        <div className="flex-1">
          <div>
            <h3 className="widget-title text-heading">Prompt Tracking</h3>
            <GoogleCleanUnderline id="google-clean-gradient-prompt-tracking" />
          </div>
          <div className="widget-meta flex items-center gap-2 flex-wrap mt-3">
            <span className="bg-surface-tertiary text-body px-2 py-0.5 rounded font-semibold">Quelle: GSC</span>
            <span className="text-faint">•</span>
            <span className="text-muted">AI Mode Proxy</span>
            <span className="text-faint">•</span>
            <span className="text-muted">≥{data.minWords} Wörter</span>
            {data.brandKeywordsUsed && data.brandKeywordsUsed.length > 0 && (
              <span
                className="bg-surface-tertiary text-body px-2 py-0.5 rounded font-medium"
                title={`Brand-Keywords: ${data.brandKeywordsUsed.join(', ')}`}
              >
                {data.brandKeywordsUsed.length} Brand-Keywords
                {data.brandKeywordsSource === 'auto-detected' && ' (auto)'}
              </span>
            )}
          </div>
          <p className="widget-meta text-muted mt-1">
            Konversationsartige Suchanfragen – möglicher AI-Mode-Indikator
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleCluster}
            disabled={!canCluster || isClustering}
            className="widget-control flex items-center gap-2 px-3 py-1.5 rounded-md border border-border text-body bg-surface hover:bg-surface-tertiary disabled:opacity-50 disabled:cursor-not-allowed transition print:hidden"
            title={!canCluster ? `Mindestens ${MIN_QUERIES_FOR_AI} Queries nötig` : `${queriesForAi.length} Queries analysieren`}
          >
            {isClustering ? <><Spinner size={16} className="" />Analysiere...</> : <><WandSparkles className="w-4 h-4" />Mit AI clustern</>}
          </button>
          <button
            onClick={handleExport}
            className="widget-control flex items-center gap-2 px-3 py-1.5 rounded-md border border-border text-body hover:bg-surface-secondary transition"
            title="CSV exportieren"
          >
            <Download className="w-4 h-4" />
            CSV
          </button>
        </div>
      </div>

      {signalInfo && <SignalBadge signal={signalInfo.signal} reasons={signalInfo.reasons} />}

      {/* Haupt-KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <KpiTile
          label="Anteil Sucheinblendungen"
          tooltip="Prompt-Impressionen / alle GSC-Impressionen. Die ehrlichste Einzel-Kennzahl."
          value={`${t.sharePercent.toFixed(1)} %`}
          delta={prev ? t.sharePercent - prev.sharePercent : undefined}
          deltaSuffix=" pp"
          highlight
        />
        <KpiTile
          label="Prompts gefunden"
          tooltip={`Anzahl unterschiedlicher Suchanfragen mit ≥${data.minWords} Wörtern.`}
          value={t.totalQueries.toLocaleString('de-DE')}
          delta={prev ? calcChange(t.totalQueries, prev.totalQueries) : undefined}
          deltaSuffix=" %"
        />
        <KpiTile
          label="Impressionen"
          tooltip="Wie oft Suchergebnisse für prompt-artige Queries angezeigt wurden."
          value={t.totalImpressions.toLocaleString('de-DE')}
          delta={prev ? calcChange(t.totalImpressions, prev.totalImpressions) : undefined}
          deltaSuffix=" %"
        />
        <KpiTile
          label="Klicks"
          tooltip={`Ø CTR ${(t.avgCtr * 100).toFixed(1)} %`}
          value={t.totalClicks.toLocaleString('de-DE')}
          delta={prev ? calcChange(t.totalClicks, prev.totalClicks) : undefined}
          deltaSuffix=" %"
        />
      </div>

      {/* Klassifikations-Row */}
      <ClassificationRow
        brandShare={t.brandedImpressionShare ?? t.brandedShare}
        brandKeywordsSource={data.brandKeywordsSource}
        geoShare={t.geoImpressionShare ?? t.geoShare}
        questionTypeDistribution={t.questionTypeDistribution}
        dominantQuestionType={t.dominantQuestionType}
        totalQueries={t.totalQueries}
      />

      {data.shareTrend && data.shareTrend.length >= 3 && (
        <ShareTrendChart trend={data.shareTrend} />
      )}

      {data.wordCountDistribution && data.wordCountDistribution.some((b) => b.count > 0) && (
        <WordCountHistogram buckets={data.wordCountDistribution} />
      )}

      {clusterError && (
        <div className="mb-5 rounded-lg border border-border bg-danger-bg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-danger shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-900">KI-Analyse fehlgeschlagen</p>
            <p className="text-xs text-danger mt-0.5">{clusterError}</p>
          </div>
          <button onClick={() => setClusterError(null)} className="text-danger hover:opacity-70">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {clusterResult && (
        <ClusterDisplay
          result={clusterResult}
          allQueries={queriesForAi}
          expandedIdx={expandedClusterIdx}
          onToggleExpand={(idx) => setExpandedClusterIdx((c) => (c === idx ? null : idx))}
          onClose={handleClearCluster}
        />
      )}

      {/* Filter */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
          <input
            type="text"
            placeholder="Suchen in Prompts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-md border border-border bg-surface text-body focus:outline-none focus:ring-2 focus:ring-purple-500/30"
          />
        </div>
        <select
          value={filterMode}
          onChange={(e) => setFilterMode(e.target.value as FilterMode)}
          className="px-3 py-2 text-sm rounded-md border border-border bg-surface text-body"
        >
          <option value="all">Alle Queries</option>
          <option value="branded">Nur Brand</option>
          <option value="nonBranded">Nur Non-Brand</option>
          <option value="geo">Nur mit Geo-Bezug</option>
          <option value="noGeo">Nur ohne Geo-Bezug</option>
        </select>
        <select
          value={questionTypeFilter}
          onChange={(e) => setQuestionTypeFilter(e.target.value as QuestionType | 'all')}
          className="px-3 py-2 text-sm rounded-md border border-border bg-surface text-body"
        >
          <option value="all">Alle Frage-Typen</option>
          {(Object.keys(QUESTION_TYPE_LABELS) as QuestionType[]).map((qt) => (
            <option key={qt} value={qt}>
              {QUESTION_TYPE_LABELS[qt].emoji} {QUESTION_TYPE_LABELS[qt].label}
            </option>
          ))}
        </select>
        <select
          value={sortMode}
          onChange={(e) => setSortMode(e.target.value as SortMode)}
          className="px-3 py-2 text-sm rounded-md border border-border bg-surface text-body"
        >
          <option value="impressions">Sort: Impressions</option>
          <option value="clicks">Sort: Klicks</option>
          <option value="ctr">Sort: CTR</option>
          <option value="position">Sort: Position</option>
          <option value="wordCount">Sort: Wortzahl</option>
        </select>
      </div>

      {/* Tabelle */}
      <div className="flex items-center justify-between gap-3 mb-2 px-2">
        <span className="text-xs text-muted">
          {filtered.length} {filtered.length === 1 ? 'Query' : 'Queries'}
          {filtered.length > limit && ` · ${limit} angezeigt`}
        </span>
        <button
          onClick={handleExport}
          disabled={filtered.length === 0}
          className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border border-border text-body hover:bg-surface-secondary disabled:opacity-50 disabled:cursor-not-allowed transition print:hidden"
          title="Tabelle als CSV herunterladen"
        >
          <Download className="w-3.5 h-3.5" />
          CSV
        </button>
      </div>
      <div className="overflow-x-auto -mx-2">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted border-b border-border">
              <th className="px-2 py-2 font-medium">Query</th>
              <th className="px-2 py-2 font-medium text-center">W</th>
              <th className="px-2 py-2 font-medium text-center">Typ</th>
              <th className="px-2 py-2 font-medium text-center">Frage</th>
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
                <td colSpan={9} className="text-center text-muted py-6 text-sm">
                  Keine Treffer für die aktuellen Filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {filtered.length > limit && (
        <div className="mt-4 text-center">
          <button
            onClick={() => setLimit((l) => l + 25)}
            className="text-sm text-accent hover:underline"
          >
            +25 weitere anzeigen ({filtered.length - limit} verbleiben)
          </button>
        </div>
      )}

      <p className="text-xs text-muted mt-4 leading-relaxed">
        💡 <strong>Hinweis:</strong> Längere Queries deuten auf konversationsartige Suchen hin und sind ein
        möglicher Indikator für AI-Mode-/LLM-Anfragen. Methodik nach{' '}
        <a
          href="https://seybold.de/prompt-tracking-in-google-search-console/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-accent"
        >Seybold (2026)</a>.
      </p>

      {isAdmin && (
        <PromptResearchTool data={data} dashboardData={dashboardData} domain={domain} />
      )}
    </div>
  );
}
