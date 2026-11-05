// Live-Prüfung von GSC-Property und GA4-Property beim Anlegen oder Bearbeiten eines Projekts.
import { google } from 'googleapis';
import { createGoogleAuth, getServiceAccountEmail, GOOGLE_SCOPES } from '@/lib/google-auth';
import { parseGa4PropertyId } from '@/lib/ga4-property-id';
import { readErrorMessage } from '@/lib/sync/google-api-error';
import { normalizeGscSiteUrl } from '@/lib/gsc-site-url';

export interface ConnectionCheckResult {
  ok: boolean;
  message: string;
}

const TIMEOUT_MS = 10_000;
const number = new Intl.NumberFormat('de-AT');

function isoDate(daysAgo: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

function readStatus(error: unknown): number | null {
  const candidate = error as { code?: unknown; status?: unknown; response?: { status?: unknown } } | null;
  const value = Number(candidate?.response?.status ?? candidate?.status ?? candidate?.code);
  return Number.isFinite(value) ? value : null;
}

function serviceAccountHint() {
  const email = getServiceAccountEmail();
  return email ? email : 'das Dienstkonto des Dashboards';
}

export async function checkGscSite(input: string): Promise<ConnectionCheckResult> {
  const site = normalizeGscSiteUrl(input);
  if (!site.ok) return { ok: false, message: site.message };

  try {
    const auth = createGoogleAuth([GOOGLE_SCOPES.searchConsole]);
    const searchconsole = google.searchconsole({ version: 'v1', auth });
    const { data: siteInfo } = await searchconsole.sites.get({ siteUrl: site.value }, { timeout: TIMEOUT_MS });
    if (siteInfo.permissionLevel === 'siteUnverifiedUser') {
      return { ok: false, message: `Property ist nicht bestätigt. ${serviceAccountHint()} braucht mindestens eingeschränkten Zugriff.` };
    }

    // GSC-Daten kommen mit 2–3 Tagen Verzögerung.
    const { data } = await searchconsole.searchanalytics.query(
      { siteUrl: site.value, requestBody: { startDate: isoDate(30), endDate: isoDate(3) } },
      { timeout: TIMEOUT_MS },
    );
    const totals = data.rows?.[0];
    const clicks = number.format(totals?.clicks ?? 0);
    const impressions = number.format(totals?.impressions ?? 0);
    return {
      ok: true,
      message: totals
        ? `Verbunden · letzte 28 Tage: ${clicks} Klicks, ${impressions} Impressionen`
        : 'Verbunden, aber in den letzten 28 Tagen keine Daten',
    };
  } catch (error) {
    const status = readStatus(error);
    if (status === 403) {
      return { ok: false, message: `Kein Zugriff. In der Search Console ${serviceAccountHint()} als Nutzer hinzufügen.` };
    }
    if (status === 404) {
      return { ok: false, message: 'Property nicht gefunden. Schreibweise prüfen (sc-domain:… oder https://…/).' };
    }
    return { ok: false, message: `Prüfung fehlgeschlagen: ${readErrorMessage(error).slice(0, 160)}` };
  }
}

export async function checkGa4Property(input: string): Promise<ConnectionCheckResult> {
  const property = parseGa4PropertyId(input);
  if (!property.ok) return { ok: false, message: property.message };
  if (!property.value) return { ok: false, message: 'Keine Property-ID angegeben.' };

  try {
    const auth = createGoogleAuth([GOOGLE_SCOPES.analytics]);
    const analytics = google.analyticsdata({ version: 'v1beta', auth });
    const { data } = await analytics.properties.runReport(
      {
        property: `properties/${property.value}`,
        requestBody: {
          dateRanges: [{ startDate: '28daysAgo', endDate: 'yesterday' }],
          metrics: [{ name: 'sessions' }, { name: 'totalUsers' }],
        },
      },
      { timeout: TIMEOUT_MS },
    );
    const values = data.rows?.[0]?.metricValues ?? [];
    const sessions = Number(values[0]?.value ?? 0);
    const users = Number(values[1]?.value ?? 0);
    return {
      ok: true,
      message: sessions > 0
        ? `Verbunden · letzte 28 Tage: ${number.format(sessions)} Sitzungen, ${number.format(users)} Nutzer`
        : 'Verbunden, aber in den letzten 28 Tagen keine Sitzungen',
    };
  } catch (error) {
    const status = readStatus(error);
    if (status === 403) {
      return { ok: false, message: `Kein Zugriff. In GA4 unter Verwaltung → Property-Zugriffsverwaltung ${serviceAccountHint()} als Betrachter hinzufügen.` };
    }
    if (status === 404) {
      return { ok: false, message: 'Property nicht gefunden. ID in GA4 → Verwaltung → Property-Details prüfen.' };
    }
    return { ok: false, message: `Prüfung fehlgeschlagen: ${readErrorMessage(error).slice(0, 160)}` };
  }
}
