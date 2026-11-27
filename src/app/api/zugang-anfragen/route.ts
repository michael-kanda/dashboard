// src/app/api/zugang-anfragen/route.ts
// Formular „Zugang anfragen“ der Landingpage: prüfen, speichern, per E-Mail weiterleiten.
import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { sql } from '@vercel/postgres';
import * as Brevo from '@getbrevo/brevo';
import { accessRequestSchema, MIN_FILL_MS, type AccessRequest } from '@/lib/access-request';
import { readClientIp } from '@/lib/login-throttle';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const RECIPIENT = process.env.ACCESS_REQUEST_EMAIL || 'michael@designare.at';
const SENDER = process.env.BREVO_SYSTEM_EMAIL || 'status@datapeak.at';
const MAX_PER_IP_PER_HOUR = 3;
const MAX_PER_DAY = 50;

function hashIp(ip: string | null) {
  if (!ip) return null;
  const salt = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || 'datapeak';
  return crypto.createHash('sha256').update(`${salt}:${ip}`).digest('hex');
}

/** true = zu viele Anfragen. Ist die Tabelle nicht erreichbar, wird nicht blockiert. */
async function isRateLimited(ipHash: string | null) {
  try {
    const { rows } = await sql<{ by_ip: number; total: number }>`
      SELECT
        COUNT(*) FILTER (WHERE ip_hash = ${ipHash} AND created_at > NOW() - INTERVAL '1 hour')::int AS by_ip,
        COUNT(*)::int AS total
      FROM access_requests
      WHERE created_at > NOW() - INTERVAL '1 day'
    `;
    return (ipHash !== null && (rows[0]?.by_ip ?? 0) >= MAX_PER_IP_PER_HOUR) || (rows[0]?.total ?? 0) >= MAX_PER_DAY;
  } catch (error) {
    logger.warn('[Zugangsanfrage] Begrenzung nicht prüfbar', error);
    return false;
  }
}

async function store(request: AccessRequest, ipHash: string | null): Promise<number | null> {
  try {
    const { rows } = await sql<{ id: number }>`
      INSERT INTO access_requests (name, company, email, website, message, ip_hash)
      VALUES (${request.name}, ${request.company ?? null}, ${request.email}, ${request.website ?? null}, ${request.message ?? null}, ${ipHash})
      RETURNING id
    `;
    await sql`DELETE FROM access_requests WHERE created_at < NOW() - INTERVAL '180 days'`;
    return rows[0]?.id ?? null;
  } catch (error) {
    logger.warn('[Zugangsanfrage] Speichern fehlgeschlagen', error);
    return null;
  }
}

async function sendMail(request: AccessRequest): Promise<boolean> {
  if (!process.env.BREVO_API_KEY) {
    logger.warn('[Zugangsanfrage] BREVO_API_KEY fehlt, keine E-Mail');
    return false;
  }
  const api = new Brevo.TransactionalEmailsApi();
  api.setApiKey(Brevo.TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY);

  const lines = [
    'Neue Zugangsanfrage über www.datapeak.at',
    '',
    `Name: ${request.name}`,
    `Firma: ${request.company ?? '–'}`,
    `E-Mail: ${request.email}`,
    `Website: ${request.website ?? '–'}`,
    '',
    'Nachricht:',
    request.message ?? '–',
    '',
    'Antworten Sie direkt auf diese E-Mail, um der anfragenden Person zu schreiben.',
  ];

  const mail = new Brevo.SendSmtpEmail();
  mail.sender = { email: SENDER, name: 'DataPeak Website' };
  mail.to = [{ email: RECIPIENT }];
  mail.replyTo = { email: request.email, name: request.name };
  mail.subject = `Zugangsanfrage: ${request.company || request.name}`.slice(0, 150);
  mail.textContent = lines.join('\n');

  try {
    await api.sendTransacEmail(mail);
    return true;
  } catch (error) {
    console.error('[Zugangsanfrage] E-Mail fehlgeschlagen:', error);
    return false;
  }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = accessRequestSchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors = Object.fromEntries(
      parsed.error.issues.map((issue) => [String(issue.path[0] ?? 'form'), issue.message]),
    );
    // Honeypot oder zu schnell: wie Erfolg antworten, damit Bots nichts lernen.
    if (fieldErrors.fax) return NextResponse.json({ ok: true });
    return NextResponse.json({ message: 'Bitte prüfen Sie Ihre Angaben.', fieldErrors }, { status: 400 });
  }
  const request = parsed.data;
  if (Date.now() - request.openedAt < MIN_FILL_MS) return NextResponse.json({ ok: true });

  const ipHash = hashIp(readClientIp(req));
  if (await isRateLimited(ipHash)) {
    return NextResponse.json(
      { message: `Gerade sind zu viele Anfragen eingegangen. Bitte versuchen Sie es später oder schreiben Sie an ${RECIPIENT}.` },
      { status: 429 },
    );
  }

  const id = await store(request, ipHash);
  const mailSent = await sendMail(request);
  if (id !== null && mailSent) {
    await sql`UPDATE access_requests SET mail_sent = TRUE WHERE id = ${id}`.catch(() => undefined);
  }

  if (id === null && !mailSent) {
    return NextResponse.json(
      { message: `Die Anfrage konnte gerade nicht gesendet werden. Bitte schreiben Sie an ${RECIPIENT}.` },
      { status: 500 },
    );
  }
  logger.info(`[Zugangsanfrage] Eingegangen (gespeichert: ${id !== null}, E-Mail: ${mailSent})`);
  return NextResponse.json({ ok: true });
}
