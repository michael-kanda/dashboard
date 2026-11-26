// src/lib/site-hosts.ts
// Aufteilung der Domains: www.datapeak.at zeigt die Landingpage, app.datapeak.at das Dashboard.

/** Domains, unter denen die Landingpage läuft. marketing.localhost dient zum lokalen Testen. */
const MARKETING_HOSTS = new Set(['datapeak.at', 'www.datapeak.at', 'marketing.localhost']);

export const APP_HOST = 'app.datapeak.at';
export const APP_ORIGIN = `https://${APP_HOST}`;
export const MARKETING_ORIGIN = 'https://www.datapeak.at';

/** Interner Pfad der Landingpage; auf der Marketing-Domain wird "/" dorthin umgeschrieben. */
export const LANDING_PATH = '/willkommen';

/** Seiten, die auf der Marketing-Domain bleiben; alles andere führt ins Dashboard. */
export const MARKETING_PAGES = new Set(['/impressum', '/datenschutz']);

/** Request-Header, mit dem die Middleware dem Layout die Landingpage-Darstellung meldet. */
export const SITE_HEADER = 'x-dp-site';

/** Hostname ohne Port, in Kleinbuchstaben. */
export function normalizeHost(host: string | null | undefined): string {
  return (host ?? '').split(':')[0].trim().toLowerCase();
}

export function isMarketingHost(host: string | null | undefined): boolean {
  return MARKETING_HOSTS.has(normalizeHost(host));
}

/**
 * Adresse des Dashboards von der Landingpage aus. Lokal (marketing.localhost:3000)
 * bleibt es beim gleichen Port auf localhost, sonst app.datapeak.at.
 */
export function appOriginFor(host: string | null | undefined): string {
  const raw = (host ?? '').trim().toLowerCase();
  if (normalizeHost(raw).endsWith('localhost')) {
    const port = raw.includes(':') ? raw.split(':')[1] : '';
    return `http://localhost${port ? `:${port}` : ''}`;
  }
  return APP_ORIGIN;
}
