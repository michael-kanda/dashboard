'use client';

import { AlertTriangle, BarChart3, Check, Database, Link2, Search } from 'lucide-react';
import type { ContentContext, InternalLinkCandidate } from '@/lib/content-studio/types';

type Props = {
  context: ContentContext;
  selectedLinks: InternalLinkCandidate[];
  onSelectedLinksChange: (links: InternalLinkCandidate[]) => void;
};

function formatNumber(value: number) {
  return new Intl.NumberFormat('de-DE').format(Math.round(value));
}

function Metric({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="min-w-0 border-l-2 border-theme-border-default pl-3">
      <div className="text-[10px] font-semibold uppercase text-muted">{label}</div>
      <div className="mt-0.5 text-xl font-semibold text-heading">{value}</div>
      <div className="mt-1 text-[11px] text-muted">{hint}</div>
    </div>
  );
}

export default function ContentContextPanel({ context, selectedLinks, onSelectedLinksChange }: Props) {
  const selectedUrls = new Set(selectedLinks.map((link) => link.url));
  const toggleLink = (candidate: InternalLinkCandidate) => {
    onSelectedLinksChange(
      selectedUrls.has(candidate.url)
        ? selectedLinks.filter((link) => link.url !== candidate.url)
        : [...selectedLinks, candidate].slice(0, 8)
    );
  };

  return (
    <div className="space-y-5">
      <section className="rounded-lg bg-surface p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-heading">Datenbriefing</h2>
            <p className="mt-1 text-sm text-muted">URL-bezogene Signale für Struktur und Priorisierung</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {context.dataSources.map((source) => (
              <span key={source} className="rounded border border-theme-border-default bg-surface-secondary px-2 py-1 text-xs font-medium text-secondary">
                {source}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-5 sm:grid-cols-4 lg:grid-cols-8">
          <Metric label="GSC Klicks" value={formatNumber(context.metrics.clicks)} hint="Ziel-Queries" />
          <Metric label="Impressionen" value={formatNumber(context.metrics.impressions)} hint="Ziel-Queries" />
          <Metric label="CTR" value={context.metrics.ctr === null ? '–' : `${(context.metrics.ctr * 100).toFixed(1)} %`} hint="Search Console" />
          <Metric label="Ø Position" value={context.metrics.position === null ? '–' : context.metrics.position.toFixed(1)} hint="gewichtet" />
          <Metric label="Sessions" value={formatNumber(context.metrics.sessions)} hint="GA4 Zielseite" />
          <Metric label="Neue Nutzer" value={formatNumber(context.metrics.newUsers)} hint="GA4 Zielseite" />
          <Metric label="Conversions" value={formatNumber(context.metrics.conversions)} hint="GA4 Zielseite" />
          <Metric label="Indexiert" value={`${context.sitemap.indexedUrls}/${context.sitemap.totalUrls}`} hint="Sitemap-URLs" />
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="rounded-lg bg-surface p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Search size={18} className="text-[#4285F4]" />
            <h3 className="font-semibold text-heading">Suchanfragen</h3>
          </div>
          {context.keywords.length > 0 ? (
            <div className="max-h-80 overflow-auto border-y border-theme-border-subtle">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-surface text-[10px] uppercase text-muted">
                  <tr>
                    <th className="py-2 pr-3">Query</th>
                    <th className="py-2 text-right">Klicks</th>
                    <th className="py-2 text-right">Impr.</th>
                    <th className="py-2 text-right">Pos.</th>
                  </tr>
                </thead>
                <tbody>
                  {context.keywords.map((keyword) => (
                    <tr key={keyword.query} className="border-t border-theme-border-subtle">
                      <td className="py-2.5 pr-3 font-medium text-heading">{keyword.query}</td>
                      <td className="py-2.5 text-right text-secondary">{formatNumber(keyword.clicks)}</td>
                      <td className="py-2.5 text-right text-secondary">{formatNumber(keyword.impressions)}</td>
                      <td className="py-2.5 text-right text-secondary">{keyword.position?.toFixed(1) || '–'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="rounded border border-dashed border-theme-border-default p-5 text-sm text-muted">Keine passenden GSC-Queries verfügbar.</p>
          )}
        </section>

        <section className="rounded-lg bg-surface p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Link2 size={18} className="text-[#34A853]" />
            <div>
              <h3 className="font-semibold text-heading">Interne Verlinkung</h3>
              <p className="text-xs text-muted">Als Linkziel im Entwurf und als mögliche Linkquelle zur Zielseite</p>
            </div>
          </div>
          {context.sitemap.internalLinkCandidates.length > 0 ? (
            <div className="max-h-80 space-y-2 overflow-auto pr-1">
              {context.sitemap.internalLinkCandidates.map((candidate) => {
                const selected = selectedUrls.has(candidate.url);
                return (
                  <button
                    key={candidate.url}
                    type="button"
                    onClick={() => toggleLink(candidate)}
                    className={`flex w-full items-start gap-3 rounded border p-3 text-left transition-colors ${selected ? 'border-blue-300 bg-blue-50 dark:bg-blue-950/20' : 'border-theme-border-subtle bg-surface-secondary hover:bg-surface'}`}
                  >
                    <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${selected ? 'border-[#4285F4] bg-[#4285F4] text-white' : 'border-theme-border-default'}`}>
                      {selected && <Check size={12} />}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-heading">{candidate.label}</span>
                      <span className="block truncate text-xs text-secondary">{candidate.path}</span>
                      <span className="mt-1 block text-[11px] text-muted">{candidate.reason}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="rounded border border-dashed border-theme-border-default p-5 text-sm text-muted">Keine ausreichend relevanten, indexierten Linkziele gefunden.</p>
          )}
        </section>
      </div>

      {context.existingPage && (
        <section className="rounded-lg bg-surface p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3 className="font-semibold text-heading">Bestehender Seiteninhalt</h3>
              <p className="mt-1 text-xs text-muted">Belegte Ausgangsbasis für die Optimierung</p>
            </div>
            <span className={`rounded px-2 py-1 text-xs font-semibold ${context.existingPage.reachable ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300' : 'bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-300'}`}>
              {context.existingPage.reachable ? `${formatNumber(context.existingPage.wordCount)} Wörter` : 'Nicht erreichbar'}
            </span>
          </div>
          {context.existingPage.reachable && (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded border border-theme-border-subtle bg-surface-secondary p-3">
                <div className="text-[10px] font-semibold uppercase text-muted">Title</div>
                <div className="mt-1 text-sm text-heading">{context.existingPage.title || 'Nicht vorhanden'}</div>
              </div>
              <div className="rounded border border-theme-border-subtle bg-surface-secondary p-3">
                <div className="text-[10px] font-semibold uppercase text-muted">H1</div>
                <div className="mt-1 text-sm text-heading">{context.existingPage.h1 || 'Nicht vorhanden'}</div>
              </div>
            </div>
          )}
        </section>
      )}

      {(context.cannibalizationCandidates.length > 0 || context.notes.length > 0) && (
        <section className="grid gap-4 rounded-lg bg-surface p-5 shadow-sm lg:grid-cols-2">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <AlertTriangle size={17} className="text-amber-500" />
              <h3 className="text-sm font-semibold text-heading">Überschneidungen prüfen</h3>
            </div>
            {context.cannibalizationCandidates.length > 0 ? (
              <ul className="space-y-1 text-sm text-secondary">
                {context.cannibalizationCandidates.map((candidate) => (
                  <li key={candidate.url}>{candidate.path} · Relevanz {candidate.relevance}</li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted">Keine deutliche URL-Überschneidung erkannt.</p>}
          </div>
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Database size={17} className="text-slate-500" />
              <h3 className="text-sm font-semibold text-heading">Datenhinweise</h3>
            </div>
            {context.notes.length > 0 ? (
              <ul className="space-y-1 text-sm text-secondary">
                {context.notes.map((note) => <li key={note}>{note}</li>)}
              </ul>
            ) : (
              <p className="flex items-center gap-2 text-sm text-secondary"><Check size={15} className="text-emerald-500" /> Alle vorgesehenen Quellen verfügbar.</p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
