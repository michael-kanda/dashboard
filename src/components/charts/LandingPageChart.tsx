// src/components/charts/LandingPageChart.tsx
'use client';

import React, { useState, useCallback } from 'react';
import { ConvertingPageData } from '@/lib/dashboard-shared';
import { 
  FileEarmarkText, 
  Search, 
  TagFill, 
  ChevronDown, 
  ChevronUp, 
  ArrowRight,
  XLg,
  ArrowRepeat,
  Diagram3Fill
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

    return `${format(start, 'dd.MM.yyyy', { locale: de })} - ${format(end, 'dd.MM.yyyy', { locale: de })}`;
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
    return <div className="h-[50vh] w-full bg-gray-50 rounded-xl animate-pulse flex items-center justify-center text-gray-400">Lade Daten...</div>;
  }

  if (!data || data.length === 0) {
    return <div className="h-[50vh] w-full bg-gray-50 rounded-xl flex items-center justify-center text-gray-400">Keine Daten verfügbar</div>;
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

  return (
    <>
      <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col max-h-[75vh]">
        
        {/* Header Bereich */}
        <div className="mb-4 flex-shrink-0 border-b border-gray-50 pb-2">
          
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-baseline gap-3">
              <h3 className="text-[18px] font-semibold text-gray-900 flex items-center gap-2">
                <FileEarmarkText className="text-indigo-500" size={18} />
                {title}
              </h3>
              <span className="text-xs text-gray-400">Sortiert nach Neuen Nutzern</span>
            </div>
            
            <div className="relative">
              <input 
                type="text" 
                placeholder="Seite oder Suchbegriff..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 pr-3 py-1 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 w-56 text-gray-700 placeholder-gray-400"
              />
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={12} />
            </div>
          </div>
          
          <div className="ml-7 flex flex-wrap items-center justify-between gap-4 mt-1">
            <div className="text-[11px] text-gray-500 flex items-center gap-2">
              <span className="font-medium bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">Quelle: GA4 + GSC</span>
              <span className="text-gray-400">•</span>
              <span>{formattedDateRange}</span>
              {queryData && (
                <>
                  <span className="text-gray-400">•</span>
                  <span className="text-indigo-500 flex items-center gap-1">
                    <TagFill size={10} />
                    Mit Suchbegriffen
                  </span>
                </>
              )}
            </div>

            <div className="flex items-center gap-x-4">
              <span className="text-[10px] text-gray-500 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-sky-500"></span>
                Sessions
              </span>
              <span className="text-[10px] text-gray-500 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-teal-500"></span>
                Interaktionsrate
              </span>
              <span className="text-[10px] text-gray-500 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                CTR (GSC)
              </span>
              <span className="text-[10px] text-gray-500 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                Conversions
              </span>
            </div>
          </div>
        </div>

        {/* Liste */}
        {sortedData.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm min-h-[200px]">
            {searchTerm ? 'Keine Landingpages für diese Suche gefunden' : 'Keine validen Daten'}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar min-h-0">
            <div className="space-y-1">
              {sortedData.map((page, i) => {
                const newUsers = page.newUsers || 0;
                const sessions = page.sessions || 0;
                const engagementRate = page.engagementRate || 0;
                const conversions = page.conversions || 0;
                const ctr = page.ctr;
                
                const barWidthPercent = maxNewUsers > 0 
                  ? Math.max((newUsers / maxNewUsers) * 60, 2) 
                  : 2;

                const queries = getQueriesForPath(page.path);
                const hasQueries = queries.length > 0;
                const isExpanded = expandedPaths.has(page.path);
                
                const inlineQueries = queries.slice(0, 3);
                const additionalQueries = queries.slice(3);

                return (
                  <div key={i} className="group">
                    <div 
                      className={`flex items-center gap-3 py-2 hover:bg-gray-50 rounded-lg px-2 transition-colors ${hasQueries ? 'cursor-pointer' : ''}`}
                      onClick={() => hasQueries && toggleExpanded(page.path)}
                    >
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="text-[15px] font-medium text-gray-800 truncate" title={page.path}>
                            {page.path}
                          </div>
                          {hasQueries && (
                            <span className="text-gray-400 flex-shrink-0">
                              {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                            </span>
                          )}
                        </div>
                        
                        {hasQueries && (
                          <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                            <TagFill size={10} className="text-indigo-400 flex-shrink-0" />
                            {inlineQueries.map((q, qi) => (
                              <span 
                                key={qi}
                                className="inline-flex items-center text-[11px] text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded"
                                title={`${q.clicks} Klicks, ${q.impressions} Impressionen`}
                              >
                                {q.query}
                                {q.clicks > 0 && (
                                  <span className="ml-1 text-[9px] text-indigo-400">({q.clicks})</span>
                                )}
                              </span>
                            ))}
                            {additionalQueries.length > 0 && !isExpanded && (
                              <span className="text-[10px] text-gray-400">
                                +{additionalQueries.length} weitere
                              </span>
                            )}
                          </div>
                        )}
                        
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                            style={{ width: `${barWidthPercent}%` }}
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="bg-emerald-500 text-white px-3 py-1.5 rounded-md text-[12px] font-semibold whitespace-nowrap min-w-[140px] text-center shadow-sm">
                          {newUsers.toLocaleString()} Neue Besucher
                        </div>
                        <div className="bg-sky-500 text-white px-2 py-1.5 rounded-md text-[11px] font-medium whitespace-nowrap min-w-[75px] text-center shadow-sm">
                          {sessions.toLocaleString()} Sess.
                        </div>
                        <div className="bg-teal-500 text-white px-2 py-1.5 rounded-md text-[11px] font-medium whitespace-nowrap min-w-[70px] text-center shadow-sm">
                          {engagementRate.toFixed(0)}% Rate
                        </div>
                        <div className="bg-amber-500 text-white px-2 py-1.5 rounded-md text-[11px] font-medium whitespace-nowrap min-w-[65px] text-center shadow-sm">
                          {ctr !== undefined ? `${ctr.toFixed(1)}% CTR` : '– CTR'}
                        </div>
                        <div className="bg-slate-400 text-white px-2 py-1.5 rounded-md text-[11px] font-medium whitespace-nowrap min-w-[65px] text-center shadow-sm">
                          {conversions} Conv.
                        </div>
                        
                        {projectId && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              loadFollowUpPaths(page.path);
                            }}
                            className="bg-violet-500 hover:bg-violet-600 text-white px-2 py-1.5 rounded-md text-[11px] font-medium whitespace-nowrap flex items-center gap-1 shadow-sm transition-colors"
                            title="Folgepfade anzeigen"
                          >
                            <Diagram3Fill size={12} />
                            Details
                          </button>
                        )}
                      </div>
                    </div>

                    {isExpanded && additionalQueries.length > 0 && (
                      <div className="ml-4 pl-4 border-l-2 border-indigo-100 py-2 mb-2">
                        <div className="text-[10px] text-gray-500 mb-1.5">Weitere Suchbegriffe:</div>
                        <div className="flex flex-wrap gap-1.5">
                          {additionalQueries.map((q, qi) => (
                            <span 
                              key={qi}
                              className="inline-flex items-center text-[11px] text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded"
                              title={`${q.clicks} Klicks, ${q.impressions} Impressionen`}
                            >
                              {q.query}
                              {q.clicks > 0 && (
                                <span className="ml-1 text-[9px] text-indigo-400">({q.clicks})</span>
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
          </div>
        )}
      </div>

      {/* --- NEU: Folgepfade Modal / Lightbox --- */}
      {showFollowUpDetail && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/40 backdrop-blur-sm p-4 sm:p-6 animate-in fade-in duration-200"
          onClick={(e) => {
            // Schließt das Modal, wenn man auf den abgedunkelten Hintergrund klickt
            if (e.target === e.currentTarget) closeFollowUpDetail();
          }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col overflow-hidden max-h-[85vh] animate-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex-shrink-0">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0">
                  <Diagram3Fill className="text-violet-600" size={20} />
                </div>
                <div className="min-w-0">
                  <h4 className="text-[16px] font-semibold text-gray-900">
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
                    className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Aktualisieren"
                  >
                    <ArrowRepeat size={18} />
                  </button>
                )}
                <button
                  onClick={closeFollowUpDetail}
                  className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Schließen"
                >
                  <XLg size={18} />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6 bg-white custom-scrollbar">
              
              {/* Loading State */}
              {isLoadingFollowUp && (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="w-8 h-8 border-3 border-violet-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                  <span className="text-gray-500 font-medium">Analysiere Nutzerverhalten...</span>
                </div>
              )}

              {/* Error State */}
              {followUpError && !isLoadingFollowUp && (
                <div className="bg-red-50 border border-red-100 rounded-xl p-6 text-center">
                  <p className="text-red-600 font-medium mb-2">Fehler beim Laden der Daten</p>
                  <p className="text-red-500 text-sm mb-4">{followUpError}</p>
                  <button
                    onClick={() => selectedLandingPage && loadFollowUpPaths(selectedLandingPage)}
                    className="px-4 py-2 bg-white text-red-600 text-sm font-medium rounded-lg border border-red-200 hover:bg-red-50 transition-colors"
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
                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                      <div className="text-xs text-gray-500 uppercase font-semibold tracking-wider mb-1">Einstiege</div>
                      <div className="text-2xl font-bold text-gray-900">
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
                    <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                      <div className="text-gray-400 mb-2">📉</div>
                      <h5 className="text-gray-700 font-medium mb-1">Keine Folgepfade gefunden</h5>
                      <p className="text-gray-500 text-sm max-w-md mx-auto">
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
                            className="flex items-center gap-4 p-3 bg-white border border-gray-100 rounded-xl hover:shadow-md transition-all group"
                          >
                            <div className="w-8 h-8 bg-violet-50 text-violet-600 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0 group-hover:bg-violet-500 group-hover:text-white transition-colors">
                              {idx + 1}
                            </div>
                            
                            <ArrowRight className="text-gray-300 flex-shrink-0" size={16} />
                            
                            <div className="flex-1 min-w-0 py-1">
                              <div className="text-[15px] font-medium text-gray-800 truncate mb-1.5" title={fp.path}>
                                {fp.path}
                              </div>
                              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
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
                              <div className="bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg text-xs font-medium min-w-[65px] text-center" title="Anteil der Landingpage-Besucher">
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
            
            {/* Modal Footer (Optional, macht es aber oft "runder") */}
            {followUpData && !isLoadingFollowUp && !followUpError && (
              <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 text-[11px] text-gray-500 flex items-center gap-2">
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
