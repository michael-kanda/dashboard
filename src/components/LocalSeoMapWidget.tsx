'use client';

import { useMemo, useState } from 'react';
import type { LocalSeoData, LocalSeoLocationData } from '@/lib/dashboard-shared';

interface LocalSeoMapWidgetProps {
  data?: LocalSeoData;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('de-DE').format(Math.round(value || 0));
}

function formatPercent(value: number) {
  return `${(value || 0).toFixed(1)} %`;
}

function getScoreColor(score: number) {
  if (score >= 70) return '#22c55e';
  if (score >= 45) return '#f59e0b';
  return '#ef4444';
}

const AUSTRIA_REGION_PATHS = [
  {
    id: 'vorarlberg',
    path: 'M50 236 L66 213 L86 204 L106 224 L103 263 L78 284 L54 268 Z',
  },
  {
    id: 'tirol',
    path: 'M101 217 L147 230 L184 205 L245 207 L277 226 L314 218 L337 244 L309 272 L255 263 L225 281 L178 265 L136 282 L96 262 Z',
  },
  {
    id: 'salzburg',
    path: 'M304 185 L346 154 L383 188 L392 237 L366 276 L323 257 L337 221 Z',
  },
  {
    id: 'oberoesterreich',
    path: 'M343 151 L398 99 L433 119 L474 104 L520 143 L500 185 L441 202 L400 181 L374 197 Z',
  },
  {
    id: 'niederoesterreich',
    path: 'M500 88 L544 53 L616 86 L681 72 L739 105 L768 160 L742 214 L672 202 L628 231 L572 206 L507 226 L486 179 L516 151 Z',
  },
  {
    id: 'wien',
    path: 'M689 149 L724 140 L734 166 L698 174 Z',
  },
  {
    id: 'burgenland',
    path: 'M728 205 L769 221 L759 274 L779 315 L735 346 L704 304 L724 260 Z',
  },
  {
    id: 'steiermark',
    path: 'M454 236 L507 219 L565 243 L626 230 L692 251 L716 312 L674 357 L601 350 L556 324 L503 337 L452 305 L420 267 Z',
  },
  {
    id: 'kaernten',
    path: 'M285 275 L342 270 L388 292 L452 304 L503 337 L444 368 L368 352 L310 339 L262 306 Z',
  },
];

function projectToAustriaSvg(location: LocalSeoLocationData) {
  const knownCityCoordinates: Record<string, { lat: number; lng: number }> = {
    wien: { lat: 48.2082, lng: 16.3738 },
    vienna: { lat: 48.2082, lng: 16.3738 },
    graz: { lat: 47.0707, lng: 15.4395 },
    leoben: { lat: 47.3817, lng: 15.0972 },
    linz: { lat: 48.3069, lng: 14.2858 },
    salzburg: { lat: 47.8095, lng: 13.0550 },
    innsbruck: { lat: 47.2692, lng: 11.4041 },
    klagenfurt: { lat: 46.6247, lng: 14.3053 },
  };
  const cityKey = (location.city || location.name || '').toLowerCase().trim();
  const fallback = knownCityCoordinates[cityKey];
  // Approximation für Österreich: west/east/south/north Bounds.
  const lat = typeof location.lat === 'number' ? location.lat : (fallback?.lat ?? 47.6);
  const lng = typeof location.lng === 'number' ? location.lng : (fallback?.lng ?? 14.2);
  const minLng = 9.4;
  const maxLng = 17.2;
  const minLat = 46.3;
  const maxLat = 49.1;
  const x = ((lng - minLng) / (maxLng - minLng)) * 720 + 40;
  const y = 330 - ((lat - minLat) / (maxLat - minLat)) * 250;
  return {
    x: Math.max(45, Math.min(760, x)),
    y: Math.max(70, Math.min(315, y)),
  };
}

function LocationMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-surface-secondary px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-sm font-semibold text-heading tabular-nums">{value}</p>
    </div>
  );
}

export default function LocalSeoMapWidget({ data }: LocalSeoMapWidgetProps) {
  const locations = data?.locations || [];
  const [selectedId, setSelectedId] = useState<string | undefined>(locations[0]?.id);
  const selected = locations.find((location) => location.id === selectedId) || locations[0];

  const rankedLocations = useMemo(
    () => [...locations].sort((a, b) => b.score - a.score),
    [locations]
  );

  if (locations.length === 0) return null;

  return (
    <section className="dashboard-widget-surface rounded-lg p-5 sm:p-6">
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-heading">Lokale Sichtbarkeit</h3>
          <p className="mt-1 text-sm text-muted">
            Standort-Auswertung aus GSC-Queries, Standort-Landingpages und GA4-Stadt-Daten.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <LocationMetric label="Klicks" value={formatNumber(data?.totals.clicks || 0)} />
          <LocationMetric label="Impr." value={formatNumber(data?.totals.impressions || 0)} />
          <LocationMetric label="Sessions" value={formatNumber(data?.totals.sessions || 0)} />
          <LocationMetric label="Conv." value={formatNumber(data?.totals.conversions || 0)} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.25fr_0.9fr]">
        <div className="min-h-[360px] rounded-lg bg-surface-secondary p-4">
          <svg viewBox="0 0 820 420" role="img" aria-label="Local SEO Karte Österreich" className="h-full min-h-[340px] w-full">
            <g className="fill-white stroke-slate-700 dark:fill-slate-800 dark:stroke-slate-300">
              {AUSTRIA_REGION_PATHS.map((region) => (
                <path key={region.id} d={region.path} strokeWidth="2" strokeLinejoin="round" />
              ))}
            </g>
            {locations.map((location) => {
              const point = projectToAustriaSvg(location);
              const color = getScoreColor(location.score);
              const isSelected = selected?.id === location.id;
              const radius = Math.max(12, Math.min(26, 12 + location.impressions / 600));
              return (
                <g key={location.id} className="cursor-pointer" onClick={() => setSelectedId(location.id)}>
                  <title>{location.name}</title>
                  <circle cx={point.x} cy={point.y} r={radius + 7} fill={color} opacity={isSelected ? 0.18 : 0.08} />
                  <circle cx={point.x} cy={point.y} r={radius} fill={color} stroke="#fff" strokeWidth="3" />
                  <text
                    x={point.x}
                    y={point.y + 4}
                    textAnchor="middle"
                    fontSize="11"
                    fontWeight="700"
                    fill="#fff"
                  >
                    {location.score}
                  </text>
                </g>
              );
            })}
          </svg>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted">
            {locations.map((location) => (
              <button
                key={`legend-${location.id}`}
                type="button"
                onClick={() => setSelectedId(location.id)}
                className={`rounded-md border px-2 py-1 text-left transition-colors ${
                  selected?.id === location.id
                    ? 'border-indigo-300 bg-indigo-50 text-slate-900 dark:border-indigo-700 dark:bg-indigo-950/30 dark:text-slate-100'
                    : 'border-border-subtle bg-surface hover:bg-surface-tertiary'
                }`}
              >
                <span
                  className="mr-1 inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: getScoreColor(location.score) }}
                />
                {location.name}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-border-subtle bg-surface p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Standort-Ranking</p>
            <div className="mt-3 space-y-2">
              {rankedLocations.map((location, index) => (
                <button
                  key={location.id}
                  type="button"
                  onClick={() => setSelectedId(location.id)}
                  className={`flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2 text-left transition-colors ${
                    selected?.id === location.id
                      ? 'border-indigo-300 bg-indigo-50 text-slate-900 dark:border-indigo-700 dark:bg-indigo-950/30 dark:text-slate-100'
                      : 'border-border-subtle bg-surface-secondary hover:bg-surface-tertiary'
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="text-xs font-semibold text-muted">#{index + 1}</span>
                    <span className="truncate text-sm font-semibold text-heading">{location.name}</span>
                  </span>
                  <span
                    className="rounded-md px-2 py-1 text-xs font-semibold text-white"
                    style={{ backgroundColor: getScoreColor(location.score) }}
                  >
                    {location.score}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {selected && (
            <div className="rounded-lg border border-border-subtle bg-surface p-4">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <h4 className="text-base font-semibold text-heading">{selected.name}</h4>
                  <p className="text-xs text-muted">
                    {[selected.postalCode, selected.city, selected.country].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <span
                  className="rounded-md px-2 py-1 text-xs font-semibold text-white"
                  style={{ backgroundColor: getScoreColor(selected.score) }}
                >
                  Score {selected.score}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <LocationMetric label="GSC Klicks" value={formatNumber(selected.clicks)} />
                <LocationMetric label="GSC Impr." value={formatNumber(selected.impressions)} />
                <LocationMetric label="CTR" value={formatPercent(selected.ctr)} />
                <LocationMetric label="Ø Pos." value={selected.position ? selected.position.toFixed(1) : '-'} />
                <LocationMetric label="Sessions" value={formatNumber(selected.sessions)} />
                <LocationMetric label="Conv." value={formatNumber(selected.conversions)} />
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">Top Queries</p>
                  <div className="space-y-1.5">
                    {selected.topQueries.length > 0 ? selected.topQueries.map((query) => (
                      <div key={`${selected.id}-${query.query}`} className="rounded-md bg-surface-secondary px-2 py-1.5">
                        <p className="truncate text-xs font-medium text-body" title={query.query}>{query.query}</p>
                        <p className="text-[11px] text-muted">
                          {formatNumber(query.impressions)} Impr. · {formatNumber(query.clicks)} Klicks
                        </p>
                      </div>
                    )) : <p className="text-xs text-muted">Keine lokalen GSC-Queries erkannt.</p>}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">Landingpages</p>
                  <div className="space-y-1.5">
                    {selected.topLandingPages.length > 0 ? selected.topLandingPages.map((page) => (
                      <div key={`${selected.id}-${page.path}`} className="rounded-md bg-surface-secondary px-2 py-1.5">
                        <p className="truncate font-mono text-xs text-body" title={page.path}>{page.path}</p>
                        <p className="text-[11px] text-muted">
                          {formatNumber(page.sessions || 0)} Sessions · {formatNumber(page.conversions || 0)} Conv.
                        </p>
                      </div>
                    )) : <p className="text-xs text-muted">Keine Standort-Landingpage zugeordnet.</p>}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
