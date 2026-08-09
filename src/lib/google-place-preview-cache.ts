import { sql } from '@vercel/postgres';
import { withInfrastructureRetry } from './sync/retry';

export type GooglePlacePreviewPayload = {
  placeId: string;
  displayName: string;
  formattedAddress: string;
  googleMapsUri: string | null;
  rating: number | null;
  userRatingCount: number | null;
  businessStatus: string | null;
  openNow: boolean | null;
  primaryType: string | null;
  photoUrl: string | null;
};

export type CachedGooglePlacePreview = {
  data: GooglePlacePreviewPayload;
  sourceUpdatedAt: string;
};

export async function readGooglePlacePreviewCache(
  projectId: string,
  locationKey: string,
  lookupKey: string,
): Promise<CachedGooglePlacePreview | null> {
  const { rows } = await withInfrastructureRetry(() => sql<{
    data: GooglePlacePreviewPayload;
    source_updated_at: Date | string;
  }>`
    SELECT data, source_updated_at
    FROM google_place_preview_cache
    WHERE project_id = ${projectId}::uuid
      AND location_key = ${locationKey}
      AND lookup_key = ${lookupKey}
    LIMIT 1
  `);
  const row = rows[0];
  if (!row?.data || !row.source_updated_at) return null;
  return {
    data: row.data,
    sourceUpdatedAt: new Date(row.source_updated_at).toISOString(),
  };
}

export async function saveGooglePlacePreviewCache(
  projectId: string,
  locationKey: string,
  lookupKey: string,
  data: GooglePlacePreviewPayload,
) {
  await withInfrastructureRetry(() => sql`
    INSERT INTO google_place_preview_cache (
      project_id, location_key, lookup_key, data, source_updated_at,
      last_attempt_at, last_error, updated_at
    ) VALUES (
      ${projectId}::uuid, ${locationKey}, ${lookupKey}, ${JSON.stringify(data)}::jsonb,
      NOW(), NOW(), NULL, NOW()
    )
    ON CONFLICT (project_id, location_key)
    DO UPDATE SET
      lookup_key = EXCLUDED.lookup_key,
      data = EXCLUDED.data,
      source_updated_at = NOW(),
      last_attempt_at = NOW(),
      last_error = NULL,
      updated_at = NOW()
  `);
}

export async function markGooglePlacePreviewFailure(
  projectId: string,
  locationKey: string,
  lookupKey: string,
  message: string,
) {
  await withInfrastructureRetry(() => sql`
    UPDATE google_place_preview_cache
    SET last_attempt_at = NOW(), last_error = ${message}, updated_at = NOW()
    WHERE project_id = ${projectId}::uuid
      AND location_key = ${locationKey}
      AND lookup_key = ${lookupKey}
  `);
}
