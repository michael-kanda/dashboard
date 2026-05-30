// src/components/charts/LandingPageChart.tsx
'use client';

import React, { useState, useCallback } from 'react';
import { ConvertingPageData } from '@/lib/dashboard-shared';
import {
  Search,
  TagFill,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  XLg,
  ArrowRepeat,
  Diagram3Fill,
  Download
} from 'react-bootstrap-icons';
import { format, subDays, subMonths } from 'date-fns';
import { de } from 'date-fns/locale';

// Typ für die Query-Daten pro Landingpage
export interface LandingPageQueries {
  [path: string]: Array<{ query: string; clicks: number; impressions: number }>;
}

export interface FollowUpPath {
  path: string;
  sessions: number;
  percentage: number;
}

export interface FollowUpData {
  landingPage: string;
  totalSessions: number;
  landingPageSessions: number;
  followUpPaths: FollowUpPath[];
}

interface Props {
  data?: ConvertingPageData[];
  isLoading?: boolean;
  title?: string;
  dateRange?: string;
  queryData?: LandingPageQueries;
  projectId?: string;
}

export default function LandingPageChart({
  data,
  isLoading,
  title = "Top Landingpages",
  dateRange = '30d',
  queryData,
  projectId
}: Props) {

  const [searchTerm, setSearchTerm] = useState('');
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());

  // State für Folgepfade-Detail-Ansicht (Lightbox)
  const [showFollowUpDetail, setShowFollowUpDetail] = useState(false);
  const [selectedLandingPage, setSelectedLandingPage] = useState<string | null>(null);
  const [followUpData, setFollowUpData] = useState<FollowUpData | null>(null);
  const [isLoadingFollowUp, setIsLoadingFollowUp] = useState(false);
  const [followUpError, setFollowUpError] = useState<string | null>(null);

  const getDateRangeString = (range: string) => {
    const end = new Date();
    let start = subDays(end, 30);

    switch (range) {
      case '7d': start = subDays(end, 7); break;
      case '30d': start = subDays(end, 30); break;
      case '3m': start = subMonths(end, 3); break;
      case '6m': start = subMonths(end, 6); break;
      case '12m': start = subMonths(end, 12); break;
      default: start = subDays(end, 30);
    }

    return `${format(start, 'dd.MM.yyyy', { locale: de })} – ${format(end, 'dd.MM.yyyy', { locale: de })}`;
  };

  const toggleExpanded = (path: string) => {
    setExpandedPaths(prev => {
      const newSet = new Set(prev);
      if (newSet.has(path)) {
        newSet.delete(path);
      } else {
        newSet.add(path);
      }
      return newSet;
    });
  };

  const getQueriesForPath = (path: string): Array<{ query: string; clicks: number; impressions: number }> => {
    if (!queryData) return [];
    if (queryData[path]) return queryData[path];

    const withSlash = path.endsWith('/') ? path : `${path}/`;
    const withoutSlash = path.endsWith('/') ? path.slice(0, -1) : path;

    return queryData[withSlash] || queryData[withoutSlash] || [];
  };

  const loadFollowUpPaths = useCallback(async (landingPage: string) => {
    if (!projectId) {
      setFollowUpError('Projekt-ID fehlt');
      return;
    }

    setIsLoadingFollowUp(true);
    setFollowUpError(null);
    setSelectedLandingPage(landingPage);
    setShowFollowUpDetail(true);

    try {
      const params = new URLSearchParams({
        projectId,
        dateRange,
        landingPage
      });

      const response = await fetch(`/api/landing-page-followup?${params.toString()}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const result = await response.json();
      setFollowUpData(result.data);

    } catch (err) {
      console.error('[LandingPageChart] Folgepfade Fehler:', err);
      setFollowUpError(err instanceof Error ? err.message : 'Unbekannter Fehler');
    } finally {
      setIsLoadingFollowUp(false);
    }
  }, [projectId, dateRange]);

  const closeFollowUpDetail = () => {
    setShowFollowUpDetail(false);
    setSelectedLandingPage(null);
    setFollowUpData(null);
    setFollowUpError(null);
  };

  if (isLoading) {
    return <div className="h-[50vh] w-full bg-surface-secondary rounded-xl animate-pulse flex items-center justify-center text-faint">Lade Daten...</div>;
  }

  if (!data || data.length === 0) {
    return <div className="h-[50vh] w-full bg-surface-secondary rounded-xl flex items-center justify-center text-faint">Keine Daten verfügbar</div>;
  }

  const sortedData = [...data]
    .filter(item => item.newUsers !== undefined && item.newUsers !== null)
    .filter(item => {
      const path = item.path?.toLowerCase() || '';

      if (path.includes('danke') || path.includes('impressum') || path.includes('datenschutz')) {
        return false;
      }

      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const queries = getQueriesForPath(item.path);
        const queryMatch = queries.some(q => q.query.toLowerCase().includes(searchLower));
        if (!path.includes(searchLower) && !queryMatch) {
          return false;
        }
      }

      return true;
    })
    .sort((a, b) => (b.newUsers || 0) - (a.newUsers || 0))
    .slice(0, 50);

  const maxNewUsers = sortedData.length > 0
    ? Math.max(...sortedData.map(p => p.newUsers || 0))
    : 0;

  const formattedDateRange = getDateRangeString(dateRange);

  const handleExportCsv = () => {
    if (!sortedData.length) return;
    const escape = (val: string) => `"${(val ?? '').replace(/"/g, '""')}"`;
    const fmtNum = (n: number, digits = 0) =>
      n.toFixed(digits).replace('.', ',');
    const header = [
      'Pfad',
      'Neue Nutzer',
      'Sessions',
      'Engagement Rate (%)',
      'CTR (%)',
      'Conversions',
      'Top Suchbegriffe (Top 5)',
    ];
    const rows = sortedData.map((page) => {
      const queries = getQueriesForPath(page.path).slice(0, 5).map((q) => q.query).join(' | ');
      return [
        escape(page.path || ''),
        page.newUsers ?? 0,
        page.sessions ?? 0,
        page.engagementRate !== undefined ? fmtNum(page.engagementRate, 0) : '',
        page.ctr !== undefined ? fmtNum(page.ctr, 1) : '',
        page.conversions ?? 0,
        escape(queries),
      ];
    });
    const csv = [header.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `top-landingpages-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <>
      <div className="dashboard-widget-surface p-5 rounded-xl flex flex-col max-h-[75vh]">

        {/* ── Header ──────────────────────────────────────────── */}
        <div className="mb-4 flex-shrink-0">
          <div className="flex items-start justify-between gap-4 mb-1.5">
            <h3 className="text-[18px] font-semibold text-heading">{title}</h3>

            <div className="flex items-center gap-2">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Seite oder Suchbegriff..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-sm border border-theme-border-default rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 w-56 text-body placeholder-faint bg-surface"
                />
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" size={12} />
              </div>
              <button
                type="button"
                onClick={handleExportCsv}
                disabled={!sortedData.length}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-sm border border-theme-border-default rounded-md text-body hover:bg-surface-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors print:hidden"
                title="Als CSV herunterladen"
              >
                <Download size={12} />
                CSV
              </button>
            </div>
          </div>

          <p className="text-xs text-muted">
            Sortiert nach Neuen Nutzern · Quelle GA4 + GSC · {formattedDateRange}
            {queryData && ' · Mit Suchbegriffen'}
          </p>
        </div>

        {/* ── Liste ───────────────────────────────────────────── */}
        {sortedData.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-faint text-sm min-h-[200px]">
            {searchTerm ? 'Keine Landingpages für diese Suche gefunden' : 'Keine validen Daten'}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto pr-3 custom-scrollbar min-h-0">
            {sortedData.map((page, i) => {
              const newUsers = page.newUsers || 0;
              const sessions = page.sessions || 0;
              const engagementRate = page.engagementRate || 0;
              const conversions = page.conversions || 0;
              const ctr = page.ctr;

              const barWidthPercent = maxNewUsers > 0
                ? Math.max((newUsers / maxNewUsers) * 100, 2)
                : 2;

              const queries = getQueriesForPath(page.path);
              const hasQueries = queries.length > 0;
              const isExpanded = expandedPaths.has(page.path);

              const inlineQueries = queries.slice(0, 3);
              const additionalQueries = queries.slice(3);

              return (
                <div
                  key={i}
                  className="py-3.5 border-t border-theme-border-subtle first:border-t-0 group"
                >
                  {/* Pfad + Hero-Metrik */}
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="flex-1 min-w-0">
                      <div
                        className={`text-[15px] font-medium text-strong truncate mb-1 ${hasQueries ? 'cursor-pointer hover:text-indigo-600 transition-colors' : ''}`}
                        onClick={() => hasQueries && toggleExpanded(page.path)}
                        title={page.path}
                      >
                        {page.path}
                      </div>

                      {hasQueries ? (
                        <div className="text-xs text-muted flex items-center gap-1.5 min-w-0">
                          <TagFill size={10} className="text-faint flex-shrink-0" />
                          <span className="truncate">
                            {inlineQueries.map(q => q.query).join(' · ')}
                          </span>
                          {additionalQueries.length > 0 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleExpanded(page.path);
                              }}
                              className="text-faint hover:text-body flex-shrink-0 ml-1 inline-flex items-center gap-0.5"
                            >
                              +{additionalQueries.length} mehr
                              {isExpanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="text-xs text-faint italic">
                          Keine GSC-Suchbegriffe verfügbar
                        </div>
                      )}
                    </div>

                    <div className="text-right flex-shrink-0 min-w-[88px]">
                      <div className="text-[22px] font-semibold text-heading leading-none">
                        {newUsers.toLocaleString('de-DE')}
                      </div>
                      <div className="text-[11px] text-faint mt-1">Neue Nutzer</div>
                    </div>
                  </div>

                  {/* Bar */}
                  <div className="h-[3px] bg-surface-tertiary rounded-full overflow-hidden mb-2.5">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                      style={{ width: `${barWidthPercent}%` }}
                    />
                  </div>

                  {/* Sekundär-Metriken + Action */}
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="text-xs text-muted flex flex-wrap gap-x-3.5 gap-y-1">
                      <span>
                        <span className="text-faint">Sessions</span>{' '}
                        <span className="text-strong font-medium">{sessions.toLocaleString('de-DE')}</span>
                      </span>
                      <span>
                        <span className="text-faint">Rate</span>{' '}
                        <span className="text-strong font-medium">{engagementRate.toFixed(0)}%</span>
                      </span>
                      <span>
                        <span className="text-faint">CTR</span>{' '}
                        {ctr !== undefined ? (
                          <span className="text-strong font-medium">{ctr.toFixed(1)}%</span>
                        ) : (
                          <span className="text-faint">—</span>
                        )}
                      </span>
                      <span>
                        <span className="text-faint">Conv</span>{' '}
                        <span className="text-strong font-medium">{conversions}</span>
                      </span>
                    </div>

                    {projectId && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          loadFollowUpPaths(page.path);
                        }}
                        className="px-2.5 py-1 text-xs font-medium text-body border border-theme-border-default rounded-md hover:bg-surface-secondary hover:border-theme-border-strong transition-colors flex items-center gap-1.5"
                        title="Folgepfade anzeigen"
                      >
                        Folgepfade
                        <ArrowRight size={11} />
                      </button>
                    )}
                  </div>

                  {/* Expanded: weitere Suchbegriffe */}
                  {isExpanded && additionalQueries.length > 0 && (
                    <div className="ml-3 mt-3 pl-3 border-l-2 border-theme-border-subtle">
                      <div className="text-[10px] text-faint mb-1.5 uppercase tracking-wider font-medium">Weitere Suchbegriffe</div>
                      <div className="text-xs text-body flex flex-wrap gap-x-3 gap-y-1">
                        {additionalQueries.map((q, qi) => (
                          <span
                            key={qi}
                            title={`${q.clicks} Klicks, ${q.impressions} Impressionen`}
                            className="inline-flex items-center"
                          >
                            <span>{q.query}</span>
                            {q.clicks > 0 && (
                              <span className="ml-1 text-[10px] text-faint">({q.clicks})</span>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Folgepfade Modal / Lightbox ─────────────────────── */}
      {showFollowUpDetail && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center overlay-backdrop backdrop-blur-sm p-4 sm:p-6 animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeFollowUpDetail();
          }}
        >
          <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col overflow-hidden max-h-[85vh] animate-in zoom-in-95 duration-200">

            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-theme-border-subtle bg-surface-secondary flex-shrink-0">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0">
                  <Diagram3Fill className="text-violet-600" size={20} />
                </div>
                <div className="min-w-0">
                  <h4 className="text-[16px] font-semibold text-heading">
                    Folgepfade Analyse
                  </h4>
                  {selectedLandingPage && (
                    <div className="text-sm text-violet-600 font-medium truncate" title={selectedLandingPage}>
                      {selectedLandingPage}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                {followUpData && (
                  <button
                    onClick={() => selectedLandingPage && loadFollowUpPaths(selectedLandingPage)}
                    className="p-2 text-faint hover:text-body hover:bg-surface-tertiary rounded-lg transition-colors"
                    title="Aktualisieren"
                  >
                    <ArrowRepeat size={18} />
                  </button>
                )}
                <button
                  onClick={closeFollowUpDetail}
                  className="p-2 text-faint hover:text-body hover:bg-surface-tertiary rounded-lg transition-colors"
                  title="Schließen"
                >
                  <XLg size={18} />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6 bg-surface custom-scrollbar">

              {/* Loading State */}
              {isLoadingFollowUp && (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="w-8 h-8 border-3 border-violet-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                  <span className="text-muted font-medium">Analysiere Nutzerverhalten...</span>
                </div>
              )}

              {/* Error State */}
              {followUpError && !isLoadingFollowUp && (
                <div className="bg-red-50 border border-red-100 rounded-xl p-6 text-center">
                  <p className="text-red-600 font-medium mb-2">Fehler beim Laden der Daten</p>
                  <p className="text-red-500 text-sm mb-4">{followUpError}</p>
                  <button
                    onClick={() => selectedLandingPage && loadFollowUpPaths(selectedLandingPage)}
                    className="px-4 py-2 bg-surface text-red-600 text-sm font-medium rounded-lg border border-red-200 hover:bg-red-50 transition-colors"
                  >
                    Erneut versuchen
                  </button>
                </div>
              )}

              {/* Data State */}
              {followUpData && !isLoadingFollowUp && !followUpError && (
                <div className="space-y-4">
                  {/* Summary Cards */}
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-surface-secondary rounded-xl p-4 border border-theme-border-subtle">
                      <div className="text-xs text-muted uppercase font-semibold tracking-wider mb-1">Einstiege</div>
                      <div className="text-2xl font-bold text-heading">
                        {followUpData.landingPageSessions.toLocaleString()}
                      </div>
                    </div>
                    <div className="bg-violet-50 rounded-xl p-4 border border-violet-100">
                      <div className="text-xs text-violet-600 uppercase font-semibold tracking-wider mb-1">Verschiedene Folgepfade</div>
                      <div className="text-2xl font-bold text-violet-900">
                        {followUpData.followUpPaths.length}
                      </div>
                    </div>
                  </div>

                  {followUpData.followUpPaths.length === 0 ? (
                    <div className="text-center py-12 bg-surface-secondary rounded-xl border border-dashed border-theme-border-default">
                      <div className="text-faint mb-2">📉</div>
                      <h5 className="text-body font-medium mb-1">Keine Folgepfade gefunden</h5>
                      <p className="text-muted text-sm max-w-md mx-auto">
                        Nutzer verlassen die Website scheinbar direkt nach dem Besuch dieser Seite oder blockieren das Tracking.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {followUpData.followUpPaths.map((fp, idx) => {
                        const maxSessions = followUpData.followUpPaths[0]?.sessions || 1;
                        const barWidth = Math.max((fp.sessions / maxSessions) * 100, 2);
                        const percentOfLandingPage = followUpData.landingPageSessions > 0
                          ? (fp.sessions / followUpData.landingPageSessions) * 100
                          : 0;

                        return (
                          <div
                            key={idx}
                            className="flex items-center gap-4 p-3 bg-surface border border-theme-border-subtle rounded-xl hover:shadow-md transition-all group"
                          >
                            <div className="w-8 h-8 bg-violet-50 text-violet-600 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0 group-hover:bg-violet-500 group-hover:text-white transition-colors">
                              {idx + 1}
                            </div>

                            <ArrowRight className="text-faint flex-shrink-0" size={16} />

                            <div className="flex-1 min-w-0 py-1">
                              <div className="text-[15px] font-medium text-strong truncate mb-1.5" title={fp.path}>
                                {fp.path}
                              </div>
                              <div className="h-2 bg-surface-tertiary rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-violet-400 to-violet-600 rounded-full"
                                  style={{ width: `${barWidth}%` }}
                                />
                              </div>
                            </div>

                            <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                              <div className="bg-violet-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold min-w-[80px] text-center shadow-sm">
                                {fp.sessions.toLocaleString()} Sess.
                              </div>
                              <div className="bg-surface-tertiary text-body px-3 py-1.5 rounded-lg text-xs font-medium min-w-[65px] text-center" title="Anteil der Landingpage-Besucher">
                                {percentOfLandingPage.toFixed(1)}%
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            {followUpData && !isLoadingFollowUp && !followUpError && (
              <div className="px-6 py-4 border-t border-theme-border-subtle bg-surface-secondary text-[11px] text-muted flex items-center gap-2">
                <span className="text-xl">💡</span>
                Die Prozentangabe rechts zeigt, wie viel Prozent der gesamten Einstiege auf diesen speziellen Folgepfad weitergeklickt haben.
              </div>
            )}

          </div>
        </div>
      )}
    </>
  );
}
