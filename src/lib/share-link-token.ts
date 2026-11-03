// Token für Gastlinks: zufällig, URL-tauglich; in der Datenbank liegt nur der SHA-256-Hash.
import { createHash, randomBytes } from 'node:crypto';

export const SHARE_LINK_TTL_HOURS = 24;
export const GUEST_ROLE = 'GAST';

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function createShareToken(): string {
  return randomBytes(32).toString('base64url');
}

export function isShareTokenFormat(token: string): boolean {
  return TOKEN_PATTERN.test(token);
}

export function hashShareToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
