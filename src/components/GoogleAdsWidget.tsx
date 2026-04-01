// src/components/GoogleAdsWidget.tsx
'use client';

import { useState, useMemo } from 'react';
import {
  CurrencyDollar,
  ChevronDown,
  ChevronUp,
  CaretDownFill,
  CaretUpFill,
  Search,
} from 'react-bootstrap-icons';
import type { GoogleAdsData, GoogleAdsRow } from '@/lib/dashboard-shared';
import type { DateRangeOption } from '@/components/DateRangeSelector';

interface GoogleAdsWidgetProps {
  data: GoogleAdsData;
  isLoading?: boolean;
  dateRange?: DateRangeOption;
}

type SortField = 'cost' | 'clicks' | 'cpc' | 'roas' | 'conversions' | 'sessions';
type ViewMode = 'campaign' | 'keyword' | 'landingpage' | 'searchquery';

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

// ── Aggregations-Logik ──

interface AggregatedRow {
  label: string;
  cost: number;
  clicks: number;
  cpc: number;
  roas: number;
  conversions: number;
  sessions: number;
  subRows?: GoogleAdsRow[];
}

function aggregateBy(rows: GoogleAdsRow[], field: keyof GoogleAdsRow): AggregatedRow[] {
  const map = new Map<string, { cost: number; clicks: number; conversions: number; sessions: number; revenue: number; subRows: GoogleAdsRow[] }>();

  for (const row of rows) {
    const key = String(row[field]) || '(not set)';
    const existing = map.get(key) || { cost: 0, clicks: 0, conversions: 0, sessions: 0, revenue: 0, subRows: [] };
    existing.cost += row.cost;
    existing.clicks += row.clicks;
    existing.conversions += row.conversions;
    existing.sessions += row.sessions;
    existing.revenue += row.roas * row.cost;
    existing.subRows.push(row);
    map.set(key, existing);
  }

  return Array.from(map.entries()).map(([label, agg]) => ({
    label,
    cost: agg.cost,
    clicks: agg.clicks,
    cpc: agg.clicks > 0 ? agg.cost / agg.clicks : 0,
    roas: agg.cost > 0 ? agg.revenue / agg.cost : 0,
    conversions: agg.conversions,
    sessions: agg.sessions,
    subRows: agg.subRows,
  }));
}

// ── Hauptkomponente ──

export default function GoogleAdsWidget({ data, isLoading, dateRange }: GoogleAdsWidgetProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('campaign');
  const [sortField, setSortField] = useState<SortField>('cost');
  const [sortAsc, setSortAsc] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const { totals } = data;

  const fieldMap: Record<ViewMode, keyof GoogleAdsRow> = {
    campaign: 'campaign',
    keyword: 'keyword',
    landingpage: 'landingPage',
    searchquery: 'searchQuery',
  };

  const tableData = useMemo(() => {
    let aggregated = aggregateBy(data.rows, fieldMap[viewMode]);

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
  }, [data.rows, viewMode, sortField, sortAsc, searchTerm]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortAsc
      ? <CaretUpFill size={10} className="ml-0.5 inline" />
      : <CaretDownFill size={10} className="ml-0.5 inline" />;
  };

  const viewModeLabels: Record<ViewMode, string> = {
    campaign: 'Kampagnen',
    keyword: 'Keywords',
    landingpage: 'Landingpages',
    searchquery: 'Suchanfragen',
  };

  // Skeleton
  if (isLoading) {
    return (
      <div className="card-glass p-6 animate-pulse">
        <div className="h-6 bg-surface-tertiary rounded w-48 mb-4" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 bg-surface-tertiary rounded" />
          ))}
        </div>
      </div>
    );
  }

  // Keine Daten
  if (!data.rows.length) {
    return (
      <div className="card-glass p-6">
        <h3 className="text-base font-semibold text-strong mb-2">Google Ads</h3>
        <p className="text-sm text-muted">
          Keine Google Ads-Daten für diesen Zeitraum vorhanden. Stelle sicher, dass Google Ads mit GA4 verknüpft ist.
        </p>
      </div>
    );
  }

  return (
    <div className="card-glass overflow-hidden">
      {/* ── KPI-Header ── */}
      <div className="p-4 sm:p-6 border-b border-theme-border-subtle">
        <h3 className="text-base font-semibold text-strong mb-4 flex items-center gap-2">
          <CurrencyDollar size={18} className="text-amber-500" />
          Google Ads Performance
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiMini label="Ad Spend" value={formatCurrency(totals.cost)} />
          <KpiMini label="Klicks" value={formatNumber(totals.clicks)} />
          <KpiMini label="Ø CPC" value={formatCurrency(totals.avgCpc)} />
          <KpiMini label="ROAS" value={totals.roas.toFixed(2) + 'x'} highlight={totals.roas >= 3} />
          <KpiMini label="Conversions" value={formatNumber(totals.conversions)} />
          <KpiMini label="Sitzungen" value={formatNumber(totals.sessions)} />
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div className="px-4 sm:px-6 py-3 flex flex-wrap items-center gap-3 border-b border-theme-border-subtle bg-surface/50">
        <div className="flex rounded-lg border border-theme-border-subtle overflow-hidden">
          {(Object.keys(viewModeLabels) as ViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => { setViewMode(mode); setExpandedRow(null); setSearchTerm(''); }}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === mode
                  ? 'bg-indigo-500/10 text-indigo-500 dark:text-indigo-400'
                  : 'text-muted hover:text-strong hover:bg-surface-secondary'
              }`}
            >
              {viewModeLabels[mode]}
            </button>
          ))}
        </div>

        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={`${viewModeLabels[viewMode]} durchsuchen...`}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-theme-border-subtle bg-surface text-body placeholder:text-faint focus:outline-none focus:ring-1 focus:ring-indigo-500/30"
          />
        </div>

        <span className="text-xs text-faint ml-auto">
          {tableData.length} {tableData.length === 1 ? 'Eintrag' : 'Einträge'}
        </span>
      </div>

      {/* ── Tabelle ── */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-theme-border-subtle bg-surface-secondary/50">
              <th className="text-left px-4 py-2.5 font-semibold text-muted w-[30%]">
                {viewModeLabels[viewMode]}
              </th>
              {[
                { field: 'cost' as SortField, label: 'Kosten' },
                { field: 'clicks' as SortField, label: 'Klicks' },
                { field: 'cpc' as SortField, label: 'CPC' },
                { field: 'roas' as SortField, label: 'ROAS' },
                { field: 'conversions' as SortField, label: 'Conv.' },
                { field: 'sessions' as SortField, label: 'Sitzungen' },
              ].map(({ field, label }) => (
                <th
                  key={field}
                  onClick={() => handleSort(field)}
                  className="text-right px-3 py-2.5 font-semibold text-muted cursor-pointer hover:text-strong transition-colors whitespace-nowrap"
                >
                  {label}
                  <SortIcon field={field} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tableData.map((row) => (
              <TableRow
                key={row.label}
                row={row}
                isExpanded={expandedRow === row.label}
                onToggle={() => setExpandedRow(expandedRow === row.label ? null : row.label)}
                viewMode={viewMode}
              />
            ))}

            {tableData.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted">
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

function KpiMini({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="bg-surface-secondary/50 rounded-xl px-3 py-2.5">
      <div className="text-[10px] font-medium text-faint uppercase tracking-wider mb-0.5">{label}</div>
      <div className={`text-sm font-bold ${highlight ? 'text-emerald-500' : 'text-strong'}`}>{value}</div>
    </div>
  );
}

function TableRow({
  row,
  isExpanded,
  onToggle,
  viewMode,
}: {
  row: AggregatedRow;
  isExpanded: boolean;
  onToggle: () => void;
  viewMode: ViewMode;
}) {
  const hasSubRows = (row.subRows?.length || 0) > 1;

  return (
    <>
      <tr
        onClick={hasSubRows ? onToggle : undefined}
        className={`border-b border-theme-border-subtle transition-colors ${
          hasSubRows ? 'cursor-pointer hover:bg-surface-secondary/50' : ''
        } ${isExpanded ? 'bg-surface-secondary/30' : ''}`}
      >
        <td className="px-4 py-2.5 font-medium text-strong max-w-[300px]">
          <div className="flex items-center gap-2">
            {hasSubRows && (
              <span className="text-faint flex-shrink-0">
                {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </span>
            )}
            <span className="truncate" title={row.label}>{row.label}</span>
          </div>
        </td>
        <td className="text-right px-3 py-2.5 text-strong font-semibold">{formatCurrency(row.cost)}</td>
        <td className="text-right px-3 py-2.5 text-body">{formatNumber(row.clicks)}</td>
        <td className="text-right px-3 py-2.5 text-body">{formatCurrency(row.cpc)}</td>
        <td className="text-right px-3 py-2.5">
          <span className={`font-semibold ${row.roas >= 3 ? 'text-emerald-500' : row.roas >= 1 ? 'text-amber-500' : 'text-red-500'}`}>
            {row.roas.toFixed(2)}x
          </span>
        </td>
        <td className="text-right px-3 py-2.5 text-body">{formatNumber(row.conversions)}</td>
        <td className="text-right px-3 py-2.5 text-body">{formatNumber(row.sessions)}</td>
      </tr>

      {isExpanded && hasSubRows && row.subRows?.map((sub, i) => {
        const subLabel = viewMode === 'campaign'
          ? sub.adGroup
          : viewMode === 'keyword'
            ? sub.campaign
            : viewMode === 'landingpage'
              ? sub.keyword
              : sub.campaign;
        const subDimLabel = viewMode === 'campaign'
          ? 'Anzeigengruppe'
          : viewMode === 'keyword'
            ? 'Kampagne'
            : viewMode === 'landingpage'
              ? 'Keyword'
              : 'Kampagne';

        return (
          <tr key={i} className="border-b border-theme-border-subtle bg-surface/30">
            <td className="pl-10 pr-4 py-2 text-muted">
              <span className="text-[10px] uppercase tracking-wider text-faint mr-1.5">{subDimLabel}:</span>
              <span className="truncate" title={subLabel}>{subLabel}</span>
            </td>
            <td className="text-right px-3 py-2 text-muted">{formatCurrency(sub.cost)}</td>
            <td className="text-right px-3 py-2 text-muted">{formatNumber(sub.clicks)}</td>
            <td className="text-right px-3 py-2 text-muted">{formatCurrency(sub.cpc)}</td>
            <td className="text-right px-3 py-2">
              <span className={`${sub.roas >= 3 ? 'text-emerald-500/70' : sub.roas >= 1 ? 'text-amber-500/70' : 'text-red-500/70'}`}>
                {sub.roas.toFixed(2)}x
              </span>
            </td>
            <td className="text-right px-3 py-2 text-muted">{formatNumber(sub.conversions)}</td>
            <td className="text-right px-3 py-2 text-muted">{formatNumber(sub.sessions)}</td>
          </tr>
        );
      })}
    </>
  );
}
