import { createHash } from 'node:crypto';

export const GOOGLE_PLACE_PREVIEW_TTL_MS = 24 * 60 * 60 * 1000;

export function createGooglePlaceLookupKey(placeId?: string | null, query?: string | null) {
  const normalized = [placeId?.trim() ?? '', query?.trim().toLocaleLowerCase('de-AT') ?? ''].join('|');
  return createHash('sha256').update(normalized).digest('hex');
}

export function isGooglePlacePreviewFresh(
  sourceUpdatedAt: string | Date,
  now = Date.now(),
) {
  const timestamp = new Date(sourceUpdatedAt).getTime();
  return Number.isFinite(timestamp) && now - timestamp < GOOGLE_PLACE_PREVIEW_TTL_MS;
}
