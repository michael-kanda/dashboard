import { sql } from '@vercel/postgres';

export const LOGIN_LOCK_MINUTES = 15;
const MAX_FAILURES_PER_EMAIL = 5;
const MAX_FAILURES_PER_IP = 30;

// Fehlt die Tabelle (Migration 007 noch nicht ausgeführt), bleibt der Login möglich.
function warn(action: string, error: unknown) {
  console.warn(`[Login Throttle] ${action} fehlgeschlagen:`, error instanceof Error ? error.message : error);
}

export function readClientIp(request?: Request): string | null {
  const forwarded = request?.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || null;
}

export async function isLoginLocked(email: string, ip: string | null): Promise<boolean> {
  try {
    const { rows } = await sql<{ by_email: number; by_ip: number }>`
      SELECT
        COUNT(*) FILTER (WHERE email = ${email})::int AS by_email,
        COUNT(*) FILTER (WHERE ip = ${ip})::int AS by_ip
      FROM login_attempts
      WHERE attempted_at > NOW() - (${LOGIN_LOCK_MINUTES} * INTERVAL '1 minute')
        AND (email = ${email} OR ip = ${ip})
    `;
    return (rows[0]?.by_email ?? 0) >= MAX_FAILURES_PER_EMAIL
      || (rows[0]?.by_ip ?? 0) >= MAX_FAILURES_PER_IP;
  } catch (error) {
    warn('Prüfung', error);
    return false;
  }
}

export async function recordLoginFailure(email: string, ip: string | null) {
  try {
    await sql`INSERT INTO login_attempts (email, ip) VALUES (${email}, ${ip})`;
    await sql`DELETE FROM login_attempts WHERE attempted_at < NOW() - INTERVAL '1 day'`;
  } catch (error) {
    warn('Protokoll', error);
  }
}

export async function clearLoginFailures(email: string) {
  try {
    await sql`DELETE FROM login_attempts WHERE email = ${email}`;
  } catch (error) {
    warn('Zurücksetzen', error);
  }
}
