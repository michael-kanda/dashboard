// Analytics-Quelle je Projekt: GA4 (Standard) oder Vercel Web Analytics.
// Reine Funktionen ohne Datenbankzugriff, damit sie in Tests und im Browser
// (Projekteinstellungen) nutzbar sind.

export type AnalyticsSource = 'ga4' | 'vercel';

export interface AnalyticsSettings {
  source: AnalyticsSource;
  vercelProjectId: string | null;
  vercelTeamId: string | null;
  /** Namen eigener Vercel-Events, die als Conversion zählen. */
  conversionEvents: string[];
}

export interface AnalyticsSettingsColumns {
  analytics_source?: string | null;
  vercel_project_id?: string | null;
  vercel_team_id?: string | null;
  vercel_conversion_events?: string | null;
}

const EVENT_NAME_MAX_LENGTH = 100;
const MAX_CONVERSION_EVENTS = 20;

function trimToNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function parseConversionEvents(value: unknown): string[] {
  const raw = Array.isArray(value) ? value.join(',') : typeof value === 'string' ? value : '';
  const names = raw
    .split(/[,\n]/)
    .map((name) => name.trim())
    .filter((name) => name.length > 0 && name.length <= EVENT_NAME_MAX_LENGTH);
  return Array.from(new Set(names)).slice(0, MAX_CONVERSION_EVENTS);
}

/** Liest die Spalten eines users-Datensatzes; fehlende Spalten (Migration 010 noch nicht ausgeführt) ergeben GA4. */
export function readAnalyticsSettings(row: AnalyticsSettingsColumns | null | undefined): AnalyticsSettings {
  const vercelProjectId = trimToNull(row?.vercel_project_id);
  return {
    source: row?.analytics_source === 'vercel' && vercelProjectId ? 'vercel' : 'ga4',
    vercelProjectId,
    vercelTeamId: trimToNull(row?.vercel_team_id),
    conversionEvents: parseConversionEvents(row?.vercel_conversion_events),
  };
}

export type AnalyticsSettingsInput = {
  analytics_source?: unknown;
  vercel_project_id?: unknown;
  vercel_team_id?: unknown;
  vercel_conversion_events?: unknown;
};

export type ParsedAnalyticsSettings =
  | { ok: true; columns: Required<AnalyticsSettingsColumns> }
  | { ok: false; message: string };

/** Prüft Formulareingaben und liefert die zu speichernden Spaltenwerte. */
export function parseAnalyticsSettingsInput(input: AnalyticsSettingsInput): ParsedAnalyticsSettings {
  const source = input.analytics_source === 'vercel' ? 'vercel' : 'ga4';
  const projectId = trimToNull(input.vercel_project_id);
  const teamId = trimToNull(input.vercel_team_id);
  if (source === 'vercel' && !projectId) {
    return { ok: false, message: 'Für Vercel Analytics ist die Vercel-Projekt-ID oder der Projektname erforderlich.' };
  }
  const invalid = [projectId, teamId].find((value) => value && !/^[A-Za-z0-9_.-]{1,100}$/.test(value));
  if (invalid) {
    return { ok: false, message: `Ungültige Vercel-Angabe: ${invalid}` };
  }
  const events = parseConversionEvents(input.vercel_conversion_events);
  return {
    ok: true,
    columns: {
      analytics_source: source,
      vercel_project_id: projectId,
      vercel_team_id: teamId,
      vercel_conversion_events: events.length > 0 ? events.join(', ') : null,
    },
  };
}

/** Postgres-Fehler 42703: Spalte existiert nicht (Migration fehlt). */
export function isMissingColumnError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === '42703';
}
