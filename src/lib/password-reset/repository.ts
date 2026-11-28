// Datenbankzugriffe für Passwort ändern und zurücksetzen (Migration 017).
import { sql } from '@vercel/postgres';
import { hashThrottleKey, RESET_TOKEN_TTL_MINUTES } from '@/lib/password-reset/token';
import { RESET_REQUEST_WINDOW_MINUTES, type ResetRequestCounts } from '@/lib/password-reset/request';
import { logger } from '@/lib/logger';

export type AccountEvent = 'password_changed' | 'password_reset' | 'password_reset_requested';

function throttleSecret() {
  return process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || 'datapeak';
}

const keyFor = (value: string | null) => hashThrottleKey(value, throttleSecret());

// Ist die Tabelle nicht erreichbar, wird nicht blockiert: Der Ablauf scheitert dann ohnehin beim Token.
export async function countRecentResetRequests(email: string, ip: string | null): Promise<ResetRequestCounts> {
  try {
    const { rows } = await sql<{ by_email: number; by_ip: number }>`
      SELECT
        COUNT(*) FILTER (WHERE email_hash = ${keyFor(email)})::int AS by_email,
        COUNT(*) FILTER (WHERE ip_hash = ${keyFor(ip)})::int AS by_ip
      FROM password_reset_requests
      WHERE requested_at > NOW() - (${RESET_REQUEST_WINDOW_MINUTES} * INTERVAL '1 minute')
    `;
    return { byEmail: rows[0]?.by_email ?? 0, byIp: rows[0]?.by_ip ?? 0 };
  } catch (error) {
    logger.warn('[Passwort] Begrenzung nicht prüfbar', error);
    return { byEmail: 0, byIp: 0 };
  }
}

export async function recordResetRequest(email: string, ip: string | null) {
  try {
    await sql`INSERT INTO password_reset_requests (email_hash, ip_hash) VALUES (${keyFor(email)}, ${keyFor(ip)})`;
    await sql`DELETE FROM password_reset_requests WHERE requested_at < NOW() - INTERVAL '1 day'`;
  } catch (error) {
    logger.warn('[Passwort] Anfrage nicht protokolliert', error);
  }
}

export async function findUserByEmail(email: string): Promise<{ id: string; email: string; role: string } | null> {
  const { rows } = await sql<{ id: string; email: string; role: string }>`
    SELECT id::text AS id, email, role FROM users WHERE email = ${email} LIMIT 1
  `;
  return rows[0] ?? null;
}

/** Speichert einen neuen Token-Hash. Ältere, noch offene Links derselben Person verfallen damit. */
export async function storeResetToken(userId: string, tokenHash: string, expiresAt: Date) {
  await sql`
    UPDATE password_reset_tokens SET used_at = NOW()
    WHERE user_id = ${userId}::uuid AND used_at IS NULL
  `;
  await sql`
    INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
    VALUES (${userId}::uuid, ${tokenHash}, ${expiresAt.toISOString()})
  `;
  await sql`
    DELETE FROM password_reset_tokens
    WHERE created_at < NOW() - (${RESET_TOKEN_TTL_MINUTES} * INTERVAL '1 minute') - INTERVAL '1 day'
  `;
}

export async function findResetToken(tokenHash: string) {
  const { rows } = await sql<{ expires_at: string; used_at: string | null }>`
    SELECT expires_at, used_at FROM password_reset_tokens WHERE token_hash = ${tokenHash} LIMIT 1
  `;
  return rows[0] ?? null;
}

/**
 * Löst den Token ein und setzt das Passwort in einer Anweisung. Ein zweiter Aufruf mit
 * demselben Token findet nichts mehr. Die Zwei-Faktor-Spalten bleiben unberührt.
 */
export async function consumeResetToken(tokenHash: string, passwordHash: string) {
  const { rows } = await sql<{ id: string; email: string; role: string }>`
    WITH consumed AS (
      UPDATE password_reset_tokens SET used_at = NOW()
      WHERE token_hash = ${tokenHash} AND used_at IS NULL AND expires_at > NOW()
      RETURNING user_id
    )
    UPDATE users SET password = ${passwordHash}
    FROM consumed
    WHERE users.id = consumed.user_id
    RETURNING users.id::text AS id, users.email, users.role
  `;
  return rows[0] ?? null;
}

/** Offene Links verfallen, sobald das Passwort auf anderem Weg geändert wurde. */
export async function revokeResetTokens(userId: string) {
  try {
    await sql`
      UPDATE password_reset_tokens SET used_at = NOW()
      WHERE user_id = ${userId}::uuid AND used_at IS NULL
    `;
  } catch (error) {
    logger.warn('[Passwort] Offene Links nicht widerrufen', error);
  }
}

/** Eintrag im Login-Protokoll, ohne Passwort und ohne Token. */
export async function recordAccountEvent(user: { id: string; email: string; role?: string | null }, event: AccountEvent) {
  try {
    await sql`
      INSERT INTO login_logs (user_id, user_email, user_role, event)
      VALUES (${user.id}::uuid, ${user.email}, ${user.role ?? null}, ${event})
    `;
  } catch (error) {
    console.error('[Passwort] Protokoll fehlgeschlagen (nicht fatal):', error);
  }
}
