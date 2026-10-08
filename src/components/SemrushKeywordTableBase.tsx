// src/components/SemrushKeywordTableBase.tsx
'use client';

import React, { useState, useEffect, useMemo } from 'react';
// ✅ NEU: Icons importieren
import { ArrowUp, ArrowDown, Search, FunnelFill, Trophy, Award, CheckCircleFill } from 'react-bootstrap-icons';
import { cn } from '@/lib/utils';

// --- TYPEN ---
interface KeywordData {
  keyword: string;
  position: number;
  previousPosition: number | null;
  searchVolume: number;
  trafficPercent: number;
  url: string;
}

export interface SemrushTheme {
  headerGradient: string;
  headerText: string;
  headerTextMuted: string;
  tableHeaderBg: string; 
  tableHeaderBorder: string;
  tableHeaderHover: string;
  tableRowHover: string;
  tableHeaderBgColor: string;
  tableHeaderHoverColor: string;
}

interface SemrushKeywordTableBaseProps {
  projectId?: string | null;
  campaign: 'kampagne_1' | 'kampagne_2';
  title: string;
  logContext: string;
  errorContext: string;
  keyPrefix: string;
  theme: SemrushTheme;
  debugInfo: {
    title: string;
    classes: string;
  };
}

export default function SemrushKeywordTableBase({
  projectId,
  campaign,
  title,
  logContext,
  errorContext,
  keyPrefix,
  theme,
  debugInfo,
}: SemrushKeywordTableBaseProps) {
  
  const [keywords, setKeywords] = useState<KeywordData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState<boolean>(false);
  const [sortField, setSortField] = useState<keyof KeywordData | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const formatLastFetched = (dateString: string | null): string => {
    if (!dateString) return 'Nie';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMinutes < 5) return 'Gerade eben';
    if (diffHours === 0) return `vor ${diffMinutes} Minuten`;
    if (diffDays === 0) return `Heute (vor ${diffHours}h)`;
    if (diffDays === 1) return 'Gestern';
    if (diffDays < 14) return `vor ${diffDays} Tagen`;
    return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const handleSort = (field: keyof KeywordData) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection(field === 'position' ? 'asc' : 'desc');
    }
  };

  const sortedKeywords = useMemo(() => {
    if (!sortField) return keywords;
    return [...keywords].sort((a, b) => {
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
  }, [keywords, sortField, sortDirection]);

  useEffect(() => {
    const fetchKeywords = async () => {
      setIsLoading(true);
      setError(null);
      setKeywords([]);
      setLastFetched(null);
      setFromCache(false);

      try {
        const urlParams = new URLSearchParams();
        urlParams.set('campaign', campaign);
        if (projectId) urlParams.set('projectId', projectId);
        
        const url = `/api/semrush/keywords?${urlParams.toString()}`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.error && !data.keywords?.length) {
          setError(data.error);
          setKeywords([]);
        } else if (data.keywords) {
          setKeywords(data.keywords);
          setLastFetched(data.lastFetched);
          setFromCache(data.fromCache || false);
          setError(data.error || null);
        } else {
          setKeywords([]);
          setError('Unerwartete Antwort von der API');
        }
      } catch (err) {
        console.error(`[${logContext}] Error fetching keywords:`, err);
        setError(`Fehler beim Laden der Keywords (${errorContext})`);
        setKeywords([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchKeywords();
  }, [projectId, campaign, logContext, errorContext]);

  const getPositionChange = (current: number, previous: number | null) => {
    if (previous === null) return null;
    return previous - current;
  };

  // ✅ NEU: Helper für Ranking Badges
  const renderRankingBadge = (position: number) => {
    const rounded = Math.round(position);
    
    if (rounded === 1) {
      return (
        <span className="widget-control inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-yellow-50 text-yellow-700 border border-yellow-200 shadow-sm">
          <Trophy size={10} className="text-yellow-600" />
          {position}
        </span>
      );
    }
    if (rounded <= 3) {
      return (
        <span className="widget-control inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-surface-tertiary text-body border border-theme-border-default shadow-sm">
          <Award size={10} className="text-muted" />
          {position}
        </span>
      );
    }
    if (rounded <= 10) {
      return (
        <span className="widget-control inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
          <CheckCircleFill size={10} className="text-emerald-500 opacity-60" />
          {position}
        </span>
      );
    }
    
    // Default > 10
    return (
      <span className="text-muted font-medium text-xs">
        {position}
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="bg-surface rounded-lg shadow-md border border-theme-border-default">
        <div className={cn("p-4 rounded-t-lg bg-gradient-to-r", theme.headerGradient)}>
          <div className="flex items-center gap-2">
            <Search className="text-white" size={20} />
            <h3 className="widget-title text-white">{title}</h3>
          </div>
        </div>
        <div className="p-6 animate-pulse space-y-3">
          {[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-surface-tertiary rounded"></div>)}
        </div>
      </div>
    );
  }

  if (error || keywords.length === 0) {
    const defaultError = projectId 
      ? 'Keine Keywords verfügbar. Bitte warten Sie auf den ersten Datenabruf.'
      : `Keine Semrush Tracking ID (${errorContext}) konfiguriert oder keine Keywords gefunden.`;

    return (
      <div className="bg-surface rounded-lg shadow-md border border-theme-border-default">
        <div className={cn("p-4 rounded-t-lg bg-gradient-to-r", theme.headerGradient)}>
          <div className="flex items-center gap-2">
            <Search className="text-white" size={20} />
            <h3 className="widget-title text-white">{title}</h3>
          </div>
        </div>
        <div className="p-6">
          <p className="text-sm text-muted italic">{error || defaultError}</p>
          {lastFetched && !isLoading && (
            <div className="mt-4 pt-4 border-t border-theme-border-subtle text-xs text-muted flex flex-col items-start gap-1">
              Letzter Versuch: {formatLastFetched(lastFetched)}
              <span className="text-[10px] text-faint">({new Date(lastFetched).toLocaleString('de-DE')})</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-lg shadow-md border border-theme-border-default flex flex-col">
      {/* Header */}
      <div className={cn("p-4 rounded-t-lg bg-gradient-to-r", theme.headerGradient)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Search className="text-white" size={20} />
            <h3 className="widget-title text-white">{title}</h3>
          </div>
          <div className="flex items-center gap-3">
            {lastFetched && (
              <div className={cn("text-xs flex flex-col items-end gap-1", theme.headerText)}>
                <div className="flex items-center gap-2">
                  <span className={cn("px-2 py-0.5 rounded text-xs font-medium", fromCache ? 'bg-surface/20 text-white' : 'bg-green-500 text-white')}>
                    {fromCache ? 'Cache' : 'Live'}
                  </span>
                  <span className="whitespace-nowrap">{formatLastFetched(lastFetched)}</span>
                </div>
                <span className={cn("text-[10px]", theme.headerTextMuted)} title={lastFetched}>{new Date(lastFetched).toLocaleString('de-DE')}</span>
              </div>
            )}
            <div className={cn("text-xs whitespace-nowrap", theme.headerText)}>
              {keywords.length} {keywords.length === 1 ? 'Keyword' : 'Keywords'}
            </div>
          </div>
        </div>
      </div>

      {process.env.NODE_ENV === 'development' && (
        <div className={cn("mx-4 mt-4 p-2 border rounded text-xs", debugInfo.classes)}>
          <strong>{debugInfo.title}:</strong> <br />ProjectId: {projectId || 'none (User)'}, <br />Keywords: {keywords.length}, <br />Campaign: {campaign}
        </div>
      )}

      {/* Tabelle */}
      <div className="overflow-x-auto">
        <div className="max-h-[600px] overflow-y-auto">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="text-white" style={{ backgroundColor: theme.tableHeaderBgColor }}>
                <th onClick={() => handleSort('keyword')} className="widget-table-head px-4 py-3 text-left cursor-pointer transition-colors border-r border-white/20" style={{ backgroundColor: theme.tableHeaderBgColor }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme.tableHeaderHoverColor} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = theme.tableHeaderBgColor}>
                  <div className="flex items-center gap-2">Keyword <FunnelFill size={12} className="opacity-60" /></div>
                </th>
                <th onClick={() => handleSort('position')} className="widget-table-head px-4 py-3 text-right cursor-pointer transition-colors whitespace-nowrap border-r border-white/20" style={{ backgroundColor: theme.tableHeaderBgColor }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme.tableHeaderHoverColor} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = theme.tableHeaderBgColor}>
                  <div className="flex items-center justify-end gap-2">Position <FunnelFill size={12} className="opacity-60" /></div>
                </th>
                <th className="widget-table-head px-4 py-3 text-center whitespace-nowrap border-r border-white/20" style={{ backgroundColor: theme.tableHeaderBgColor }}>Änderung</th>
                <th onClick={() => handleSort('searchVolume')} className="widget-table-head px-4 py-3 text-right cursor-pointer transition-colors whitespace-nowrap border-r border-white/20" style={{ backgroundColor: theme.tableHeaderBgColor }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme.tableHeaderHoverColor} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = theme.tableHeaderBgColor}>
                  <div className="flex items-center justify-end gap-2">Suchvolumen <FunnelFill size={12} className="opacity-60" /></div>
                </th>
                <th onClick={() => handleSort('trafficPercent')} className="widget-table-head px-4 py-3 text-right cursor-pointer transition-colors whitespace-nowrap border-r border-white/20" style={{ backgroundColor: theme.tableHeaderBgColor }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme.tableHeaderHoverColor} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = theme.tableHeaderBgColor}>
                  <div className="flex items-center justify-end gap-2">Traffic % <FunnelFill size={12} className="opacity-60" /></div>
                </th>
                <th className="widget-table-head px-4 py-3 text-left whitespace-nowrap" style={{ backgroundColor: theme.tableHeaderBgColor }}>URL</th>
              </tr>
            </thead>
            <tbody>
              {sortedKeywords.map((kw, index) => {
                const positionChange = getPositionChange(kw.position, kw.previousPosition);
                return (
                  <tr key={`${keyPrefix}-${projectId || 'user'}-${kw.keyword}-${index}`} className={cn("border-b border-theme-border-default transition-colors", index % 2 === 0 ? "bg-surface" : "bg-surface-secondary", theme.tableRowHover)}>
                    <td className="widget-table-cell px-4 py-3 text-heading font-medium border-r border-theme-border-default"><div className="break-words max-w-xs">{kw.keyword}</div></td>
                    
                    {/* ✅ KORREKTUR: Neue Badges */}
                    <td className="widget-table-cell px-4 py-3 text-right border-r border-theme-border-default whitespace-nowrap">
                      <div className="flex justify-end">
                        {renderRankingBadge(kw.position)}
                      </div>
                    </td>
                    
                    <td className="widget-table-cell px-4 py-3 text-center border-r border-theme-border-default whitespace-nowrap">
                      {positionChange !== null && positionChange !== 0 ? (
                        <span className={cn("inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-xs font-semibold", positionChange > 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700")}>
                          {positionChange > 0 ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                          {Math.abs(positionChange)}
                        </span>
                      ) : (<span className="text-faint text-xs">-</span>)}
                    </td>
                    <td className="widget-table-cell px-4 py-3 text-heading text-right font-medium border-r border-theme-border-default whitespace-nowrap">{kw.searchVolume.toLocaleString('de-DE')}</td>
                    <td className="widget-table-cell px-4 py-3 text-heading text-right font-medium border-r border-theme-border-default whitespace-nowrap">{kw.trafficPercent.toFixed(1)}%</td>
                    <td className="widget-table-cell px-4 py-3 border-r-0">
                      {kw.url ? (
                        <a href={kw.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate block max-w-xs text-xs" title={kw.url}>{kw.url.length > 40 ? kw.url.substring(0, 40) + '...' : kw.url}</a>
                      ) : (<span className="text-faint text-xs">-</span>)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="px-4 py-3 bg-surface-secondary border-t border-theme-border-default rounded-b-lg">
        <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-secondary">
          <div className="flex items-center gap-4">
            <span>Ø Position: <span className="font-semibold text-heading">{(sortedKeywords.reduce((sum, k) => sum + k.position, 0) / (sortedKeywords.length || 1)).toFixed(1)}</span></span>
            <span>Gesamt Traffic: <span className="font-semibold text-heading">{sortedKeywords.reduce((sum, k) => sum + k.trafficPercent, 0).toFixed(1)}%</span></span>
          </div>
          <div className="text-muted">💡 Datenaktualisierung alle 14 Tage | Klicken Sie auf die Spaltenüberschriften zum Sortieren</div>
        </div>
      </div>
    </div>
  );
}
