// src/components/PromptTrackingCard.tsx
'use client';

import React, { useMemo, useState } from 'react';
import {
  Sparkles, Download, Search, ExternalLink, Wand2, Loader2, X,
  ChevronDown, ChevronUp, Lightbulb, AlertCircle, Info, TrendingUp,
  TrendingDown, Minus, EyeOff, Eye, FileText, MapPin, MessageCircleQuestion,
} from 'lucide-react';
import type {
  PromptTrackingResult,
  PromptQueryData,
  PromptTrackingShareBucket,
  PromptWordCountBucket,
  QuestionTypeDistribution,
} from '@/lib/dashboard-shared';
import { calculatePromptTrackingSignal } from '@/lib/dashboard-shared';
import { QUESTION_TYPE_LABELS, type QuestionType } from '@/lib/prompt-tracking/query-classifier';
import {
  type PromptClusterApiResponse,
  type PromptClusterEntry,
  INTENT_LABELS,
} from '@/lib/prompt-cluster-schema';

interface PromptTrackingCardProps {
  data?: PromptTrackingResult;
  domain?: string;
  dateRange?: string;
}

type FilterMode = 'all' | 'branded' | 'nonBranded' | 'geo' | 'noGeo';
type SortMode = 'impressions' | 'clicks' | 'ctr' | 'position' | 'wordCount';

const MAX_QUERIES_FOR_AI = 200;
const MIN_QUERIES_FOR_AI = 5;

export default function PromptTrackingCard({
  data, domain, dateRange,
}: PromptTrackingCardProps) {
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [sortMode, setSortMode] = useState<SortMode>('impressions');
  const [questionTypeFilter, setQuestionTypeFilter] = useState<QuestionType | 'all'>('all');
  const [limit, setLimit] = useState(25);
  const [anonymized, setAnonymized] = useState(false);

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

    if (anonymized) {
      list = list.map((q) => ({ ...q, query: anonymizeQuery(q.query) }));
    }

    return list;
  }, [data, filterMode, sortMode, questionTypeFilter, search, anonymized]);

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
      anonymized ? '(anonymisiert)' : q.url,
    ]);
    const csv = [header.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `prompt-tracking-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const queriesForAi = useMemo(() => filtered.slice(0, MAX_QUERIES_FOR_AI), [filtered]);
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
    <div className="card-glass p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Sparkles className="w-5 h-5 text-purple-500" />
            <h3 className="text-lg font-semibold">Prompt Tracking</h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
              GSC Proxy
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-muted/70 text-muted-foreground">
              ≥{data.minWords} Wörter
            </span>
            {data.brandKeywordsUsed && data.brandKeywordsUsed.length > 0 && (
              <span
                className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                title={`Brand-Keywords: ${data.brandKeywordsUsed.join(', ')}`}
              >
                {data.brandKeywordsUsed.length} Brand-Keywords
                {data.brandKeywordsSource === 'auto-detected' && ' (auto)'}
              </span>
            )}
          </div>
          <p className="text-muted text-xs mt-1">
            Konversationsartige Suchanfragen – möglicher AI-Mode-Indikator
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setAnonymized((v) => !v)}
            className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-md border border-border hover:bg-muted/50 transition print:hidden"
            title={anonymized ? 'Originale Queries anzeigen' : 'Queries anonymisieren'}
          >
            {anonymized ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            {anonymized ? 'Original' : 'Demo'}
          </button>
          <button
            onClick={handleCluster}
            disabled={!canCluster || isClustering}
            className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-md bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition print:hidden"
            title={!canCluster ? `Mindestens ${MIN_QUERIES_FOR_AI} Queries nötig` : `${queriesForAi.length} Queries analysieren`}
          >
            {isClustering ? <><Loader2 className="w-4 h-4 animate-spin" />Analysiere...</> : <><Wand2 className="w-4 h-4" />Mit AI clustern</>}
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-md border border-border hover:bg-muted/50 transition"
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
          tooltip="Anzahl unterschiedlicher Suchanfragen mit ≥10 Wörtern."
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

      {/* Klassifikations-Row: Brand klein + Geo + Frage-Typ */}
      <ClassificationRow
        brandShare={t.brandedShare}
        brandKeywordsSource={data.brandKeywordsSource}
        geoShare={t.geoShare}
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
        <div className="mb-5 rounded-lg border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20 p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-900 dark:text-red-200">KI-Analyse fehlgeschlagen</p>
            <p className="text-xs text-red-700 dark:text-red-300 mt-0.5">{clusterError}</p>
          </div>
          <button onClick={() => setClusterError(null)} className="text-red-600 dark:text-red-400 hover:opacity-70">
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
          anonymized={anonymized}
        />
      )}

      {/* Filter */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
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
          <option value="geo">Nur mit Geo-Bezug</option>
          <option value="noGeo">Nur ohne Geo-Bezug</option>
        </select>
        <select
          value={questionTypeFilter}
          onChange={(e) => setQuestionTypeFilter(e.target.value as QuestionType | 'all')}
          className="px-3 py-2 text-sm rounded-md border border-border bg-background"
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
          className="px-3 py-2 text-sm rounded-md border border-border bg-background"
        >
          <option value="impressions">Sort: Impressions</option>
          <option value="clicks">Sort: Klicks</option>
          <option value="ctr">Sort: CTR</option>
          <option value="position">Sort: Position</option>
          <option value="wordCount">Sort: Wortzahl</option>
        </select>
      </div>

      {/* Tabelle */}
      <div className="overflow-x-auto -mx-2">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
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
              <PromptRow key={`${q.query}-${idx}`} q={q} anonymized={anonymized} />
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
            className="text-sm text-purple-600 dark:text-purple-400 hover:underline"
          >
            +25 weitere anzeigen ({filtered.length - limit} verbleiben)
          </button>
        </div>
      )}

      <p className="text-xs text-muted mt-4 leading-relaxed">
        💡 <strong>Hinweis:</strong> Lange Queries deuten auf konversationsartige Suchen hin und sind ein
        möglicher Indikator für AI-Mode-/LLM-Anfragen. Methodik nach{' '}
        <a
          href="https://seybold.de/prompt-tracking-in-google-search-console/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-purple-600"
        >Seybold (2026)</a>.
      </p>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// ClassificationRow – Brand klein + Geo + Frage-Typ
// ════════════════════════════════════════════════════════════════════

function ClassificationRow({
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
    brandKeywordsSource === 'configured'      ? 'Brand-Keywords manuell konfiguriert' :
    brandKeywordsSource === 'auto-detected'   ? 'Brand-Keywords automatisch erkannt (Domain + Page-Title + GSC Top-Queries)' :
    brandKeywordsSource === 'domain-heuristic'? 'Heuristik aus Domain-Wurzel. Brand-Keywords im Settings setzen für bessere Erkennung.' :
                                                'Keine Brand-Erkennung möglich';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
      {/* Brand-Tile (klein, mit Erklärung) */}
      <div className="rounded-md border border-border bg-background/40 p-3">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Brand-Anteil</span>
          <span title={sourceTooltip} className="cursor-help ml-auto">
            <Info className="w-3 h-3 opacity-60" />
          </span>
        </div>
        <div className="text-base font-semibold tabular-nums">
          {brandShare.toFixed(1)} %
        </div>
        <div className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
          {brandShare < 5
            ? 'Long-Tail ist meist generisch — bei B2B normal'
            : brandShare < 30
              ? 'Mischung aus Brand- und Themen-Suche'
              : 'Hohe Markenbekanntheit erkennbar'}
        </div>
      </div>

      {/* Geo-Tile */}
      <div className="rounded-md border border-border bg-background/40 p-3">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1">
          <MapPin className="w-3.5 h-3.5" />
          <span>Geo-Bezug</span>
          <span
            title='Anteil Queries mit Stadt-, Bundesland- oder Lokalbezug (z.B. "wien", "in der nähe", PLZ etc.). Hoch = lokale Relevanz.'
            className="cursor-help ml-auto"
          >
            <Info className="w-3 h-3 opacity-60" />
          </span>
        </div>
        <div className="text-base font-semibold tabular-nums">
          {geoShare.toFixed(1)} %
        </div>
        <div className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
          {geoShare > 30 ? 'Stark lokalbezogene Suchen' :
           geoShare > 10 ? 'Teilweise mit Ortsbezug' :
           'Überwiegend ortsunabhängig'}
        </div>
      </div>

      {/* Dominanter Frage-Typ */}
      <div className="rounded-md border border-border bg-background/40 p-3">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1">
          <MessageCircleQuestion className="w-3.5 h-3.5" />
          <span>Dominanter Frage-Typ</span>
          <span
            title="Welcher Frage-Typ in deinen Long-Tail-Queries dominiert. Direkter Hinweis auf passenden Content (FAQ, Vergleichsseite, Preisseite, etc.)"
            className="cursor-help ml-auto"
          >
            <Info className="w-3 h-3 opacity-60" />
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-base">{QUESTION_TYPE_LABELS[dominantQuestionType].emoji}</span>
          <span className="text-base font-semibold">
            {QUESTION_TYPE_LABELS[dominantQuestionType].label}
          </span>
        </div>
        <div className="text-[10px] text-muted-foreground mt-0.5 leading-tight tabular-nums">
          {dominantPct.toFixed(0)} % der Queries
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// Sub-Components
// ════════════════════════════════════════════════════════════════════

function SignalBadge({ signal, reasons }: { signal: 'strong' | 'weak' | 'insufficient'; reasons: string[] }) {
  const cfg = {
    strong:       { label: 'Starkes Signal',  color: 'text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/20 border-green-300 dark:border-green-700', icon: '🟢' },
    weak:         { label: 'Schwaches Signal', color: 'text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700', icon: '🟡' },
    insufficient: { label: 'Zu wenig Daten',   color: 'text-gray-700 dark:text-gray-400 bg-gray-100 dark:bg-gray-900/30 border-gray-300 dark:border-gray-700', icon: '⚪' },
  }[signal];

  return (
    <div className={`mb-4 rounded-md border px-3 py-2 ${cfg.color}`}>
      <div className="flex items-start gap-2 text-sm">
        <span className="shrink-0">{cfg.icon}</span>
        <div className="flex-1">
          <div className="font-semibold">{cfg.label}</div>
          {reasons.length > 0 && (
            <ul className="text-xs mt-0.5 opacity-90 leading-relaxed">
              {reasons.map((r, i) => <li key={i}>· {r}</li>)}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function ShareTrendChart({ trend }: { trend: PromptTrackingShareBucket[] }) {
  const max = Math.max(...trend.map((b) => b.sharePercent), 0.1);
  const last = trend[trend.length - 1];
  const first = trend[0];
  const direction =
    last.sharePercent > first.sharePercent * 1.05 ? 'up' :
    last.sharePercent < first.sharePercent * 0.95 ? 'down' : 'flat';

  return (
    <div className="mb-4 rounded-md border border-border bg-background/40 p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
          <Info className="w-3 h-3" />
          Anteil prompt-Queries über Zeit
        </div>
        <div className="flex items-center gap-1 text-xs">
          {direction === 'up' && <><TrendingUp className="w-3 h-3 text-green-600" /><span className="text-green-700 dark:text-green-400 font-medium">steigend</span></>}
          {direction === 'down' && <><TrendingDown className="w-3 h-3 text-red-600" /><span className="text-red-700 dark:text-red-400 font-medium">fallend</span></>}
          {direction === 'flat' && <><Minus className="w-3 h-3 text-muted-foreground" /><span className="text-muted-foreground">stabil</span></>}
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
                className="w-full rounded-t bg-purple-400 dark:bg-purple-600 group-hover:bg-purple-500 dark:group-hover:bg-purple-500 transition relative"
                style={{ height: `${Math.max(height, 4)}%`, minHeight: '4px' }}
              >
                <span className="hidden group-hover:block absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] tabular-nums whitespace-nowrap text-foreground">
                  {bucket.sharePercent.toFixed(1)}%
                </span>
              </div>
              <span className="text-[10px] text-muted-foreground tabular-nums truncate w-full text-center">
                {bucket.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WordCountHistogram({ buckets }: { buckets: PromptWordCountBucket[] }) {
  const maxCount = Math.max(...buckets.map((b) => b.count), 1);
  return (
    <div className="mb-4 rounded-md border border-border bg-background/40 p-3">
      <div className="flex items-center gap-1.5 mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
        <Info className="w-3 h-3" />
        Wortzahl-Verteilung
      </div>
      <div className="space-y-1.5">
        {buckets.map((b) => {
          const pct = (b.count / maxCount) * 100;
          return (
            <div key={b.range} className="flex items-center gap-2 text-xs">
              <span className="w-12 text-muted-foreground tabular-nums shrink-0">{b.range} W</span>
              <div className="flex-1 h-4 bg-muted/50 rounded overflow-hidden">
                <div className="h-full bg-purple-400/70 dark:bg-purple-600/70 rounded" style={{ width: `${pct}%` }} />
              </div>
              <span className="w-12 text-right tabular-nums text-foreground/80">{b.count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface ClusterDisplayProps {
  result: PromptClusterApiResponse;
  allQueries: PromptQueryData[];
  expandedIdx: number | null;
  onToggleExpand: (idx: number) => void;
  onClose: () => void;
  anonymized: boolean;
}

function ClusterDisplay({
  result, allQueries, expandedIdx, onToggleExpand, onClose, anonymized,
}: ClusterDisplayProps) {
  const { clusters, insights, meta } = result;

  const handleMarkdownExport = () => {
    const md = buildMarkdown(result, allQueries, anonymized);
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `prompt-cluster-briefing-${new Date().toISOString().split('T')[0]}.md`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className="mb-5 rounded-lg border border-purple-200 dark:border-purple-800 bg-gradient-to-br from-purple-50/50 to-blue-50/50 dark:from-purple-950/20 dark:to-blue-950/20 p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Wand2 className="w-5 h-5 text-purple-600" />
          <h4 className="font-semibold">KI-Analyse: {clusters.length} Cluster erkannt</h4>
          <span className="text-xs text-muted-foreground">
            {meta.queriesAnalyzed} Queries · {(meta.elapsedMs / 1000).toFixed(1)}s · {meta.model}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={handleMarkdownExport} className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-border hover:bg-muted/50 transition" title="Markdown-Briefing exportieren">
            <FileText className="w-3.5 h-3.5" />
            MD
          </button>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
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
                <span key={i} className="px-2 py-0.5 rounded-full bg-muted/70 text-foreground">{attr}</span>
              ))}
            </div>
          </div>
        </div>
        {insights.contentGaps.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border">
            <div className="font-medium text-muted-foreground text-xs mb-1.5">Content-Lücken & Empfehlungen</div>
            <ul className="text-xs space-y-1 list-disc list-inside marker:text-purple-500">
              {insights.contentGaps.map((gap, i) => <li key={i}>{gap}</li>)}
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
            anonymized={anonymized}
          />
        ))}
      </div>
    </div>
  );
}

function ClusterCard({ cluster, allQueries, isExpanded, onToggleExpand, anonymized }: {
  cluster: PromptClusterEntry;
  allQueries: PromptQueryData[];
  isExpanded: boolean;
  onToggleExpand: () => void;
  anonymized: boolean;
}) {
  const intentMeta = INTENT_LABELS[cluster.intent];
  const clusterQueries = cluster.queryIndices
    .map((i) => allQueries[i])
    .filter((q): q is PromptQueryData => Boolean(q));

  const totalImpressions = clusterQueries.reduce((s, q) => s + q.impressions, 0);
  const totalClicks = clusterQueries.reduce((s, q) => s + q.clicks, 0);

  return (
    <div className="rounded-md bg-background/60 border border-border p-4">
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
      <p className="text-xs text-muted-foreground leading-relaxed mb-3">{cluster.description}</p>
      <div className="flex gap-4 text-xs mb-3 tabular-nums">
        <div><span className="text-muted-foreground">Impr.:</span> <span className="font-medium">{totalImpressions.toLocaleString('de-DE')}</span></div>
        <div><span className="text-muted-foreground">Klicks:</span> <span className="font-medium">{totalClicks.toLocaleString('de-DE')}</span></div>
      </div>
      <div className="flex flex-wrap gap-1 mb-3">
        {cluster.topAttributes.map((attr, i) => (
          <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
            {attr}
          </span>
        ))}
      </div>
      <button onClick={onToggleExpand} className="flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400 hover:underline">
        {isExpanded ? <><ChevronUp className="w-3 h-3" /> verbergen</> : <><ChevronDown className="w-3 h-3" /> {clusterQueries.length} Queries anzeigen</>}
      </button>
      {isExpanded && (
        <ul className="mt-3 pt-3 border-t border-border space-y-1.5">
          {clusterQueries
            .sort((a, b) => b.impressions - a.impressions)
            .map((q, i) => (
              <li key={i} className="text-xs flex items-start gap-2">
                <span className="text-muted-foreground tabular-nums shrink-0">{q.impressions.toLocaleString('de-DE')}</span>
                <span className="text-foreground/90 leading-snug">{anonymized ? anonymizeQuery(q.query) : q.query}</span>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}

function KpiTile({ label, value, sub, delta, deltaSuffix = '', tooltip, highlight }:
  { label: string; value: string; sub?: string; delta?: number; deltaSuffix?: string; tooltip?: string; highlight?: boolean; }
) {
  return (
    <div className={`rounded-lg border bg-background/50 p-3 relative ${highlight ? 'border-purple-300 dark:border-purple-700 ring-1 ring-purple-200 dark:ring-purple-900/30' : 'border-border'}`}>
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <span>{label}</span>
        {tooltip && <span title={tooltip} className="cursor-help"><Info className="w-3 h-3 opacity-60" /></span>}
      </div>
      <div className="text-xl font-semibold mt-0.5 tabular-nums">{value}</div>
      {delta !== undefined && (
        <div className={`text-[11px] mt-0.5 tabular-nums flex items-center gap-0.5 ${delta > 0 ? 'text-green-600 dark:text-green-400' : delta < 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
          {delta > 0 ? <TrendingUp className="w-3 h-3" /> : delta < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
          {delta > 0 ? '+' : ''}{delta.toFixed(1)}{deltaSuffix} vs. Vorperiode
        </div>
      )}
      {sub && !delta && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

function PromptRow({ q, anonymized }: { q: PromptQueryData; anonymized: boolean }) {
  const qtMeta = QUESTION_TYPE_LABELS[q.questionType];
  return (
    <tr className="border-b border-border/50 hover:bg-muted/30 transition">
      <td className="px-2 py-2 max-w-[380px]">
        <div className="flex items-center gap-1.5">
          {q.hasGeoReference && <MapPin className="w-3 h-3 text-emerald-500 shrink-0" aria-label="Geo-Bezug" />}
          <span className="truncate" title={q.query}>{q.query}</span>
        </div>
      </td>
      <td className="px-2 py-2 text-center">
        <span className="inline-block min-w-[28px] text-xs px-2 py-0.5 rounded-full bg-muted/70 tabular-nums">{q.wordCount}</span>
      </td>
      <td className="px-2 py-2 text-center">
        {q.isBranded
          ? <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">Brand</span>
          : <span className="text-xs px-2 py-0.5 rounded-full bg-muted/50 text-muted-foreground">Non-Brand</span>}
      </td>
      <td className="px-2 py-2 text-center">
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full whitespace-nowrap ${qtMeta.color}`} title={qtMeta.label}>
          {qtMeta.emoji}
        </span>
      </td>
      <td className="px-2 py-2 text-right tabular-nums">{q.impressions.toLocaleString('de-DE')}</td>
      <td className="px-2 py-2 text-right tabular-nums">{q.clicks.toLocaleString('de-DE')}</td>
      <td className="px-2 py-2 text-right tabular-nums">{(q.ctr * 100).toFixed(1)}%</td>
      <td className="px-2 py-2 text-right tabular-nums">{q.position.toFixed(1)}</td>
      <td className="px-2 py-2">
        {q.url && !anonymized && (
          <a href={q.url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground" title={q.url}>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </td>
    </tr>
  );
}

function calcChange(current: number, previous: number): number {
  if (!previous || previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

function anonymizeQuery(query: string): string {
  const stopwords = new Set([
    'der','die','das','den','dem','des','ein','eine','einer','einen','eines',
    'und','oder','aber','wenn','dass','weil','als','wie','was','wer','wo',
    'wann','warum','welche','welcher','welches','gibt','es','ist','sind',
    'war','waren','hat','haben','hatte','hatten','wird','werden','wurde',
    'in','an','auf','für','mit','von','zu','nach','bei','aus','um','über',
    'unter','vor','hinter','neben','zwischen','seit','bis','durch','gegen',
    'ohne','statt','während','wegen','trotz','noch','nicht','kein','keine',
    'auch','nur','schon','doch','ja','nein','sehr','mehr','weniger','viel',
    'wenig','alle','viele','einige','manche','jede','jeder','jedes',
    'mein','meine','dein','deine','sein','seine','ihr','ihre','unser',
    'einfach','besser','beste','gut','gute','am','to','for','with','of',
    'a','an','the','is','are','was','what','how','which','where','when',
  ]);
  return query
    .split(/\s+/)
    .map((w) => {
      const clean = w.toLowerCase().replace(/[^\wäöüß]/g, '');
      if (stopwords.has(clean) || w.length <= 2) return w;
      return '█'.repeat(Math.max(3, Math.min(w.length, 8)));
    })
    .join(' ');
}

function buildMarkdown(
  result: PromptClusterApiResponse,
  allQueries: PromptQueryData[],
  anonymized: boolean
): string {
  const { clusters, insights, meta } = result;
  const lines: string[] = [];
  lines.push(`# Prompt Cluster Briefing`);
  lines.push('');
  lines.push(`*Generiert am ${new Date(meta.generatedAt).toLocaleString('de-DE')} mit ${meta.model}*`);
  lines.push(`*Basis: ${meta.queriesAnalyzed} prompt-artige Suchanfragen*`);
  lines.push('');
  lines.push(`## 🔍 Gesamtbild`);
  lines.push('');
  lines.push(insights.summary);
  lines.push('');
  lines.push(`**Dominanter Intent:** ${insights.dominantIntent}`);
  lines.push('');
  lines.push(`**Top-Attribute:** ${insights.dominantAttributes.join(', ')}`);
  lines.push('');
  if (insights.contentGaps.length > 0) {
    lines.push(`## ✏️ Content-Lücken & Empfehlungen`);
    lines.push('');
    insights.contentGaps.forEach((gap) => lines.push(`- ${gap}`));
    lines.push('');
  }
  lines.push(`## 📚 Cluster im Detail`);
  lines.push('');
  clusters.forEach((cluster, idx) => {
    const queries = cluster.queryIndices.map((i) => allQueries[i]).filter((q): q is PromptQueryData => Boolean(q));
    lines.push(`### ${idx + 1}. ${cluster.theme}`);
    lines.push('');
    lines.push(`**Intent:** ${cluster.intent}  `);
    lines.push(`**Anzahl Queries:** ${queries.length}  `);
    lines.push(`**Top-Attribute:** ${cluster.topAttributes.join(', ')}`);
    lines.push('');
    lines.push(cluster.description);
    lines.push('');
    lines.push('**Beispiel-Queries (Top 10):**');
    lines.push('');
    queries.sort((a, b) => b.impressions - a.impressions).slice(0, 10).forEach((q) => {
      const text = anonymized ? anonymizeQuery(q.query) : q.query;
      lines.push(`- _${text}_ (${q.impressions} Impr., ${q.clicks} Klicks)`);
    });
    lines.push('');
  });
  lines.push(`---`);
  lines.push(`*Methodik nach Seybold (2026): https://seybold.de/prompt-tracking-in-google-search-console/*`);
  return lines.join('\n');
}
