// src/components/GoogleAdsWidget.tsx
'use client';

import { useState, useMemo } from 'react';
import {
  ChevronDown,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  ArrowDownUp,
  Search,
  Google,
} from 'react-bootstrap-icons';
import type { GoogleAdsData, GoogleAdsRow } from '@/lib/dashboard-shared';
import type { DateRangeOption } from '@/components/DateRangeSelector';

interface GoogleAdsWidgetProps {
  data: GoogleAdsData;
  isLoading?: boolean;
  dateRange?: DateRangeOption;
}

type SortField = 'cost' | 'clicks' | 'cpc' | 'interactionRate' | 'conversions' | 'sessions';
type ViewMode = 'campaign' | 'adgroup' | 'ads' | 'searchquery';

// ── Hilfsfunktionen ──

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('de-DE').format(value);
}

/**
 * Zeitraum aus DateRangeOption berechnen.
 */
function formatDateRange(dateRange?: DateRangeOption): string {
  if (!dateRange) return '';
  const fmt = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const to = new Date();
  const from = new Date();
  if (dateRange.endsWith('d')) from.setDate(from.getDate() - parseInt(dateRange, 10));
  else if (dateRange.endsWith('m')) from.setMonth(from.getMonth() - parseInt(dateRange, 10));
  return `${fmt.format(from)} – ${fmt.format(to)}`;
}

// ── Aggregations-Logik ──

interface AggregatedRow {
  label: string;
  cost: number;
  clicks: number;
  cpc: number;
  interactionRate: number;
  conversions: number;
  sessions: number;
  subRows?: GoogleAdsRow[];
}

function aggregateBy(rows: GoogleAdsRow[], field: keyof GoogleAdsRow): AggregatedRow[] {
  const map = new Map<
    string,
    {
      cost: number;
      clicks: number;
      impressions: number;
      conversions: number;
      sessions: number;
      engagedSessions: number;
      subRows: GoogleAdsRow[];
    }
  >();

  for (const row of rows) {
    const key = String(row[field]) || '(not set)';
    if (key === '–' || key === 'undefined' || key === '') continue; // Platzhalter/fehlende Felder überspringen
    const existing = map.get(key) || {
      cost: 0,
      clicks: 0,
      impressions: 0,
      conversions: 0,
      sessions: 0,
      engagedSessions: 0,
      subRows: [],
    };
    existing.cost += row.cost;
    existing.clicks += row.clicks;
    existing.impressions += row.impressions ?? 0;
    existing.conversions += row.conversions;
    existing.sessions += row.sessions;
    existing.engagedSessions += row.engagedSessions ?? 0;
    existing.subRows.push(row);
    map.set(key, existing);
  }

  return Array.from(map.entries()).map(([label, agg]) => ({
    label,
    cost: agg.cost,
    clicks: agg.clicks,
    cpc: agg.clicks > 0 ? agg.cost / agg.clicks : 0,
    // Sheet-Daten: impressions-basiert (Klicks/Impressionen)
    // GA4-Daten: session-basiert (Engaged/Sessions)
    interactionRate: agg.impressions > 0
      ? (agg.clicks / agg.impressions) * 100
      : agg.sessions > 0
      ? (agg.engagedSessions / agg.sessions) * 100
      : 0,
    conversions: agg.conversions,
    sessions: agg.sessions,
    subRows: agg.subRows,
  }));
}

/**
 * Bestimmt die nächste Drill-Down-Dimension und das zugehörige Label.
 */
function getNextDimension(viewMode: ViewMode): { field: keyof GoogleAdsRow; label: string } | null {
  switch (viewMode) {
    case 'campaign':
      return { field: 'adGroup', label: 'Anzeigengr.' };
    case 'adgroup':
      return { field: 'adName', label: 'Anzeige' };
    case 'ads':
      return null;
    default:
      return null;
  }
}

// ── Hauptkomponente ──

export default function GoogleAdsWidget({ data, isLoading, dateRange }: GoogleAdsWidgetProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('campaign');
  const [sortField, setSortField] = useState<SortField>('cost');
  const [sortAsc, setSortAsc] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Safety: falls data undefined/null → Skeleton zeigen
  if (!data || !data.totals) {
    return null;
  }

  const { totals } = data;
  const isSheet = data.source === 'sheet';

  const dateRangeStr = formatDateRange(dateRange);

  const viewConfig: Record<ViewMode, { field: keyof GoogleAdsRow }> = {
    campaign:    { field: 'campaign' },
    adgroup:     { field: 'adGroup' },
    ads:         { field: 'adName' },
    searchquery: { field: 'searchQuery' },
  };

  function getSourceRows(mode: ViewMode): GoogleAdsRow[] {
    if (isSheet) {
      switch (mode) {
        case 'campaign':    return data.campaignRows || data.rows;
        case 'adgroup':     return data.adGroupRows || data.rows;
        case 'ads':         return data.adRows || [];
        case 'searchquery': return data.searchQueryRows || data.rows;
      }
    }
    return data.rows;
  }

  const tableData = useMemo(() => {
    const config = viewConfig[viewMode];
    const sourceRows = getSourceRows(viewMode);

    let aggregated = aggregateBy(sourceRows, config.field);

    // GA4-Modus: Lookup-Overrides für Conversions und Metriken
    if (!isSheet) {
      if (viewMode === 'campaign' && data.conversionsByCampaign) {
        for (const row of aggregated) {
          if (data.conversionsByCampaign[row.label] !== undefined) {
            row.conversions = data.conversionsByCampaign[row.label];
          }
        }
      } else if (viewMode === 'adgroup' && data.conversionsByAdGroup) {
        for (const row of aggregated) {
          if (data.conversionsByAdGroup[row.label] !== undefined) {
            row.conversions = data.conversionsByAdGroup[row.label];
          }
        }
      }

      if (viewMode === 'campaign' && data.metricsByCampaign) {
        for (const row of aggregated) {
          const lookup = data.metricsByCampaign[row.label];
          if (lookup) {
            row.cost = lookup.cost;
            row.clicks = lookup.clicks;
            row.cpc = lookup.clicks > 0 ? lookup.cost / lookup.clicks : 0;
            row.sessions = lookup.sessions;
            row.interactionRate = lookup.sessions > 0
              ? (lookup.engagedSessions / lookup.sessions) * 100
              : 0;
          }
        }
      } else if (viewMode === 'adgroup' && data.metricsByAdGroup) {
        for (const row of aggregated) {
          const lookup = data.metricsByAdGroup[row.label];
          if (lookup) {
            row.cost = lookup.cost;
            row.clicks = lookup.clicks;
            row.cpc = lookup.clicks > 0 ? lookup.cost / lookup.clicks : 0;
            row.sessions = lookup.sessions;
            row.interactionRate = lookup.sessions > 0
              ? (lookup.engagedSessions / lookup.sessions) * 100
              : 0;
          }
        }
      }
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      aggregated = aggregated.filter((row) =>
        row.label.toLowerCase().includes(term)
      );
    }

    aggregated.sort((a, b) => {
      const valA = a[sortField] as number;
      const valB = b[sortField] as number;
      return sortAsc ? valA - valB : valB - valA;
    });

    return aggregated;
  }, [data.rows, data.landingPageRows, data.conversionsByCampaign, data.conversionsByAdGroup, data.metricsByCampaign, data.metricsByAdGroup, data.campaignRows, data.adGroupRows, data.adRows, data.searchQueryRows, data.source, viewMode, sortField, sortAsc, searchTerm]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  // ── Sort-Indikator: aktiv = Pfeil, inaktiv = subtiler Doppelpfeil ──
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowDownUp size={10} className="ml-1 inline opacity-40" />;
    }
    return sortAsc
      ? <ArrowUp size={10} className="ml-1 inline" />
      : <ArrowDown size={10} className="ml-1 inline" />;
  };

  const viewModeLabels: Record<ViewMode, string> = {
    campaign: 'Kampagnen',
    adgroup: 'Anzeigengruppen',
    ads: 'Anzeigen',
    searchquery: 'Suchanfragen',
  };

  // Conversions ausblenden: in der Suchanfragen-Ansicht (nur bei GA4)
  const hideConv = !isSheet && viewMode === 'searchquery';

  const hasAnyData = data.rows.length > 0 || (data.landingPageRows || []).length > 0
    || (data.campaignRows || []).length > 0 || (data.adRows || []).length > 0;

  // ── Skeleton ──
  if (isLoading) {
    return (
      <div className="dashboard-widget-surface rounded-xl p-5 animate-pulse">
        <div className="h-6 bg-surface-tertiary rounded w-56 mb-2" />
        <div className="h-3 bg-surface-tertiary rounded w-72 mb-5" />
        <div className="grid grid-cols-5 gap-2 mb-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 bg-surface-tertiary rounded-md" />
          ))}
        </div>
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-10 bg-surface-tertiary rounded" />
          ))}
        </div>
      </div>
    );
  }

  // ── Empty State ──
  if (!hasAnyData) {
    return (
      <div className="dashboard-widget-surface rounded-xl p-5">
        <h3 className="text-[18px] font-semibold text-heading mb-1 flex items-center gap-2">
          <Google size={18} style={{ color: '#EA4335' }} aria-hidden="true" />
          Google Ads Performance
        </h3>
        <p className="text-sm text-muted">
          Keine Google Ads-Daten für diesen Zeitraum vorhanden. Stelle sicher, dass Google Ads
          mit GA4 verknüpft ist.
        </p>
      </div>
    );
  }

  // ── Liste der sichtbaren View-Modes ──
  const visibleModes = (Object.keys(viewModeLabels) as ViewMode[])
    .filter((mode) => mode !== 'ads' || isSheet);

  return (
    <div className="dashboard-widget-surface rounded-xl p-5">

      {/* ── Header ──────────────────────────────────────────── */}
      <div className="mb-4">
        <h3 className="text-[18px] font-semibold text-heading mb-1 flex items-center gap-2">
          <Google size={18} style={{ color: '#EA4335' }} aria-hidden="true" />
          Google Ads Performance
        </h3>
        <p className="text-xs text-muted">
          Quelle {isSheet ? 'Google Ads' : 'GA4'}
          {dateRangeStr && ` · ${dateRangeStr}`}
        </p>
      </div>

      {/* ── KPI-Strip ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 mb-5">
        <KpiMini label="Ad Spend"    value={formatCurrency(totals.cost)} />
        <KpiMini label="Klicks"      value={formatNumber(totals.clicks)} />
        <KpiMini label="Ø CPC"       value={formatCurrency(totals.avgCpc)} />
        <KpiMini label="Conversions" value={formatNumber(totals.conversions)} />
        {isSheet
          ? <KpiMini label="Impressionen" value={formatNumber((totals as any).impressions ?? 0)} />
          : <KpiMini label="Sitzungen"    value={formatNumber(totals.sessions)} />
        }
      </div>

      {/* ── Tabs + Search ───────────────────────────────────── */}
      <div className="flex items-end justify-between gap-3 border-b border-theme-border-subtle mb-1 flex-wrap">
        <div className="flex gap-0.5 -mb-px">
          {visibleModes.map((mode) => {
            const isActive = viewMode === mode;
            return (
              <button
                key={mode}
                onClick={() => {
                  setViewMode(mode);
                  setExpandedRow(null);
                  setSearchTerm('');
                }}
                className={`px-3.5 py-2 text-[13px] font-medium transition-colors border-b-2 ${
                  isActive
                    ? 'border-strong text-heading'
                    : 'border-transparent text-muted hover:text-body'
                }`}
              >
                {viewModeLabels[mode]}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3 pb-2">
          <span className="text-[11px] text-faint whitespace-nowrap">
            {tableData.length} {tableData.length === 1 ? 'Eintrag' : 'Einträge'}
          </span>
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Suchen..."
              className="w-40 pl-7 pr-2.5 py-1 text-xs h-7 rounded-md border border-theme-border-subtle bg-surface text-body placeholder:text-faint focus:outline-none focus:ring-1 focus:ring-indigo-500/30"
            />
          </div>
        </div>
      </div>

      {/* ── Tabelle ─────────────────────────────────────────── */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th className="text-left px-2 py-2.5 text-[11px] font-medium uppercase tracking-wider text-faint">
                {viewModeLabels[viewMode]}
              </th>
              <th
                onClick={() => handleSort('cost')}
                className={`text-right px-2 py-2.5 text-[11px] font-medium uppercase tracking-wider cursor-pointer hover:text-body transition-colors whitespace-nowrap ${
                  sortField === 'cost' ? 'text-body' : 'text-faint'
                }`}
              >
                Kosten<SortIcon field="cost" />
              </th>
              <th
                onClick={() => handleSort('clicks')}
                className={`text-right px-2 py-2.5 text-[11px] font-medium uppercase tracking-wider cursor-pointer hover:text-body transition-colors whitespace-nowrap ${
                  sortField === 'clicks' ? 'text-body' : 'text-faint'
                }`}
              >
                Klicks<SortIcon field="clicks" />
              </th>
              <th
                onClick={() => handleSort('cpc')}
                className={`text-right px-2 py-2.5 text-[11px] font-medium uppercase tracking-wider cursor-pointer hover:text-body transition-colors whitespace-nowrap ${
                  sortField === 'cpc' ? 'text-body' : 'text-faint'
                }`}
              >
                CPC<SortIcon field="cpc" />
              </th>
              {!hideConv && (
                <th
                  onClick={() => handleSort('conversions')}
                  className={`text-right px-2 py-2.5 text-[11px] font-medium uppercase tracking-wider cursor-pointer hover:text-body transition-colors whitespace-nowrap ${
                    sortField === 'conversions' ? 'text-body' : 'text-faint'
                  }`}
                >
                  Conv.<SortIcon field="conversions" />
                </th>
              )}
              {!isSheet && (
                <th
                  onClick={() => handleSort('sessions')}
                  className={`text-right px-2 py-2.5 text-[11px] font-medium uppercase tracking-wider cursor-pointer hover:text-body transition-colors whitespace-nowrap ${
                    sortField === 'sessions' ? 'text-body' : 'text-faint'
                  }`}
                >
                  Sitzungen<SortIcon field="sessions" />
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {tableData.map((row) => (
              <TableRow
                key={row.label}
                row={row}
                isExpanded={expandedRow === row.label}
                onToggle={() =>
                  setExpandedRow(expandedRow === row.label ? null : row.label)
                }
                viewMode={viewMode}
                hideConv={hideConv}
                isSheet={isSheet}
                conversionsByAdGroup={data.conversionsByAdGroup}
                metricsByAdGroup={data.metricsByAdGroup}
              />
            ))}

            {tableData.length === 0 && (
              <tr>
                <td
                  colSpan={4 + (hideConv ? 0 : 1) + (isSheet ? 0 : 1)}
                  className="px-4 py-10 text-center text-sm text-muted"
                >
                  Keine Ergebnisse für &quot;{searchTerm}&quot;
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Sub-Komponenten ──

function KpiMini({
  label,
  value,
  tooltip,
}: {
  label: string;
  value: string;
  tooltip?: string;
}) {
  return (
    <div className="bg-surface-secondary/60 rounded-md px-3.5 py-3" title={tooltip}>
      <div className="text-[10px] font-medium text-faint uppercase tracking-wider mb-1.5">
        {label}
      </div>
      <div className="text-[18px] font-medium text-heading leading-none">
        {value}
      </div>
    </div>
  );
}

function TableRow({
  row,
  isExpanded,
  onToggle,
  viewMode,
  hideConv,
  isSheet,
  conversionsByAdGroup,
  metricsByAdGroup,
}: {
  row: AggregatedRow;
  isExpanded: boolean;
  onToggle: () => void;
  viewMode: ViewMode;
  hideConv: boolean;
  isSheet: boolean;
  conversionsByAdGroup?: Record<string, number>;
  metricsByAdGroup?: Record<string, { cost: number; clicks: number; sessions: number; engagedSessions: number }>;
}) {
  const nextDim = getNextDimension(viewMode);

  // Conversions in SubRows ausblenden, wenn SubRows = Suchanfragen (nur GA4)
  const hideSubConv = !isSheet && viewMode === 'adgroup';

  const aggregatedSubRows = useMemo(() => {
    if (!nextDim || !row.subRows || row.subRows.length <= 1) return [];

    const subAgg = aggregateBy(row.subRows, nextDim.field);

    if (!isSheet) {
      if (viewMode === 'campaign' && conversionsByAdGroup) {
        for (const sub of subAgg) {
          if (conversionsByAdGroup[sub.label] !== undefined) {
            sub.conversions = conversionsByAdGroup[sub.label];
          }
        }
      }

      if (viewMode === 'campaign' && metricsByAdGroup) {
        for (const sub of subAgg) {
          const lookup = metricsByAdGroup[sub.label];
          if (lookup) {
            sub.cost = lookup.cost;
            sub.clicks = lookup.clicks;
            sub.cpc = lookup.clicks > 0 ? lookup.cost / lookup.clicks : 0;
            sub.sessions = lookup.sessions;
            sub.interactionRate = lookup.sessions > 0
              ? (lookup.engagedSessions / lookup.sessions) * 100
              : 0;
          }
        }
      }
    }

    return subAgg;
  }, [row.subRows, nextDim, viewMode, isSheet, conversionsByAdGroup, metricsByAdGroup]);

  const hasSubRows = aggregatedSubRows.length > 1;

  return (
    <>
      <tr
        onClick={hasSubRows ? onToggle : undefined}
        className={`border-t border-theme-border-subtle transition-colors ${
          hasSubRows ? 'cursor-pointer hover:bg-surface-secondary/40' : ''
        } ${isExpanded ? 'bg-surface-secondary/50' : ''}`}
      >
        <td className="px-2 py-3 text-sm font-medium text-strong max-w-[300px]">
          <div className="flex items-center gap-2">
            <span className="text-faint flex-shrink-0 w-3 flex justify-center">
              {hasSubRows ? (
                isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />
              ) : null}
            </span>
            <span className="truncate" title={row.label}>
              {row.label}
            </span>
          </div>
        </td>
        <td className="text-right px-2 py-3 text-sm font-medium text-heading whitespace-nowrap">
          {formatCurrency(row.cost)}
        </td>
        <td className="text-right px-2 py-3 text-sm text-body whitespace-nowrap">
          {formatNumber(row.clicks)}
        </td>
        <td className="text-right px-2 py-3 text-sm text-body whitespace-nowrap">
          {formatCurrency(row.cpc)}
        </td>
        {!hideConv && (
          <td className="text-right px-2 py-3 text-sm text-body whitespace-nowrap">
            {formatNumber(row.conversions)}
          </td>
        )}
        {!isSheet && (
          <td className="text-right px-2 py-3 text-sm text-body whitespace-nowrap">
            {formatNumber(row.sessions)}
          </td>
        )}
      </tr>

      {isExpanded &&
        hasSubRows &&
        aggregatedSubRows.map((sub) => (
          <tr key={sub.label} className={isExpanded ? 'bg-surface-secondary/50' : ''}>
            <td className="px-2 py-2">
              <div className="ml-3.5 pl-3.5 border-l-2 border-theme-border-subtle text-xs text-body">
                <span className="text-[10px] uppercase tracking-wider text-faint mr-1.5 font-medium">
                  {nextDim!.label}
                </span>
                <span className="truncate" title={sub.label}>
                  {sub.label}
                </span>
              </div>
            </td>
            <td className="text-right px-2 py-2 text-xs text-body whitespace-nowrap">
              {formatCurrency(sub.cost)}
            </td>
            <td className="text-right px-2 py-2 text-xs text-faint whitespace-nowrap">
              {formatNumber(sub.clicks)}
            </td>
            <td className="text-right px-2 py-2 text-xs text-faint whitespace-nowrap">
              {formatCurrency(sub.cpc)}
            </td>
            {!hideConv && (
              <td className="text-right px-2 py-2 text-xs text-faint whitespace-nowrap">
                {hideSubConv ? '–' : formatNumber(sub.conversions)}
              </td>
            )}
            {!isSheet && (
              <td className="text-right px-2 py-2 text-xs text-faint whitespace-nowrap">
                {formatNumber(sub.sessions)}
              </td>
            )}
          </tr>
        ))}
    </>
  );
}
