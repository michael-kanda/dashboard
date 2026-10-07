'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import { MapPin, Save, X } from 'lucide-react';
import type { LocalSeoData, LocalSeoLocationData } from '@/lib/dashboard-shared';
import austriaGeoJson from '@/data/austria-bundeslaender.json';
import { formatReportingPeriod, type ReportingPeriod } from '@/lib/reporting-period';

interface LocalSeoMapWidgetProps {
  data?: LocalSeoData;
  projectId?: string;
  userRole?: string;
  reportingPeriod?: ReportingPeriod;
}

type GooglePlacePreview = {
  placeId: string;
  displayName: string;
  formattedAddress?: string;
  googleMapsUri?: string | null;
  rating?: number | null;
  userRatingCount?: number | null;
  businessStatus?: string | null;
  openNow?: boolean | null;
  primaryType?: string | null;
  photoUrl?: string | null;
  cacheState?: 'live' | 'fresh' | 'stale';
  sourceUpdatedAt?: string;
  warning?: string;
};

function formatNumber(value: number) {
  return new Intl.NumberFormat('de-DE').format(Math.round(value || 0));
}

function formatPercent(value: number) {
  return `${(value || 0).toFixed(1)} %`;
}

function getExternalProfileUrl(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function isUsablePlaceId(value?: string | null): value is string {
  const trimmed = value?.trim();
  if (!trimmed) return false;
  if (/^\d+$/.test(trimmed)) return false;
  return trimmed.length >= 10;
}

function buildPlaceQuery(location: LocalSeoLocationData) {
  return [
    location.name,
    location.postalCode,
    location.city,
    location.country || 'AT',
  ].filter(Boolean).join(' ');
}

function getOpeningLabel(preview?: GooglePlacePreview | null) {
  if (!preview) return null;
  if (preview.businessStatus === 'CLOSED_PERMANENTLY') return 'Dauerhaft geschlossen';
  if (preview.openNow === true) return 'Geöffnet';
  if (preview.openNow === false) return 'Geschlossen';
  return null;
}

type LocationDetailTab = 'overview' | 'queries' | 'landingpages';
type GeoPoint = [number, number];
type GeoRing = GeoPoint[];
type GeoPolygon = GeoRing[];
type GeoMultiPolygon = GeoPolygon[];
type AustriaFeature = {
  id?: string;
  properties?: {
    name?: string;
    longitude?: string;
    latitude?: string;
  };
  geometry: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: GeoPolygon | GeoMultiPolygon;
  };
};

const MAP_VIEWBOX = { width: 820, height: 420, padding: 34 };
const GOOGLE_BLUE = '#4285F4';
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

function collectGeoPoints(coordinates: unknown, points: GeoPoint[] = []) {
  if (!Array.isArray(coordinates)) return points;
  if (typeof coordinates[0] === 'number' && typeof coordinates[1] === 'number') {
    points.push([coordinates[0], coordinates[1]]);
    return points;
  }
  coordinates.forEach((entry) => collectGeoPoints(entry, points));
  return points;
}

function getFeatureCenter(feature: AustriaFeature) {
  const points = collectGeoPoints(feature.geometry.coordinates);
  const center = points.reduce(
    (acc, point) => ({ x: acc.x + point[0], y: acc.y + point[1] }),
    { x: 0, y: 0 }
  );

  return mapGeoPoint([center.x / points.length, center.y / points.length]);
}

function solveThreeByThree(matrix: number[][], vector: number[]) {
  const a = matrix.map((row) => [...row]);
  const b = [...vector];

  for (let pivot = 0; pivot < 3; pivot += 1) {
    let bestRow = pivot;
    for (let row = pivot + 1; row < 3; row += 1) {
      if (Math.abs(a[row][pivot]) > Math.abs(a[bestRow][pivot])) bestRow = row;
    }

    [a[pivot], a[bestRow]] = [a[bestRow], a[pivot]];
    [b[pivot], b[bestRow]] = [b[bestRow], b[pivot]];

    const divisor = a[pivot][pivot] || 1;
    for (let column = pivot; column < 3; column += 1) a[pivot][column] /= divisor;
    b[pivot] /= divisor;

    for (let row = 0; row < 3; row += 1) {
      if (row === pivot) continue;
      const factor = a[row][pivot];
      for (let column = pivot; column < 3; column += 1) {
        a[row][column] -= factor * a[pivot][column];
      }
      b[row] -= factor * b[pivot];
    }
  }

  return b;
}

function buildLatLngProjection() {
  const calibrationPoints = austriaFeatures
    .map((feature) => {
      const longitude = Number(feature.properties?.longitude);
      const latitude = Number(feature.properties?.latitude);
      if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null;
      return { longitude, latitude, ...getFeatureCenter(feature) };
    })
    .filter((point): point is { longitude: number; latitude: number; x: number; y: number } => Boolean(point));

  const solveAxis = (axis: 'x' | 'y') => {
    const matrix = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ];
    const vector = [0, 0, 0];

    calibrationPoints.forEach((point) => {
      const values = [point.longitude, point.latitude, 1];
      values.forEach((value, row) => {
        vector[row] += value * point[axis];
        values.forEach((innerValue, column) => {
          matrix[row][column] += value * innerValue;
        });
      });
    });

    return solveThreeByThree(matrix, vector);
  };

  const xCoefficients = solveAxis('x');
  const yCoefficients = solveAxis('y');

  return (latitude: number, longitude: number) => ({
    x: xCoefficients[0] * longitude + xCoefficients[1] * latitude + xCoefficients[2],
    y: yCoefficients[0] * longitude + yCoefficients[1] * latitude + yCoefficients[2],
  });
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

const projectLatLngToAustriaSvg = buildLatLngProjection();
const cityPointOverrides = austriaFeatures.reduce<Record<string, { x: number; y: number }>>((points, feature) => {
  const name = feature.properties?.name?.toLowerCase();
  if (name === 'wien') {
    const center = getFeatureCenter(feature);
    points.wien = center;
    points.vienna = center;
  }
  return points;
}, {});

const knownCitySvgPoints: Record<string, { x: number; y: number }> = {
  wien: { x: 704, y: 203 },
  vienna: { x: 704, y: 203 },
  graz: { x: 610, y: 295 },
  leoben: { x: 580, y: 250 },
  linz: { x: 430, y: 182 },
  salzburg: { x: 316, y: 258 },
  innsbruck: { x: 202, y: 278 },
  klagenfurt: { x: 520, y: 326 },
};

function projectToAustriaSvg(location: LocalSeoLocationData) {
  if (typeof location.mapX === 'number' && typeof location.mapY === 'number') {
    return {
      x: Math.max(0, Math.min(MAP_VIEWBOX.width, (location.mapX / 100) * MAP_VIEWBOX.width)),
      y: Math.max(0, Math.min(MAP_VIEWBOX.height, (location.mapY / 100) * MAP_VIEWBOX.height)),
    };
  }

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
  const manualOverrideKey = Object.keys(knownCitySvgPoints).find((key) => cityKey === key || cityKey.includes(key));
  if (manualOverrideKey) {
    return knownCitySvgPoints[manualOverrideKey];
  }

  const cityOverrideKey = Object.keys(cityPointOverrides).find((key) => cityKey === key || cityKey.includes(key));
  if (cityOverrideKey) {
    const point = cityPointOverrides[cityOverrideKey];
    return {
      x: Math.max(45, Math.min(760, point.x)),
      y: Math.max(70, Math.min(315, point.y)),
    };
  }

  const fallbackKey = Object.keys(knownCityCoordinates).find((key) => cityKey === key || cityKey.includes(key));
  const fallback = fallbackKey ? knownCityCoordinates[fallbackKey] : undefined;
  const lat = typeof location.lat === 'number' ? location.lat : (fallback?.lat ?? 47.6);
  const lng = typeof location.lng === 'number' ? location.lng : (fallback?.lng ?? 14.2);
  const { x, y } = projectLatLngToAustriaSvg(lat, lng);

  return {
    x: Math.max(45, Math.min(760, x)),
    y: Math.max(70, Math.min(315, y)),
  };
}

function LocationMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[9px] font-semibold uppercase text-muted">{label}</p>
      <p className="mt-1.5 text-[17px] font-medium leading-none tabular-nums text-heading">{value}</p>
    </div>
  );
}

function GoogleRule() {
  return (
    <div className="mt-2.5 flex h-1 w-[152px] overflow-hidden rounded-full" aria-hidden="true">
      <span className="w-1/4 bg-[#4285F4]" />
      <span className="w-1/4 bg-[#EA4335]" />
      <span className="w-1/4 bg-[#FBBC05]" />
      <span className="w-1/4 bg-[#34A853]" />
    </div>
  );
}

function svgPointToPercent(point: { x: number; y: number }) {
  return {
    mapX: Math.max(0, Math.min(100, (point.x / MAP_VIEWBOX.width) * 100)),
    mapY: Math.max(0, Math.min(100, (point.y / MAP_VIEWBOX.height) * 100)),
  };
}

export default function LocalSeoMapWidget({
  data,
  projectId,
  userRole,
  reportingPeriod,
}: LocalSeoMapWidgetProps) {
  const locations = data?.locations || [];
  const reportingPeriodLabel = formatReportingPeriod(reportingPeriod);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [displayLocations, setDisplayLocations] = useState<LocalSeoLocationData[]>(locations);
  const [selectedId, setSelectedId] = useState<string | undefined>(locations[0]?.id);
  const [isEditingPins, setIsEditingPins] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<LocationDetailTab>('overview');
  const [isSavingPins, setIsSavingPins] = useState(false);
  const [pinSaveError, setPinSaveError] = useState<string | null>(null);
  const [placePreviews, setPlacePreviews] = useState<Record<string, GooglePlacePreview | null>>({});
  const canEditPins = userRole === 'SUPERADMIN' && Boolean(projectId);
  const selected = displayLocations.find((location) => location.id === selectedId) || displayLocations[0];
  const selectedPreview = selected ? placePreviews[selected.id || selected.name] : null;
  const selectedOpeningLabel = getOpeningLabel(selectedPreview);
  const selectedProfileUrl = selected
    ? selectedPreview?.googleMapsUri || getExternalProfileUrl(selected.googleBusinessProfileUrl)
    : null;

  const rankedLocations = useMemo(
    () => [...displayLocations].sort((a, b) => b.score - a.score),
    [displayLocations]
  );
  const placePreviewLookupKey = useMemo(
    () => displayLocations
      .map((location) => [
        location.id || location.name,
        location.googlePlaceId || '',
        location.googleBusinessProfileUrl || '',
        location.name || '',
        location.postalCode || '',
        location.city || '',
        location.country || 'AT',
      ].join(':'))
      .join('|'),
    [displayLocations]
  );

  useEffect(() => {
    setDisplayLocations(locations);
    setSelectedId((current) => current && locations.some((location) => location.id === current)
      ? current
      : locations[0]?.id
    );
  }, [locations]);

  useEffect(() => {
    const controller = new AbortController();
    const loadPreviews = async () => {
      const previewEntries = await Promise.all(displayLocations.map(async (location) => {
        const locationId = location.id || location.name;
        if (!locationId) return null;
        if (!location.googlePlaceId && !location.googleBusinessProfileUrl) return [locationId, null] as const;

        const params = new URLSearchParams();
        if (projectId) {
          params.set('projectId', projectId);
          params.set('locationId', locationId);
        }
        const googlePlaceId = location.googlePlaceId?.trim();
        if (isUsablePlaceId(googlePlaceId)) {
          params.set('placeId', googlePlaceId);
        }
        params.set('query', buildPlaceQuery(location));

        try {
          const response = await fetch(`/api/google-places/preview?${params.toString()}`, {
            signal: controller.signal,
          });
          if (!response.ok) return [locationId, null] as const;
          const preview = await response.json() as GooglePlacePreview;
          if (!preview?.placeId) return [locationId, null] as const;
          return [locationId, preview] as const;
        } catch {
          if (controller.signal.aborted) return null;
          return [locationId, null] as const;
        }
      }));

      if (controller.signal.aborted) return;
      setPlacePreviews((current) => {
        const next = { ...current };
        previewEntries.forEach((entry) => {
          if (!entry) return;
          const [locationId, preview] = entry;
          next[locationId] = preview;
        });
        return next;
      });
    };

    if (displayLocations.length > 0) {
      loadPreviews();
    }

    return () => controller.abort();
  }, [placePreviewLookupKey, projectId]);

  const getSvgPointFromClient = (clientX: number, clientY: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return null;

    return {
      x: Math.max(0, Math.min(MAP_VIEWBOX.width, ((clientX - rect.left) / rect.width) * MAP_VIEWBOX.width)),
      y: Math.max(0, Math.min(MAP_VIEWBOX.height, ((clientY - rect.top) / rect.height) * MAP_VIEWBOX.height)),
    };
  };

  const moveLocationPin = (locationId: string, point: { x: number; y: number }) => {
    const percent = svgPointToPercent(point);
    setDisplayLocations((current) => current.map((location) => (
      location.id === locationId
        ? { ...location, mapX: Math.round(percent.mapX * 10) / 10, mapY: Math.round(percent.mapY * 10) / 10 }
        : location
    )));
  };

  const selectLocation = (locationId?: string) => {
    setSelectedId(locationId);
    setDetailTab('overview');
  };

  const handlePinPointerDown = (event: PointerEvent<SVGGElement>, locationId: string) => {
    if (!isEditingPins) return;
    event.preventDefault();
    event.stopPropagation();
    setDraggingId(locationId);
    selectLocation(locationId);
    const point = getSvgPointFromClient(event.clientX, event.clientY);
    if (point) moveLocationPin(locationId, point);
  };

  const handleMapPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (!draggingId) return;
    const point = getSvgPointFromClient(event.clientX, event.clientY);
    if (point) moveLocationPin(draggingId, point);
  };

  const stopDragging = () => setDraggingId(null);

  const resetPinEditing = () => {
    setDisplayLocations(locations);
    setIsEditingPins(false);
    setDraggingId(null);
    setPinSaveError(null);
  };

  const startPinEditing = () => {
    setDisplayLocations((current) => current.map((location) => {
      if (typeof location.mapX === 'number' && typeof location.mapY === 'number') return location;
      const point = projectToAustriaSvg(location);
      const percent = svgPointToPercent(point);
      return {
        ...location,
        mapX: Math.round(percent.mapX * 10) / 10,
        mapY: Math.round(percent.mapY * 10) / 10,
      };
    }));
    setIsEditingPins(true);
    setPinSaveError(null);
  };

  const savePinPositions = async () => {
    if (!projectId) return;
    setIsSavingPins(true);
    setPinSaveError(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/locations/positions`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          positions: displayLocations.map((location) => ({
            id: location.id,
            mapX: location.mapX,
            mapY: location.mapY,
          })),
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || 'Pin-Positionen konnten nicht gespeichert werden.');
      setIsEditingPins(false);
    } catch (error) {
      setPinSaveError(error instanceof Error ? error.message : 'Pin-Positionen konnten nicht gespeichert werden.');
    } finally {
      setIsSavingPins(false);
    }
  };

  if (displayLocations.length === 0) return null;

  return (
    <section className="dashboard-widget-surface local-signal-map overflow-hidden rounded-lg">
      <header className="flex flex-col gap-4 px-5 pb-[18px] pt-[22px] sm:px-6 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase text-muted">Standort Performance</p>
          <h3 className="mt-1 text-[17px] font-medium text-heading">Lokale Sichtbarkeit</h3>
          <GoogleRule />
          <p className="mt-2 text-sm text-muted">
            Standort-Auswertung aus GSC-Queries, Standort-Landingpages und GA4-Stadt-Daten.
          </p>
          <p className="mt-1 text-[11px] text-muted">
            Quelle: GSC + GA4{reportingPeriodLabel ? ` · ${reportingPeriodLabel}` : ''} · {displayLocations.length} Standorte
          </p>
          {pinSaveError ? <p className="mt-2 text-xs font-medium text-red-600 dark:text-red-400">{pinSaveError}</p> : null}
        </div>
        {canEditPins ? (
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              {!isEditingPins ? (
                <button
                  type="button"
                  onClick={startPinEditing}
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-border-subtle bg-surface px-3 text-xs font-medium text-body shadow-sm hover:bg-surface-tertiary"
                >
                  <MapPin size={15} />
                  Standorte bearbeiten
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={savePinPositions}
                    disabled={isSavingPins}
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-slate-900 px-3 text-xs font-medium text-white shadow-sm hover:bg-slate-800 disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
                  >
                    <Save size={15} />
                    {isSavingPins ? 'Speichern…' : 'Position speichern'}
                  </button>
                  <button
                    type="button"
                    onClick={resetPinEditing}
                    disabled={isSavingPins}
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-border-subtle bg-surface px-3 text-xs font-medium text-body shadow-sm hover:bg-surface-tertiary disabled:opacity-60"
                  >
                    <X size={15} />
                    Abbrechen
                  </button>
                </>
              )}
          </div>
        ) : null}
      </header>

      <div className="local-signal-map__layout">
        <div className="local-signal-map__stage">
          <svg
            ref={svgRef}
            viewBox="0 0 820 420"
            role="img"
            aria-label="Local SEO Karte Österreich"
            className={`h-full min-h-[340px] w-full ${isEditingPins ? 'cursor-crosshair select-none touch-none' : ''}`}
            onPointerMove={handleMapPointerMove}
            onPointerUp={stopDragging}
            onPointerLeave={stopDragging}
          >
            <g className="fill-[var(--local-map-panel)] stroke-slate-500 dark:stroke-slate-400">
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
            {displayLocations.map((location) => {
              const point = projectToAustriaSvg(location);
              const isSelected = selected?.id === location.id;
              const isActive = isSelected || hoveredId === location.id;
              const preview = placePreviews[location.id || location.name] || null;
              const rawLabel = preview?.displayName || location.name;
              const label = rawLabel.length > 30 ? `${rawLabel.slice(0, 27)}...` : rawLabel;
              const profileUrl = preview?.googleMapsUri || getExternalProfileUrl(location.googleBusinessProfileUrl);
              const profileImageUrl = preview?.photoUrl || getExternalProfileUrl(location.googleBusinessProfileImageUrl);
              const hasProfileImage = Boolean(profileImageUrl);
              const categoryLabel = preview?.primaryType || 'Google Unternehmensprofil';
              const openingLabel = getOpeningLabel(preview);
              const ratingLabel = typeof preview?.rating === 'number'
                ? preview.rating.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
                : null;
              const reviewLabel = typeof preview?.userRatingCount === 'number'
                ? `(${formatNumber(preview.userRatingCount)})`
                : '';
              const profileClipId = `local-seo-profile-${String(location.id || 'location').replace(/[^a-zA-Z0-9_-]/g, '-')}`;
              const imageHeight = 88;
              const labelWidth = profileUrl ? 300 : Math.min(286, Math.max(214, label.length * 7.2 + 44));
              const labelHeight = profileUrl ? (hasProfileImage ? 226 : 152) : 82;
              const preferredLabelX = point.x > MAP_VIEWBOX.width - labelWidth - 20 ? -labelWidth - 17 : 18;
              const preferredLabelY = profileUrl ? (hasProfileImage ? -236 : -162) : -92;
              const absoluteLabelX = Math.max(8, Math.min(MAP_VIEWBOX.width - labelWidth - 8, point.x + preferredLabelX));
              const absoluteLabelY = Math.max(8, Math.min(MAP_VIEWBOX.height - labelHeight - 8, point.y + preferredLabelY));
              const labelX = absoluteLabelX - point.x;
              const labelY = absoluteLabelY - point.y;
              const pointerX = Math.max(12, Math.min(labelWidth - 12, point.x - absoluteLabelX));
              const pointerAtBottom = absoluteLabelY + labelHeight <= point.y;
              const nameY = profileUrl ? (hasProfileImage ? 116 : 26) : 24;
              const profileMetaY = hasProfileImage ? 140 : 50;
              const ratingY = hasProfileImage ? 158 : 68;
              const profileActionY = hasProfileImage ? 176 : 88;
              const visitorsY = profileUrl ? (hasProfileImage ? 202 : 118) : 50;
              const conversionsY = profileUrl ? (hasProfileImage ? 220 : 138) : 70;
              return (
                <g
                  key={location.id}
                  className={isEditingPins ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}
                  transform={`translate(${point.x} ${point.y})`}
                  onClick={() => selectLocation(location.id)}
                  onPointerDown={(event) => handlePinPointerDown(event, location.id || '')}
                  onMouseEnter={() => setHoveredId(location.id || null)}
                  onMouseLeave={() => setHoveredId(null)}
                >
                  <title>{location.name}</title>
                  <g transform="scale(0.44) translate(-50 -30)">
                    <ellipse cx="50" cy="78" rx="32" ry="13" fill={isActive ? GOOGLE_BLUE : '#6B7280'} opacity={isActive ? '0.22' : '0.25'} />
                    <g fill={isActive ? GOOGLE_BLUE : '#4B5563'}>
                      <rect x="46.5" y="44" width="7" height="30" rx="3.5" />
                      <circle cx="50" cy="30" r="18" />
                    </g>
                  </g>
                  {hoveredId === location.id ? (
                    <g transform={`translate(${labelX} ${labelY})`}>
                      <path
                        d={pointerAtBottom
                          ? `M${pointerX - 9} ${labelHeight - 1} L${pointerX} ${labelHeight + 10} L${pointerX + 9} ${labelHeight - 1} Z`
                          : `M${pointerX - 9} 1 L${pointerX} -10 L${pointerX + 9} 1 Z`
                        }
                        fill="white"
                        stroke={GOOGLE_BLUE}
                        className="dark:fill-slate-900"
                        strokeWidth="1"
                      />
                      <rect
                        width={labelWidth}
                        height={labelHeight}
                        rx="7"
                        fill="white"
                        stroke={GOOGLE_BLUE}
                        className="drop-shadow-sm dark:fill-slate-900"
                        strokeWidth="1"
                      />
                      {profileUrl ? (
                        <a
                          href={profileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(event) => event.stopPropagation()}
                          className="cursor-pointer"
                        >
                          {profileImageUrl ? (
                            <>
                              <defs>
                                <clipPath id={profileClipId}>
                                  <rect x="1" y="1" width={labelWidth - 2} height={imageHeight} rx="7" />
                                </clipPath>
                              </defs>
                              <rect x="1" y="1" width={labelWidth - 2} height={imageHeight} rx="7" fill="#E5E7EB" />
                            </>
                          ) : null}
                          {profileImageUrl ? (
                            <image
                              href={profileImageUrl}
                              x="1"
                              y="1"
                              width={labelWidth - 2}
                              height={imageHeight}
                              preserveAspectRatio="xMidYMid meet"
                              clipPath={`url(#${profileClipId})`}
                            />
                          ) : null}
                          <rect width={labelWidth} height={labelHeight} fill="transparent" />
                        </a>
                      ) : null}
                      <text
                        x="13"
                        y={nameY}
                        fill={profileUrl ? '#111827' : GOOGLE_BLUE}
                        className="text-[15px] font-semibold dark:fill-slate-100"
                      >
                        {label}
                      </text>
                      {profileUrl ? (
                        <>
                          <text
                            x="13"
                            y={profileMetaY}
                            fill="#64748B"
                            className="text-[13px] dark:fill-slate-300"
                          >
                            {categoryLabel.length > 34 ? `${categoryLabel.slice(0, 31)}...` : categoryLabel}
                          </text>
                          {ratingLabel ? (
                            <text
                              x="13"
                              y={ratingY}
                              fill="#374151"
                              className="text-[13px] dark:fill-slate-200"
                            >
                              {ratingLabel} Sterne {reviewLabel}
                            </text>
                          ) : null}
                          <text
                            x="13"
                            y={profileActionY}
                            fill={openingLabel === 'Geöffnet' ? '#15803D' : '#DC2626'}
                            className="text-[13px]"
                          >
                            {openingLabel ? `${openingLabel} · Profil öffnen` : 'Profil öffnen'}
                          </text>
                        </>
                      ) : null}
                      <text
                        x="13"
                        y={visitorsY}
                        fill={GOOGLE_BLUE}
                        className="text-[13px] font-semibold"
                      >
                        Neue Besucher {formatNumber(location.newUsers)}
                      </text>
                      <text
                        x="13"
                        y={conversionsY}
                        fill={GOOGLE_BLUE}
                        className="text-[13px] font-semibold"
                      >
                        Conversions {formatNumber(location.conversions)}
                      </text>
                      {profileUrl ? (
                        <a
                          href={profileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(event) => event.stopPropagation()}
                          className="cursor-pointer"
                        >
                          <rect width={labelWidth} height={labelHeight} fill="transparent" />
                        </a>
                      ) : null}
                    </g>
                  ) : (
                    <text
                      x="12"
                      y="-10"
                      className="fill-slate-700 text-[11px] font-medium dark:fill-slate-200"
                    >
                      {location.city || (location.name.length > 18 ? `${location.name.slice(0, 16)}…` : location.name)}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
          <p className="absolute bottom-4 left-5 text-[10px] text-muted">
            {isEditingPins ? 'Pins direkt auf der Karte verschieben.' : 'Standorte nach organischer Reichweite'}
          </p>
        </div>

        <div className="local-signal-map__side">
          <div className="local-signal-map__locations">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] font-semibold uppercase text-muted">Standorte</p>
              <span className="text-[9px] uppercase text-muted">Sessions</span>
            </div>
            <div className="mt-2 space-y-0.5">
              {rankedLocations.map((location, index) => {
                const preview = placePreviews[location.id || location.name];
                const hasRating = typeof preview?.rating === 'number' && preview.rating > 0;
                const ratingLabel = hasRating
                  ? preview.rating!.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
                  : null;
                const reviewLabel = typeof preview?.userRatingCount === 'number'
                  ? formatNumber(preview.userRatingCount)
                  : null;

                return (
                  <button
                    key={location.id}
                    type="button"
                    onClick={() => selectLocation(location.id)}
                    aria-pressed={selected?.id === location.id}
                    className="local-signal-map__location border-0 bg-transparent transition-colors hover:bg-surface-secondary"
                  >
                    <span className="text-[10px] font-medium tabular-nums text-muted">{String(index + 1).padStart(2, '0')}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-[11px] font-medium text-heading">{location.name}</span>
                      <span className="mt-0.5 block truncate text-[9px] text-muted">
                        {[location.postalCode, location.city].filter(Boolean).join(' ')}
                        {ratingLabel ? ` · ${ratingLabel} Sterne${reviewLabel ? ` (${reviewLabel})` : ''}` : ''}
                      </span>
                    </span>
                    <span className="text-xs font-medium tabular-nums text-heading">{formatNumber(location.sessions)}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {selected && (
            <div className="local-signal-map__detail">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase text-muted">Ausgewählter Standort</p>
                  <h4 className="mt-1 truncate text-[13px] font-medium text-heading">{selected.name}</h4>
                  <p className="mt-0.5 text-[10px] text-muted">
                  {[selected.postalCode, selected.city, selected.country].filter(Boolean).join(' · ')}
                  </p>
                </div>
                {selectedProfileUrl ? (
                  <a
                    href={selectedProfileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-[10px] font-medium text-[#4285F4] hover:underline"
                  >
                    {selectedOpeningLabel || 'Profil öffnen'}
                  </a>
                ) : (
                  <span className="inline-flex shrink-0 items-center gap-1.5 text-[10px] text-muted">
                    <span className="h-2 w-2 rounded-full bg-[#34A853]" />Aktiv
                  </span>
                )}
              </div>

              <div className="local-signal-map__tabs overflow-x-auto custom-scrollbar" role="tablist" aria-label="Standortdetails">
                {([
                  ['overview', 'Übersicht'],
                  ['queries', `Queries (${selected.topQueries.length})`],
                  ['landingpages', `Landingpages (${selected.topLandingPages.length})`],
                ] as const).map(([tab, label]) => (
                  <button
                    key={tab}
                    type="button"
                    role="tab"
                    aria-selected={detailTab === tab}
                    onClick={() => setDetailTab(tab)}
                    className={`shrink-0 rounded-md border-0 px-2.5 py-2 text-[10px] font-medium transition-colors ${
                      detailTab === tab
                        ? 'bg-surface-tertiary text-heading'
                        : 'bg-transparent text-muted hover:bg-surface-secondary hover:text-heading'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="local-signal-map__tab-panel">
                {detailTab === 'overview' ? (
                  <div className="local-signal-map__metrics !mt-0">
                    <LocationMetric label="GSC Klicks" value={formatNumber(selected.clicks)} />
                    <LocationMetric label="GSC Impr." value={formatNumber(selected.impressions)} />
                    <LocationMetric label="CTR" value={formatPercent(selected.ctr)} />
                    <LocationMetric label="Ø Pos." value={selected.position ? selected.position.toFixed(1) : '-'} />
                    <LocationMetric label="Sessions" value={formatNumber(selected.sessions)} />
                    <LocationMetric label="Conv." value={formatNumber(selected.conversions)} />
                  </div>
                ) : null}

                {detailTab === 'queries' ? (
                  <div className="max-h-[250px] divide-y divide-border-subtle overflow-y-auto pr-1 custom-scrollbar">
                    {selected.topQueries.length > 0 ? selected.topQueries.map((query) => (
                      <div key={`${selected.id}-${query.query}`} className="py-2">
                        <p className="truncate text-xs font-medium text-body" title={query.query}>{query.query}</p>
                        <p className="text-[11px] text-muted">
                          {formatNumber(query.impressions)} Impr. · {formatNumber(query.clicks)} Klicks
                        </p>
                      </div>
                    )) : <p className="text-xs text-muted">Keine lokalen GSC-Queries erkannt.</p>}
                  </div>
                ) : null}

                {detailTab === 'landingpages' ? (
                  <div className="max-h-[250px] divide-y divide-border-subtle overflow-y-auto pr-1 custom-scrollbar">
                    {selected.topLandingPages.length > 0 ? selected.topLandingPages.map((page) => (
                      <div key={`${selected.id}-${page.path}`} className="py-2">
                        <p className="truncate font-mono text-xs text-body" title={page.path}>{page.path}</p>
                        <p className="text-[11px] text-muted">
                          {formatNumber(page.sessions || 0)} Sessions · {formatNumber(page.conversions || 0)} Conv.
                        </p>
                      </div>
                    )) : <p className="text-xs text-muted">Keine Standort-Landingpage zugeordnet.</p>}
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
