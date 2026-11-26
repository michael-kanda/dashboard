import { sql } from '@vercel/postgres';
import {
  isMissingColumnError,
  type AnalyticsSettingsColumns,
} from './settings';

export const MIGRATION_HINT =
  'Vercel Analytics ist noch nicht eingerichtet: Bitte zuerst "npm run db:migrate" ausführen (Migration 010).';

/** Liest die Analytics-Spalten eines Projekts. Ohne Migration 010 gilt GA4. */
export async function loadAnalyticsSettingsColumns(userId: string): Promise<AnalyticsSettingsColumns> {
  try {
    const { rows } = await sql`
      SELECT analytics_source, vercel_project_id, vercel_team_id, vercel_conversion_events
      FROM users WHERE id = ${userId}::uuid
    `;
    return (rows[0] as AnalyticsSettingsColumns | undefined) ?? {};
  } catch (error) {
    if (isMissingColumnError(error)) return {};
    throw error;
  }
}

/**
 * Speichert die Analytics-Spalten. Fehlt Migration 010, wird GA4 stillschweigend
 * beibehalten; nur der Wechsel auf Vercel scheitert mit einem klaren Hinweis.
 */
export async function saveAnalyticsSettingsColumns(
  userId: string,
  columns: Required<AnalyticsSettingsColumns>,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await sql`
      UPDATE users SET
        analytics_source = ${columns.analytics_source},
        vercel_project_id = ${columns.vercel_project_id},
        vercel_team_id = ${columns.vercel_team_id},
        vercel_conversion_events = ${columns.vercel_conversion_events}
      WHERE id = ${userId}::uuid
    `;
    return { ok: true };
  } catch (error) {
    if (!isMissingColumnError(error)) throw error;
    return columns.analytics_source === 'vercel' ? { ok: false, message: MIGRATION_HINT } : { ok: true };
  }
}
