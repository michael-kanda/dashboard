'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Download,
  ExternalLink,
  RefreshCw,
  Search,
  XCircle,
} from 'lucide-react';
import type {
  IndexingStatusRow,
  IndexingUrlStatus,
  ProjectIndexingProgress,
  ProjectIndexingStatus,
} from '@/lib/indexing-status';

type FilterValue = 'all' | IndexingUrlStatus | 'canonical';

interface IndexingStatusWidgetProps {
  initialData: ProjectIndexingStatus;
  projectId: string;
  userRole?: string;
}

function GoogleUnderline() {
  return (
    <div className="mt-1 flex h-1.5 w-[220px] overflow-hidden rounded-full" aria-hidden="true">
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
  if (row.hasCanonicalIssue) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-300">
        <AlertCircle size={14} /> Canonical prüfen
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
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 dark:text-rose-300">
      <XCircle size={14} /> {row.status === 'error' ? 'Prüffehler' : 'Nicht indexiert'}
    </span>
  );
}

function getHint(row: IndexingStatusRow) {
  if (row.inspectionError) return row.inspectionError;
  if (row.hasCanonicalIssue) return 'Google verwendet eine andere kanonische URL.';
  if (row.status === 'pending') {
    return 'Noch nicht geprüft. Die URL wurde erkannt und ist für die automatische Google-Indexprüfung vorgemerkt.';
  }
  return row.coverageState || (row.status === 'indexed' ? 'URL ist im Google-Index.' : 'Indexierungsstatus prüfen.');
}

function getStatusLabel(row: IndexingStatusRow) {
  if (row.hasCanonicalIssue) return 'Canonical prüfen';
  if (row.status === 'indexed') return 'Indexiert';
  if (row.status === 'pending') return 'Ausstehend';
  if (row.status === 'error') return 'Prüffehler';
  return 'Nicht indexiert';
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
    const deferred = Math.max(0, data.progressDueTotal - data.progressTotal);
    return `${data.progressCompleted} von ${data.progressTotal} URLs in diesem Lauf geprüft${
      deferred > 0 ? ` · ${deferred} weitere vorgemerkt` : ''
    }`;
  }
  if (data.progressStage === 'paused') return 'Lauf abgeschlossen · weitere URLs sind vorgemerkt.';
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
  const canSync = userRole === 'ADMIN' || userRole === 'SUPERADMIN';
  const progress = data.totalUrls > 0 ? Math.round((data.indexedUrls / data.totalUrls) * 100) : 0;
  const showSyncProgress = isSyncing || data.status === 'running';
  const runProgress = data.progressTotal > 0
    ? Math.round((data.progressCompleted / data.progressTotal) * 100)
    : 0;
  const syncButtonLabel =
    showSyncProgress && data.progressStage === 'inspection' && data.progressTotal > 0
      ? `${data.progressCompleted}/${data.progressTotal} geprüft`
      : showSyncProgress
        ? 'Prüfung läuft…'
        : 'Jetzt prüfen';

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
        (filter === 'canonical' ? row.hasCanonicalIssue : row.status === filter);
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
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Abgleich fehlgeschlagen');
      setData(result);
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
      'Hinweis',
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
      getHint(row),
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
    { value: 'error', label: 'Fehler', count: data.rows.filter((row) => row.status === 'error').length },
    { value: 'canonical', label: 'Canonical', count: data.rows.filter((row) => row.hasCanonicalIssue).length },
  ];
  const summaryItems = [
    {
      label: 'Sitemap-Einträge',
      value: data.sitemapEntryCount,
      description: 'Alle Einträge der erkannten Sitemap.',
    },
    {
      label: 'Relevante Seiten',
      value: data.totalUrls,
      description: 'Für die Indexierungsprüfung berücksichtigt.',
    },
    {
      label: 'Technisch ausgeschlossen',
      value: data.excludedUrlCount,
      description: 'Feeds, Trackbacks und System-URLs.',
      showsDetails: true,
    },
    {
      label: 'Indexiert',
      value: data.indexedUrls,
      description: 'Von Google geprüft und im Suchindex.',
    },
    {
      label: 'Nicht indexiert',
      value: data.notIndexedUrls,
      description: 'Nicht im Google-Index; kann beabsichtigt sein.',
    },
    {
      label: 'Handlungsbedarf',
      value: data.issueUrls,
      description: 'Nicht indexiert, Prüffehler oder Canonical-Abweichung.',
    },
  ];

  return (
    <section className="dashboard-widget-surface overflow-hidden rounded-lg">
      <div className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-heading">Indexierungsstatus</h2>
            <GoogleUnderline />
            <p className="mt-2 text-sm text-body">
              Sitemap und Google-Index im direkten Abgleich.
            </p>
            <p className="mt-1 text-xs text-muted">
              Sitemap alle 48 Stunden · Änderungen priorisiert · stabile URLs zyklisch · GSC-Leistung: {data.performanceRange}
            </p>
          </div>
          {data.configured && (
            <div className="flex min-w-[240px] flex-col items-stretch gap-2">
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
              <div
                aria-live="polite"
                className={`min-h-[38px] w-full rounded-md border px-3 py-2 transition-opacity ${
                  showSyncProgress
                    ? 'border-[#4285F4]/30 bg-[#4285F4]/5 opacity-100'
                    : 'pointer-events-none border-transparent opacity-0'
                }`}
              >
                {showSyncProgress && (
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
                )}
              </div>
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
              <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border-subtle bg-border-subtle lg:grid-cols-3 2xl:grid-cols-6">
                {summaryItems.map((item) => item.showsDetails ? (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => setShowExcludedUrls((current) => !current)}
                    disabled={data.excludedUrlCount === 0}
                    className="bg-surface px-4 py-4 text-left transition-colors hover:bg-surface-secondary disabled:cursor-default disabled:hover:bg-surface"
                  >
                    <p className="text-[11px] font-semibold uppercase text-muted">{item.label}</p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums text-heading">{item.value}</p>
                    <p className="mt-1.5 text-[11px] leading-4 text-muted">{item.description}</p>
                  </button>
                ) : (
                  <div key={item.label} className="bg-surface px-4 py-4">
                    <p className="text-[11px] font-semibold uppercase text-muted">{item.label}</p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums text-heading">{item.value}</p>
                    <p className="mt-1.5 text-[11px] leading-4 text-muted">{item.description}</p>
                  </div>
                ))}
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

            {data.totalUrls > 0 && (
              <div className="mt-5">
                <div className="mb-2 flex items-center justify-between gap-3 text-xs">
                  <span className="font-medium text-body">{data.indexedUrls} von {data.totalUrls} URLs indexiert</span>
                  <span className="font-semibold tabular-nums text-heading">{progress}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-surface-tertiary">
                  <div className="h-full rounded-full bg-[#34A853] transition-[width]" style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}

            {(syncError || data.errorMessage) && (
              <div className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
                {syncError || data.errorMessage}
              </div>
            )}

            <div className="mt-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-wrap gap-1.5">
                {filters.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setFilter(item.value)}
                    className={`rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                      filter === item.value
                        ? 'border-[#4285F4] bg-[#4285F4]/10 text-[#4285F4]'
                        : 'border-border-subtle bg-surface text-body hover:bg-surface-secondary'
                    }`}
                  >
                    {item.label} <span className="ml-1 tabular-nums text-muted">{item.count}</span>
                  </button>
                ))}
              </div>
              <label className="relative block w-full xl:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={15} />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="URL suchen"
                  className="h-9 w-full rounded-md border border-border-subtle bg-surface pl-9 pr-3 text-xs text-body outline-none placeholder:text-muted focus:border-[#4285F4]"
                />
              </label>
            </div>
          </>
        )}
      </div>

      {data.configured && (
        <div className="border-t border-border-subtle">
          <div className="max-h-[520px] overflow-auto">
            <table className="w-full min-w-[940px] border-collapse text-left">
              <thead className="sticky top-0 z-10 bg-surface-secondary">
                <tr className="border-b border-border-subtle text-[11px] font-semibold uppercase text-muted">
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
                  <tr key={row.url} className="border-b border-border-subtle last:border-0 hover:bg-surface-secondary/70">
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
                    <td className="px-4 py-3"><StatusBadge row={row} /></td>
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
          <div className="flex flex-col gap-1 border-t border-border-subtle bg-surface-secondary px-5 py-3 text-[11px] text-muted sm:flex-row sm:items-center sm:justify-between">
            <span>{filteredRows.length} von {data.totalUrls} URLs</span>
            <span>Letzter Abgleich: {formatDate(data.lastSyncedAt, true)}</span>
          </div>
        </div>
      )}
    </section>
  );
}
