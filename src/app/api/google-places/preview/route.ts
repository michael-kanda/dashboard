import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  markGooglePlacePreviewFailure,
  readGooglePlacePreviewCache,
  saveGooglePlacePreviewCache,
  type CachedGooglePlacePreview,
  type GooglePlacePreviewPayload,
} from '@/lib/google-place-preview-cache';
import {
  createGooglePlaceLookupKey,
  isGooglePlacePreviewFresh,
} from '@/lib/google-place-preview-policy';

export const dynamic = 'force-dynamic';

type GooglePlacePhoto = {
  name?: string;
  widthPx?: number;
  heightPx?: number;
};

type GooglePlace = {
  id?: string;
  displayName?: { text?: string; languageCode?: string };
  formattedAddress?: string;
  shortFormattedAddress?: string;
  googleMapsUri?: string;
  rating?: number;
  userRatingCount?: number;
  businessStatus?: string;
  primaryTypeDisplayName?: { text?: string; languageCode?: string };
  currentOpeningHours?: { openNow?: boolean };
  photos?: GooglePlacePhoto[];
};

type LegacyPlace = {
  place_id?: string;
  name?: string;
  formatted_address?: string;
  url?: string;
  rating?: number;
  user_ratings_total?: number;
  business_status?: string;
  types?: string[];
  opening_hours?: { open_now?: boolean };
  photos?: { photo_reference?: string; width?: number; height?: number }[];
};

function getPlacesApiKey() {
  return process.env.GOOGLE_PLACES_API_KEY
    || process.env.GOOGLE_MAPS_API_KEY
    || process.env.GOOGLE_API_KEY
    || '';
}

function isUsablePlaceId(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) return false;
  if (/^\d+$/.test(trimmed)) return false;
  return trimmed.length >= 10;
}

function normalizeTypeLabel(type?: string) {
  if (!type) return null;
  return type
    .split('_')
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

const PREVIEW_CACHE_HEADERS = {
  'Cache-Control': 'private, max-age=3600, stale-while-revalidate=86400',
};

function normalizePlace(place: GooglePlace | null): GooglePlacePreviewPayload | null {
  if (!place?.id) return null;

  const photoName = place.photos?.find((photo) => photo.name)?.name || null;
  const photoUrl = photoName
    ? `/api/google-places/photo?name=${encodeURIComponent(photoName)}&maxWidthPx=600&maxHeightPx=240`
    : null;

  return {
    placeId: place.id,
    displayName: place.displayName?.text || '',
    formattedAddress: place.shortFormattedAddress || place.formattedAddress || '',
    googleMapsUri: place.googleMapsUri || null,
    rating: typeof place.rating === 'number' ? place.rating : null,
    userRatingCount: typeof place.userRatingCount === 'number' ? place.userRatingCount : null,
    businessStatus: place.businessStatus || null,
    openNow: typeof place.currentOpeningHours?.openNow === 'boolean' ? place.currentOpeningHours.openNow : null,
    primaryType: place.primaryTypeDisplayName?.text || null,
    photoUrl,
  };
}

function normalizeLegacyPlace(place: LegacyPlace | null): GooglePlacePreviewPayload | null {
  if (!place?.place_id) return null;

  const photoReference = place.photos?.find((photo) => photo.photo_reference)?.photo_reference || null;
  const photoUrl = photoReference
    ? `/api/google-places/photo?photoReference=${encodeURIComponent(photoReference)}&maxWidthPx=600&maxHeightPx=240`
    : null;

  return {
    placeId: place.place_id,
    displayName: place.name || '',
    formattedAddress: place.formatted_address || '',
    googleMapsUri: place.url || null,
    rating: typeof place.rating === 'number' ? place.rating : null,
    userRatingCount: typeof place.user_ratings_total === 'number' ? place.user_ratings_total : null,
    businessStatus: place.business_status || null,
    openNow: typeof place.opening_hours?.open_now === 'boolean' ? place.opening_hours.open_now : null,
    primaryType: normalizeTypeLabel(place.types?.[0]),
    photoUrl,
  };
}

async function fetchPlaceById(placeId: string, apiKey: string) {
  const response = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': [
        'id',
        'displayName',
        'formattedAddress',
        'shortFormattedAddress',
        'googleMapsUri',
        'rating',
        'userRatingCount',
        'businessStatus',
        'primaryTypeDisplayName',
        'currentOpeningHours',
        'photos',
      ].join(','),
    },
    next: { revalidate: 86400 },
  });

  if (!response.ok) {
    throw new Error(`Google Places Details fehlgeschlagen (${response.status})`);
  }

  return await response.json() as GooglePlace;
}

async function fetchLegacyPlaceById(placeId: string, apiKey: string) {
  const url = new URL('https://maps.googleapis.com/maps/api/place/details/json');
  url.searchParams.set('place_id', placeId);
  url.searchParams.set('language', 'de');
  url.searchParams.set('fields', [
    'place_id',
    'name',
    'formatted_address',
    'url',
    'rating',
    'user_ratings_total',
    'business_status',
    'type',
    'opening_hours',
    'photo',
  ].join(','));
  url.searchParams.set('key', apiKey);

  const response = await fetch(url.toString(), { next: { revalidate: 86400 } });
  if (!response.ok) {
    throw new Error(`Google Places Legacy Details fehlgeschlagen (${response.status})`);
  }

  const data = await response.json() as { status?: string; error_message?: string; result?: LegacyPlace };
  if (data.status && data.status !== 'OK') {
    throw new Error(data.error_message || `Google Places Legacy Details Status ${data.status}`);
  }

  return data.result || null;
}

async function searchPlace(textQuery: string, apiKey: string) {
  const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': [
        'places.id',
        'places.displayName',
        'places.formattedAddress',
        'places.shortFormattedAddress',
        'places.googleMapsUri',
        'places.rating',
        'places.userRatingCount',
        'places.businessStatus',
        'places.primaryTypeDisplayName',
        'places.currentOpeningHours',
        'places.photos',
      ].join(','),
    },
    body: JSON.stringify({
      textQuery,
      languageCode: 'de',
      regionCode: 'AT',
      maxResultCount: 1,
    }),
    next: { revalidate: 86400 },
  });

  if (!response.ok) {
    throw new Error(`Google Places Suche fehlgeschlagen (${response.status})`);
  }

  const data = await response.json() as { places?: GooglePlace[] };
  return data.places?.[0] || null;
}

async function searchLegacyPlace(textQuery: string, apiKey: string) {
  const url = new URL('https://maps.googleapis.com/maps/api/place/findplacefromtext/json');
  url.searchParams.set('input', textQuery);
  url.searchParams.set('inputtype', 'textquery');
  url.searchParams.set('language', 'de');
  url.searchParams.set('fields', [
    'place_id',
    'name',
    'formatted_address',
    'photos',
    'rating',
    'user_ratings_total',
    'business_status',
    'opening_hours',
    'types',
  ].join(','));
  url.searchParams.set('key', apiKey);

  const response = await fetch(url.toString(), { next: { revalidate: 86400 } });
  if (!response.ok) {
    throw new Error(`Google Places Legacy Suche fehlgeschlagen (${response.status})`);
  }

  const data = await response.json() as { status?: string; error_message?: string; candidates?: LegacyPlace[] };
  if (data.status && data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    throw new Error(data.error_message || `Google Places Legacy Suche Status ${data.status}`);
  }

  const candidate = data.candidates?.[0] || null;
  if (!candidate?.place_id) return candidate;

  try {
    return await fetchLegacyPlaceById(candidate.place_id, apiKey);
  } catch {
    return candidate;
  }
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId')?.trim();
  const locationKey = searchParams.get('locationId')?.trim();
  const placeId = searchParams.get('placeId')?.trim();
  const query = searchParams.get('query')?.trim();

  if (!placeId && !query) {
    return NextResponse.json({ message: 'placeId oder query ist erforderlich.' }, { status: 400 });
  }
  if ((projectId && !locationKey) || (!projectId && locationKey)) {
    return NextResponse.json({ message: 'projectId und locationId müssen gemeinsam angegeben werden.' }, { status: 400 });
  }
  if (projectId && !/^[0-9a-f-]{36}$/i.test(projectId)) {
    return NextResponse.json({ message: 'Ungültige projectId.' }, { status: 400 });
  }
  if (projectId && session.user.role === 'BENUTZER' && session.user.id !== projectId) {
    return NextResponse.json({ message: 'Zugriff verweigert' }, { status: 403 });
  }

  const lookupKey = createGooglePlaceLookupKey(placeId, query);
  let cached: CachedGooglePlacePreview | null = null;
  if (projectId && locationKey) {
    try {
      cached = await readGooglePlacePreviewCache(projectId, locationKey, lookupKey);
      if (cached && isGooglePlacePreviewFresh(cached.sourceUpdatedAt)) {
        return NextResponse.json({
          ...cached.data,
          cacheState: 'fresh',
          sourceUpdatedAt: cached.sourceUpdatedAt,
        }, { headers: PREVIEW_CACHE_HEADERS });
      }
    } catch (error) {
      console.warn('[Google Places Preview] Cache konnte nicht gelesen werden:', error);
    }
  }

  const apiKey = getPlacesApiKey();
  if (!apiKey) {
    if (cached) {
      return NextResponse.json({
        ...cached.data,
        cacheState: 'stale',
        sourceUpdatedAt: cached.sourceUpdatedAt,
        warning: 'Google Places ist derzeit nicht konfiguriert. Letzter erfolgreicher Stand wird angezeigt.',
      }, { headers: PREVIEW_CACHE_HEADERS });
    }
    return NextResponse.json(
      { message: 'GOOGLE_PLACES_API_KEY oder GOOGLE_MAPS_API_KEY ist nicht konfiguriert.' },
      { status: 503 },
    );
  }

  try {
    let place: GooglePlace | null = null;
    let legacyPlace: LegacyPlace | null = null;

    if (isUsablePlaceId(placeId)) {
      try {
        place = await fetchPlaceById(placeId as string, apiKey);
      } catch (detailsError) {
        try {
          legacyPlace = await fetchLegacyPlaceById(placeId as string, apiKey);
        } catch {
          if (!query) throw detailsError;
        }
      }
    }

    if (!place && !legacyPlace && query) {
      try {
        place = await searchPlace(query, apiKey);
      } catch {
        legacyPlace = await searchLegacyPlace(query, apiKey);
      }
    }

    const preview = normalizePlace(place) || normalizeLegacyPlace(legacyPlace);
    if (!preview) {
      throw new Error('Kein Google-Unternehmensprofil gefunden.');
    }

    if (projectId && locationKey) {
      try {
        await saveGooglePlacePreviewCache(projectId, locationKey, lookupKey, preview);
      } catch (error) {
        console.warn('[Google Places Preview] Neuer Profilstand konnte nicht gespeichert werden:', error);
      }
    }

    return NextResponse.json({
      ...preview,
      cacheState: 'live',
      sourceUpdatedAt: new Date().toISOString(),
    }, {
      headers: PREVIEW_CACHE_HEADERS,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Google Places Vorschau konnte nicht geladen werden.';
    if (projectId && locationKey) {
      await markGooglePlacePreviewFailure(projectId, locationKey, lookupKey, message).catch((cacheError) => {
        console.warn('[Google Places Preview] Fehlerstatus konnte nicht gespeichert werden:', cacheError);
      });
    }
    if (cached) {
      return NextResponse.json({
        ...cached.data,
        cacheState: 'stale',
        sourceUpdatedAt: cached.sourceUpdatedAt,
        warning: `${message} Letzter erfolgreicher Stand wird angezeigt.`,
      }, { headers: PREVIEW_CACHE_HEADERS });
    }
    return NextResponse.json({ available: false, message }, { status: 502 });
  }
}
