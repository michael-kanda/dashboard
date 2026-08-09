import assert from 'node:assert/strict';
import test from 'node:test';
import {
  GOOGLE_PLACE_PREVIEW_TTL_MS,
  createGooglePlaceLookupKey,
  isGooglePlacePreviewFresh,
} from '../../src/lib/google-place-preview-policy.ts';

test('Google Place lookup keys are stable and configuration-sensitive', () => {
  const first = createGooglePlaceLookupKey('place-123456', 'Kanzlei Wien 1010');
  const same = createGooglePlaceLookupKey('place-123456', 'kanzlei wien 1010');
  const changed = createGooglePlaceLookupKey('place-654321', 'Kanzlei Wien 1010');

  assert.equal(first, same);
  assert.notEqual(first, changed);
});

test('Google Place previews stay fresh for 24 hours', () => {
  const now = Date.parse('2026-08-09T12:00:00.000Z');
  assert.equal(
    isGooglePlacePreviewFresh(new Date(now - GOOGLE_PLACE_PREVIEW_TTL_MS + 1), now),
    true,
  );
  assert.equal(
    isGooglePlacePreviewFresh(new Date(now - GOOGLE_PLACE_PREVIEW_TTL_MS), now),
    false,
  );
});
