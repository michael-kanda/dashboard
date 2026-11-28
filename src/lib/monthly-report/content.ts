// src/lib/monthly-report/content.ts
// Inhalt des Monatsberichts: Kennzahlen aus dem 30-Tage-Snapshot, Betreff, HTML und Text.
// Ohne Datenbank und ohne @/-Importe, damit die Tests die Ausgabe direkt prüfen können.
import type { ProjectDashboardData } from '../dashboard-shared';

export interface ReportMetric {
  label: string;
  value: string;
  /** Veränderung zur Vorperiode in Prozent, null wenn nicht berechenbar. */
  change: number | null;
  /** Quelle für die Fußnote (GSC, GA4, Vercel). */
  source: string;
}

const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

/** Berichteter Monat: der Vormonat des Versanddatums, als 'YYYY-MM' und lesbar. */
export function reportPeriod(now: Date): { key: string; label: string; lastDay: string } {
  const year = now.getUTCMonth() === 0 ? now.getUTCFullYear() - 1 : now.getUTCFullYear();
  const month = now.getUTCMonth() === 0 ? 12 : now.getUTCMonth();
  const lastDay = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  return { key: `${year}-${String(month).padStart(2, '0')}`, label: `${MONTHS[month - 1]} ${year}`, lastDay };
}

const number = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });
const percent = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 });

function finiteOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** Die wichtigsten Kennzahlen, nur solche mit Wert. */
export function buildReportMetrics(data: ProjectDashboardData): ReportMetric[] {
  const kpis = data.kpis ?? {};
  const visitorsSource = data.analyticsSource === 'vercel' ? 'Vercel' : 'GA4';
  const rows: Array<ReportMetric | null> = [
    kpis.clicks ? { label: 'Klicks aus der Google-Suche', value: number.format(kpis.clicks.value), change: finiteOrNull(kpis.clicks.change), source: 'GSC' } : null,
    kpis.impressions ? { label: 'Impressionen in der Google-Suche', value: number.format(kpis.impressions.value), change: finiteOrNull(kpis.impressions.change), source: 'GSC' } : null,
    kpis.totalUsers ? { label: 'Besucher', value: number.format(kpis.totalUsers.value), change: finiteOrNull(kpis.totalUsers.change), source: visitorsSource } : null,
    kpis.conversions && kpis.conversions.value > 0 ? { label: 'Conversions', value: number.format(kpis.conversions.value), change: finiteOrNull(kpis.conversions.change), source: 'GA4' } : null,
    data.aiTraffic && data.aiTraffic.totalSessions > 0
      ? { label: 'Besuche über KI-Assistenten', value: number.format(data.aiTraffic.totalSessions), change: finiteOrNull(data.aiTraffic.totalSessionsChange), source: 'GA4' }
      : null,
  ];
  return rows.filter((row): row is ReportMetric => row !== null);
}

export function formatChange(change: number | null): string {
  if (change === null) return 'kein Vergleich';
  if (Math.abs(change) < 0.05) return '±0 %';
  return `${change > 0 ? '+' : '−'}${percent.format(Math.abs(change))} %`;
}

function formatDate(iso: string | undefined): string | null {
  if (!iso) return null;
  const [y, m, d] = iso.slice(0, 10).split('-');
  return y && m && d ? `${d}.${m}.${y}` : null;
}

export function reportWindowLabel(data: ProjectDashboardData): string {
  const from = formatDate(data.reportingPeriod?.from);
  const to = formatDate(data.reportingPeriod?.to);
  return from && to ? `${from} bis ${to}` : 'letzte 30 Tage';
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export interface ReportEmailInput {
  domain: string;
  periodLabel: string;
  windowLabel: string;
  metrics: ReportMetric[];
  summary: string | null;
  reportUrl: string;
  unsubscribeUrl: string;
  isTest?: boolean;
}

export function buildReportEmail(input: ReportEmailInput): { subject: string; html: string; text: string } {
  const subject = `${input.isTest ? '[Test] ' : ''}DataPeak Monatsbericht ${input.periodLabel} · ${input.domain}`;

  const textLines = [
    `Monatsbericht ${input.periodLabel} für ${input.domain}`,
    `Zeitraum: ${input.windowLabel}, Vergleich mit den 30 Tagen davor`,
    '',
    ...input.metrics.map((m) => `${m.label}: ${m.value} (${formatChange(m.change)})`),
    '',
    ...(input.summary ? ['Kurz erklärt von DataMax:', input.summary, ''] : []),
    `Vollständiger Bericht (nach Anmeldung): ${input.reportUrl}`,
    '',
    `Keine Monatsberichte mehr erhalten: ${input.unsubscribeUrl}`,
  ];

  const metricRows = input.metrics.map((m) => {
    const color = m.change === null || Math.abs(m.change) < 0.05 ? '#6e6e73' : m.change > 0 ? '#1a7f37' : '#c62828';
    return `<tr>
      <td style="padding:10px 0;border-bottom:1px solid #e5e5ea;font-size:14px;color:#3a3a3c">${escapeHtml(m.label)}<br><span style="font-size:11px;color:#8e8e93">${escapeHtml(m.source)}</span></td>
      <td style="padding:10px 0;border-bottom:1px solid #e5e5ea;font-size:18px;font-weight:600;color:#1d1d1f;text-align:right;white-space:nowrap">${escapeHtml(m.value)}</td>
      <td style="padding:10px 0 10px 12px;border-bottom:1px solid #e5e5ea;font-size:13px;color:${color};text-align:right;white-space:nowrap">${escapeHtml(formatChange(m.change))}</td>
    </tr>`;
  }).join('');

  const summaryBlock = input.summary
    ? `<p style="margin:24px 0 6px;font-size:12px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:#0066CC">Kurz erklärt von DataMax</p>
       <p style="margin:0;font-size:14px;line-height:1.55;color:#3a3a3c">${escapeHtml(input.summary).replace(/\n+/g, '<br>')}</p>`
    : '';

  const html = `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f7;padding:24px 12px"><tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px;padding:28px">
      <tr><td>
        <p style="margin:0;font-size:13px;font-weight:600;color:#0066CC">DataPeak</p>
        <h1 style="margin:6px 0 4px;font-size:22px;line-height:1.25;color:#1d1d1f">Monatsbericht ${escapeHtml(input.periodLabel)}</h1>
        <p style="margin:0 0 20px;font-size:14px;color:#6e6e73">${escapeHtml(input.domain)} · ${escapeHtml(input.windowLabel)}, verglichen mit den 30 Tagen davor</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${metricRows}</table>
        ${summaryBlock}
        <p style="margin:28px 0 0"><a href="${escapeHtml(input.reportUrl)}" style="display:inline-block;background:#0066CC;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:11px 18px;border-radius:10px">Vollständigen Bericht ansehen</a></p>
        <p style="margin:8px 0 0;font-size:12px;color:#8e8e93">Der Bericht öffnet sich nach der Anmeldung in DataPeak.</p>
      </td></tr>
    </table>
    <p style="max-width:560px;margin:16px auto 0;font-size:11px;line-height:1.5;color:#8e8e93">Sie erhalten diese E-Mail, weil für ${escapeHtml(input.domain)} der Monatsbericht eingeschaltet ist. <a href="${escapeHtml(input.unsubscribeUrl)}" style="color:#8e8e93">Keine Monatsberichte mehr erhalten</a></p>
  </td></tr></table>
</body></html>`;

  return { subject, html, text: textLines.join('\n') };
}

/** Kompakte Kennzahlen für den KI-Prompt (nur Zahlen, keine Personendaten). */
export function metricsForPrompt(domain: string, windowLabel: string, metrics: ReportMetric[]): string {
  return [
    `Website: ${domain}`,
    `Zeitraum: ${windowLabel}, verglichen mit den 30 Tagen davor`,
    ...metrics.map((m) => `- ${m.label}: ${m.value} (${formatChange(m.change)}, Quelle ${m.source})`),
  ].join('\n');
}
