import assert from 'node:assert/strict';
import test from 'node:test';
import { parseGa4PropertyId } from '../../src/lib/ga4-property-id.ts';
import { classifyGoogleApiError } from '../../src/lib/sync/google-api-error.ts';

test('accepts numeric property ids and the properties/ prefix', () => {
  assert.deepEqual(parseGa4PropertyId(' 412345678 '), { ok: true, value: '412345678' });
  assert.deepEqual(parseGa4PropertyId('properties/412345678'), { ok: true, value: '412345678' });
  assert.deepEqual(parseGa4PropertyId(''), { ok: true, value: null });
  assert.deepEqual(parseGa4PropertyId(null), { ok: true, value: null });
});

test('rejects measurement ids and other text with a helpful message', () => {
  const measurement = parseGa4PropertyId('G-WGF2PCSVB0');
  assert.equal(measurement.ok, false);
  assert.match(measurement.ok ? '' : measurement.message, /Mess-ID/);
  assert.equal(parseGa4PropertyId('UA-12345-1').ok, false);
  assert.equal(parseGa4PropertyId('123').ok, false);
});

test('a wrong GA4 property id never blocks the snapshot write', () => {
  const google = classifyGoogleApiError('Invalid property ID: G-WGF2PCSVB0. A numeric Property ID is required.');
  assert.equal(google.kind, 'permanent');
  assert.equal(google.blocksSnapshotWrite, false);

  const local = parseGa4PropertyId('G-WGF2PCSVB0');
  assert.equal(classifyGoogleApiError(local.ok ? '' : local.message).blocksSnapshotWrite, false);
});
