// Datenbankzugriff für die Zwei-Faktor-Anmeldung. Ohne Migration 011 gilt
// die Funktion als nicht verfügbar: Logins funktionieren dann wie bisher.

import { sql } from '@vercel/postgres';
import { isMissingColumnError } from '../vercel-analytics/settings';
import { openSecret, sealSecret } from './secret-box';
import { generateTotpSecret, verifyTotp } from './totp';
import { consumeRecoveryCode, generateRecoveryCodes, hashRecoveryCode, looksLikeRecoveryCode } from './recovery';

export interface TwoFactorState {
  /** false, solange Migration 011 nicht ausgeführt ist. */
  available: boolean;
  enabled: boolean;
  /** Geheimnis vorhanden (aktiv oder Einrichtung begonnen). */
  hasSecret: boolean;
  recoveryCodesLeft: number;
}

interface TwoFactorRow {
  totp_secret_enc: string | null;
  totp_enabled_at: string | null;
  totp_last_step: string | number | null;
  totp_recovery_hashes: string[] | null;
}

const UNAVAILABLE: TwoFactorState = { available: false, enabled: false, hasSecret: false, recoveryCodesLeft: 0 };

async function loadRow(userId: string): Promise<TwoFactorRow | null | 'unavailable'> {
  try {
    const { rows } = await sql<TwoFactorRow>`
      SELECT totp_secret_enc, totp_enabled_at, totp_last_step, totp_recovery_hashes
      FROM users WHERE id::text = ${userId}
    `;
    return rows[0] ?? null;
  } catch (error) {
    if (isMissingColumnError(error)) return 'unavailable';
    throw error;
  }
}

function toState(row: TwoFactorRow): TwoFactorState {
  return {
    available: true,
    enabled: Boolean(row.totp_enabled_at),
    hasSecret: Boolean(row.totp_secret_enc),
    recoveryCodesLeft: row.totp_recovery_hashes?.length ?? 0,
  };
}

export async function loadTwoFactorState(userId: string): Promise<TwoFactorState> {
  const row = await loadRow(userId);
  if (row === 'unavailable' || row === null) return UNAVAILABLE;
  return toState(row);
}

/**
 * Prüft den zweiten Faktor beim Login: 6-stelliger App-Code oder ein
 * Wiederherstellungscode. Ein benutzter Code wird verbraucht.
 */
export async function verifySecondFactor(userId: string, input: string): Promise<'totp' | 'recovery' | null> {
  const row = await loadRow(userId);
  if (row === 'unavailable' || !row?.totp_enabled_at || !row.totp_secret_enc) return null;

  if (looksLikeRecoveryCode(input)) {
    const remaining = consumeRecoveryCode(input, row.totp_recovery_hashes);
    if (!remaining) return null;
    // Nur verbrauchen, wenn der Code noch in der Liste steht (gleichzeitige Logins).
    const { rowCount } = await sql`
      UPDATE users SET totp_recovery_hashes = ${remaining as unknown as string}
      WHERE id::text = ${userId} AND ${hashRecoveryCode(input)} = ANY(totp_recovery_hashes)
    `;
    return rowCount ? 'recovery' : null;
  }

  const lastStep = row.totp_last_step === null ? null : Number(row.totp_last_step);
  const step = verifyTotp(openSecret(row.totp_secret_enc), input, { lastStep });
  if (step === null) return null;
  // Schritt atomar fortschreiben: derselbe Code kann nicht zweimal benutzt werden.
  const { rowCount } = await sql`
    UPDATE users SET totp_last_step = ${step}
    WHERE id::text = ${userId} AND (totp_last_step IS NULL OR totp_last_step < ${step})
  `;
  return rowCount ? 'totp' : null;
}

/** Beginnt die Einrichtung: neues Geheimnis, solange noch nichts aktiv ist. */
export async function startTwoFactorSetup(userId: string): Promise<{ secret: string } | { error: string }> {
  const row = await loadRow(userId);
  if (row === 'unavailable') return { error: 'Die Zwei-Faktor-Anmeldung ist noch nicht eingerichtet (Migration 011 fehlt).' };
  if (!row) return { error: 'Benutzer nicht gefunden' };
  if (row.totp_enabled_at) return { error: 'Die Zwei-Faktor-Anmeldung ist bereits aktiv.' };
  const secret = generateTotpSecret();
  await sql`
    UPDATE users SET totp_secret_enc = ${sealSecret(secret)}, totp_last_step = NULL, totp_recovery_hashes = NULL
    WHERE id::text = ${userId} AND totp_enabled_at IS NULL
  `;
  return { secret };
}

/** Schließt die Einrichtung mit einem gültigen Code ab und liefert die Wiederherstellungscodes. */
export async function enableTwoFactor(userId: string, code: string): Promise<{ recoveryCodes: string[] } | { error: string }> {
  const row = await loadRow(userId);
  if (row === 'unavailable' || !row) return { error: 'Benutzer nicht gefunden' };
  if (row.totp_enabled_at) return { error: 'Die Zwei-Faktor-Anmeldung ist bereits aktiv.' };
  if (!row.totp_secret_enc) return { error: 'Bitte die Einrichtung neu starten.' };
  const step = verifyTotp(openSecret(row.totp_secret_enc), code);
  if (step === null) return { error: 'Der Code stimmt nicht. Bitte den aktuellen Code aus der App eingeben.' };
  const recoveryCodes = generateRecoveryCodes();
  const hashes = recoveryCodes.map(hashRecoveryCode);
  await sql`
    UPDATE users SET
      totp_enabled_at = NOW(),
      totp_last_step = ${step},
      totp_recovery_hashes = ${hashes as unknown as string}
    WHERE id::text = ${userId} AND totp_enabled_at IS NULL
  `;
  return { recoveryCodes };
}

/** Schaltet die Zwei-Faktor-Anmeldung ab (eigenes Konto ohne Pflicht oder Reset durch Superadmin). */
export async function clearTwoFactor(userId: string): Promise<void> {
  await sql`
    UPDATE users SET totp_secret_enc = NULL, totp_enabled_at = NULL, totp_last_step = NULL, totp_recovery_hashes = NULL
    WHERE id::text = ${userId}
  `;
}
