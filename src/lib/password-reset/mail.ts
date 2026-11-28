// E-Mail mit dem Link zum Zurücksetzen, über Brevo wie die Zugangsanfragen.
import * as Brevo from '@getbrevo/brevo';
import { APP_ORIGIN } from '@/lib/site-hosts';
import { RESET_TOKEN_TTL_MINUTES } from '@/lib/password-reset/token';
import { logger } from '@/lib/logger';

const SENDER = process.env.BREVO_SYSTEM_EMAIL || 'status@datapeak.at';

/**
 * Adresse für den Link. Nie aus dem Host-Header der Anfrage, sonst ließe sich der Link
 * auf eine fremde Domain umbiegen. Produktion: app.datapeak.at, Previews: eigene Vercel-URL,
 * lokal: die Adresse des Entwicklungsservers.
 */
export function resetBaseUrl(requestUrl: string): string {
  if (process.env.VERCEL_ENV === 'production') return APP_ORIGIN;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  if (process.env.NODE_ENV === 'production') return APP_ORIGIN;
  return new URL(requestUrl).origin;
}

export async function sendResetMail(email: string, link: string): Promise<boolean> {
  if (!process.env.BREVO_API_KEY) {
    logger.warn('[Passwort] BREVO_API_KEY fehlt, keine E-Mail');
    return false;
  }
  const api = new Brevo.TransactionalEmailsApi();
  api.setApiKey(Brevo.TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY);

  const text = [
    'Guten Tag,',
    '',
    'für Ihr DataPeak-Konto wurde ein neues Passwort angefordert. Über diesen Link legen Sie es fest:',
    '',
    link,
    '',
    `Der Link ist ${RESET_TOKEN_TTL_MINUTES} Minuten gültig und funktioniert einmal. Danach werden alle Geräte abgemeldet.`,
    'Haben Sie die Zwei-Faktor-Anmeldung eingeschaltet, brauchen Sie beim nächsten Anmelden weiterhin den Code aus Ihrer App.',
    '',
    'Haben Sie das nicht angefordert, ignorieren Sie diese E-Mail. Ihr Passwort bleibt dann unverändert.',
    '',
    'DataPeak',
  ].join('\n');

  const mail = new Brevo.SendSmtpEmail();
  mail.sender = { email: SENDER, name: 'DataPeak' };
  mail.to = [{ email }];
  mail.subject = 'DataPeak: Neues Passwort festlegen';
  mail.textContent = text;

  try {
    await api.sendTransacEmail(mail);
    return true;
  } catch (error) {
    console.error('[Passwort] E-Mail fehlgeschlagen:', error instanceof Error ? error.message : error);
    return false;
  }
}
