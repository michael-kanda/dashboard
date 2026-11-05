import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeGscSiteUrl } from '../../src/lib/gsc-site-url.ts';

test('accepts domain and url-prefix properties', () => {
  assert.deepEqual(normalizeGscSiteUrl(' sc-domain:Beispiel.at '), { ok: true, value: 'sc-domain:beispiel.at' });
  assert.deepEqual(normalizeGscSiteUrl('https://www.beispiel.at'), { ok: true, value: 'https://www.beispiel.at/' });
  assert.deepEqual(normalizeGscSiteUrl('https://www.beispiel.at/blog/'), { ok: true, value: 'https://www.beispiel.at/blog/' });
});

test('suggests sc-domain for a bare domain and rejects other text', () => {
  const bare = normalizeGscSiteUrl('www.Beispiel.at');
  assert.equal(bare.ok, false);
  assert.match(bare.ok ? '' : bare.message, /sc-domain:beispiel\.at/);
  assert.equal(normalizeGscSiteUrl('beispiel').ok, false);
});
