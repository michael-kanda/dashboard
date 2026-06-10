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
  const y = 300 - ((lat - minLat) / (maxLat - minLat)) * 220;
  return {
    x: Math.max(45, Math.min(760, x)),
    y: Math.max(55, Math.min(295, y)),
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
        <div className="min-h-[320px] rounded-lg bg-surface-secondary p-4">
          <svg viewBox="0 0 820 360" role="img" aria-label="Local SEO Karte Österreich" className="h-full min-h-[300px] w-full">
            <path
              d="M61 194 C96 157 137 156 176 169 C208 180 230 143 270 153 C312 164 319 134 361 141 C397 147 419 120 453 134 C497 153 520 139 557 159 C594 179 632 163 671 181 C714 201 745 199 778 221 C739 252 686 264 632 251 C590 242 551 278 503 266 C461 256 440 286 395 271 C353 257 319 286 279 266 C242 247 212 264 176 241 C139 218 96 226 61 194 Z"
              fill="var(--dp-surface)"
              stroke="var(--dp-border)"
              strokeWidth="3"
            />
            <path
              d="M135 201 C230 185 315 199 402 184 C493 169 592 190 702 210"
              fill="none"
              stroke="var(--dp-border)"
              strokeDasharray="7 9"
              strokeWidth="2"
            />
            {locations.map((location) => {
              const point = projectToAustriaSvg(location);
              const color = getScoreColor(location.score);
              const isSelected = selected?.id === location.id;
              const radius = Math.max(12, Math.min(26, 12 + location.impressions / 600));
              return (
                <g key={location.id} className="cursor-pointer" onClick={() => setSelectedId(location.id)}>
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
                  <text
                    x={point.x}
                    y={point.y + radius + 19}
                    textAnchor="middle"
                    fontSize="12"
                    fontWeight="700"
                    fill="var(--dp-text)"
                  >
                    {location.name}
                  </text>
                </g>
              );
            })}
          </svg>
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
