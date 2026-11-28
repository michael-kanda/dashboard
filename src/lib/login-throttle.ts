import { createHmac } from 'node:crypto';
import { sql } from '@vercel/postgres';

export const LOGIN_LOCK_MINUTES = 15;
const MAX_FAILURES_PER_EMAIL = 5;
const MAX_FAILURES_PER_IP = 30;

// Fehlt die Tabelle (Migration 007 noch nicht ausgeführt), bleibt der Login möglich.
function warn(action: string, error: unknown) {
  console.warn(`[Login Throttle] ${action} fehlgeschlagen:`, error instanceof Error ? error.message : error);
}

// E-Mail-Adresse und IP-Adresse werden nur als HMAC gespeichert (Spalten email/ip), wie bei
// den Anfragen zum Zurücksetzen des Passworts. Für die Sperre reicht der Vergleich der Hashwerte.
export function loginThrottleKey(value: string | null, secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || 'datapeak'): string | null {
  if (!value) return null;
  return createHmac('sha256', secret).update(`login:${value}`).digest('hex');
}

export function readClientIp(request?: Request): string | null {
  const forwarded = request?.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || null;
}

export async function isLoginLocked(rawEmail: string, rawIp: string | null): Promise<boolean> {
  const email = loginThrottleKey(rawEmail);
  const ip = loginThrottleKey(rawIp);
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

export async function recordLoginFailure(rawEmail: string, rawIp: string | null) {
  const email = loginThrottleKey(rawEmail);
  const ip = loginThrottleKey(rawIp);
  try {
    await sql`INSERT INTO login_attempts (email, ip) VALUES (${email}, ${ip})`;
    await sql`DELETE FROM login_attempts WHERE attempted_at < NOW() - INTERVAL '1 day'`;
  } catch (error) {
    warn('Protokoll', error);
  }
}

export async function clearLoginFailures(rawEmail: string) {
  const email = loginThrottleKey(rawEmail);
  try {
    await sql`DELETE FROM login_attempts WHERE email = ${email}`;
  } catch (error) {
    warn('Zurücksetzen', error);
  }
}
