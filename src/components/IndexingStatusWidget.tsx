'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Download,
  ExternalLink,
  Info,
  MinusCircle,
  RefreshCw,
  Search,
  XCircle,
} from 'lucide-react';
import { CATEGORY_LABELS, INDEXED_RECHECK_DAYS } from '@/lib/indexing-status-constants';
import type {
  IndexingStatusRow,
  IndexingUrlStatus,
  ProjectIndexingProgress,
  ProjectIndexingStatus,
} from '@/lib/indexing-status';
import { readIndexingStatusResponse } from '@/lib/indexing-response';

type FilterValue = 'all' | IndexingUrlStatus | 'canonical' | 'action' | 'intentional' | 'stale';

interface IndexingStatusWidgetProps {
  initialData: ProjectIndexingStatus;
  projectId: string;
  userRole?: string;
}

function GoogleUnderline() {
  return (
    <div className="mt-2.5 flex h-1 w-[152px] overflow-hidden rounded-full" aria-hidden="true">
      <span className="w-1/4 bg-[#4285F4]" />
      <span className="w-1/4 bg-[#EA4335]" />
      <span className="w-1/4 bg-[#FBBC05]" />
      <span className="w-1/4 bg-[#34A853]" />
    </div>
  );
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('de-DE').format(Math.round(value));
}

function formatDate(value: string | null, includeTime = false) {
  if (!value) return 'Noch nicht geprüft';
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...(includeTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(new Date(value));
}

function getUrlLabel(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.pathname === '/' ? '/' : parsed.pathname;
  } catch {
    return url;
  }
}

function StatusBadge({ row }: { row: IndexingStatusRow }) {
  if (row.status === 'indexed' && !row.hasCanonicalIssue) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-300">
        <CheckCircle2 size={14} /> Indexiert
      </span>
    );
  }
  if (row.status === 'pending') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-600 dark:text-sky-300">
        <Clock3 size={14} /> Ausstehend
      </span>
    );
  }
  if (row.isIntentional) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
        <MinusCircle size={14} /> {CATEGORY_LABELS[row.category]}
      </span>
    );
  }
  if (row.hasCanonicalIssue) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-300">
        <AlertCircle size={14} /> Canonical prüfen
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 dark:text-rose-300">
      <XCircle size={14} /> {CATEGORY_LABELS[row.category]}
    </span>
  );
}

function getHint(row: IndexingStatusRow) {
  if (row.inspectionError) return row.inspectionError;
  if (row.status === 'pending') {
    return 'Noch nicht geprüft. Die URL wurde erkannt und ist für die automatische Google-Indexprüfung vorgemerkt.';
  }
  const base = row.actionHint
    || row.coverageState
    || (row.status === 'indexed' ? 'URL ist im Google-Index.' : 'Indexierungsstatus prüfen.');
  const parts = [base];
  if (row.isStale && row.inspectionAgeDays !== null) {
    parts.push(`Letzte Prüfung vor ${row.inspectionAgeDays} Tagen.`);
  } else if (row.inspectionPending) {
    parts.push('Erneute Prüfung vorgemerkt.');
  }
  return parts.join(' ');
}

function getStatusLabel(row: IndexingStatusRow) {
  if (row.status === 'pending') return 'Ausstehend';
  return CATEGORY_LABELS[row.category];
}

function escapeCsv(value: string | number | null | undefined) {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function getSyncProgressLabel(data: ProjectIndexingStatus) {
  if (data.progressStage === 'sitemap') return 'Sitemap wird gelesen …';
  if (data.progressStage === 'gsc') return 'GSC-Daten werden geladen …';
  if (data.progressStage === 'inspection') {
    if (data.progressTotal === 0) return 'Keine fälligen URLs gefunden.';
    const totalDue = Math.max(data.progressTotal, data.progressDueTotal);
    const remaining = Math.max(0, totalDue - data.progressCompleted);
    return `${data.progressCompleted} von ${totalDue} fälligen URLs geprüft${
      remaining > 0 ? ` · ${remaining} werden automatisch fortgesetzt` : ''
    }`;
  }
  if (data.progressStage === 'queued' || data.progressStage === 'paused') {
    return 'Nächste Prüfcharge ist automatisch eingeplant.';
  }
  if (data.progressStage === 'completed') return 'Prüfung abgeschlossen.';
  if (data.progressStage === 'error') return 'Prüfung mit Fehler beendet.';
  return 'Prüfung wird vorbereitet …';
}

export default function IndexingStatusWidget({
  initialData,
  projectId,
  userRole,
}: IndexingStatusWidgetProps) {
  const [data, setData] = useState(initialData);
  const [filter, setFilter] = useState<FilterValue>('all');
  const [search, setSearch] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState('');
  const [showExcludedUrls, setShowExcludedUrls] = useState(false);
  const [showDataInfo, setShowDataInfo] = useState(false);
  const canSync = userRole === 'ADMIN' || userRole === 'SUPERADMIN';
  const indexShare = data.verifiedUrls > 0
    ? Math.round((data.indexedUrls / data.verifiedUrls) * 100)
    : 0;
  const indexedWidth = data.totalUrls > 0 ? (data.indexedUrls / data.totalUrls) * 100 : 0;
  const notIndexedWidth = data.totalUrls > 0 ? (data.notIndexedUrls / data.totalUrls) * 100 : 0;
  const pendingWidth = data.totalUrls > 0 ? (data.pendingUrls / data.totalUrls) * 100 : 0;
  const showSyncProgress = isSyncing || data.status === 'running';
  const runProgressTotal = Math.max(data.progressTotal, data.progressDueTotal);
  const runProgress = runProgressTotal > 0
    ? Math.round((data.progressCompleted / runProgressTotal) * 100)
    : 0;
  const syncButtonLabel =
    showSyncProgress && data.progressStage === 'inspection' && data.progressTotal > 0
      ? `${data.progressCompleted}/${data.progressTotal} geprüft`
      : showSyncProgress
        ? 'Prüfung läuft…'
        : 'Jetzt prüfen';
  const hasCoverageNotices = (
    (data.totalUrls > 0 && !data.isVerificationComplete)
    || data.staleUrls > 0
    || Boolean(data.warningMessage)
    || (showExcludedUrls && data.excludedUrls.length > 0)
    || Boolean(syncError || data.errorMessage)
  );

  useEffect(() => {
    if (!showSyncProgress) return;
    let cancelled = false;
    let requestRunning = false;

    const refreshProgress = async () => {
      if (requestRunning) return;
      requestRunning = true;
      try {
        const response = await fetch(`/api/projects/${projectId}/indexing-status?progress=1&t=${Date.now()}`, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' },
        });
        if (!response.ok || cancelled) return;
        const progressData = await response.json() as ProjectIndexingProgress;
        setData((current) => ({ ...current, ...progressData }));
      } catch {
        // Der abschließende POST liefert weiterhin das vollständige Ergebnis.
      } finally {
        requestRunning = false;
      }
    };

    void refreshProgress();
    const interval = window.setInterval(refreshProgress, 2_500);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [projectId, showSyncProgress]);

  const filteredRows = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase('de-DE');
    return data.rows.filter((row) => {
      const filterMatches =
        filter === 'all' ||
        (filter === 'canonical' && row.hasCanonicalIssue) ||
        (filter === 'action' && row.needsAction) ||
        (filter === 'intentional' && row.isIntentional) ||
        (filter === 'stale' && row.isStale) ||
        row.status === filter;
      return filterMatches && (!needle || row.url.toLocaleLowerCase('de-DE').includes(needle));
    });
  }, [data.rows, filter, search]);

  async function runSync() {
    setIsSyncing(true);
    setSyncError('');
    setData((current) => ({
      ...current,
      status: 'running',
      progressStage: 'sitemap',
      progressTotal: 0,
      progressCompleted: 0,
      progressDueTotal: 0,
    }));
    try {
      const response = await fetch(`/api/projects/${projectId}/indexing-status`, {
        method: 'POST',
      });
      const result = await response.json() as unknown;
      if (!response.ok) {
        const message = result && typeof result === 'object' && 'message' in result
          && typeof result.message === 'string' ? result.message : 'Abgleich fehlgeschlagen';
        throw new Error(message);
      }
      // Accept the former wrapped response during rolling deployments, but
      // never put an incomplete payload into component state.
      const nextData = readIndexingStatusResponse(result);
      if (!nextData) {
        throw new Error('Der Indexierungsstatus konnte nicht gelesen werden.');
      }
      setData(nextData);
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Abgleich fehlgeschlagen');
      setData((current) => ({ ...current, status: 'error', progressStage: 'error' }));
    } finally {
      setIsSyncing(false);
    }
  }

  function exportCsv() {
    if (!filteredRows.length) return;

    const columns = [
      'URL',
      'Status',
      'Prüfstatus',
      'Hinweis',
      'Kategorie',
      'Handlungsbedarf',
      'Prüfalter (Tage)',
      'GSC-Abdeckung',
      'Letzter Crawl',
      'Google Canonical',
      'User Canonical',
      'Sitemap Lastmod',
      'GSC Impressionen',
      'GSC Klicks',
      'GSC Position',
      'Geprüft am',
    ];
    const rows = filteredRows.map((row) => [
      row.url,
      getStatusLabel(row),
      row.status === 'pending'
        ? 'Erstprüfung vorgemerkt'
        : row.inspectionPending ? 'Erneute Prüfung vorgemerkt' : 'Aktuell',
      getHint(row),
      CATEGORY_LABELS[row.category],
      row.needsAction ? 'ja' : 'nein',
      row.inspectionAgeDays ?? '',
      row.coverageState,
      row.lastCrawlTime ? formatDate(row.lastCrawlTime, true) : '',
      row.googleCanonical,
      row.userCanonical,
      row.sitemapLastmod ? formatDate(row.sitemapLastmod, true) : '',
      row.impressions,
      row.clicks,
      row.position?.toLocaleString('de-DE', { maximumFractionDigits: 2 }) ?? '',
      row.inspectedAt ? formatDate(row.inspectedAt, true) : '',
    ]);
    const csv = [
      columns.map(escapeCsv).join(';'),
      ...rows.map((row) => row.map(escapeCsv).join(';')),
    ].join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `indexierungsstatus-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const filters: Array<{ value: FilterValue; label: string; count: number }> = [
    { value: 'all', label: 'Alle', count: data.totalUrls },
    { value: 'indexed', label: 'Indexiert', count: data.indexedUrls },
    { value: 'pending', label: 'Ausstehend', count: data.pendingUrls },
    { value: 'not_indexed', label: 'Nicht indexiert', count: data.notIndexedUrls },
    { value: 'action', label: 'Handlungsbedarf', count: data.issueUrls },
    { value: 'intentional', label: 'Beabsichtigt', count: data.intentionalUrls },
    { value: 'stale', label: 'Prüfung veraltet', count: data.staleUrls },
    { value: 'error', label: 'Fehler', count: data.rows.filter((row) => row.status === 'error').length },
    { value: 'canonical', label: 'Canonical', count: data.rows.filter((row) => row.hasCanonicalIssue).length },
  ];
  const primaryFilters = filters.filter((item) => ['all', 'indexed', 'action'].includes(item.value));
  const secondaryFilters = filters.filter((item) => !['all', 'indexed', 'action'].includes(item.value));
  const secondaryFilterValue = secondaryFilters.some((item) => item.value === filter) ? filter : '';
  const coverageMetrics: Array<{
    label: string;
    value: number;
    description: string;
    showsDetails?: boolean;
    filter?: FilterValue;
  }> = [
    {
      label: 'Sitemap',
      value: data.sitemapEntryCount,
      description: 'Erkannte Einträge',
    },
    {
      label: 'Relevante Seiten',
      value: data.totalUrls,
      description: 'Für die Prüfung',
    },
    {
      label: 'Ausgeschlossen',
      value: data.excludedUrlCount,
      description: 'Technische URLs',
      showsDetails: true,
    },
    {
      label: 'Handlungsbedarf',
      value: data.issueUrls,
      description: 'Ungewollte Probleme',
      filter: 'action' as const,
    },
  ];

  return (
    <section className="dashboard-widget-surface indexing-coverage-rail overflow-hidden rounded-lg">
      <div className="px-5 pb-[18px] pt-[22px] sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="widget-eyebrow text-muted">Google Index</p>
            <h2 className="widget-title mt-1 text-heading">Indexierungsstatus</h2>
            <GoogleUnderline />
            <div className="mt-2 flex items-center gap-1.5">
              <p className="widget-body text-body">Sitemap und Google-Index im direkten Abgleich.</p>
              <button
                type="button"
                onClick={() => setShowDataInfo((current) => !current)}
                aria-expanded={showDataInfo}
                aria-label="Datenbasis und Abweichung zur Search Console"
                className="text-muted transition-colors hover:text-heading"
              >
                <Info size={14} />
              </button>
            </div>
            {data.lastSyncedAt && (
              <p className="widget-meta mt-1 text-muted">
                Stand: {formatDate(data.lastSyncedAt, true)} Uhr · GSC-Leistung: {data.performanceRange.toLocaleLowerCase('de-DE')}
              </p>
            )}
            {showDataInfo && (
              <div className="mt-3 max-w-xl rounded-md border border-border-subtle bg-surface-secondary px-3 py-2.5 text-[11px] leading-5 text-body">
                <p>
                  <span className="font-semibold">Datenbasis:</span> alle URLs der XML-Sitemap,
                  einzeln geprüft über die Google URL-Inspection-API.
                </p>
                <p className="mt-1.5">
                  <span className="font-semibold">Abweichung zur Search Console:</span> Der Bericht
                  „Seitenindexierung“ zählt unter „Alle bekannten Seiten“ auch URLs außerhalb der
                  Sitemap und aktualisiert mit einigen Tagen Verzögerung. Für einen direkten
                  Vergleich dort auf „Alle eingereichten Seiten“ umstellen.
                </p>
                <p className="mt-1.5">
                  <span className="font-semibold">Aktualisierung:</span> Sitemap alle 48 Stunden,
                  geänderte URLs vorrangig, stabile URLs alle {INDEXED_RECHECK_DAYS} Tage.
                  {data.maxInspectionAgeDays !== null && (
                    <> Älteste Einzelprüfung: {data.maxInspectionAgeDays} Tage.</>
                  )}
                </p>
                <p className="mt-1.5 text-muted">GSC-Leistungsdaten: {data.performanceRange}.</p>
              </div>
            )}
          </div>
          {data.configured && (
            <div className="flex min-w-[220px] flex-col items-stretch gap-2">
              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                <button
                  type="button"
                  onClick={exportCsv}
                  disabled={!filteredRows.length}
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-border-subtle bg-surface px-3 text-xs font-semibold text-body shadow-sm transition-colors hover:bg-surface-secondary disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Download size={15} />
                  CSV
                </button>
                {canSync && (
                  <button
                    type="button"
                    onClick={runSync}
                    disabled={showSyncProgress}
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-border-subtle bg-surface px-3 text-xs font-semibold text-body shadow-sm transition-colors hover:bg-surface-secondary disabled:cursor-wait disabled:opacity-60"
                  >
                    <RefreshCw size={15} className={showSyncProgress ? 'animate-spin' : ''} />
                    {syncButtonLabel}
                  </button>
                )}
              </div>
              {showSyncProgress && (
                <div
                  aria-live="polite"
                  className="w-full rounded-md border border-[#4285F4]/30 bg-[#4285F4]/5 px-3 py-2"
                >
                  <>
                    <p className="text-left text-xs font-semibold text-body">
                      {getSyncProgressLabel(data)}
                    </p>
                    {data.progressStage === 'inspection' && data.progressTotal > 0 && (
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-tertiary">
                        <div
                          className="h-full rounded-full bg-[#4285F4] transition-[width]"
                          style={{ width: `${runProgress}%` }}
                        />
                      </div>
                    )}
                  </>
                </div>
              )}
            </div>
          )}
        </div>

        {!data.configured ? (
          <div className="mt-5 rounded-md border border-dashed border-border-subtle p-5 text-sm text-muted">
            Für dieses Projekt fehlen eine GSC Site URL oder eine erreichbare Sitemap. Die Sitemap kann im Admin-Bereich unter Konfiguration hinterlegt werden.
          </div>
        ) : (
          <>
            {data.status === 'idle' && data.totalUrls === 0 && (
              <div className="mt-5 rounded-md border border-dashed border-border-subtle p-4 text-sm text-body">
                Der erste Abgleich ist vorgemerkt. Bis Sitemap, GSC-Daten und URL-Prüfungen verarbeitet wurden, werden keine Nullwerte als Ergebnis ausgewiesen.
              </div>
            )}

            {(data.sitemapEntryCount > 0 || data.totalUrls > 0) && (
              <div className={`indexing-coverage-rail__layout -mx-5 mt-5 sm:-mx-6 ${hasCoverageNotices ? '' : '-mb-[18px]'}`}>
                <aside className="indexing-coverage-rail__score">
                  <div>
                    <p className="widget-eyebrow text-muted">Indexabdeckung</p>
                    <p className="widget-score mt-2 text-heading">
                      {indexShare}%
                    </p>
                    <p className="widget-meta mt-2.5 text-muted">
                      {data.isVerificationComplete
                        ? `${data.indexedUrls} von ${data.totalUrls} relevanten URLs sind im Google-Index.`
                        : `${data.indexedUrls} von ${data.verifiedUrls} erfolgreich geprüften URLs sind indexiert.`}
                    </p>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--indexing-muted)]">
                      <div
                        className="h-full rounded-full bg-[#34A853] transition-[width]"
                        style={{ width: `${indexShare}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-6 space-y-2.5 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setFilter('indexed')}
                      className="flex w-full items-center justify-between gap-3 text-left text-muted hover:text-heading"
                    >
                      <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#34A853]" />Indexiert</span>
                      <strong className="font-medium tabular-nums text-heading">{data.indexedUrls}</strong>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilter('not_indexed')}
                      className="flex w-full items-center justify-between gap-3 text-left text-muted hover:text-heading"
                    >
                      <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#EA4335]" />Nicht indexiert</span>
                      <strong className="font-medium tabular-nums text-heading">{data.notIndexedUrls}</strong>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilter('intentional')}
                      className="flex w-full items-center justify-between gap-3 text-left text-muted hover:text-heading"
                    >
                      <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[var(--dp-text-muted)]" />Davon beabsichtigt</span>
                      <strong className="font-medium tabular-nums text-heading">{data.intentionalUrls}</strong>
                    </button>
                  </div>
                </aside>

                <div className="indexing-coverage-rail__main">
                  <div className="indexing-coverage-rail__metrics">
                    {coverageMetrics.map((item) => {
                      const interactive = item.showsDetails || item.filter;
                      const content = (
                        <>
                          <p className="widget-eyebrow text-muted">{item.label}</p>
                          <p className="widget-metric-sm mt-2 text-heading">{item.value}</p>
                          <p className="widget-meta mt-2 text-muted">{item.description}</p>
                        </>
                      );

                      return interactive ? (
                        <button
                          key={item.label}
                          type="button"
                          onClick={() => {
                            if (item.showsDetails) setShowExcludedUrls((current) => !current);
                            if (item.filter) setFilter(item.filter);
                          }}
                          disabled={item.showsDetails && data.excludedUrlCount === 0}
                          className="indexing-coverage-rail__metric text-left transition-colors hover:bg-surface-secondary disabled:cursor-default disabled:hover:bg-transparent"
                        >
                          {content}
                        </button>
                      ) : (
                        <div key={item.label} className="indexing-coverage-rail__metric">{content}</div>
                      );
                    })}
                  </div>

                  <div className="indexing-coverage-rail__distribution px-[18px] py-4">
                    <div className="flex items-center justify-between gap-3 text-[10px] text-muted">
                      <span>{data.isVerificationComplete ? 'Vollständiger Datenstand' : 'Vorläufiger Datenstand'}</span>
                      <span className="tabular-nums">
                        {data.isVerificationComplete && data.recheckPendingUrls > 0
                          ? `${data.recheckPendingUrls} Re-Checks vorgemerkt`
                          : `${data.verifiedUrls} von ${data.totalUrls} geprüft`}
                      </span>
                    </div>
                    <div className="mt-2.5 flex h-2 overflow-hidden rounded-full bg-[var(--indexing-muted)]" aria-label="Verteilung der Indexierungsstatus">
                      <span className="h-full bg-[#34A853]" style={{ width: `${indexedWidth}%` }} />
                      <span className="h-full bg-[#EA4335]" style={{ width: `${notIndexedWidth}%` }} />
                      <span className="h-full bg-[#4285F4]" style={{ width: `${pendingWidth}%` }} />
                    </div>
                  </div>

                  <div className="indexing-coverage-rail__filters flex flex-col gap-3 px-[18px] py-3.5 xl:flex-row xl:items-center xl:justify-between">
                    <div className="flex flex-wrap items-center gap-1">
                      {primaryFilters.map((item) => (
                        <button
                          key={item.value}
                          type="button"
                          onClick={() => setFilter(item.value)}
                          className={`rounded-md px-2.5 py-2 text-[11px] font-medium transition-colors ${
                            filter === item.value
                              ? 'bg-surface-tertiary text-heading'
                              : 'text-muted hover:bg-surface-secondary hover:text-heading'
                          }`}
                        >
                          {item.label} <span className="ml-1 tabular-nums">{item.count}</span>
                        </button>
                      ))}
                      <select
                        value={secondaryFilterValue}
                        onChange={(event) => {
                          if (event.target.value) setFilter(event.target.value as FilterValue);
                        }}
                        aria-label="Weitere Statusfilter"
                        className={`h-8 rounded-md border-0 px-2 text-[11px] font-medium outline-none ${
                          secondaryFilterValue ? 'bg-surface-tertiary text-heading' : 'bg-transparent text-muted'
                        }`}
                      >
                        <option value="">Weitere Filter</option>
                        {secondaryFilters.map((item) => (
                          <option key={item.value} value={item.value}>{item.label} ({item.count})</option>
                        ))}
                      </select>
                    </div>
                    <label className="relative block w-full xl:w-[210px]">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={14} />
                      <input
                        type="search"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="URL suchen"
                        className="h-9 w-full rounded-md border border-border-subtle bg-surface pl-9 pr-3 text-[11px] text-body outline-none placeholder:text-muted focus:border-[#4285F4]"
                      />
                    </label>
                  </div>
                </div>
              </div>
            )}

            {data.totalUrls > 0 && !data.isVerificationComplete && (
              <div className="mt-5 rounded-md border border-[#4285F4]/30 bg-[#4285F4]/5 px-4 py-3">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <p className="widget-section-title text-heading">Vorläufiger Datenstand</p>
                  <p className="text-xs font-semibold tabular-nums text-[#4285F4]">
                    {data.verifiedUrls} von {data.totalUrls} URLs klassifiziert
                  </p>
                </div>
                <p className="mt-1 text-xs leading-5 text-body">
                  {data.unverifiedUrls} URLs haben noch kein erfolgreiches Ergebnis aus der Google URL Inspection API.
                  Die Prüfung läuft automatisch in kleinen Chargen weiter; bis zur vollständigen Erstabdeckung sind die Summen für „Indexiert“ und „Nicht indexiert“ vorläufig.
                </p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-tertiary">
                  <div
                    className="h-full rounded-full bg-[#4285F4] transition-[width]"
                    style={{ width: `${data.verificationCoverage}%` }}
                  />
                </div>
              </div>
            )}

            {data.staleUrls > 0 && (
              <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                Bei {data.staleUrls} URLs liegt die letzte Google-Prüfung länger zurück als das Re-Check-Intervall.
                Ihr Status kann inzwischen veraltet sein und die Summen entsprechend vom aktuellen Google-Index abweichen.
                <button
                  type="button"
                  onClick={() => setFilter('stale')}
                  className="ml-1 font-semibold underline underline-offset-2"
                >
                  Betroffene URLs anzeigen
                </button>
              </div>
            )}

            {data.warningMessage && (
              <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                {data.warningMessage}
              </div>
            )}

            {showExcludedUrls && data.excludedUrls.length > 0 && (
              <div className="mt-4 overflow-hidden rounded-md border border-border-subtle">
                <div className="flex items-center justify-between border-b border-border-subtle bg-surface-secondary px-4 py-2.5">
                  <div>
                    <p className="text-xs font-semibold text-heading">Technisch ausgeschlossene URLs</p>
                    <p className="mt-0.5 text-[11px] text-muted">Diese Einträge werden nicht per URL Inspection geprüft.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowExcludedUrls(false)}
                    className="text-xs font-semibold text-body hover:text-heading"
                  >
                    Schließen
                  </button>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {data.excludedUrls.map((item) => (
                    <div key={item.url} className="flex flex-col gap-1 border-b border-border-subtle px-4 py-2.5 last:border-0 sm:flex-row sm:items-center sm:justify-between">
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="truncate text-xs font-medium text-heading hover:text-[#4285F4]"
                        title={item.url}
                      >
                        {getUrlLabel(item.url)}
                      </a>
                      <span className="shrink-0 text-[11px] text-muted">{item.reason}</span>
                    </div>
                  ))}
                </div>
                {data.excludedUrlCount > data.excludedUrls.length && (
                  <p className="border-t border-border-subtle bg-surface-secondary px-4 py-2 text-[11px] text-muted">
                    Angezeigt werden die ersten {data.excludedUrls.length} von {data.excludedUrlCount} ausgeschlossenen URLs.
                  </p>
                )}
              </div>
            )}

            {(syncError || data.errorMessage) && (
              <div className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
                {syncError || data.errorMessage}
              </div>
            )}

          </>
        )}
      </div>

      {data.configured && (
        <details className="group border-t border-[var(--indexing-line)]">
          <summary className="indexing-coverage-rail__table-header flex min-h-12 list-none items-center justify-between gap-4 px-5 py-3 text-left transition-colors hover:bg-surface-secondary [&::-webkit-details-marker]:hidden">
            <span>
              <span className="block text-xs font-medium text-heading">URL-Details</span>
              <span className="mt-0.5 block text-[10px] text-muted">
                {filteredRows.length} von {data.totalUrls} URLs anzeigen
              </span>
            </span>
            <ChevronDown
              size={16}
              className="shrink-0 text-muted transition-transform duration-200 group-open:rotate-180"
              aria-hidden="true"
            />
          </summary>
          <div className="max-h-[520px] overflow-auto">
            <table className="w-full min-w-[940px] border-collapse text-left">
              <thead className="indexing-coverage-rail__table-header sticky top-0 z-10">
                <tr className="widget-table-head border-b border-[var(--indexing-line)] text-muted">
                  <th className="px-5 py-3">URL</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Hinweis</th>
                  <th className="px-4 py-3">Letzter Crawl</th>
                  <th className="px-4 py-3 text-right">Impr.</th>
                  <th className="px-5 py-3 text-right">Klicks</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.url} className="border-b border-[var(--indexing-line)] last:border-0 hover:bg-surface-secondary/70">
                    <td className="max-w-[360px] px-5 py-3">
                      <a
                        href={row.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex max-w-full items-center gap-1.5 text-xs font-medium text-heading hover:text-[#4285F4]"
                        title={row.url}
                      >
                        <span className="truncate">{getUrlLabel(row.url)}</span>
                        <ExternalLink size={13} className="shrink-0" />
                      </a>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge row={row} />
                      {row.status !== 'pending' && row.inspectionPending && (
                        <span className="mt-1 block text-[10px] font-medium text-muted">
                          Erneute Prüfung vorgemerkt
                        </span>
                      )}
                    </td>
                    <td className="max-w-[280px] px-4 py-3 text-xs text-body">
                      <span className="line-clamp-2" title={getHint(row)}>{getHint(row)}</span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-body">{formatDate(row.lastCrawlTime)}</td>
                    <td className="px-4 py-3 text-right text-xs font-medium tabular-nums text-heading">{formatNumber(row.impressions)}</td>
                    <td className="px-5 py-3 text-right text-xs font-medium tabular-nums text-heading">{formatNumber(row.clicks)}</td>
                  </tr>
                ))}
                {!filteredRows.length && (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center text-sm text-muted">
                      Keine URLs für diesen Filter gefunden.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="indexing-coverage-rail__table-footer flex flex-col gap-1 border-t border-[var(--indexing-line)] px-5 py-3 text-[11px] text-muted sm:flex-row sm:items-center sm:justify-between">
            <span>{filteredRows.length} von {data.totalUrls} URLs</span>
            <span>Letzter Abgleich: {formatDate(data.lastSyncedAt, true)}</span>
          </div>
        </details>
      )}
    </section>
  );
}
