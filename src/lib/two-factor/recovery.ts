// Wiederherstellungscodes: einmal nutzbar, falls das Handy mit der
// Authenticator-App fehlt. Gespeichert werden nur SHA-256-Hashes.

import { createHash, randomBytes } from 'node:crypto';

// Ohne leicht verwechselbare Zeichen (0/O, 1/I/L).
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const RECOVERY_CODE_COUNT = 8;

function randomGroup(length: number): string {
  const bytes = randomBytes(length);
  return Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join('');
}

export function generateRecoveryCodes(count = RECOVERY_CODE_COUNT): string[] {
  return Array.from({ length: count }, () => `${randomGroup(5)}-${randomGroup(5)}`);
}

export function normalizeRecoveryCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function hashRecoveryCode(code: string): string {
  return createHash('sha256').update(normalizeRecoveryCode(code)).digest('hex');
}

/** Sieht die Eingabe wie ein Wiederherstellungscode aus (statt eines 6-stelligen TOTP-Codes)? */
export function looksLikeRecoveryCode(input: string): boolean {
  return normalizeRecoveryCode(input).length === 10;
}

/** Liefert die verbleibenden Hashes, wenn der Code passt, sonst null. */
export function consumeRecoveryCode(input: string, hashes: string[] | null | undefined): string[] | null {
  if (!hashes?.length) return null;
  const hash = hashRecoveryCode(input);
  const index = hashes.indexOf(hash);
  if (index < 0) return null;
  return hashes.filter((_, i) => i !== index);
}
