// src/lib/csp.mjs
// Content Security Policy für alle Seiten, gesetzt in next.config.mjs (headers()).
// Vorerst als Content-Security-Policy-Report-Only: Der Browser blockiert nichts, meldet aber
// Verstöße an Sentry (Bereich „Security“). Erst wenn dort nichts Unerwartetes auftaucht, wird
// die Policy scharf geschaltet (CSP_ENFORCE).
//
// Ohne Nonce: Next.js liest die Nonce aus dem Request-Header Content-Security-Policy, und den
// lässt Vercel nicht bis zum Rendern durch (live getestet, PR 52/53). Deshalb sind Inline-Skripte
// erlaubt; Skripte von fremden Domains bleiben ausgeschlossen.
//
// Warum diese Quellen:
// - script-src 'self' 'unsafe-inline': eigene Skripte und die Inline-Skripte von Next.js
// - style-src 'unsafe-inline': React-style-Attribute und Tailwind-Inline-Stile
// - img-src https:: Mandanten-Logos liegen auf beliebigen Kunden-Domains
// - connect-src: eigene APIs, Analytics über /_vercel; Sentry über den Tunnel /monitoring oder,
//   ohne Sentry-Build-Plugin, direkt an den EU-Ingest
// - worker-src blob:: Sentry Replay komprimiert in einem Web Worker

export const CSP_ENFORCE = false;
export const CSP_HEADER = CSP_ENFORCE ? 'Content-Security-Policy' : 'Content-Security-Policy-Report-Only';

const SENTRY_CSP_REPORT_URI =
  'https://o4510442605051905.ingest.de.sentry.io/api/4510442606755920/security/?sentry_key=47443b3ff6edf164f0a58f55f12bd41e';

/** @param {{ isDev?: boolean }} [options] */
export function buildCsp({ isDev = false } = {}) {
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src 'self' https://*.ingest.de.sentry.io${isDev ? ' ws: http://localhost:*' : ''}`,
    "worker-src 'self' blob:",
    "frame-src 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "object-src 'none'",
  ];
  if (!isDev) directives.push(`report-uri ${SENTRY_CSP_REPORT_URI}`);
  return directives.join('; ');
}
