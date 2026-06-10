'use client';

import { useMemo, useState } from 'react';
import type { LocalSeoData, LocalSeoLocationData } from '@/lib/dashboard-shared';
import austriaGeoJson from '@/data/austria-bundeslaender.geojson';

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

type GeoPoint = [number, number];
type GeoRing = GeoPoint[];
type GeoPolygon = GeoRing[];
type GeoMultiPolygon = GeoPolygon[];
type AustriaFeature = {
  id?: string;
  properties?: { name?: string };
  geometry: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: GeoPolygon | GeoMultiPolygon;
  };
};

const MAP_VIEWBOX = { width: 820, height: 420, padding: 34 };
const austriaFeatures = (austriaGeoJson as unknown as { features: AustriaFeature[] }).features;

const austriaBounds = (() => {
  const xs: number[] = [];
  const ys: number[] = [];
  const collectPoints = (coordinates: unknown) => {
    if (!Array.isArray(coordinates)) return;
    if (typeof coordinates[0] === 'number' && typeof coordinates[1] === 'number') {
      xs.push(coordinates[0]);
      ys.push(coordinates[1]);
      return;
    }
    coordinates.forEach(collectPoints);
  };

  austriaFeatures.forEach((feature) => collectPoints(feature.geometry.coordinates));

  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
})();

function mapGeoPoint([x, y]: GeoPoint) {
  const scale = Math.min(
    (MAP_VIEWBOX.width - MAP_VIEWBOX.padding * 2) / (austriaBounds.maxX - austriaBounds.minX),
    (MAP_VIEWBOX.height - MAP_VIEWBOX.padding * 2) / (austriaBounds.maxY - austriaBounds.minY)
  );
  const mapWidth = (austriaBounds.maxX - austriaBounds.minX) * scale;
  const mapHeight = (austriaBounds.maxY - austriaBounds.minY) * scale;
  const offsetX = (MAP_VIEWBOX.width - mapWidth) / 2;
  const offsetY = (MAP_VIEWBOX.height - mapHeight) / 2;

  return {
    x: (x - austriaBounds.minX) * scale + offsetX,
    y: (austriaBounds.maxY - y) * scale + offsetY,
  };
}

function ringToPath(ring: GeoRing) {
  return ring
    .map((point, index) => {
      const mapped = mapGeoPoint(point);
      return `${index === 0 ? 'M' : 'L'}${mapped.x.toFixed(1)} ${mapped.y.toFixed(1)}`;
    })
    .join(' ')
    .concat(' Z');
}

function featureToPath(feature: AustriaFeature) {
  if (feature.geometry.type === 'Polygon') {
    return (feature.geometry.coordinates as GeoPolygon).map(ringToPath).join(' ');
  }

  return (feature.geometry.coordinates as GeoMultiPolygon)
    .map((polygon) => polygon.map(ringToPath).join(' '))
    .join(' ');
}

const AUSTRIA_REGION_PATHS = austriaFeatures.map((feature) => ({
  id: feature.id || feature.properties?.name || 'austria-region',
  name: feature.properties?.name || 'Bundesland',
  path: featureToPath(feature),
}));

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
                <path
                  key={region.id}
                  d={region.path}
                  fillRule="evenodd"
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                >
                  <title>{region.name}</title>
                </path>
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
