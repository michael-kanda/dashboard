// Ablauf „Passwort vergessen?“ ohne Datenbank- und Mail-Anbindung: die Route reicht
// die echten Funktionen herein, die Tests Attrappen. Die Antwort ist in jedem Fall gleich,
// damit sich nicht prüfen lässt, welche Adressen ein Konto haben.

export const RESET_REQUEST_WINDOW_MINUTES = 60;
export const MAX_RESET_REQUESTS_PER_EMAIL = 3;
export const MAX_RESET_REQUESTS_PER_IP = 10;
/** Kürzeste Antwortzeit, damit der Mailversand die Antwortzeit nicht verlängert, nur weil ein Konto existiert. */
export const MIN_RESET_RESPONSE_MS = 1200;

export const RESET_REQUEST_RESPONSE = {
  ok: true,
  message:
    'Wenn zu dieser Adresse ein Konto besteht, haben wir eine E-Mail mit einem Link geschickt. Der Link ist 60 Minuten gültig. Bitte prüfen Sie auch den Spam-Ordner.',
} as const;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeResetEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  return email.length <= 254 && EMAIL_PATTERN.test(email) ? email : null;
}

export interface ResetRequestCounts {
  byEmail: number;
  byIp: number;
}

export function isResetRequestThrottled(counts: ResetRequestCounts): boolean {
  return counts.byEmail >= MAX_RESET_REQUESTS_PER_EMAIL || counts.byIp >= MAX_RESET_REQUESTS_PER_IP;
}

export interface ResetRequestDeps {
  countRecentRequests(email: string, ip: string | null): Promise<ResetRequestCounts>;
  recordRequest(email: string, ip: string | null): Promise<void>;
  findUser(email: string): Promise<{ id: string; email: string } | null>;
  /** Speichert den Hash eines neuen Tokens und liefert den Link für die E-Mail. */
  issueLink(userId: string): Promise<string>;
  sendMail(email: string, link: string): Promise<boolean>;
  log(outcome: ResetRequestOutcome, userId?: string): void;
}

export type ResetRequestOutcome = 'invalid' | 'throttled' | 'unknown' | 'sent' | 'mail_failed';

/** Führt die Anfrage aus und meldet intern, was passiert ist. Nach außen geht immer RESET_REQUEST_RESPONSE. */
export async function requestPasswordReset(
  rawEmail: unknown,
  ip: string | null,
  deps: ResetRequestDeps,
): Promise<ResetRequestOutcome> {
  const email = normalizeResetEmail(rawEmail);
  if (!email) {
    deps.log('invalid');
    return 'invalid';
  }

  if (isResetRequestThrottled(await deps.countRecentRequests(email, ip))) {
    deps.log('throttled');
    return 'throttled';
  }
  await deps.recordRequest(email, ip);

  const user = await deps.findUser(email);
  if (!user) {
    deps.log('unknown');
    return 'unknown';
  }

  const link = await deps.issueLink(user.id);
  const sent = await deps.sendMail(user.email, link);
  const outcome = sent ? 'sent' : 'mail_failed';
  deps.log(outcome, user.id);
  return outcome;
}

export interface ResetResponse {
  status: number;
  body: { ok?: boolean; message: string };
}

/**
 * Antwort der Route. Gleich für bekannte und unbekannte Adressen, für begrenzte Anfragen
 * und für Fehler beim Speichern oder Versenden; nur eine ungültige Eingabe bekommt 400.
 */
export async function respondToResetRequest(
  rawEmail: unknown,
  ip: string | null,
  deps: ResetRequestDeps,
  { minMs = MIN_RESET_RESPONSE_MS, onError }: { minMs?: number; onError?: (error: unknown) => void } = {},
): Promise<ResetResponse> {
  const startedAt = Date.now();
  let outcome: ResetRequestOutcome | 'error';
  try {
    outcome = await requestPasswordReset(rawEmail, ip, deps);
  } catch (error) {
    onError?.(error);
    outcome = 'error';
  }
  if (outcome === 'invalid') {
    return { status: 400, body: { message: 'Bitte eine gültige E-Mail-Adresse eingeben.' } };
  }
  await padResponseTime(startedAt, minMs);
  return { status: 200, body: { ...RESET_REQUEST_RESPONSE } };
}

/** Wartet, bis seit `startedAt` mindestens `minMs` vergangen sind. */
export async function padResponseTime(startedAt: number, minMs = MIN_RESET_RESPONSE_MS, now = Date.now) {
  const remaining = minMs - (now() - startedAt);
  if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
}
