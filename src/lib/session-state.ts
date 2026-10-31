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
}

// null: Benutzer existiert nicht mehr. undefined: Datenbank nicht erreichbar.
export async function loadSessionState(userId: string): Promise<SessionState | null | undefined> {
  try {
    const { rows } = await sql`
      SELECT role, mandant_id, permissions, password
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
    };
  } catch (error) {
    console.warn('[Session] Auffrischen fehlgeschlagen:', error instanceof Error ? error.message : error);
    return undefined;
  }
}
