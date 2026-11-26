// Verschlüsselung des TOTP-Geheimnisses in der Datenbank (AES-256-GCM).
// Der Schlüssel wird per HKDF aus NEXTAUTH_SECRET abgeleitet, damit kein
// zusätzliches Geheimnis verwaltet werden muss. Wird NEXTAUTH_SECRET
// gewechselt, müssen alle Nutzer die Zwei-Faktor-Anmeldung neu einrichten.

import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';

const VERSION = 'v1';

function deriveKey(secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET): Buffer {
  if (!secret) throw new Error('NEXTAUTH_SECRET fehlt: TOTP-Geheimnisse können nicht verschlüsselt werden');
  return Buffer.from(hkdfSync('sha256', secret, 'datapeak-two-factor', 'totp-secret-v1', 32));
}

export function sealSecret(plain: string, secret?: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', deriveKey(secret), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString('base64url'), tag.toString('base64url'), ciphertext.toString('base64url')].join(':');
}

export function openSecret(sealed: string, secret?: string): string {
  const [version, iv, tag, ciphertext] = sealed.split(':');
  if (version !== VERSION || !iv || !tag || !ciphertext) throw new Error('Unbekanntes Format des TOTP-Geheimnisses');
  const decipher = createDecipheriv('aes-256-gcm', deriveKey(secret), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64url')), decipher.final()]).toString('utf8');
}
