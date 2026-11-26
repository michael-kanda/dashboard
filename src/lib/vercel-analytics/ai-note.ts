import type { ProjectDashboardData } from '../dashboard-shared';

/**
 * Hinweis für KI-Analyse und DataMax-Chat, wenn die Website-Kennzahlen aus
 * Vercel Web Analytics stammen. Ohne ihn würde das Modell Nullwerte für nicht
 * gemessene GA4-Kennzahlen als echte Werte deuten.
 */
export function analyticsSourceNote(data: Pick<ProjectDashboardData, 'analyticsSource' | 'vercelAnalytics'> | null | undefined): string {
  if (data?.analyticsSource !== 'vercel') return '';
  const pageviews = data.vercelAnalytics?.pageviews;
  const conversions = data.vercelAnalytics?.conversionsConfigured
    ? 'Conversions sind die Summe der als Conversion konfigurierten Vercel-Events.'
    : 'Conversions werden nicht gemessen (keine Events konfiguriert); nenne keine Conversion-Werte.';
  return [
    'DATENQUELLE WEBSITE: Vercel Web Analytics (statt GA4).',
    '"Nutzer", "Sitzungen" und "Sessions" bedeuten hier eindeutige Besucher; Sitzungen im GA4-Sinn gibt es nicht.',
    pageviews ? `Seitenaufrufe: ${pageviews.value.toLocaleString('de-DE')} (${pageviews.change.toFixed(1)}%).` : '',
    'Interaktionsrate, Absprungrate, Verweildauer und neue Besucher werden NICHT gemessen. Werte von 0 dafür bedeuten "nicht verfügbar", nicht "null"; erwähne sie nicht.',
    conversions,
    'KI-Traffic sind Besucher mit Referrer eines bekannten KI-Assistenten.',
  ].filter(Boolean).join('\n');
}
