import { sql } from '@vercel/postgres';

// Kurzer Fingerabdruck des Passwort-Hashes: ändert sich das Passwort, enden bestehende Sitzungen.
// Web Crypto, weil die Funktion auch in der Middleware läuft.
export async function fingerprintPasswordHash(hash: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(hash));
  return Array.from(new Uint8Array(digest).slice(0, 8), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export interface SessionState {
  role: 'BENUTZER' | 'ADMIN' | 'SUPERADMIN';
  mandant_id: string | null;
  permissions: string[];
  passwordFingerprint: string;
  /** undefined, solange Migration 011 fehlt. */
  twoFactorEnabled: boolean | undefined;
}

// null: Benutzer existiert nicht mehr. undefined: Datenbank nicht erreichbar.
export async function loadSessionState(userId: string): Promise<SessionState | null | undefined> {
  try {
    const { rows } = await sql`
      SELECT role, mandant_id, permissions, password,
        -- to_jsonb bleibt auch ohne Spalte (Migration 011) gültig.
        to_jsonb(users) ? 'totp_enabled_at' AS two_factor_available,
        to_jsonb(users)->>'totp_enabled_at' AS totp_enabled_at
      FROM users
      WHERE id::text = ${userId}
      LIMIT 1
    `;
    const row = rows[0];
    if (!row) return null;
    return {
      role: row.role,
      mandant_id: row.mandant_id ?? null,
      permissions: row.permissions ?? [],
      passwordFingerprint: await fingerprintPasswordHash(String(row.password ?? '')),
      twoFactorEnabled: row.two_factor_available ? Boolean(row.totp_enabled_at) : undefined,
    };
  } catch (error) {
    console.warn('[Session] Auffrischen fehlgeschlagen:', error instanceof Error ? error.message : error);
    return undefined;
  }
}

// Nach einer Passwortänderung behält nur die Sitzung, die sie ausgelöst hat, ihre Gültigkeit:
// Die Route schickt über unstable_update diesen Nachweis mit. Er hängt vom neuen Fingerabdruck
// ab und lässt sich ohne AUTH_SECRET nicht erzeugen, ein update() aus dem Browser reicht also nicht.
function sessionSecret(): string | null {
  return process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || null;
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function createPasswordChangeProof(userId: string, passwordFingerprint: string, secret = sessionSecret()): Promise<string | null> {
  if (!secret) return null;
  return hmacHex(secret, `password-change:${userId}:${passwordFingerprint}`);
}

export async function isValidPasswordChangeProof(
  proof: unknown,
  userId: string,
  passwordFingerprint: string,
  secret = sessionSecret(),
): Promise<boolean> {
  if (typeof proof !== 'string' || !secret) return false;
  const expected = await createPasswordChangeProof(userId, passwordFingerprint, secret);
  if (!expected || expected.length !== proof.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) diff |= expected.charCodeAt(i) ^ proof.charCodeAt(i);
  return diff === 0;
}
