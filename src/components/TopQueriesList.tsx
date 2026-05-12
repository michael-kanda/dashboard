// src/components/TopQueriesList.tsx
'use client';

import React, { useState } from 'react';
import { ClockHistory, FunnelFill, ExclamationTriangleFill, Search, X, Trophy, Award, CheckCircleFill } from 'react-bootstrap-icons';
import { cn } from '@/lib/utils';
import { type DateRangeOption, getRangeLabel } from '@/components/DateRangeSelector';

type TopQueryData = {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  url?: string; // ✅ NEU: Landingpage URL (optional für Abwärtskompatibilität)
};

interface TopQueriesListProps {
  queries: TopQueryData[];
  isLoading?: boolean;
  className?: string;
  dateRange?: DateRangeOption;
  error?: string | null;
}

// ✅ Hilfsfunktion: URL zu lesbarem Pfad konvertieren
function formatUrl(url: string | undefined): string | null {
  if (!url) return null;
  
  try {
    const urlObj = new URL(url);
    let path = urlObj.pathname;
    
    // Query-Parameter entfernen falls vorhanden
    path = path.split('?')[0];
    
    // Trailing Slash entfernen (außer bei Root)
    if (path.length > 1 && path.endsWith('/')) {
      path = path.slice(0, -1);
    }
    
    // Leerer Pfad = Homepage
    if (path === '' || path === '/') {
      return '/';
    }
    
    return path;
  } catch {
    // Fallback: Wenn URL nicht parsebar, versuche Pfad direkt zu extrahieren
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
  const [sortField, setSortField] = useState<keyof TopQueryData | null>(null);
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
      // ✅ Suche auch in URL
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

  const renderRankingBadge = (position: number) => {
    const rounded = Math.round(position);
    
    if (rounded === 1) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-700/50 shadow-sm">
          <Trophy size={10} className="text-yellow-600" />
          {position.toFixed(1)}
        </span>
      );
    }
    if (rounded <= 3) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-surface-tertiary text-body border border-border shadow-sm">
          <Award size={10} className="text-muted" />
          {position.toFixed(1)}
        </span>
      );
    }
    if (rounded <= 10) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-700/50">
          <CheckCircleFill size={10} className="text-emerald-500 opacity-60" />
          {position.toFixed(1)}
        </span>
      );
    }
    
    return (
      <span className="text-muted font-medium text-xs">
        {position.toFixed(1)}
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className={cn("bg-surface rounded-lg shadow-sm border border-border card-glass", className)}>
        <div className="p-4 bg-[#188BDB] rounded-t-lg">
          <div className="flex items-center gap-2 text-white">
            <ClockHistory size={20} />
            <h3 className="text-lg font-semibold">Top 100 Suchanfragen</h3>
          </div>
        </div>
        <div className="p-6 animate-pulse space-y-3">
          {[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-surface-tertiary rounded"></div>)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("bg-surface rounded-lg shadow-sm border border-border card-glass", className)}>
        <div className="p-4 bg-[#188BDB] rounded-t-lg">
          <div className="flex items-center gap-2 text-white">
            <ClockHistory size={20} />
            <h3 className="text-lg font-semibold">Top 100 Suchanfragen</h3>
          </div>
        </div>
        <div className="p-6 text-center text-sm text-red-700 flex flex-col items-center gap-2 min-h-[200px] justify-center">
          <ExclamationTriangleFill className="text-red-500 w-6 h-6" />
          <span className="font-semibold">Fehler bei GSC-Daten</span>
          <p className="text-xs text-muted" title={error}>Die Suchanfragen konnten nicht geladen werden.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("bg-surface rounded-lg shadow-sm border border-border flex flex-col card-glass", className)}>
      
      {/* Header */}
      <div className="p-4 bg-[#188BDB] rounded-t-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <ClockHistory className="text-white" size={20} />
          <h3 className="text-lg font-semibold text-white">Top 100 Suchanfragen (Quelle: GSC)</h3>
          {rangeLabel && (
             <span className="text-xs text-white/90 bg-black/10 px-2 py-0.5 rounded-full ml-2 hidden sm:inline-block">
               {rangeLabel}
             </span>
           )}
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-initial">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/70" size={14} />
            <input 
              type="text" 
              placeholder="Suchen..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-48 bg-white/20 text-white placeholder-white/70 text-sm rounded-full py-1.5 pl-8 pr-8 border border-white/10 focus:outline-none focus:ring-2 focus:ring-white/30 transition-all"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/70 hover:text-white"
              >
                <X size={16} />
              </button>
            )}
          </div>
          <div className="text-xs text-white/80 whitespace-nowrap hidden sm:block">
            {displayedQueries.length} {displayedQueries.length === 1 ? 'Eintrag' : 'Einträge'}
          </div>
        </div>
      </div>

      {/* Tabelle */}
      <div className="overflow-x-auto flex-grow">
        {displayedQueries.length === 0 ? (
           <div className="p-8 text-center text-sm text-muted italic min-h-[200px] flex flex-col items-center justify-center">
             <Search className="text-faint mb-2" size={32} />
             {searchTerm ? `Keine Ergebnisse für "${searchTerm}"` : 'Keine Suchanfragen gefunden.'}
           </div>
        ) : (
          <div className="max-h-[600px] overflow-y-auto">
            <table className="w-full border-collapse">
              <thead className="sticky top-0 z-10">
                <tr className="bg-[#188BDB] text-white">
                  <th onClick={() => handleSort('query')} className="px-4 py-3 text-left text-sm font-semibold border-r border-white/20 cursor-pointer hover:bg-[#1479BF] transition-colors"><div className="flex items-center gap-2">Suchanfrage <FunnelFill size={12} className="opacity-60" /></div></th>
                  <th onClick={() => handleSort('clicks')} className="px-4 py-3 text-right text-sm font-semibold border-r border-white/20 cursor-pointer hover:bg-[#1479BF] transition-colors whitespace-nowrap"><div className="flex items-center justify-end gap-2">Klicks <FunnelFill size={12} className="opacity-60" /></div></th>
                  <th onClick={() => handleSort('impressions')} className="px-4 py-3 text-right text-sm font-semibold border-r border-white/20 cursor-pointer hover:bg-[#1479BF] transition-colors whitespace-nowrap"><div className="flex items-center justify-end gap-2">Impr. <FunnelFill size={12} className="opacity-60" /></div></th>
                  <th onClick={() => handleSort('ctr')} className="px-4 py-3 text-right text-sm font-semibold border-r border-white/20 cursor-pointer hover:bg-[#1479BF] transition-colors whitespace-nowrap"><div className="flex items-center justify-end gap-2">CTR <FunnelFill size={12} className="opacity-60" /></div></th>
                  <th onClick={() => handleSort('position')} className="px-4 py-3 text-right text-sm font-semibold cursor-pointer hover:bg-[#1479BF] transition-colors whitespace-nowrap"><div className="flex items-center justify-end gap-2">Pos. <FunnelFill size={12} className="opacity-60" /></div></th>
                </tr>
              </thead>
              <tbody>
                {displayedQueries.map((query, index) => {
                  const formattedPath = formatUrl(query.url);
                  
                  return (
                    <tr 
                      key={`${query.query}-${index}`}
                      className={cn("border-b border-border hover:bg-surface-tertiary transition-colors", index % 2 === 0 ? "bg-surface" : "bg-surface-secondary")}
                    >
                      <td className="px-4 py-3 text-sm text-heading border-r border-border">
                        <div className="break-words max-w-md">
                          {/* ✅ Suchanfrage */}
                          <span className="font-medium">{query.query}</span>
                          
                          {/* ✅ NEU: Landingpage subtil darunter */}
                          {formattedPath && (
                            <div className="mt-1">
                              <span 
                                className="inline-flex items-center text-xs text-rose-400 font-mono px-1.5 py-0.5 bg-surface-secondary rounded border border-border/50"
                                title={query.url}
                              >
                                {formattedPath}
                              </span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-heading text-right border-r border-border whitespace-nowrap">{query.clicks.toLocaleString('de-DE')}</td>
                      <td className="px-4 py-3 text-sm text-heading text-right border-r border-border whitespace-nowrap">{query.impressions.toLocaleString('de-DE')}</td>
                      <td className="px-4 py-3 text-sm text-heading text-right border-r border-border whitespace-nowrap">{(query.ctr * 100).toFixed(1)}%</td>
                      
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="flex justify-end">
                          {renderRankingBadge(query.position)}
                        </div>
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
      <div className="px-4 py-3 bg-surface-secondary border-t border-border rounded-b-lg">
        <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-secondary">
          <div className="flex items-center gap-4">
            <span>Klicks: <span className="font-semibold text-heading">{displayedQueries.reduce((sum, q) => sum + q.clicks, 0).toLocaleString('de-DE')}</span></span>
            <span>Impressionen: <span className="font-semibold text-heading">{displayedQueries.reduce((sum, q) => sum + q.impressions, 0).toLocaleString('de-DE')}</span></span>
          </div>
        </div>
      </div>
    </div>
  );
}
