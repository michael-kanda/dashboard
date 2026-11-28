import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildReportEmail,
  buildReportMetrics,
  formatChange,
  metricsForPrompt,
  reportPeriod,
  reportWindowLabel,
} from '../../src/lib/monthly-report/content.ts';
import { hashRecipient, optOutUrl, verifyOptOut } from '../../src/lib/monthly-report/token.ts';
import type { ProjectDashboardData } from '../../src/lib/dashboard-shared.ts';

const data = {
  reportingPeriod: { from: '2026-11-01', to: '2026-11-30' },
  kpis: {
    clicks: { value: 1848, change: 14.7 },
    impressions: { value: 48210, change: 22.4 },
    totalUsers: { value: 2474, change: -3.2 },
    conversions: { value: 0, change: 0 },
  },
  aiTraffic: { totalSessions: 312, totalSessionsChange: 41 },
} as unknown as ProjectDashboardData;

test('Berichtsmonat ist der Vormonat, auch über den Jahreswechsel', () => {
  assert.deepEqual(reportPeriod(new Date('2026-12-01T07:15:00Z')), { key: '2026-11', label: 'November 2026', lastDay: '2026-11-30' });
  assert.deepEqual(reportPeriod(new Date('2027-01-01T07:15:00Z')), { key: '2026-12', label: 'Dezember 2026', lastDay: '2026-12-31' });
  assert.equal(reportPeriod(new Date('2027-03-01T06:15:00Z')).lastDay, '2027-02-28');
});

test('Kennzahlen: nur vorhandene, Conversions erst ab 1, deutsche Zahlen', () => {
  const metrics = buildReportMetrics(data);
  assert.deepEqual(metrics.map((m) => m.label), [
    'Klicks aus der Google-Suche',
    'Impressionen in der Google-Suche',
    'Besucher',
    'Besuche über KI-Assistenten',
  ]);
  assert.equal(metrics[1].value, '48.210');
  assert.equal(formatChange(14.7), '+14,7 %');
  assert.equal(formatChange(-3.2), '−3,2 %');
  assert.equal(formatChange(0.01), '±0 %');
  assert.equal(formatChange(null), 'kein Vergleich');
  assert.equal(reportWindowLabel(data), '01.11.2026 bis 30.11.2026');
});

test('E-Mail: Betreff, Abmeldelink, Zusammenfassung, HTML ist maskiert', () => {
  const mail = buildReportEmail({
    domain: 'kanzlei-<demo>.at',
    periodLabel: 'November 2026',
    windowLabel: '01.11.2026 bis 30.11.2026',
    metrics: buildReportMetrics(data),
    summary: 'Gute Entwicklung.',
    reportUrl: 'https://app.datapeak.at/projekt/x?range=30d',
    unsubscribeUrl: 'https://app.datapeak.at/monatsbericht/abmelden?p=1',
  });
  assert.equal(mail.subject, 'DataPeak Monatsbericht November 2026 · kanzlei-<demo>.at');
  assert.ok(mail.html.includes('kanzlei-&lt;demo&gt;.at'));
  assert.ok(!mail.html.includes('kanzlei-<demo>'));
  assert.ok(mail.html.includes('Kurz erklärt von DataMax'));
  assert.ok(mail.text.includes('Keine Monatsberichte mehr erhalten: https://app.datapeak.at/monatsbericht/abmelden?p=1'));
  assert.ok(mail.text.includes('Klicks aus der Google-Suche: 1.848 (+14,7 %)'));
});

test('KI-Prompt enthält nur Zahlen und Domain', () => {
  const prompt = metricsForPrompt('kanzlei-demo.at', 'letzte 30 Tage', buildReportMetrics(data));
  assert.ok(prompt.startsWith('Website: kanzlei-demo.at'));
  assert.ok(!prompt.includes('@'));
});

test('Abmeldelink: ohne E-Mail im Link, Signatur gebunden an Projekt und Empfänger', () => {
  const projectId = '11111111-2222-3333-4444-555555555555';
  const url = new URL(optOutUrl('https://app.datapeak.at', projectId, 'Kunde@Example.at', 'geheim'));
  assert.ok(!url.toString().toLowerCase().includes('kunde'));
  const r = url.searchParams.get('r') ?? '';
  const s = url.searchParams.get('s') ?? '';
  assert.equal(r, hashRecipient('kunde@example.at', 'geheim'));
  assert.equal(verifyOptOut(projectId, r, s, 'geheim'), true);
  assert.equal(verifyOptOut('99999999-2222-3333-4444-555555555555', r, s, 'geheim'), false);
  assert.equal(verifyOptOut(projectId, hashRecipient('andere@example.at', 'geheim'), s, 'geheim'), false);
  assert.equal(verifyOptOut(projectId, r, s, 'anderes-geheimnis'), false);
  assert.equal(verifyOptOut(projectId, 'kein-hash', s, 'geheim'), false);
});
