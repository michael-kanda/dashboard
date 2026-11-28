// src/lib/monthly-report/token.ts
// Abmeldelink des Monatsberichts. Die E-Mail-Adresse steht nicht im Link (sonst landet sie in
// Server-Logs), sondern nur ihr HMAC; eine Signatur mit AUTH_SECRET verhindert, dass jemand
// fremde Empfänger abmeldet. Gespeichert wird ebenfalls nur der HMAC (monthly_report_optouts).
import { createHmac, timingSafeEqual } from 'node:crypto';

function secret(): string {
  return process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || 'datapeak';
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function hashRecipient(email: string, key = secret()): string {
  return createHmac('sha256', key).update(`monthly-report-recipient:${normalizeEmail(email)}`).digest('hex');
}

export function signOptOut(projectId: string, recipientHash: string, key = secret()): string {
  return createHmac('sha256', key).update(`monthly-report-optout:${projectId}:${recipientHash}`).digest('base64url');
}

export function verifyOptOut(projectId: string, recipientHash: string, signature: string, key = secret()): boolean {
  if (!/^[0-9a-f]{64}$/.test(recipientHash)) return false;
  const expected = Buffer.from(signOptOut(projectId, recipientHash, key));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** Link zur Abmeldeseite: Projekt, HMAC der Adresse, Signatur. */
export function optOutUrl(baseUrl: string, projectId: string, email: string, key = secret()): string {
  const recipientHash = hashRecipient(email, key);
  const url = new URL('/monatsbericht/abmelden', baseUrl);
  url.searchParams.set('p', projectId);
  url.searchParams.set('r', recipientHash);
  url.searchParams.set('s', signOptOut(projectId, recipientHash, key));
  return url.toString();
}
