// src/components/PromptTrackingCard.tsx
'use client';

import React, { useMemo, useState } from 'react';
import { Sparkles, Download, Search, Filter, ExternalLink } from 'lucide-react';
import type { PromptTrackingResult, PromptQueryData } from '@/lib/google-api';

interface PromptTrackingCardProps {
  data?: PromptTrackingResult;
}

type FilterMode = 'all' | 'branded' | 'nonBranded';
type SortMode = 'impressions' | 'clicks' | 'ctr' | 'position' | 'wordCount';

export default function PromptTrackingCard({ data }: PromptTrackingCardProps) {
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [sortMode, setSortMode] = useState<SortMode>('impressions');
  const [limit, setLimit] = useState(25);

  // ─── Empty State ──────────────────────────────────────────────────
  if (!data || data.totals.totalQueries === 0) {
    return (
      <div className="card-glass p-6">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-5 h-5 text-purple-500" />
          <h3 className="text-lg font-semibold">Prompt Tracking (GSC)</h3>
        </div>
        <p className="text-muted text-sm">
          Keine prompt-ähnlichen Suchanfragen (≥10 Wörter) im gewählten Zeitraum gefunden.
        </p>
      </div>
    );
  }

  // ─── Filter + Sort + Search ──────────────────────────────────────
  const filtered = useMemo(() => {
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
          return a.position - b.position; // niedriger = besser
        case 'wordCount':
          return b.wordCount - a.wordCount;
        case 'impressions':
        default:
          return b.impressions - a.impressions;
      }
    });

    return list;
  }, [data.queries, filterMode, sortMode, search]);

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
  };

  return (
    <div className="card-glass p-6">
      {/* ─── Header ─────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-500" />
            <h3 className="text-lg font-semibold">Prompt Tracking</h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
              GSC Proxy
            </span>
          </div>
          <p className="text-muted text-xs mt-1">
            Konversationsartige Suchanfragen mit ≥10 Wörtern – möglicher AI-Mode-Indikator
          </p>
        </div>

        <button
          onClick={handleExport}
          className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-md border border-border hover:bg-muted/50 transition"
          title="Als CSV exportieren"
        >
          <Download className="w-4 h-4" />
          CSV
        </button>
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
        />
        <KpiTile
          label="Brand-Anteil"
          value={`${data.totals.brandedShare.toFixed(1)}%`}
          sub={`${data.totals.nonBrandedShare.toFixed(1)}% Non-Brand`}
        />
      </div>

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
        möglicher Proxy für AI-Mode- bzw. LLM-Anfragen. Kein direkter Beweis für AI-Herkunft –
        Methodik nach{' '}
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
// Sub-Components
// ════════════════════════════════════════════════════════════════════

function KpiTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-border bg-background/50 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold mt-0.5">{value}</div>
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
        <span className="inline-block min-w-[28px] text-xs px-2 py-0.5 rounded-full bg-muted/70">
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
