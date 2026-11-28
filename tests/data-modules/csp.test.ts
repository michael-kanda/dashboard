import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCsp, CSP_HEADER } from '../../src/lib/csp.mjs';

test('CSP: Skripte nur von der eigenen Domain, Meldungen an Sentry, kein eval in Produktion', () => {
  const csp = buildCsp();
  assert.match(csp, /script-src 'self' 'unsafe-inline'(;|$)/);
  assert.ok(!csp.includes('unsafe-eval'));
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /report-uri https:\/\/[^ ]+ingest\.de\.sentry\.io\/api\/\d+\/security\//);
  assert.equal(CSP_HEADER, 'Content-Security-Policy-Report-Only');
});

test('CSP in der Entwicklung erlaubt eval und meldet nichts', () => {
  const csp = buildCsp({ isDev: true });
  assert.match(csp, /'unsafe-eval'/);
  assert.ok(!csp.includes('report-uri'));
});
