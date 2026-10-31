import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function getPlacesApiKey() {
  return process.env.GOOGLE_PLACES_API_KEY
    || process.env.GOOGLE_MAPS_API_KEY
    || process.env.GOOGLE_API_KEY
    || '';
}

// Places-API-v1-Fotonamen: places/{placeId}/photos/{photoId}. Andere Pfade würden
// den Server-Schlüssel an beliebige Places-Endpunkte weiterreichen.
const PHOTO_NAME_PATTERN = /^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+$/;
const CACHE_CONTROL = 'private, max-age=3600, stale-while-revalidate=86400';

function normalizeDimension(value: string | null, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(4800, Math.round(parsed)));
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
  }

  const apiKey = getPlacesApiKey();
  if (!apiKey) {
    return NextResponse.json({ message: 'Google Places API Key fehlt.' }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const name = searchParams.get('name')?.trim();
  const photoReference = searchParams.get('photoReference')?.trim();
  if (!(name && PHOTO_NAME_PATTERN.test(name)) && !photoReference) {
    return NextResponse.json({ message: 'Ungueltiger Foto-Name.' }, { status: 400 });
  }

  const maxWidthPx = normalizeDimension(searchParams.get('maxWidthPx'), 600);
  const maxHeightPx = normalizeDimension(searchParams.get('maxHeightPx'), 240);

  if (photoReference) {
    // Die Legacy-URL enthält den API-Schlüssel; das Bild wird deshalb serverseitig
    // geladen und durchgereicht, statt den Browser dorthin weiterzuleiten.
    const legacyUrl = new URL('https://maps.googleapis.com/maps/api/place/photo');
    legacyUrl.searchParams.set('photo_reference', photoReference);
    legacyUrl.searchParams.set('maxwidth', String(maxWidthPx));
    legacyUrl.searchParams.set('key', apiKey);
    const photo = await fetch(legacyUrl.toString(), { next: { revalidate: 86400 } });
    const contentType = photo.headers.get('content-type') ?? '';
    if (!photo.ok || !contentType.startsWith('image/')) {
      return NextResponse.json({ message: `Google Places Foto fehlgeschlagen (${photo.status}).` }, { status: 502 });
    }
    return new NextResponse(photo.body, {
      headers: { 'Content-Type': contentType, 'Cache-Control': CACHE_CONTROL },
    });
  }

  const url = new URL(`https://places.googleapis.com/v1/${name}/media`);
  url.searchParams.set('key', apiKey);
  url.searchParams.set('maxWidthPx', String(maxWidthPx));
  url.searchParams.set('maxHeightPx', String(maxHeightPx));
  url.searchParams.set('skipHttpRedirect', 'true');

  const response = await fetch(url.toString(), { next: { revalidate: 86400 } });
  if (!response.ok) {
    return NextResponse.json({ message: `Google Places Foto fehlgeschlagen (${response.status}).` }, { status: 502 });
  }

  const data = await response.json() as { photoUri?: string };
  if (!data.photoUri) {
    return NextResponse.json({ message: 'Kein Foto gefunden.' }, { status: 404 });
  }

  const redirect = NextResponse.redirect(data.photoUri);
  redirect.headers.set('Cache-Control', CACHE_CONTROL);
  return redirect;
}
