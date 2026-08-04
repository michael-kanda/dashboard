// src/components/TopQueriesList.tsx
'use client';

import React, { useState } from 'react';
import {
  ExclamationTriangleFill,
  Search,
  X,
  Link45deg,
  Download
} from 'react-bootstrap-icons';
import { cn } from '@/lib/utils';
import { type DateRangeOption, getRangeLabel } from '@/components/DateRangeSelector';
import type { TopQueryData } from '@/types/dashboard';

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
  const [searchTerm, setSearchTerm] = useState('');

  const rangeLabel = dateRange ? getRangeLabel(dateRange) : null;

  const displayedQueries = React.useMemo(() => {
    let data = queries || [];
    if (searchTerm) {
      const lowerTerm = searchTerm.toLowerCase();
      data = data.filter(q =>
        q.query.toLowerCase().includes(lowerTerm) ||
        (q.url && q.url.toLowerCase().includes(lowerTerm))
      );
    }
    return [...data].sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions);
  }, [queries, searchTerm]);

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

  // ── CSV Export ─────────────────────────────────────────────
  const handleExportCsv = () => {
    if (!displayedQueries.length) return;
    const escape = (val: string) => `"${val.replace(/"/g, '""')}"`;
    const header = [
      'Suchanfrage',
      'Landingpage',
      'Klicks',
      'Impressionen',
      'CTR (%)',
      'Position',
      'GA4-Conversions der Landingpage',
    ];
    const rows = displayedQueries.map((q) => [
      escape(q.query),
      escape(q.url || ''),
      q.clicks,
      q.impressions,
      (q.ctr * 100).toFixed(2).replace('.', ','),
      q.position.toFixed(1).replace('.', ','),
      q.landingPageConversions ?? '',
    ]);
    const csv = [header.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `top-suchanfragen-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  // ── Header-Block (Titel + Subtitle + Search) ─────────────
  const renderHeader = (subtitle: React.ReactNode) => (
    <div className="mb-6 flex-shrink-0">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <h3 className="text-[18px] font-semibold text-heading">Top Suchanfragen</h3>
          <div className="mt-1 h-[12px] max-w-[220px]" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 12" width="100%" height="12">
              <defs>
                <linearGradient id="google-clean-gradient-topqueries" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#4285F4" />
                  <stop offset="25%" stopColor="#4285F4" />
                  <stop offset="25%" stopColor="#EA4335" />
                  <stop offset="50%" stopColor="#EA4335" />
                  <stop offset="50%" stopColor="#FBBC05" />
                  <stop offset="75%" stopColor="#FBBC05" />
                  <stop offset="75%" stopColor="#34A853" />
                  <stop offset="100%" stopColor="#34A853" />
                </linearGradient>
              </defs>
              <rect width="100%" height="12" rx="6" fill="url(#google-clean-gradient-topqueries)" />
            </svg>
          </div>
        </div>

        <div className="flex items-center gap-2">
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
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={!displayedQueries.length}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-sm border border-theme-border-default rounded-md text-body hover:bg-surface-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors print:hidden"
            title="Als CSV herunterladen"
          >
            <Download size={12} />
            CSV
          </button>
        </div>
      </div>
      <p className="text-xs text-muted mt-2">{subtitle}</p>
    </div>
  );

  // ── Loading State ────────────────────────────────────────
  if (isLoading) {
    return (
      <div className={cn("dashboard-widget-surface rounded-xl p-5 flex flex-col", className)}>
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
      <div className={cn("dashboard-widget-surface rounded-xl p-5 flex flex-col", className)}>
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
    'Sortiert nach Klicks',
    queries.some((query) => query.landingPageConversions !== undefined) ? 'Quelle GSC + GA4' : 'Quelle GSC',
    rangeLabel,
    `${displayedQueries.length} ${displayedQueries.length === 1 ? 'Eintrag' : 'Einträge'}`,
    queries.some((query) => query.landingPageConversions !== undefined)
      ? 'LP-Conv. = Conversions der zugeordneten Landingpage'
      : null,
  ].filter(Boolean);

  // ── Totals für Footer ────────────────────────────────────
  const totalClicks = displayedQueries.reduce((sum, q) => sum + q.clicks, 0);
  const totalImpressions = displayedQueries.reduce((sum, q) => sum + q.impressions, 0);
  const avgCtr = totalImpressions > 0
    ? (totalClicks / totalImpressions) * 100
    : 0;
  const maxClicks = displayedQueries.length > 0
    ? Math.max(...displayedQueries.map((query) => query.clicks))
    : 0;

  return (
    <div className={cn("dashboard-widget-surface rounded-xl p-5 flex flex-col min-h-0", className)}>
      {renderHeader(subtitleParts.join(' · '))}

      {/* Liste im Stil der Top Landingpages */}
      <div className="flex-grow min-h-0">
        {displayedQueries.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted flex flex-col items-center gap-2">
            <Search className="text-faint" size={28} />
            <p>
              {searchTerm
                ? <>Keine Ergebnisse für „<span className="font-medium text-body">{searchTerm}</span>“</>
                : 'Keine Suchanfragen gefunden.'}
            </p>
          </div>
        ) : (
          <div className="h-full overflow-y-auto pr-3 custom-scrollbar">
            {displayedQueries.map((query, index) => {
              const formattedPath = formatUrl(query.url);
              const barWidthPercent = maxClicks > 0
                ? Math.max((query.clicks / maxClicks) * 100, 2)
                : 2;

              return (
                <div
                  key={`${query.query}-${index}`}
                  className="group border-t border-theme-border-subtle py-3 first:border-t-0"
                >
                  <div className="mb-2 flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 truncate text-sm font-medium text-heading" title={query.query}>
                        {query.query}
                      </div>
                      {formattedPath ? (
                        <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted" title={query.url}>
                          <Link45deg size={12} className="flex-shrink-0 text-faint" />
                          <span className="truncate font-mono text-[11px]">{formattedPath}</span>
                        </div>
                      ) : (
                        <div className="text-xs italic text-faint">Keine Landingpage zugeordnet</div>
                      )}
                    </div>

                    <div className="min-w-[76px] flex-shrink-0 text-right">
                      <div className="text-sm font-medium leading-tight text-strong">
                        {query.clicks.toLocaleString('de-DE')}
                      </div>
                      <div className="mt-1 text-[11px] text-faint">Klicks</div>
                    </div>
                  </div>

                  <div className="mb-2.5 h-[3px] overflow-hidden rounded-full bg-surface-tertiary">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                      style={{ width: `${barWidthPercent}%` }}
                    />
                  </div>

                  <div className="flex flex-wrap gap-x-3.5 gap-y-1 text-xs text-muted">
                    <span>
                      <span className="text-faint">Impr.</span>{' '}
                      <span className="font-medium text-strong">{query.impressions.toLocaleString('de-DE')}</span>
                    </span>
                    <span>
                      <span className="text-faint">CTR</span>{' '}
                      <span className="font-medium text-strong">{(query.ctr * 100).toFixed(1).replace('.', ',')}%</span>
                    </span>
                    <span>
                      <span className="text-faint">Pos.</span>{' '}
                      {renderPosition(query.position)}
                    </span>
                    <span title="GA4-Conversions der zugeordneten Landingpage, nicht der einzelnen Suchanfrage">
                      <span className="text-faint">LP-Conv.</span>{' '}
                      <span className="font-medium text-strong">
                        {query.landingPageConversions === undefined
                          ? '–'
                          : query.landingPageConversions.toLocaleString('de-DE', { maximumFractionDigits: 2 })}
                      </span>
                    </span>
                  </div>
                </div>
              );
            })}
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
