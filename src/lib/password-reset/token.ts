// Einmal-Token für „Passwort vergessen?“. Ohne Datenbank und ohne @/-Importe,
// damit die Tests die Regeln direkt prüfen können.
import { createHash, createHmac, randomBytes } from 'node:crypto';

export const RESET_TOKEN_TTL_MINUTES = 60;
const TOKEN_BYTES = 32;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export interface ResetToken {
  /** Steht nur im Link der E-Mail. */
  token: string;
  /** Wird gespeichert. */
  hash: string;
  expiresAt: Date;
}

export function hashResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function createResetToken(now: Date = new Date()): ResetToken {
  const token = randomBytes(TOKEN_BYTES).toString('base64url');
  return {
    token,
    hash: hashResetToken(token),
    expiresAt: new Date(now.getTime() + RESET_TOKEN_TTL_MINUTES * 60_000),
  };
}

/** Grobe Formprüfung, bevor die Datenbank gefragt wird. */
export function looksLikeResetToken(value: unknown): value is string {
  return typeof value === 'string' && TOKEN_PATTERN.test(value);
}

export function isResetTokenUsable(
  record: { expires_at: Date | string; used_at: Date | string | null } | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!record || record.used_at) return false;
  return new Date(record.expires_at).getTime() > now.getTime();
}

/**
 * Hash für E-Mail-Adressen und IPs in der Begrenzungstabelle. Mit Schlüssel, damit
 * sich gespeicherte Adressen nicht durch Durchprobieren bekannter Adressen zuordnen lassen.
 */
export function hashThrottleKey(value: string | null, secret: string): string | null {
  if (!value) return null;
  return createHmac('sha256', secret).update(value).digest('hex');
}

/** Link aus der E-Mail. Der Token steht hinter #, damit er nicht in Server-Logs oder im Referer landet. */
export function resetLinkFor(baseUrl: string, token: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/login/neues-passwort#token=${token}`;
}
