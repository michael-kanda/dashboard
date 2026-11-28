// src/lib/csp.ts
// Content Security Policy für alle Seiten (Proxy setzt sie pro Anfrage mit eigener Nonce).
// Vorerst als Content-Security-Policy-Report-Only: Der Browser blockiert nichts, meldet aber
// Verstöße an Sentry (Bereich „Security“). Erst wenn dort nichts Unerwartetes auftaucht, wird
// die Policy scharf geschaltet (CSP_ENFORCE).
//
// Warum diese Quellen:
// - script-src: nur eigene Skripte mit Nonce; 'strict-dynamic' erlaubt, was diese nachladen
//   (z. B. Vercel Analytics unter /_vercel/insights)
// - style-src 'unsafe-inline': React-style-Attribute und Tailwind-Inline-Stile
// - img-src https:: Mandanten-Logos liegen auf beliebigen Kunden-Domains
// - connect-src: eigene APIs, Analytics über /_vercel; Sentry über den Tunnel /monitoring oder,
//   ohne Sentry-Build-Plugin, direkt an den EU-Ingest
// - worker-src blob:: Sentry Replay komprimiert in einem Web Worker

export const CSP_ENFORCE = false;
export const CSP_HEADER = CSP_ENFORCE ? 'Content-Security-Policy' : 'Content-Security-Policy-Report-Only';

const SENTRY_CSP_REPORT_URI =
  'https://o4510442605051905.ingest.de.sentry.io/api/4510442606755920/security/?sentry_key=47443b3ff6edf164f0a58f55f12bd41e';

export function createNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

export function buildCsp(nonce: string, { isDev = false }: { isDev?: boolean } = {}): string {
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
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
