// src/lib/monthly-report/service.ts
// Versand des Monatsberichts: Kennzahlen aus dem 30-Tage-Snapshot, kurze Erklärung von DataMax,
// je Empfänger eine eigene E-Mail (eigener Abmeldelink). Der Cron läuft am 1. stündlich; jeder
// Monat wird pro Projekt nur einmal versendet (monthly_report_runs).
import * as Brevo from '@getbrevo/brevo';
import { generateText } from 'ai';
import { sql } from '@vercel/postgres';
import { google, getAiModels } from '@/lib/ai-config';
import { loadProjectPageData } from '@/lib/project-page-data';
import { APP_ORIGIN } from '@/lib/site-hosts';
import { logger } from '@/lib/logger';
import type { ProjectDashboardData } from '@/lib/dashboard-shared';
import {
  buildReportEmail,
  buildReportMetrics,
  metricsForPrompt,
  reportPeriod,
  reportWindowLabel,
} from './content';
import { hashRecipient, normalizeEmail, optOutUrl } from './token';

const SENDER = process.env.BREVO_SYSTEM_EMAIL || 'status@datapeak.at';
const SUMMARY_TIMEOUT_MS = 20_000;

const SUMMARY_INSTRUCTIONS = `Du bist DataMax, der KI-Assistent von DataPeak. Schreibe für die Inhaberin oder den Inhaber
der Website eine kurze Einordnung des Monats in 3 bis 4 Sätzen auf Deutsch, in der Sie-Form, ohne Fachjargon.
Nenne, was gut lief, und worauf man achten sollte. Nutze nur die angegebenen Zahlen, erfinde nichts und
nenne keine Ursachen als Tatsache. Keine Aufzählung, keine Überschrift, kein Markdown.`;

/** Basis-URL für Links: Produktion app.datapeak.at, Previews ihre eigene Adresse. */
export function reportBaseUrl(): string {
  if (process.env.VERCEL_ENV === 'production') return APP_ORIGIN;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return process.env.NODE_ENV === 'production' ? APP_ORIGIN : 'http://localhost:3000';
}

async function writeSummary(prompt: string): Promise<string | null> {
  const { primary, fallback } = await getAiModels();
  for (const model of primary === fallback ? [primary] : [primary, fallback]) {
    try {
      const { text } = await generateText({
        model: google(model),
        instructions: SUMMARY_INSTRUCTIONS,
        prompt,
        temperature: 0.4,
        maxOutputTokens: 400,
        abortSignal: AbortSignal.timeout(SUMMARY_TIMEOUT_MS),
      });
      const cleaned = text.replace(/[*#_`]/g, '').trim();
      if (cleaned) return cleaned;
    } catch (error) {
      console.warn(`[Monatsbericht] KI-Zusammenfassung mit ${model} fehlgeschlagen:`, error instanceof Error ? error.message : error);
    }
  }
  return null;
}

async function sendMail(to: string, mail: { subject: string; html: string; text: string }, unsubscribeUrl: string): Promise<void> {
  if (!process.env.BREVO_API_KEY) throw new Error('BREVO_API_KEY fehlt');
  const api = new Brevo.TransactionalEmailsApi();
  api.setApiKey(Brevo.TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY);
  const message = new Brevo.SendSmtpEmail();
  message.sender = { email: SENDER, name: 'DataPeak' };
  message.to = [{ email: to }];
  message.subject = mail.subject;
  message.htmlContent = mail.html;
  message.textContent = mail.text;
  // Abmelden mit einem Klick im Mailprogramm (RFC 8058)
  message.headers = { 'List-Unsubscribe': `<${unsubscribeUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' };
  await api.sendTransacEmail(message);
}

interface PreparedReport {
  domain: string;
  data: ProjectDashboardData;
  recipients: string[];
  projectEmail: string;
}

async function prepare(projectId: string): Promise<PreparedReport | null> {
  const loaded = await loadProjectPageData(projectId, '30d');
  if (!loaded?.dashboardData) return null;
  const { projectUser } = loaded;
  const admins = String((projectUser as { assigned_admins?: string | null }).assigned_admins ?? '')
    .split(',').map((email) => email.trim()).filter(Boolean);
  const projectEmail = normalizeEmail(projectUser.email);
  const recipients = Array.from(new Set([projectEmail, ...admins.map(normalizeEmail)]));
  return { domain: projectUser.domain || projectEmail, data: loaded.dashboardData, recipients, projectEmail };
}

async function optedOut(projectId: string): Promise<Set<string>> {
  const { rows } = await sql<{ email_hash: string }>`
    SELECT email_hash FROM monthly_report_optouts WHERE project_id = ${projectId}::uuid
  `;
  return new Set(rows.map((row) => row.email_hash));
}

async function composeAndSend(projectId: string, report: PreparedReport, recipients: string[], periodLabel: string, isTest = false) {
  const metrics = buildReportMetrics(report.data);
  const windowLabel = reportWindowLabel(report.data);
  const summary = metrics.length > 0 ? await writeSummary(metricsForPrompt(report.domain, windowLabel, metrics)) : null;
  const baseUrl = reportBaseUrl();
  const reportUrl = new URL(`/projekt/${projectId}?range=30d`, baseUrl).toString();
  let sent = 0;
  const errors: string[] = [];
  for (const email of recipients) {
    const unsubscribeUrl = optOutUrl(baseUrl, projectId, email);
    const mail = buildReportEmail({ domain: report.domain, periodLabel, windowLabel, metrics, summary, reportUrl, unsubscribeUrl, isTest });
    try {
      await sendMail(email, mail, unsubscribeUrl);
      sent += 1;
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }
  return { sent, errors };
}

/** Testbericht nur an die angegebene Adresse (Admin), ohne Eintrag im Versandprotokoll. */
export async function sendTestReport(projectId: string, toEmail: string, now = new Date()) {
  const report = await prepare(projectId);
  if (!report) return { ok: false as const, message: 'Für dieses Projekt liegt noch kein 30-Tage-Snapshot vor.' };
  const { sent, errors } = await composeAndSend(projectId, report, [normalizeEmail(toEmail)], reportPeriod(now).label, true);
  return sent > 0 ? { ok: true as const } : { ok: false as const, message: errors[0] ?? 'Versand fehlgeschlagen' };
}

/**
 * Monatslauf. finalAttempt: letzter Lauf des Tages; dann wird auch mit älterem Snapshot
 * versendet bzw. „keine Daten“ vermerkt, statt auf den nächsten Lauf zu warten.
 */
export async function runMonthlyReports({ now = new Date(), finalAttempt = false, deadlineAt = Date.now() + 240_000 } = {}) {
  const period = reportPeriod(now);
  const { rows: projects } = await sql<{ id: string }>`
    SELECT u.id::text AS id
    FROM users u
    WHERE u.monthly_report_enabled = TRUE
      AND u.role = 'BENUTZER'
      AND COALESCE(u.is_demo, FALSE) = FALSE
      AND NOT EXISTS (
        SELECT 1 FROM monthly_report_runs r WHERE r.project_id = u.id AND r.period = ${period.key}
      )
    ORDER BY u.domain NULLS LAST
  `;

  const summary = { period: period.key, due: projects.length, sent: 0, waiting: 0, noData: 0, failed: 0 };
  for (const { id } of projects) {
    if (Date.now() > deadlineAt) break;
    try {
      const report = await prepare(id);
      const snapshotEnd = report?.data.reportingPeriod?.to?.slice(0, 10);
      const fresh = Boolean(snapshotEnd && snapshotEnd >= period.lastDay);
      if (!report || (!fresh && !finalAttempt)) {
        if (finalAttempt) {
          await sql`INSERT INTO monthly_report_runs (project_id, period, status) VALUES (${id}::uuid, ${period.key}, 'no_data') ON CONFLICT DO NOTHING`;
          summary.noData += 1;
        } else {
          summary.waiting += 1;
        }
        continue;
      }

      // Erst den Monat beanspruchen, dann senden: Ein paralleler Lauf versendet so nicht doppelt.
      const claim = await sql`
        INSERT INTO monthly_report_runs (project_id, period, status) VALUES (${id}::uuid, ${period.key}, 'sent')
        ON CONFLICT DO NOTHING RETURNING project_id
      `;
      if (claim.rowCount === 0) continue;

      const blocked = await optedOut(id);
      const recipients = report.recipients.filter((email) => !blocked.has(hashRecipient(email)));
      if (recipients.length === 0) {
        await sql`UPDATE monthly_report_runs SET status = 'no_recipients' WHERE project_id = ${id}::uuid AND period = ${period.key}`;
        continue;
      }

      const { sent, errors } = await composeAndSend(id, report, recipients, period.label);
      const status = sent > 0 ? 'sent' : 'failed';
      await sql`
        UPDATE monthly_report_runs
        SET status = ${status}, recipient_count = ${sent}, error = ${errors.length ? errors.join(' | ').slice(0, 500) : null}
        WHERE project_id = ${id}::uuid AND period = ${period.key}
      `;
      if (status === 'sent') summary.sent += 1; else summary.failed += 1;
    } catch (error) {
      summary.failed += 1;
      console.error(`[Monatsbericht] Projekt ${id} fehlgeschlagen:`, error);
    }
  }
  logger.info('[Monatsbericht] Lauf beendet', summary);
  return summary;
}

/** Abmeldung eines Empfängers (HMAC der Adresse) für ein Projekt. */
export async function recordOptOut(projectId: string, recipientHash: string) {
  await sql`
    INSERT INTO monthly_report_optouts (project_id, email_hash) VALUES (${projectId}::uuid, ${recipientHash})
    ON CONFLICT DO NOTHING
  `;
}
