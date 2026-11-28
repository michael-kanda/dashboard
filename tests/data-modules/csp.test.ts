import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCsp, createNonce, CSP_HEADER } from '../../src/lib/csp.ts';

test('Nonce ist pro Aufruf neu und Base64', () => {
  const a = createNonce();
  const b = createNonce();
  assert.notEqual(a, b);
  assert.match(a, /^[A-Za-z0-9+/]{22}==$/);
});

test('CSP: Skripte nur mit Nonce, Meldungen an Sentry, kein eval in Produktion', () => {
  const csp = buildCsp('abc');
  assert.match(csp, /script-src 'self' 'nonce-abc' 'strict-dynamic'(;|$)/);
  assert.ok(!csp.includes('unsafe-eval'));
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /report-uri https:\/\/[^ ]+ingest\.de\.sentry\.io\/api\/\d+\/security\//);
  assert.equal(CSP_HEADER, 'Content-Security-Policy-Report-Only');
});

test('CSP in der Entwicklung erlaubt eval und meldet nichts', () => {
  const csp = buildCsp('abc', { isDev: true });
  assert.match(csp, /'unsafe-eval'/);
  assert.ok(!csp.includes('report-uri'));
});
