import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

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

function normalizePlace(place: GooglePlace | null) {
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

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
  }

  const apiKey = getPlacesApiKey();
  if (!apiKey) {
    return NextResponse.json(
      { message: 'GOOGLE_PLACES_API_KEY oder GOOGLE_MAPS_API_KEY ist nicht konfiguriert.' },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(request.url);
  const placeId = searchParams.get('placeId')?.trim();
  const query = searchParams.get('query')?.trim();

  if (!placeId && !query) {
    return NextResponse.json({ message: 'placeId oder query ist erforderlich.' }, { status: 400 });
  }

  try {
    let place: GooglePlace | null = null;

    if (isUsablePlaceId(placeId)) {
      try {
        place = await fetchPlaceById(placeId as string, apiKey);
      } catch (detailsError) {
        if (!query) throw detailsError;
      }
    }

    if (!place && query) {
      place = await searchPlace(query, apiKey);
    }

    const preview = normalizePlace(place);
    if (!preview) {
      return NextResponse.json({
        available: false,
        message: 'Kein Google-Unternehmensprofil gefunden.',
      });
    }

    return NextResponse.json(preview, {
      headers: {
        'Cache-Control': 'private, max-age=3600, stale-while-revalidate=86400',
      },
    });
  } catch (error) {
    return NextResponse.json({
      available: false,
      message: error instanceof Error ? error.message : 'Google Places Vorschau konnte nicht geladen werden.',
    });
  }
}
