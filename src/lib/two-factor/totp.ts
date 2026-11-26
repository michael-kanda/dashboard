// TOTP nach RFC 6238 (HMAC-SHA1, 30 Sekunden, 6 Ziffern), kompatibel mit
// Google Authenticator, Microsoft Authenticator, 1Password und ähnlichen Apps.

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export const TOTP_PERIOD_SECONDS = 30;
const DIGITS = 6;
/** Toleranz für Uhrabweichungen: ein Schritt davor und danach. */
const WINDOW = 1;

export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[\s=-]/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of clean) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index < 0) throw new Error('Ungültiges Base32-Zeichen');
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** Neues Geheimnis (160 Bit, wie von RFC 4226 empfohlen) als Base32. */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

export function currentStep(now = Date.now()): number {
  return Math.floor(now / 1000 / TOTP_PERIOD_SECONDS);
}

export function totpCode(secretBase32: string, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const hmac = createHmac('sha1', base32Decode(secretBase32)).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary = ((hmac[offset] & 0x7f) << 24)
    | (hmac[offset + 1] << 16)
    | (hmac[offset + 2] << 8)
    | hmac[offset + 3];
  return String(binary % 10 ** DIGITS).padStart(DIGITS, '0');
}

export function normalizeTotpInput(code: string): string {
  return code.replace(/\s/g, '');
}

/**
 * Prüft einen Code. Liefert den Schritt, zu dem er passt, oder null.
 * Ein Schritt <= lastStep gilt als bereits benutzt (Schutz gegen Wiederverwendung).
 */
export function verifyTotp(
  secretBase32: string,
  input: string,
  options: { now?: number; lastStep?: number | null } = {},
): number | null {
  const code = normalizeTotpInput(input);
  if (!/^\d{6}$/.test(code)) return null;
  const step = currentStep(options.now);
  for (let offset = -WINDOW; offset <= WINDOW; offset++) {
    const candidate = step + offset;
    if (options.lastStep != null && candidate <= options.lastStep) continue;
    const expected = totpCode(secretBase32, candidate);
    if (timingSafeEqual(Buffer.from(expected), Buffer.from(code))) return candidate;
  }
  return null;
}

/** otpauth-URI für den QR-Code der Authenticator-App. */
export function totpUri(secretBase32: string, accountEmail: string, issuer = 'DataPeak'): string {
  const label = encodeURIComponent(`${issuer}:${accountEmail}`);
  const params = new URLSearchParams({
    secret: secretBase32,
    issuer,
    algorithm: 'SHA1',
    digits: String(DIGITS),
    period: String(TOTP_PERIOD_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}
