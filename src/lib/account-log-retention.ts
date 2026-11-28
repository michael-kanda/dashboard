// src/lib/account-log-retention.ts
// Aufbewahrung der Protokolle mit E-Mail-Adressen (Datenschutzerklärung, Abschnitt Speicherdauer):
// Das Anmeldeprotokoll wird nach 12 Monaten gelöscht, beim Löschen eines Kontos sofort.
// Im Landingpage-Protokoll bleibt die Aktion stehen, die E-Mail-Adresse des gelöschten Kontos nicht.
import { sql } from '@vercel/postgres';
import { logger } from '@/lib/logger';

export const LOGIN_LOG_RETENTION_MONTHS = 12;
export const DELETED_ACCOUNT_LABEL = 'Gelöschtes Konto';

// Höchstens einmal pro Stunde und Instanz aufräumen, nicht bei jeder Anmeldung.
const PRUNE_INTERVAL_MS = 60 * 60 * 1000;
let lastPruneAt = 0;

/** Löscht Anmeldeprotokolle, die älter als 12 Monate sind oder zu keinem Konto mehr gehören. */
export async function pruneLoginLogs(now = Date.now()) {
  if (now - lastPruneAt < PRUNE_INTERVAL_MS) return;
  lastPruneAt = now;
  try {
    await sql`
      DELETE FROM login_logs
      WHERE timestamp < NOW() - (${LOGIN_LOG_RETENTION_MONTHS} * INTERVAL '1 month')
         OR user_id IS NULL
    `;
    // Einträge von früher gelöschten Konten (user_id wurde auf NULL gesetzt) ebenfalls ohne E-Mail
    await sql`
      UPDATE landingpage_logs SET user_email = ${DELETED_ACCOUNT_LABEL}
      WHERE user_id IS NULL AND user_email IS NOT NULL AND user_email <> ${DELETED_ACCOUNT_LABEL}
    `;
  } catch (error) {
    logger.warn('[Protokoll] Alte Anmeldeprotokolle nicht gelöscht (nicht fatal)', error);
  }
}

/** Vor dem Löschen eines Kontos: Anmeldeprotokoll löschen, E-Mail im Landingpage-Protokoll ersetzen. */
export async function removeAccountLogTraces(userId: string) {
  await sql`DELETE FROM login_logs WHERE user_id = ${userId}::uuid`;
  await sql`
    UPDATE landingpage_logs SET user_email = ${DELETED_ACCOUNT_LABEL}
    WHERE user_id = ${userId}::uuid
  `;
}
