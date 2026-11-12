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
} from 'react-bootstrap-icons';
import type { GoogleAdsData, GoogleAdsRow } from '@/lib/dashboard-shared';
import type { DateRangeOption } from '@/components/DateRangeSelector';
import GoogleCleanUnderline from '@/components/ui/GoogleCleanUnderline';
import {
  aggregateGoogleAdsRows,
  applyGa4SessionsToSheetRows,
  buildGa4GoogleAdsLevelRows,
  compareGoogleAdsSources,
  GOOGLE_ADS_COMPARISON_TOLERANCE_PERCENT,
  type GoogleAdsSourceComparison,
  type GoogleAdsSourceComparisonValue,
  type GoogleAdsTableRow,
} from '@/lib/google-ads-table';

interface GoogleAdsWidgetProps {
  error?: string;
  data: GoogleAdsData;
  isLoading?: boolean;
  dateRange?: DateRangeOption;
  /** Admin-Abgleich Sheet vs. GA4 anzeigen (nur Admins). */
  showSourceComparison?: boolean;
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


function formatStoredDateRange(startDate?: string, endDate?: string): string {
  if (!startDate || !endDate) return '';
  const fmt = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const parse = (value: string) => new Date(`${value}T12:00:00`);
  const start = parse(startDate);
  const end = parse(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return '';
  return `${fmt.format(start)} – ${fmt.format(end)}`;
}

// ── Aggregations-Logik ──

type AggregatedRow = GoogleAdsTableRow;
const aggregateBy = aggregateGoogleAdsRows;

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

export default function GoogleAdsWidget(props: GoogleAdsWidgetProps) {
  // Datenpruefung vor allen Hooks: GoogleAdsWidgetContent ruft so immer dieselben Hooks auf.
  return props.data?.totals ? <GoogleAdsWidgetContent {...props} /> : null;
}

function GoogleAdsWidgetContent({ data, isLoading, error, showSourceComparison = false }: GoogleAdsWidgetProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('campaign');
  const [sortField, setSortField] = useState<SortField>('cost');
  const [sortAsc, setSortAsc] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const { totals } = data;
  const isSheet = data.source === 'sheet';
  const ga4Supplement = isSheet ? data.ga4Supplement : undefined;
  const sourceComparison = showSourceComparison ? compareGoogleAdsSources(data) : null;

  const dateRangeStr = formatStoredDateRange(data.reportStartDate, data.reportEndDate);
  const latestDataDate = data.latestDataDate
    ? new Intl.DateTimeFormat('de-DE').format(new Date(`${data.latestDataDate}T12:00:00`))
    : null;

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

    // GA4-Modus: Kampagnen und Anzeigengruppen aus den vollständigen
    // 1-Dimension-Abfragen, damit z. B. Performance Max nicht fehlt.
    let aggregated = !isSheet && (viewMode === 'campaign' || viewMode === 'adgroup')
      ? buildGa4GoogleAdsLevelRows(data, viewMode === 'campaign' ? 'campaign' : 'adGroup')
      : aggregateBy(sourceRows, config.field);

    // Sheet-Modus: Sitzungen aus GA4 ergänzen (Kosten/Klicks bleiben aus Google Ads)
    if (isSheet && (viewMode === 'campaign' || viewMode === 'adgroup')) {
      aggregated = applyGa4SessionsToSheetRows(aggregated, data, viewMode === 'campaign' ? 'campaign' : 'adGroup');
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      aggregated = aggregated.filter((row) =>
        row.label.toLowerCase().includes(term)
      );
    }

    aggregated.sort((a, b) => {
      // Restzeile immer ans Ende
      if (a.isRemainder !== b.isRemainder) return a.isRemainder ? 1 : -1;
      const valA = a[sortField] as number;
      const valB = b[sortField] as number;
      return sortAsc ? valA - valB : valB - valA;
    });

    return aggregated;
  }, [data.rows, data.totals, data.landingPageRows, data.conversionsByCampaign, data.conversionsByAdGroup, data.metricsByCampaign, data.metricsByAdGroup, data.campaignRows, data.adGroupRows, data.adRows, data.searchQueryRows, data.source, data.ga4Supplement, viewMode, sortField, sortAsc, searchTerm]);

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
  // Sitzungen: GA4 immer; Sheet nur mit GA4-Ergänzung und nur dort, wo GA4 die Ebene kennt
  const showSessions = !isSheet || (Boolean(ga4Supplement) && (viewMode === 'campaign' || viewMode === 'adgroup'));

  const hasAnyData = data.rows.length > 0 || (data.landingPageRows || []).length > 0
    || (data.campaignRows || []).length > 0 || (data.adRows || []).length > 0
    || Object.keys(data.metricsByCampaign || {}).length > 0 || totals.cost > 0;

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
        <h3 className="widget-title text-heading">Google Ads Performance</h3>
        <GoogleCleanUnderline id="google-clean-gradient-google-ads-empty" />
        <p className="widget-body mt-3 text-muted">
          {isSheet
            ? 'Google-Ads-Sheet ist konfiguriert, aber für diesen Zeitraum wurden keine lesbaren Zeilen gefunden. Prüfe Sheet-Freigabe, Tabs Kampagnen/Anzeigengruppen/Anzeigen/Suchanfragen und das Datum im Tab Kampagnen.'
            : 'Keine Google Ads-Daten für diesen Zeitraum vorhanden. Stelle sicher, dass Google Ads mit GA4 verknüpft ist.'
          }
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
        <h3 className="widget-title text-heading">Google Ads Performance</h3>
        <GoogleCleanUnderline id="google-clean-gradient-google-ads" />
        <p className="widget-meta mt-2 text-muted">
          Quelle {isSheet ? 'Google Ads' : 'GA4'}
          {dateRangeStr && ` · ${dateRangeStr}`}
          {isSheet && latestDataDate && ` · Sheet-Daten bis ${latestDataDate}`}
          {error && ' · Aktualisierung fehlgeschlagen; letzter verfügbarer Stand'}
          {ga4Supplement && ' · Sitzungen aus GA4'}
        </p>
        {sourceComparison && <SourceComparisonNote comparison={sourceComparison} />}
      </div>

      {/* ── KPI-Strip ───────────────────────────────────────── */}
      <div className={`grid grid-cols-2 sm:grid-cols-3 gap-2 mb-5 ${ga4Supplement ? 'lg:grid-cols-6' : 'lg:grid-cols-5'}`}>
        <KpiMini label="Ad Spend"    value={formatCurrency(totals.cost)} />
        <KpiMini label="Klicks"      value={formatNumber(totals.clicks)} />
        <KpiMini label="Ø CPC"       value={formatCurrency(totals.avgCpc)} />
        <KpiMini label="Conversions" value={formatNumber(totals.conversions)} />
        {isSheet
          ? <KpiMini label="Impressionen" value={formatNumber((totals as any).impressions ?? 0)} />
          : <KpiMini label="Sitzungen"    value={formatNumber(totals.sessions)} />
        }
        {ga4Supplement && (
          <KpiMini
            label="Sitzungen"
            value={formatNumber(ga4Supplement.totals.sessions)}
            tooltip="Sitzungen aus GA4, die Google Ads zugeordnet sind"
          />
        )}
      </div>

      {/* ── Tabs + Search ───────────────────────────────────── */}
      <div className="flex items-end justify-between gap-3 border-b border-border-subtle mb-1 flex-wrap">
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
                className={`widget-control px-3.5 py-2 transition-colors border-b-2 ${
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
          <span className="widget-meta text-faint whitespace-nowrap">
            {tableData.length} {tableData.length === 1 ? 'Eintrag' : 'Einträge'}
          </span>
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Suchen..."
              className="widget-control w-40 pl-7 pr-2.5 py-1 h-7 rounded-md border border-border-subtle bg-surface text-body placeholder:text-faint focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
        </div>
      </div>

      {/* ── Tabelle ─────────────────────────────────────────── */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th className="widget-table-head text-left px-2 py-2.5 text-faint">
                {viewModeLabels[viewMode]}
              </th>
              <th
                onClick={() => handleSort('cost')}
                className={`widget-table-head text-right px-2 py-2.5 cursor-pointer hover:text-body transition-colors whitespace-nowrap ${
                  sortField === 'cost' ? 'text-body' : 'text-faint'
                }`}
              >
                Kosten<SortIcon field="cost" />
              </th>
              <th
                onClick={() => handleSort('clicks')}
                className={`widget-table-head text-right px-2 py-2.5 cursor-pointer hover:text-body transition-colors whitespace-nowrap ${
                  sortField === 'clicks' ? 'text-body' : 'text-faint'
                }`}
              >
                Klicks<SortIcon field="clicks" />
              </th>
              <th
                onClick={() => handleSort('cpc')}
                className={`widget-table-head text-right px-2 py-2.5 cursor-pointer hover:text-body transition-colors whitespace-nowrap ${
                  sortField === 'cpc' ? 'text-body' : 'text-faint'
                }`}
              >
                CPC<SortIcon field="cpc" />
              </th>
              {!hideConv && (
                <th
                  onClick={() => handleSort('conversions')}
                  className={`widget-table-head text-right px-2 py-2.5 cursor-pointer hover:text-body transition-colors whitespace-nowrap ${
                    sortField === 'conversions' ? 'text-body' : 'text-faint'
                  }`}
                >
                  Conv.<SortIcon field="conversions" />
                </th>
              )}
              {showSessions && (
                <th
                  onClick={() => handleSort('sessions')}
                  className={`widget-table-head text-right px-2 py-2.5 cursor-pointer hover:text-body transition-colors whitespace-nowrap ${
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
                showSessions={showSessions}
                ga4AdGroupLookup={ga4Supplement?.byAdGroup}
                conversionsByAdGroup={data.conversionsByAdGroup}
                metricsByAdGroup={data.metricsByAdGroup}
              />
            ))}

            {tableData.length === 0 && (
              <tr>
                <td
                  colSpan={4 + (hideConv ? 0 : 1) + (showSessions ? 1 : 0)}
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

function formatDiff(value: GoogleAdsSourceComparisonValue): string {
  if (value.diffPercent === null) return '';
  const rounded = Math.round(value.diffPercent * 10) / 10;
  const sign = rounded > 0 ? '+' : rounded < 0 ? '−' : '±';
  return ` (${sign}${new Intl.NumberFormat('de-DE').format(Math.abs(rounded))} %)`;
}

function SourceComparisonNote({ comparison }: { comparison: GoogleAdsSourceComparison }) {
  const { cost, clicks, hasWarning } = comparison;
  return (
    <p
      className={`widget-meta mt-1.5 ${hasWarning ? 'text-warning' : 'text-faint'}`}
      title={`Nur für Admins sichtbar. Abweichungen bis ${GOOGLE_ADS_COMPARISON_TOLERANCE_PERCENT} % sind normal (Zeitzone, Datenverzögerung). Größere Abweichungen deuten auf ein veraltetes Sheet oder eine fehlende Google-Ads-Verknüpfung in GA4 hin.`}
    >
      {hasWarning ? 'Abweichung prüfen · ' : 'Abgleich · '}
      GA4: {formatCurrency(cost.ga4)}{formatDiff(cost)} · {formatNumber(clicks.ga4)} Klicks{formatDiff(clicks)}
      <span className="ml-1 opacity-70">(nur Admin)</span>
    </p>
  );
}

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
      <div className="widget-eyebrow text-faint mb-1.5">
        {label}
      </div>
      <div className="widget-metric-sm text-heading">
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
  showSessions,
  ga4AdGroupLookup,
  conversionsByAdGroup,
  metricsByAdGroup,
}: {
  row: AggregatedRow;
  isExpanded: boolean;
  onToggle: () => void;
  viewMode: ViewMode;
  hideConv: boolean;
  isSheet: boolean;
  showSessions: boolean;
  ga4AdGroupLookup?: Record<string, { sessions: number }>;
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

    // Sheet + GA4: Sitzungen der Anzeigengruppen in der Kampagnen-Ansicht
    if (isSheet && viewMode === 'campaign' && ga4AdGroupLookup) {
      for (const sub of subAgg) {
        sub.sessions = ga4AdGroupLookup[sub.label]?.sessions ?? 0;
      }
    }

    return subAgg;
  }, [row.subRows, nextDim, viewMode, isSheet, conversionsByAdGroup, metricsByAdGroup, ga4AdGroupLookup]);

  const hasSubRows = aggregatedSubRows.length > 1;

  return (
    <>
      <tr
        onClick={hasSubRows ? onToggle : undefined}
        className={`border-t border-border-subtle transition-colors ${
          hasSubRows ? 'cursor-pointer hover:bg-surface-secondary/40' : ''
        } ${isExpanded ? 'bg-surface-secondary/50' : ''}`}
      >
        <td className="widget-table-cell px-2 py-3 font-medium text-strong max-w-[300px]">
          <div className="flex items-center gap-2">
            <span className="text-faint flex-shrink-0 w-3 flex justify-center">
              {hasSubRows ? (
                isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />
              ) : null}
            </span>
            <span
              className={`truncate ${row.isRemainder ? 'font-normal text-muted' : ''}`}
              title={row.isRemainder
                ? 'Kosten, Klicks und Sitzungen, die GA4 keiner einzelnen Kampagne bzw. Anzeigengruppe zuordnet. So passt die Tabelle zu den Summen oben.'
                : row.label}
            >
              {row.label}
            </span>
          </div>
        </td>
        <td className="widget-table-cell text-right px-2 py-3 font-medium text-heading whitespace-nowrap">
          {formatCurrency(row.cost)}
        </td>
        <td className="widget-table-cell text-right px-2 py-3 text-body whitespace-nowrap">
          {formatNumber(row.clicks)}
        </td>
        <td className="widget-table-cell text-right px-2 py-3 text-body whitespace-nowrap">
          {formatCurrency(row.cpc)}
        </td>
        {!hideConv && (
          <td className="widget-table-cell text-right px-2 py-3 text-body whitespace-nowrap">
            {formatNumber(row.conversions)}
          </td>
        )}
        {showSessions && (
          <td className="widget-table-cell text-right px-2 py-3 text-body whitespace-nowrap">
            {formatNumber(row.sessions)}
          </td>
        )}
      </tr>

      {isExpanded &&
        hasSubRows &&
        aggregatedSubRows.map((sub) => (
          <tr key={sub.label} className={isExpanded ? 'bg-surface-secondary/50' : ''}>
            <td className="px-2 py-2">
              <div className="ml-3.5 pl-3.5 border-l-2 border-border-subtle text-xs text-body">
                <span className="text-[11px] text-faint mr-1.5 font-medium">
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
            {showSessions && (
              <td className="text-right px-2 py-2 text-xs text-faint whitespace-nowrap">
                {isSheet && viewMode !== 'campaign' ? '–' : formatNumber(sub.sessions)}
              </td>
            )}
          </tr>
        ))}
    </>
  );
}
