// src/components/PromptTrackingCard.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Sparkles, Download, Search, ExternalLink, Wand2, Loader2, X,
  ChevronDown, ChevronUp, Lightbulb, AlertCircle, Info, TrendingUp,
  TrendingDown, Minus, FileText, MapPin, MessageCircleQuestion,
  Copy, ClipboardCheck, Target,
} from 'lucide-react';
import type {
  ProjectDashboardData,
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

  if (!data || data.totals.totalQueries === 0) {
    return (
      <div className="card-glass prompt-tracking-card p-6">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-5 h-5 text-purple-500" />
          <h3 className="text-lg font-semibold text-heading">Prompt Tracking (GSC)</h3>
          <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
            AI Mode Proxy
          </span>
        </div>
        <p className="text-muted text-sm">
          Keine prompt-ähnlichen Suchanfragen im gewählten Zeitraum gefunden.
        </p>
        {isAdmin && (
          <PromptResearchTool data={data} dashboardData={dashboardData} domain={domain} />
        )}
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
    <div className="card-glass prompt-tracking-card p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Sparkles className="w-5 h-5 text-purple-500" />
            <h3 className="text-lg font-semibold text-heading">Prompt Tracking</h3>
            <span className="prompt-pill prompt-pill-purple">
              GSC Proxy
            </span>
            <span className="prompt-pill prompt-pill-slate">
              ≥{data.minWords} Wörter
            </span>
            {data.brandKeywordsUsed && data.brandKeywordsUsed.length > 0 && (
              <span
                className="prompt-pill prompt-pill-blue"
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
            onClick={handleCluster}
            disabled={!canCluster || isClustering}
            className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-md bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition print:hidden"
            title={!canCluster ? `Mindestens ${MIN_QUERIES_FOR_AI} Queries nötig` : `${queriesForAi.length} Queries analysieren`}
          >
            {isClustering ? <><Loader2 className="w-4 h-4 animate-spin" />Analysiere...</> : <><Wand2 className="w-4 h-4" />Mit AI clustern</>}
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-md border border-border text-body hover:bg-surface-secondary transition"
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
      <div className="overflow-x-auto -mx-2">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-muted border-b border-border">
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
            className="text-sm text-purple-600 dark:text-purple-400 hover:underline"
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
          className="underline hover:text-purple-600"
        >Seybold (2026)</a>.
      </p>

      {isAdmin && (
        <PromptResearchTool data={data} dashboardData={dashboardData} domain={domain} />
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// Admin-only Prompt Research Tool
// ════════════════════════════════════════════════════════════════════

interface ResearchOpportunity {
  rank: number;
  score: number;
  topic: string;
  prompt: string;
  source: 'GSC' | 'GA4' | 'GSC + GA4';
  intent: 'Quick Win' | 'Buy Intent' | 'Optimierung';
  reason: string;
  action: string;
}

interface ResearchSetup {
  domainLabel: string;
  industry: string;
  region: string;
  projectName: string;
  landingPage: string;
  topic: string;
  includeBrand: boolean;
  isLegal: boolean;
}

interface ResearchSetupOverrides {
  industry?: string;
  region?: string;
  landingPage?: string;
  topic?: string;
  includeBrand?: boolean;
}

function PromptResearchTool({
  data,
  dashboardData,
  domain,
}: {
  data?: PromptTrackingResult;
  dashboardData?: ProjectDashboardData;
  domain?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [isGeneratingResearch, setIsGeneratingResearch] = useState(false);
  const [researchError, setResearchError] = useState<string | null>(null);
  const [dataMaxOpportunities, setDataMaxOpportunities] = useState<ResearchOpportunity[] | null>(null);
  const baseSetup = useMemo(
    () => buildResearchSetup(data, dashboardData, domain),
    [data, dashboardData, domain]
  );
  const [setupOverrides, setSetupOverrides] = useState<ResearchSetupOverrides>({});

  const setup = useMemo(
    () => ({ ...baseSetup, ...setupOverrides }),
    [baseSetup, setupOverrides]
  );
  const summary = useMemo(
    () => buildResearchDataSummary(data, dashboardData, setup),
    [data, dashboardData, setup]
  );
  const opportunities = useMemo(
    () => buildResearchOpportunities(data, dashboardData, setup),
    [data, dashboardData, setup]
  );
  const displayedOpportunities = dataMaxOpportunities ?? opportunities;

  useEffect(() => {
    setDataMaxOpportunities(null);
  }, [setup]);

  const handleCopy = async () => {
    const text = displayedOpportunities
      .map((item) => `${item.rank}. [${item.intent} | Score ${item.score}] ${item.prompt}`)
      .join('\n');
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const handleGenerateResearch = async () => {
    if (isGeneratingResearch) return;
    setIsGeneratingResearch(true);
    setResearchError(null);
    try {
      const res = await fetch('/api/prompt-tracking/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          setup,
          queries: (data?.queries ?? []).slice(0, 60).map((query) => ({
            query: query.query,
            clicks: query.clicks,
            impressions: query.impressions,
            ctr: query.ctr,
            position: query.position,
            url: query.url,
          })),
          landingPages: (dashboardData?.topConvertingPages ?? []).slice(0, 12).map((page) => ({
            path: page.path,
            conversions: page.conversions ?? 0,
            conversionRate: page.conversionRate ?? 0,
            sessions: page.sessions ?? 0,
          })),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || err?.details || `HTTP ${res.status}`);
      }
      const result = await res.json();
      const ranked = (result.opportunities ?? []).map((item: Omit<ResearchOpportunity, 'rank'>, idx: number) => ({
        ...item,
        rank: idx + 1,
      }));
      setDataMaxOpportunities(ranked);
    } catch (error: any) {
      setResearchError(error?.message || 'DataMax konnte keine Prompts generieren.');
    } finally {
      setIsGeneratingResearch(false);
    }
  };

  return (
    /* ── Clean surface card with amber left accent for "Admin only" ── */
    <section className="mt-5 mb-5 rounded-lg shadow-card bg-surface-secondary dark:bg-surface-tertiary p-4 print:hidden border-l-4 border-l-amber-400 dark:border-l-amber-500">
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <Target className="w-5 h-5 text-amber-600" />
            <h4 className="font-semibold text-heading">Prompt Research Tool</h4>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800">
              Nur Admins
            </span>
          </div>
          <p className="text-xs text-muted mt-1 leading-relaxed">
            Research-Workflow aus Projekt-Setup, GA4/GSC-Signalen, Quick-Wins und gerankten Decision-Prompts.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleGenerateResearch}
            disabled={isGeneratingResearch}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border border-amber-300 bg-surface text-amber-800 hover:bg-surface-secondary disabled:opacity-50 disabled:cursor-not-allowed transition dark:text-amber-200 dark:hover:bg-surface-tertiary"
          >
            {isGeneratingResearch ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
            Mit DataMax generieren
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md bg-amber-600 text-white hover:bg-amber-700 transition"
          >
            {copied ? <ClipboardCheck className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Kopiert' : 'Prompts kopieren'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-3 mb-4">
        <ResearchStep
          step="01"
          title="Setup"
          lines={[
            `Domain: ${setup.domainLabel}`,
            `Branche: ${setup.industry}`,
            `Region: ${setup.region}`,
            `Landingpage: ${setup.landingPage || 'nicht gesetzt'}`,
            `Thema: ${setup.topic || 'aus Daten abgeleitet'}`,
            `Brand: ${setup.includeBrand ? 'mit Brand' : 'ohne Brand'}`,
          ]}
        />
        <ResearchStep
          step="02"
          title="Daten"
          lines={[
            `GSC: ${summary.gscQueries} Prompt-Queries, ${summary.gscImpressions} Impr., ${summary.gscClicks} Klicks`,
            `GA4: ${summary.ga4Sessions} Sessions, ${summary.ga4Conversions} Conversions`,
            `KI-Traffic: ${summary.aiSessions} Sessions`,
          ]}
        />
        <ResearchStep
          step="03"
          title="Analyse"
          lines={[
            `${summary.quickWins} Quick-Win-Kandidaten`,
            `${summary.buyIntent} Buy-Intent-Queries`,
            `${summary.optimizationCandidates} Optimierungskandidaten`,
          ]}
        />
        <ResearchStep
          step="04"
          title="Prompts"
          lines={[
            `${displayedOpportunities.length} Decision-Prompts`,
            dataMaxOpportunities ? 'DataMax-generiertes Ranking' : 'Fallback-Ranking nach Datenlogik',
            'Direkt kopierbar für LLM-Tests',
          ]}
        />
      </div>

      {researchError && (
        <div className="mb-4 rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 p-3 text-xs text-red-700 dark:text-red-300">
          {researchError}
        </div>
      )}

      {/* Setup fields */}
      <div className="rounded-md shadow-sm bg-surface p-3 mb-4">
        <div className="text-xs font-semibold text-heading mb-3">Setup-Felder</div>
        <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr_150px] gap-3 mb-3">
          <SetupField
            label="Landingpage"
            value={setup.landingPage}
            placeholder="/leistungen/scheidung"
            onChange={(value) => setSetupOverrides((current) => ({ ...current, landingPage: value }))}
          />
          <SetupField
            label="Thema"
            value={setup.topic}
            placeholder="Scheidungsanwalt Wien"
            onChange={(value) => setSetupOverrides((current) => ({ ...current, topic: value }))}
          />
          <label className="flex flex-col gap-1 text-xs font-medium text-muted">
            Brand-Modus
            <select
              value={setup.includeBrand ? 'brand' : 'nonbrand'}
              onChange={(event) => setSetupOverrides((current) => ({ ...current, includeBrand: event.target.value === 'brand' }))}
              className="px-3 py-2 text-sm rounded-md border border-border bg-surface text-body"
            >
              <option value="brand">mit Brand</option>
              <option value="nonbrand">ohne Brand</option>
            </select>
          </label>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <SetupField
            label="Branche"
            value={setup.industry}
            placeholder="Rechtsanwalt / Kanzlei"
            onChange={(value) => setSetupOverrides((current) => ({ ...current, industry: value }))}
          />
          <SetupField
            label="Region"
            value={setup.region}
            placeholder="Wien"
            onChange={(value) => setSetupOverrides((current) => ({ ...current, region: value }))}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-4">
        <ResearchInsight
          label="Quick Wins"
          items={displayedOpportunities.filter((item) => item.intent === 'Quick Win').slice(0, 3)}
        />
        <ResearchInsight
          label="Buy-Intent"
          items={displayedOpportunities.filter((item) => item.intent === 'Buy Intent').slice(0, 3)}
        />
        <ResearchInsight
          label="Optimierung"
          items={displayedOpportunities.filter((item) => item.intent === 'Optimierung').slice(0, 3)}
        />
      </div>

      <div className="space-y-2">
        {displayedOpportunities.map((item) => (
          <div key={`${item.rank}-${item.topic}-${item.intent}`} className="grid grid-cols-[44px_1fr] lg:grid-cols-[44px_120px_1fr_110px] gap-3 rounded-md shadow-sm bg-surface p-3">
            <div className="text-lg font-bold tabular-nums text-amber-700 dark:text-amber-300">#{item.rank}</div>
            <div className="hidden lg:block">
              <div className="text-[10px] uppercase tracking-wide font-semibold text-muted">{item.intent}</div>
              <div className="text-xs font-medium tabular-nums text-body">Score {item.score}</div>
              <div className="text-[10px] text-muted">{item.source}</div>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1 lg:hidden">
                <span className="text-[10px] uppercase tracking-wide font-semibold text-muted">{item.intent}</span>
                <span className="text-xs font-medium tabular-nums text-body">Score {item.score}</span>
                <span className="text-[10px] text-muted">{item.source}</span>
              </div>
              <div className="text-[11px] text-muted mb-1">{item.topic}</div>
              <p className="text-sm leading-relaxed text-body">{item.prompt}</p>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] leading-relaxed text-muted">
                <span>{item.reason}</span>
                {setup.landingPage && normalizePath(setup.landingPage) !== '/' && (
                  <span>· Zielseite: {normalizePath(setup.landingPage)}</span>
                )}
              </div>
            </div>
            <div className="col-span-2 lg:col-span-1 text-[11px] leading-relaxed text-muted lg:text-right">
              {item.action}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ResearchStep({ step, title, lines }: { step: string; title: string; lines: string[] }) {
  return (
    <div className="rounded-md shadow-sm bg-surface p-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 tabular-nums">{step}</span>
        <span className="text-sm font-semibold text-heading">{title}</span>
      </div>
      <ul className="space-y-1">
        {lines.map((line) => (
          <li key={line} className="text-xs leading-relaxed text-muted">{line}</li>
        ))}
      </ul>
    </div>
  );
}

function SetupField({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-muted">
      {label}
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="px-3 py-2 text-sm rounded-md border border-border bg-surface text-body focus:outline-none focus:ring-2 focus:ring-amber-500/30"
      />
    </label>
  );
}

function ResearchInsight({ label, items }: { label: string; items: ResearchOpportunity[] }) {
  return (
    <div className="rounded-md shadow-sm bg-surface p-3">
      <div className="text-xs font-semibold text-heading mb-2">{label}</div>
      {items.length > 0 ? (
        <ul className="space-y-1.5">
          {items.map((item) => (
            <li key={`${item.rank}-${item.topic}`} className="text-xs text-muted leading-snug">
              <span className="font-medium text-body">#{item.rank}</span> {item.topic}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted">Keine klaren Kandidaten im aktuellen Zeitraum.</p>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// ClassificationRow
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
    brandKeywordsSource === 'configured'       ? 'Brand-Keywords manuell konfiguriert' :
    brandKeywordsSource === 'auto-detected'    ? 'Brand-Keywords automatisch erkannt (Domain + Page-Title)' :
    brandKeywordsSource === 'domain-heuristic' ? 'Heuristik aus Domain-Wurzel. Brand-Keywords im Settings setzen für bessere Erkennung.' :
                                                 'Keine Brand-Erkennung möglich';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
      <div className="rounded-md shadow-sm bg-surface-secondary p-3">
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
        <div className="text-[10px] text-muted mt-0.5 leading-tight">
          {brandShare < 5
            ? 'Long-Tail ist meist generisch — bei B2B normal'
            : brandShare < 30
              ? 'Mischung aus Brand- und Themen-Suche'
              : 'Hohe Markenbekanntheit erkennbar'}
        </div>
      </div>

      <div className="rounded-md shadow-sm bg-surface-secondary p-3">
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
        <div className="text-[10px] text-muted mt-0.5 leading-tight">
          {geoShare > 30 ? 'Stark lokalbezogene Suchen' :
           geoShare > 10 ? 'Teilweise mit Ortsbezug' :
           'Überwiegend ortsunabhängig'}
        </div>
      </div>

      <div className="rounded-md shadow-sm bg-surface-secondary p-3">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted mb-1">
          <MessageCircleQuestion className="w-3.5 h-3.5" />
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
        <div className="text-[10px] text-muted mt-0.5 leading-tight tabular-nums">
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

function ShareTrendChart({ trend }: { trend: PromptTrackingShareBucket[] }) {
  const max = Math.max(...trend.map((b) => b.sharePercent), 0.1);
  const last = trend[trend.length - 1];
  const first = trend[0];
  const direction =
    last.sharePercent > first.sharePercent * 1.05 ? 'up' :
    last.sharePercent < first.sharePercent * 0.95 ? 'down' : 'flat';

  return (
    <div className="mb-4 rounded-md shadow-sm bg-surface-secondary p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted uppercase tracking-wider">
          <Info className="w-3 h-3" />
          Anteil prompt-Queries über Zeit
        </div>
        <div className="flex items-center gap-1 text-xs">
          {direction === 'up' && <><TrendingUp className="w-3 h-3 text-green-600" /><span className="text-green-700 dark:text-green-400 font-medium">steigend</span></>}
          {direction === 'down' && <><TrendingDown className="w-3 h-3 text-red-600" /><span className="text-red-700 dark:text-red-400 font-medium">fallend</span></>}
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
                className="w-full rounded-t bg-purple-400 dark:bg-purple-600 group-hover:bg-purple-500 dark:group-hover:bg-purple-500 transition relative"
                style={{ height: `${Math.max(height, 4)}%`, minHeight: '4px' }}
              >
                <span className="hidden group-hover:block absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] tabular-nums whitespace-nowrap text-body">
                  {bucket.sharePercent.toFixed(1)}%
                </span>
              </div>
              <span className="text-[10px] text-muted tabular-nums truncate w-full text-center">
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
    <div className="mb-4 rounded-md shadow-sm bg-surface-secondary p-3">
      <div className="flex items-center gap-1.5 mb-2 text-xs font-medium text-muted uppercase tracking-wider">
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
                <div className="h-full bg-purple-400/70 dark:bg-purple-600/70 rounded" style={{ width: `${pct}%` }} />
              </div>
              <span className="w-12 text-right tabular-nums text-body">{b.count}</span>
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
}

function ClusterDisplay({
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
    <div className="mb-5 rounded-lg border border-purple-200 dark:border-purple-800 bg-gradient-to-br from-purple-50/50 to-blue-50/50 dark:from-purple-950/20 dark:to-blue-950/20 p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Wand2 className="w-5 h-5 text-purple-600" />
          <h4 className="font-semibold text-heading">KI-Analyse: {clusters.length} Cluster erkannt</h4>
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
      <div className="mb-5 rounded-md shadow-sm bg-surface p-4">
        <div className="flex items-center gap-2 mb-2">
          <Lightbulb className="w-4 h-4 text-amber-500" />
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
    <div className="rounded-md shadow-sm bg-surface p-4">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`text-[10px] px-2 py-0.5 rounded-full ${intentMeta.color}`}>
              {intentMeta.emoji} {intentMeta.label}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface-tertiary text-muted tabular-nums">
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
                <span className="text-muted tabular-nums shrink-0">{q.impressions.toLocaleString('de-DE')}</span>
                <span className="text-body leading-snug">{q.query}</span>
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
    <div className={`rounded-lg border bg-surface p-3 relative ${highlight ? 'border-purple-300 dark:border-purple-700 ring-1 ring-purple-200 dark:ring-purple-900/30' : 'border-border'}`}>
      <div className="flex items-center gap-1 text-xs text-muted">
        <span>{label}</span>
        {tooltip && <span title={tooltip} className="cursor-help"><Info className="w-3 h-3 opacity-60" /></span>}
      </div>
      <div className="text-xl font-semibold mt-0.5 tabular-nums text-heading">{value}</div>
      {delta !== undefined && (
        <div className={`text-[11px] mt-0.5 tabular-nums flex items-center gap-0.5 ${delta > 0 ? 'text-green-600 dark:text-green-400' : delta < 0 ? 'text-red-600 dark:text-red-400' : 'text-muted'}`}>
          {delta > 0 ? <TrendingUp className="w-3 h-3" /> : delta < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
          {delta > 0 ? '+' : ''}{delta.toFixed(1)}{deltaSuffix} vs. Vorperiode
        </div>
      )}
      {sub && !delta && <div className="text-[11px] text-muted mt-0.5">{sub}</div>}
    </div>
  );
}

function PromptRow({ q }: { q: PromptQueryData }) {
  const qtMeta = QUESTION_TYPE_LABELS[q.questionType];
  return (
    <tr className="border-b border-border-subtle hover:bg-surface-tertiary transition">
      <td className="px-2 py-2 max-w-[380px]">
        <div className="flex items-center gap-1.5">
          {q.hasGeoReference && <MapPin className="w-3 h-3 text-emerald-500 shrink-0" aria-label="Geo-Bezug" />}
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
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border whitespace-nowrap ${qtMeta.color}`} title={qtMeta.label}>
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

function calcChange(current: number, previous: number): number {
  if (!previous || previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

// ════════════════════════════════════════════════════════════════════
// All utility functions below are unchanged (logic only)
// ════════════════════════════════════════════════════════════════════

function buildResearchSetup(
  data?: PromptTrackingResult,
  dashboardData?: ProjectDashboardData,
  domain?: string
): ResearchSetup {
  const corpus = [
    domain,
    ...(data?.brandKeywordsUsed ?? []),
    ...(data?.queries ?? []).slice(0, 30).map((q) => q.query),
    ...(dashboardData?.topQueries ?? []).slice(0, 20).map((q) => q.query),
    ...(dashboardData?.topConvertingPages ?? []).slice(0, 10).map((p) => p.path),
  ].filter(Boolean).join(' ');
  const isLegal = /\b(anwalt|rechtsanwalt|kanzlei|jurist|recht|scheidung|strafrecht|arbeitsrecht|erbrecht)\b/i.test(corpus);
  const projectName = getProjectName(domain, data?.brandKeywordsUsed);
  const landingPage = inferLandingPage(data, dashboardData);
  const topic = inferPrimaryTopic(data, dashboardData, projectName, isLegal);

  return {
    domainLabel: normalizeDomain(domain),
    industry: isLegal ? 'Rechtsanwalt / Kanzlei' : inferIndustry(corpus),
    region: inferRegion(corpus, domain),
    projectName,
    landingPage,
    topic,
    includeBrand: true,
    isLegal,
  };
}

function buildResearchDataSummary(data?: PromptTrackingResult, dashboardData?: ProjectDashboardData, setup?: ResearchSetup) {
  const opportunities = buildResearchOpportunities(data, dashboardData, setup ?? buildResearchSetup(data, dashboardData));
  return {
    gscQueries: (data?.totals.totalQueries ?? 0).toLocaleString('de-DE'),
    gscImpressions: (data?.totals.totalImpressions ?? 0).toLocaleString('de-DE'),
    gscClicks: (data?.totals.totalClicks ?? 0).toLocaleString('de-DE'),
    ga4Sessions: (dashboardData?.kpis?.sessions?.value ?? 0).toLocaleString('de-DE'),
    ga4Conversions: (dashboardData?.kpis?.conversions?.value ?? 0).toLocaleString('de-DE'),
    aiSessions: (dashboardData?.aiTraffic?.totalSessions ?? 0).toLocaleString('de-DE'),
    quickWins: opportunities.filter((item) => item.intent === 'Quick Win').length,
    buyIntent: opportunities.filter((item) => item.intent === 'Buy Intent').length,
    optimizationCandidates: opportunities.filter((item) => item.intent === 'Optimierung').length,
  };
}

function buildResearchOpportunities(
  data?: PromptTrackingResult,
  dashboardData?: ProjectDashboardData,
  setup?: ResearchSetup
): ResearchOpportunity[] {
  const resolvedSetup = setup ?? buildResearchSetup(data, dashboardData);
  const conversionPaths = new Set(
    (dashboardData?.topConvertingPages ?? [])
      .filter((page) => (page.conversions ?? 0) > 0)
      .map((page) => normalizePath(page.path))
  );

  const focusLandingPath = normalizePath(resolvedSetup.landingPage);
  const hasFocusLandingPage = focusLandingPath !== '/';
  const effectiveSetup = hasFocusLandingPage
    ? resolvedSetup
    : { ...resolvedSetup, landingPage: '' };

  const queryCandidates = (data?.queries ?? [])
    .map((query): Omit<ResearchOpportunity, 'rank'> | null => {
      const topic = queryToResearchTopic(query.query, resolvedSetup.projectName, data?.brandKeywordsUsed, resolvedSetup.isLegal);
      const finalTopic = normalizeResearchTopic(resolvedSetup.topic.trim() || topic, resolvedSetup.isLegal);
      if (!finalTopic) return null;
      const queryPath = query.url ? normalizePath(query.url) : '';
      const matchesFocusLandingPage = hasFocusLandingPage && queryPath === focusLandingPath;
      const hasConversionPath = queryPath ? conversionPaths.has(queryPath) || matchesFocusLandingPage : matchesFocusLandingPage;
      const buyIntent = hasBuyIntent(query.query, finalTopic, resolvedSetup.isLegal);
      const weakCtr = query.impressions >= 10 && query.ctr < 0.025;
      const rankablePosition = query.position >= 4 && query.position <= 18;
      const score = Math.min(92, scoreOpportunity(query, buyIntent, rankablePosition, weakCtr, hasConversionPath) + (matchesFocusLandingPage ? 6 : 0));
      const intent: ResearchOpportunity['intent'] =
        buyIntent ? 'Buy Intent' :
        rankablePosition ? 'Quick Win' :
        'Optimierung';

      return {
        score, topic,
        prompt: buildDecisionPrompt(finalTopic, intent, effectiveSetup),
        source: hasConversionPath ? 'GSC + GA4' : 'GSC',
        intent, reason: `${query.impressions.toLocaleString('de-DE')} Impr., ${query.clicks.toLocaleString('de-DE')} Klicks, Pos. ${query.position.toFixed(1)}, CTR ${(query.ctr * 100).toFixed(1)} %.`,
        action: actionForOpportunity(intent, resolvedSetup.isLegal, hasConversionPath),
      } satisfies Omit<ResearchOpportunity, 'rank'>;
    })
    .filter((item): item is Omit<ResearchOpportunity, 'rank'> => Boolean(item));

  const pageCandidates: Array<Omit<ResearchOpportunity, 'rank'>> = (dashboardData?.topConvertingPages ?? [])
    .filter((page) => (page.conversions ?? 0) > 0 || normalizePath(page.path) === focusLandingPath)
    .slice(0, 4)
    .map((page) => {
      const topic = normalizeResearchTopic(resolvedSetup.topic.trim() || pathToTopic(page.path, resolvedSetup), resolvedSetup.isLegal);
      const matchesFocusLandingPage = normalizePath(page.path) === focusLandingPath;
      return {
        score: Math.min(88, 58 + Math.round((page.conversions ?? 0) * 3) + (matchesFocusLandingPage ? 6 : 0)),
        topic, prompt: buildDecisionPrompt(topic, 'Buy Intent', effectiveSetup),
        source: 'GA4', intent: 'Buy Intent',
        reason: `${(page.conversions ?? 0).toLocaleString('de-DE')} Conversions auf ${page.path}.`,
        action: 'Decision-Prompt gegen diese Landingpage testen und Trust-/FAQ-Blöcke ergänzen.',
      } satisfies Omit<ResearchOpportunity, 'rank'>;
    });

  const fallback = queryCandidates.length + pageCandidates.length >= 3 ? [] : defaultResearchOpportunities(effectiveSetup);
  const combined = uniqueOpportunities([...queryCandidates, ...pageCandidates, ...fallback]);

  return combined.sort((a, b) => b.score - a.score).slice(0, 10).map((item, idx) => ({ ...item, rank: idx + 1 }));
}

function getProjectName(domain?: string, brandKeywords?: string[] | null): string {
  const brand = brandKeywords?.map((kw) => prettifyProjectName(kw)).find((kw) => kw.length > 1 && !looksLikeGenericLegalQuery(kw));
  if (brand) return brand;
  if (!domain) return 'dieses Projekt';
  return prettifyProjectName(normalizeDomain(domain).split('.')[0]) || 'dieses Projekt';
}

function normalizeDomain(domain?: string): string {
  if (!domain) return 'nicht gesetzt';
  return domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split(/[/?#]/)[0].trim();
}

function normalizePath(value: string): string {
  if (!value.trim()) return '/';
  try { return new URL(value).pathname.replace(/\/$/, '') || '/'; }
  catch { return value.split(/[?#]/)[0].replace(/\/$/, '') || '/'; }
}

function inferLandingPage(data?: PromptTrackingResult, dashboardData?: ProjectDashboardData): string {
  const convertingPage = (dashboardData?.topConvertingPages ?? []).slice().sort((a, b) => (b.conversions ?? 0) - (a.conversions ?? 0))[0]?.path;
  if (convertingPage) return normalizePath(convertingPage);
  const queryUrl = (data?.queries ?? []).slice().sort((a, b) => (b.impressions + b.clicks * 20) - (a.impressions + a.clicks * 20)).find((query) => query.url)?.url;
  return queryUrl ? normalizePath(queryUrl) : '';
}

function inferPrimaryTopic(data?: PromptTrackingResult, dashboardData?: ProjectDashboardData, projectName = '', isLegal = false): string {
  const promptTopic = (data?.queries ?? []).slice().sort((a, b) => (b.impressions + b.clicks * 20) - (a.impressions + a.clicks * 20)).map((query) => queryToResearchTopic(query.query, projectName, data?.brandKeywordsUsed, isLegal)).find(Boolean);
  if (promptTopic) return promptTopic;
  const topQueryTopic = (dashboardData?.topQueries ?? []).slice(0, 10).map((query) => queryToResearchTopic(query.query, projectName, data?.brandKeywordsUsed, isLegal)).find(Boolean);
  if (topQueryTopic) return topQueryTopic;
  return isLegal ? 'rechtliche Erstberatung' : '';
}

function prettifyProjectName(value: string): string {
  const lowered = value.toLowerCase();
  if (/\bbernhard\b/.test(lowered) && /\bhofer\b/.test(lowered)) return 'Mag. Bernhard Hofer';
  if (/\banwalt[-_\s]+hofer\b/.test(lowered) || /\brechtsanwalt[-_\s]+hofer\b/.test(lowered)) return 'Anwalt Hofer';
  return value.replace(/^https?:\/\//, '').replace(/^www\./, '').split(/[/?#]/)[0].replace(/\.[a-z]{2,}$/i, '').replace(/[§|]+/g, ' ').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/\b\w/g, (char) => char.toUpperCase());
}

function inferIndustry(corpus: string): string {
  if (/\b(seo|marketing|agentur|ads|semrush|traffic)\b/i.test(corpus)) return 'Marketing / SEO';
  if (/\b(shop|ecommerce|produkt|kaufen|preis)\b/i.test(corpus)) return 'E-Commerce';
  if (/\b(hotel|restaurant|praxis|klinik|arzt)\b/i.test(corpus)) return 'Local Business';
  return 'Projekt-Branche aus Daten ableiten';
}

function inferRegion(corpus: string, domain?: string): string {
  if (/\b(1010|wien|vienna)\b/i.test(corpus)) return 'Wien';
  if (/\b(graz)\b/i.test(corpus)) return 'Graz';
  if (/\b(salzburg)\b/i.test(corpus)) return 'Salzburg';
  if (/\b(linz)\b/i.test(corpus)) return 'Linz';
  if (/\.at(\/|$)/i.test(domain ?? '')) return 'Österreich';
  return 'nicht eindeutig';
}

function queryToResearchTopic(query: string, projectName: string, brandKeywords?: string[] | null, isLegal = false): string {
  const brandParts = [projectName, ...(brandKeywords ?? []), 'mag', 'magister', 'bernhard', 'hofer'].flatMap((part) => part.split(/[\s\-_.§,]+/));
  const cleaned = query.replace(/[?!"'():;,.§]/g, ' ').replace(/\s+/g, ' ').trim();
  const stopWords = new Set(['was','wie','warum','wieso','welche','welcher','welches','wer','wo','wann','ist','sind','kann','koennen','können','fuer','für','und','oder','mit','ohne','bei','von','im','in','der','die','das','ein','eine','einen','einer','zu','zum','zur','am','besten','beste','kosten','kostet','rechtsanwalt','anwalt','kanzlei','law','attorney','1010','wien']);
  const brandStopWords = new Set(brandParts.map((part) => part.toLowerCase().trim()).filter((part) => part.length > 2));
  const words = cleaned.split(' ').filter((word) => { const n = word.toLowerCase(); return n.length > 2 && !stopWords.has(n) && !brandStopWords.has(n); });
  const topic = (words.length > 0 ? words.slice(0, 5).join(' ') : '').slice(0, 80).trim();
  if (!topic || (isLegal && looksLikeGenericLegalQuery(topic))) return '';
  return prettifyTopic(topic);
}

function prettifyTopic(value: string): string {
  return value.replace(/\s+/g, ' ').trim().replace(/\b(arbeitsrecht|erbrecht|immobilienrecht|strafrecht|vertragsrecht|scheidungsanwalt|mietrecht)\b/gi, (match) => match.charAt(0).toUpperCase() + match.slice(1).toLowerCase());
}

function normalizeResearchTopic(value: string, isLegal: boolean): string {
  const topic = prettifyTopic(value);
  if (!isLegal) return topic;
  const normalized = topic.toLowerCase();
  if (/führerschein/.test(normalized) && /(entzogen|entzug|abgenommen|weg)/.test(normalized)) return 'Führerscheinentzug in Österreich';
  if (/alkohol|promille|trunken/.test(normalized) && /führerschein/.test(normalized)) return 'Führerscheinentzug wegen Alkohol';
  if (/anwaltskosten|anwalt.*kosten|kosten.*anwalt|honorar|rechtsanwaltstarif/.test(normalized)) return 'Anwaltskosten in Österreich';
  if (/scheidung|ehe/.test(normalized)) return 'Scheidung in Österreich';
  if (/arbeitsrecht|kündigung|entlassung/.test(normalized)) return 'Arbeitsrechtliche Beratung';
  if (/erbrecht|testament|erbe/.test(normalized)) return 'Erbrecht und Testament';
  if (/mietrecht|miete|vermieter/.test(normalized)) return 'Mietrechtliche Beratung';
  if (/strafrecht|strafverteidigung|anzeige/.test(normalized)) return 'Strafverteidigung';
  return topic;
}

function pathToTopic(path: string, setup: ResearchSetup): string {
  const topic = path.split('/').filter(Boolean).pop()?.replace(/[-_]+/g, ' ').trim();
  if (topic && topic.length > 2) return prettifyTopic(topic);
  return setup.isLegal ? 'rechtliche Erstberatung' : setup.projectName;
}

function looksLikeGenericLegalQuery(value: string): boolean {
  const n = value.toLowerCase().trim();
  if (!n) return true;
  return ['anwalt','rechtsanwalt','kanzlei','anwalt wien','rechtsanwalt wien','mag','mag.'].includes(n);
}

function hasBuyIntent(query: string, topic: string, isLegal: boolean): boolean {
  const text = `${query} ${topic}`.toLowerCase();
  const generic = /\b(kosten|kostet|preis|preise|vergleich|beste|empfehlung|anbieter|beratung|kontakt|termin|kaufen)\b/i.test(text);
  const legal = /\b(erstberatung|scheidung|strafverteidigung|arbeitsrecht|mietrecht|erbrecht|vertrag|anwalt|rechtsanwalt)\b/i.test(text);
  return generic || (isLegal && legal);
}

function scoreOpportunity(query: PromptQueryData, buyIntent: boolean, rankablePosition: boolean, weakCtr: boolean, hasConversionPath: boolean): number {
  const impressionScore = Math.min(30, Math.round(Math.log10(query.impressions + 1) * 12));
  const positionScore = rankablePosition ? 22 : query.position <= 3 ? 4 : 8;
  const ctrScore = weakCtr ? 16 : query.ctr >= 0.03 ? 2 : 6;
  const buyScore = buyIntent ? 18 : 0;
  const ga4Score = hasConversionPath ? 10 : 0;
  return Math.min(92, 12 + impressionScore + positionScore + ctrScore + buyScore + ga4Score);
}

function buildDecisionPrompt(topic: string, intent: ResearchOpportunity['intent'], setup: ResearchSetup): string {
  const brandPart = setup.includeBrand ? (setup.isLegal ? ` und bewerte ${setup.projectName} als mögliche Kanzlei` : ` und bewerte ${setup.projectName} als mögliche Lösung`) : '';
  if (setup.isLegal) {
    if (isLegalCostTopic(topic)) return `Mit welchen Anwaltskosten muss ich in ${setup.region} bzw. Österreich rechnen, wie setzen sie sich zusammen und welche Fragen sollte ich vor einer Erstberatung klären${brandPart}?`;
    if (intent === 'Buy Intent') return `Ich brauche rechtliche Unterstützung zu "${topic}" in ${setup.region}. Welche Kanzlei passt, welche Kosten/Unterlagen sind wichtig${brandPart}?`;
    if (intent === 'Quick Win') return `Welche Rechtsanwälte in ${setup.region} werden für "${topic}" empfohlen? Vergleiche Spezialisierung, Vertrauenssignale, Erstberatung und Erreichbarkeit${brandPart}.`;
    return `Welche Fragen sollte eine Kanzlei-Seite zu "${topic}" beantworten, damit Mandanten Vertrauen fassen und eine Erstberatung anfragen?${brandPart}.`;
  }
  if (intent === 'Buy Intent') return `Ich suche eine Lösung für "${topic}". Welche Anbieter kommen infrage und welche Kosten/Nutzen-Argumente zählen${brandPart}?`;
  if (intent === 'Quick Win') return `Welche Anbieter werden für "${topic}" empfohlen? Vergleiche Nutzen, Aufwand, Risiken und Entscheidungskriterien${brandPart}.`;
  return `Welche Inhalte muss eine Seite zu "${topic}" liefern, um in KI-Antworten als hilfreiche Quelle genannt zu werden?${brandPart}.`;
}

function actionForOpportunity(intent: ResearchOpportunity['intent'], isLegal: boolean, hasConversionPath: boolean): string {
  if (hasConversionPath) return 'Bestehende Conversion-Seite mit Decision-FAQ, Trust-Signalen und klarer CTA erweitern.';
  if (intent === 'Buy Intent') return isLegal ? 'Leistungsseite mit Kosten, Ablauf, Unterlagen und Erstberatung ergänzen.' : 'Landingpage um Preise, Vergleich und Entscheidungshilfen erweitern.';
  if (intent === 'Quick Win') return 'Snippet/FAQ optimieren und Query exakt in H2 oder FAQ-Frage aufnehmen.';
  return 'Content-Lücke schließen: klare Antwort, Belege, Beispiele und interne Verlinkung ergänzen.';
}

function isLegalCostTopic(topic: string): boolean {
  return /\b(anwaltskosten|honorar|kosten|rechtsanwaltstarif)\b/i.test(topic);
}

function defaultResearchOpportunities(setup: ResearchSetup): Array<Omit<ResearchOpportunity, 'rank'>> {
  const topics = setup.isLegal
    ? ['rechtliche Erstberatung', 'Scheidungsanwalt', 'Arbeitsrechtliche Beratung', 'Erbrecht und Testament']
    : [`${setup.projectName} Vergleich`, `${setup.projectName} Kosten`, `${setup.projectName} Alternative`];
  return topics.map((topic, idx) => {
    const intent: ResearchOpportunity['intent'] = idx === 0 ? 'Buy Intent' : idx === 1 ? 'Quick Win' : 'Optimierung';
    return { score: 55 - idx * 4, topic, prompt: buildDecisionPrompt(topic, intent, setup), source: 'GSC', intent, reason: 'Fallback, falls im aktuellen Zeitraum zu wenige verwertbare Prompt-Queries vorhanden sind.', action: actionForOpportunity(intent, setup.isLegal, false) } satisfies Omit<ResearchOpportunity, 'rank'>;
  });
}

function uniqueOpportunities(items: Array<Omit<ResearchOpportunity, 'rank'>>): Array<Omit<ResearchOpportunity, 'rank'>> {
  const bestByTopic = new Map<string, Omit<ResearchOpportunity, 'rank'>>();
  items.forEach((item) => {
    const key = item.topic.toLowerCase();
    const existing = bestByTopic.get(key);
    if (!existing || item.score > existing.score) bestByTopic.set(key, item);
  });
  return Array.from(bestByTopic.values());
}

function buildMarkdown(result: PromptClusterApiResponse, allQueries: PromptQueryData[]): string {
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
      lines.push(`- _${q.query}_ (${q.impressions} Impr., ${q.clicks} Klicks)`);
    });
    lines.push('');
  });
  lines.push(`---`);
  lines.push(`*Methodik nach Seybold (2026): https://seybold.de/prompt-tracking-in-google-search-console/*`);
  return lines.join('\n');
}
