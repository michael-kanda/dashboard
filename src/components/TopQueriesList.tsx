// src/components/TopQueriesList.tsx
'use client';

import React, { useState } from 'react';
import {
  ExclamationTriangleFill,
  Search,
  X,
  ArrowUp,
  ArrowDown,
  ArrowDownUp,
  Link45deg
} from 'react-bootstrap-icons';
import { cn } from '@/lib/utils';
import { type DateRangeOption, getRangeLabel } from '@/components/DateRangeSelector';

type TopQueryData = {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  url?: string; // Landingpage URL (optional für Abwärtskompatibilität)
};

interface TopQueriesListProps {
  queries: TopQueryData[];
  isLoading?: boolean;
  className?: string;
  dateRange?: DateRangeOption;
  error?: string | null;
}

// Hilfsfunktion: URL zu lesbarem Pfad konvertieren
function formatUrl(url: string | undefined): string | null {
  if (!url) return null;

  try {
    const urlObj = new URL(url);
    let path = urlObj.pathname;

    path = path.split('?')[0];

    if (path.length > 1 && path.endsWith('/')) {
      path = path.slice(0, -1);
    }

    if (path === '' || path === '/') {
      return '/';
    }

    return path;
  } catch {
    const match = url.match(/^https?:\/\/[^\/]+(\/[^\?]*)/);
    if (match && match[1]) {
      let path = match[1];
      if (path.length > 1 && path.endsWith('/')) {
        path = path.slice(0, -1);
      }
      return path;
    }
    return url.startsWith('/') ? url : null;
  }
}

export default function TopQueriesList({
  queries,
  isLoading = false,
  className,
  dateRange,
  error = null
}: TopQueriesListProps) {
  const [sortField, setSortField] = useState<keyof TopQueryData | null>('clicks');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [searchTerm, setSearchTerm] = useState('');

  const rangeLabel = dateRange ? getRangeLabel(dateRange) : null;

  const handleSort = (field: keyof TopQueryData) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const displayedQueries = React.useMemo(() => {
    let data = queries || [];
    if (searchTerm) {
      const lowerTerm = searchTerm.toLowerCase();
      data = data.filter(q =>
        q.query.toLowerCase().includes(lowerTerm) ||
        (q.url && q.url.toLowerCase().includes(lowerTerm))
      );
    }
    if (!sortField) return data;

    return [...data].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }
      return 0;
    });
  }, [queries, sortField, sortDirection, searchTerm]);

  // ── Position-Anzeige: Dot + Zahl, einheitlicher Stil ──────
  const renderPosition = (position: number) => {
    const rounded = Math.round(position);
    const formatted = position.toFixed(1).replace('.', ',');

    if (rounded <= 10) {
      return (
        <span className="inline-flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
          <span className="font-medium text-strong">{formatted}</span>
        </span>
      );
    }
    if (rounded <= 20) {
      return (
        <span className="inline-flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
          <span className="font-medium text-strong">{formatted}</span>
        </span>
      );
    }
    return (
      <span className="font-medium text-muted">{formatted}</span>
    );
  };

  // ── Sort-Header-Renderer ──────────────────────────────────
  const renderSortHeader = (
    field: keyof TopQueryData,
    label: string,
    rightAligned = false
  ) => {
    const isActive = sortField === field;

    return (
      <th
        onClick={() => handleSort(field)}
        className={cn(
          "px-2 py-2.5 text-[11px] font-medium uppercase tracking-wider cursor-pointer select-none border-b border-theme-border-subtle hover:text-body transition-colors bg-surface",
          rightAligned ? "text-right" : "text-left",
          isActive ? "text-body" : "text-faint"
        )}
      >
        <div className={cn("flex items-center gap-1", rightAligned && "justify-end")}>
          <span>{label}</span>
          {isActive ? (
            sortDirection === 'desc'
              ? <ArrowDown size={10} className="text-body" />
              : <ArrowUp size={10} className="text-body" />
          ) : (
            <ArrowDownUp size={10} className="opacity-40" />
          )}
        </div>
      </th>
    );
  };

  // ── Header-Block (Titel + Subtitle + Search) ─────────────
  const renderHeader = (subtitle: React.ReactNode) => (
    <div className="mb-4 flex-shrink-0">
      <div className="flex items-start justify-between gap-4 mb-1.5">
        <h3 className="text-[18px] font-semibold text-heading">Top Suchanfragen</h3>

        <div className="relative">
          <input
            type="text"
            placeholder="Query oder Pfad..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 pr-8 py-1.5 text-sm border border-theme-border-default rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 w-56 text-body placeholder-faint bg-surface"
          />
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" size={12} />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-faint hover:text-body"
              title="Filter zurücksetzen"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>
      <p className="text-xs text-muted">{subtitle}</p>
    </div>
  );

  // ── Loading State ────────────────────────────────────────
  if (isLoading) {
    return (
      <div className={cn("dashboard-widget-surface rounded-lg p-5 flex flex-col", className)}>
        {renderHeader('Lade Daten...')}
        <div className="animate-pulse space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 bg-surface-tertiary rounded" />
          ))}
        </div>
      </div>
    );
  }

  // ── Error State ──────────────────────────────────────────
  if (error) {
    return (
      <div className={cn("dashboard-widget-surface rounded-lg p-5 flex flex-col", className)}>
        {renderHeader('Quelle GSC')}
        <div className="py-12 text-center flex flex-col items-center gap-2">
          <ExclamationTriangleFill className="text-red-500" size={24} />
          <span className="text-sm font-semibold text-strong">Fehler bei GSC-Daten</span>
          <p className="text-xs text-muted max-w-md" title={error}>
            Die Suchanfragen konnten nicht geladen werden.
          </p>
        </div>
      </div>
    );
  }

  // ── Subtitle für Normal-State ────────────────────────────
  const subtitleParts = [
    'Quelle GSC',
    rangeLabel,
    `${displayedQueries.length} ${displayedQueries.length === 1 ? 'Eintrag' : 'Einträge'}`
  ].filter(Boolean);

  // ── Totals für Footer ────────────────────────────────────
  const totalClicks = displayedQueries.reduce((sum, q) => sum + q.clicks, 0);
  const totalImpressions = displayedQueries.reduce((sum, q) => sum + q.impressions, 0);
  const avgCtr = totalImpressions > 0
    ? (totalClicks / totalImpressions) * 100
    : 0;

  return (
    <div className={cn("dashboard-widget-surface rounded-lg p-5 flex flex-col", className)}>
      {renderHeader(subtitleParts.join(' · '))}

      {/* Tabelle */}
      <div className="flex-grow min-h-0">
        {displayedQueries.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted flex flex-col items-center gap-2">
            <Search className="text-faint" size={28} />
            <p>
              {searchTerm
                ? <>Keine Ergebnisse für „<span className="font-medium text-body">{searchTerm}</span>"</>
                : 'Keine Suchanfragen gefunden.'}
            </p>
          </div>
        ) : (
          <div className="max-h-[600px] overflow-y-auto custom-scrollbar">
            <table className="w-full border-collapse table-fixed">
              <colgroup>
                <col style={{ width: '48%' }} />
                <col style={{ width: '13%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '11%' }} />
                <col style={{ width: '14%' }} />
              </colgroup>

              <thead className="sticky top-0 z-10">
                <tr>
                  {renderSortHeader('query', 'Suchanfrage')}
                  {renderSortHeader('clicks', 'Klicks', true)}
                  {renderSortHeader('impressions', 'Impr.', true)}
                  {renderSortHeader('ctr', 'CTR', true)}
                  {renderSortHeader('position', 'Pos.', true)}
                </tr>
              </thead>

              <tbody>
                {displayedQueries.map((query, index) => {
                  const formattedPath = formatUrl(query.url);

                  return (
                    <tr
                      key={`${query.query}-${index}`}
                      className="border-b border-theme-border-subtle hover:bg-surface-secondary/40 transition-colors"
                    >
                      <td className="px-2 py-3 align-top">
                        <div className="text-sm font-medium text-heading break-words">
                          {query.query}
                        </div>
                        {formattedPath && (
                          <div className="flex items-center gap-1 mt-1 text-xs text-muted" title={query.url}>
                            <Link45deg size={12} className="text-faint flex-shrink-0" />
                            <span className="font-mono text-[11px] truncate">{formattedPath}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-3 text-right align-top text-sm font-medium text-strong whitespace-nowrap">
                        {query.clicks.toLocaleString('de-DE')}
                      </td>
                      <td className="px-2 py-3 text-right align-top text-sm text-body whitespace-nowrap">
                        {query.impressions.toLocaleString('de-DE')}
                      </td>
                      <td className="px-2 py-3 text-right align-top text-sm text-body whitespace-nowrap">
                        {(query.ctr * 100).toFixed(1).replace('.', ',')}%
                      </td>
                      <td className="px-2 py-3 text-right align-top whitespace-nowrap">
                        {renderPosition(query.position)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer */}
      {displayedQueries.length > 0 && (
        <div className="mt-4 pt-3 border-t border-theme-border-subtle flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted">
          <span>
            <span className="text-faint">Klicks gesamt</span>{' '}
            <span className="text-strong font-medium ml-1">{totalClicks.toLocaleString('de-DE')}</span>
          </span>
          <span>
            <span className="text-faint">Impressionen gesamt</span>{' '}
            <span className="text-strong font-medium ml-1">{totalImpressions.toLocaleString('de-DE')}</span>
          </span>
          <span>
            <span className="text-faint">Ø CTR</span>{' '}
            <span className="text-strong font-medium ml-1">{avgCtr.toFixed(1).replace('.', ',')}%</span>
          </span>
        </div>
      )}
    </div>
  );
}
