#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const AI_SOURCES = [
  'chatgpt.com', 'chat.openai.com', 'openai.com',
  'claude.ai', 'anthropic.com',
  'gemini.google.com', 'bard.google.com',
  'perplexity.ai',
  'bing.com/chat', 'copilot.microsoft.com',
  'you.com',
  'poe.com',
  'character.ai',
];

function loadDotEnv(fileName) {
  const filePath = path.join(repoRoot, fileName);
  if (!fs.existsSync(filePath)) return;

  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const key = match[1];
    if (process.env[key] !== undefined) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value.replace(/\\n/g, '\n');
  }
}

loadDotEnv('.env.local');
loadDotEnv('.env');

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {
    property: process.env.GA4_PROPERTY_ID || '337078709',
    start: '2026-03-12',
    end: '2026-06-10',
    timeout: 55_000,
    limit: '1000',
    suite: 'core',
    json: '',
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    const next = args[i + 1];
    if (arg === '--property' && next) { out.property = next; i += 1; }
    else if (arg === '--start' && next) { out.start = next; i += 1; }
    else if (arg === '--end' && next) { out.end = next; i += 1; }
    else if (arg === '--timeout' && next) { out.timeout = Number(next); i += 1; }
    else if (arg === '--limit' && next) { out.limit = next; i += 1; }
    else if (arg === '--suite' && next) { out.suite = next; i += 1; }
    else if (arg === '--json' && next) { out.json = next; i += 1; }
    else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  return out;
}

function printHelp() {
  console.log(`
GA4 Diagnose

Usage:
  npm run diagnose:ga4 -- --property 337078709 --start 2026-03-12 --end 2026-06-10

Options:
  --property <id>   GA4 Property ID, ohne "properties/" (Default: 337078709)
  --start <date>    Startdatum YYYY-MM-DD (Default: 2026-03-12)
  --end <date>      Enddatum YYYY-MM-DD (Default: 2026-06-10)
  --timeout <ms>    Timeout pro Report (Default: 55000)
  --limit <n>       Limit fuer KI-Reports (Default: 1000)
  --suite <core|all>
  --json <path>     Ergebnis zusätzlich als JSON schreiben
`);
}

function createAuth(JWT) {
  if (process.env.GOOGLE_CREDENTIALS) {
    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
    return new JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
    });
  }

  const privateKeyBase64 = process.env.GOOGLE_PRIVATE_KEY_BASE64;
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  if (!privateKeyBase64 || !clientEmail) {
    throw new Error(
      'Google Credentials fehlen. Setze GOOGLE_CREDENTIALS oder GOOGLE_PRIVATE_KEY_BASE64 + GOOGLE_SERVICE_ACCOUNT_EMAIL.'
    );
  }

  return new JWT({
    email: clientEmail,
    key: Buffer.from(privateKeyBase64, 'base64').toString('utf8'),
    scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
  });
}

function aiTrafficFilter() {
  return {
    orGroup: {
      expressions: [
        ...AI_SOURCES.map((source) => ({
          filter: {
            fieldName: 'sessionSource',
            stringFilter: {
              matchType: 'CONTAINS',
              value: source,
              caseSensitive: false,
            },
          },
        })),
        {
          filter: {
            fieldName: 'sessionDefaultChannelGroup',
            stringFilter: {
              matchType: 'EXACT',
              value: 'AI Assistant',
            },
          },
        },
      ],
    },
  };
}

function classifyError(error) {
  const message = (
    error?.cause?.message ||
    error?.response?.data?.error?.message ||
    error?.message ||
    String(error)
  );
  const lower = message.toLowerCase();
  const status = error?.status || error?.code || error?.response?.status || null;
  const aborted =
    lower.includes('aborted') ||
    error?.error?.type === 'aborted' ||
    error?.cause?.type === 'aborted' ||
    error?.config?.signal?.aborted === true;

  if (aborted) return { type: 'timeout-abort', status, message };
  if (status === 429 || lower.includes('quota') || lower.includes('resource_exhausted')) {
    return { type: 'quota', status, message };
  }
  if (status === 401 || status === 403 || lower.includes('permission')) {
    return { type: 'auth-permission', status, message };
  }
  if (status >= 500 || lower.includes('internal')) return { type: 'ga4-server', status, message };
  return { type: 'other', status, message };
}

function summarizeBody(body) {
  return {
    dimensions: (body.dimensions || []).map((d) => d.name),
    metrics: (body.metrics || []).map((m) => m.name),
    hasFilter: Boolean(body.dimensionFilter),
    limit: body.limit,
  };
}

function reportDefinitions({ start, end, limit }) {
  const dateRanges = [{ startDate: start, endDate: end }];
  const fullQualityMetrics = [
    { name: 'sessions' },
    { name: 'totalUsers' },
    { name: 'averageSessionDuration' },
    { name: 'bounceRate' },
    { name: 'conversions' },
    { name: 'screenPageViewsPerSession' },
    { name: 'engagementRate' },
  ];
  const aiFilter = aiTrafficFilter();

  return [
    {
      id: 'basis-date-full',
      purpose: 'Dashboard-Basisdaten: Date-Trend mit 7 Metriken',
      body: {
        dateRanges,
        dimensions: [{ name: 'date' }],
        metrics: [
          { name: 'sessions' },
          { name: 'totalUsers' },
          { name: 'newUsers' },
          { name: 'conversions' },
          { name: 'bounceRate' },
          { name: 'engagementRate' },
          { name: 'averageSessionDuration' },
        ],
        orderBys: [{ dimension: { dimensionName: 'date' } }],
      },
    },
    {
      id: 'basis-date-lite',
      purpose: 'Dashboard-Basisdaten: gleiche Dimension, nur 2 Metriken',
      body: {
        dateRanges,
        dimensions: [{ name: 'date' }],
        metrics: [{ name: 'sessions' }, { name: 'totalUsers' }],
        orderBys: [{ dimension: { dimensionName: 'date' } }],
      },
    },
    {
      id: 'basis-totals-no-dimension',
      purpose: 'Dashboard-Basisdaten: gleiche 7 Metriken ohne Date-Dimension',
      body: {
        dateRanges,
        metrics: [
          { name: 'sessions' },
          { name: 'totalUsers' },
          { name: 'newUsers' },
          { name: 'conversions' },
          { name: 'bounceRate' },
          { name: 'engagementRate' },
          { name: 'averageSessionDuration' },
        ],
      },
    },
    {
      id: 'ai-main-exact',
      purpose: 'KI-Traffic V2 Hauptreport wie Produktion: Source + Landingpage + 7 Metriken + AI-OR-Filter',
      body: {
        dateRanges,
        dimensions: [{ name: 'sessionSource' }, { name: 'landingPagePlusQueryString' }],
        metrics: fullQualityMetrics,
        dimensionFilter: aiFilter,
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit,
      },
    },
    {
      id: 'ai-main-lite',
      purpose: 'KI-Traffic V2 Hauptreport: gleiche Dimensionen/Filter, nur Sessions + Users',
      body: {
        dateRanges,
        dimensions: [{ name: 'sessionSource' }, { name: 'landingPagePlusQueryString' }],
        metrics: [{ name: 'sessions' }, { name: 'totalUsers' }],
        dimensionFilter: aiFilter,
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit,
      },
    },
    {
      id: 'ai-source-only-full',
      purpose: 'KI-Traffic: nur sessionSource mit 7 Metriken',
      body: {
        dateRanges,
        dimensions: [{ name: 'sessionSource' }],
        metrics: fullQualityMetrics,
        dimensionFilter: aiFilter,
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit,
      },
    },
    {
      id: 'ai-landingpage-only-full',
      purpose: 'KI-Traffic: nur landingPagePlusQueryString mit 7 Metriken',
      body: {
        dateRanges,
        dimensions: [{ name: 'landingPagePlusQueryString' }],
        metrics: fullQualityMetrics,
        dimensionFilter: aiFilter,
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit,
      },
    },
    {
      id: 'ai-source-date',
      purpose: 'KI-Traffic Trend: sessionSource + date',
      body: {
        dateRanges,
        dimensions: [{ name: 'date' }, { name: 'sessionSource' }],
        metrics: [{ name: 'sessions' }, { name: 'totalUsers' }],
        dimensionFilter: aiFilter,
        orderBys: [{ dimension: { dimensionName: 'date' } }],
        limit: '10000',
      },
    },
  ];
}

function buildDiagnosis(results) {
  const byId = new Map(results.map((r) => [r.id, r]));
  const fail = (id) => byId.get(id)?.ok === false;
  const pass = (id) => byId.get(id)?.ok === true;
  const lines = [];

  if (fail('basis-date-full') && pass('basis-date-lite')) {
    lines.push('Basisdaten: Date-Report ist vor allem durch die vielen Metriken schwer. Split in Trend + Qualitätsmetriken prüfen.');
  }
  if (fail('basis-date-full') && pass('basis-totals-no-dimension')) {
    lines.push('Basisdaten: Die date-Dimension ist der Kostentreiber. Trend separat kürzen/cachen.');
  }
  if (fail('ai-main-exact') && pass('ai-main-lite')) {
    lines.push('KI-Traffic: Die Kombination aus 7 Metriken + Source/Landingpage ist zu schwer. Hauptreport in schlanken Sessions/Users-Report plus optionale Qualitätsreports splitten.');
  }
  if (fail('ai-main-exact') && pass('ai-source-only-full') && fail('ai-landingpage-only-full')) {
    lines.push('KI-Traffic: landingPagePlusQueryString ist der Kardinalitäts-Treiber. Landingpage-Report separat/optional oder mit kleinerem Limit laden.');
  }
  if (fail('ai-main-exact') && pass('ai-source-only-full') && pass('ai-landingpage-only-full')) {
    lines.push('KI-Traffic: Erst die Kombination aus Source + Landingpage kippt. Dimensionen trennen.');
  }
  if (results.some((r) => r.errorType === 'quota')) {
    lines.push('Quota: Mindestens ein Report lief in GA4-Quota. Keine parallelen Wiederholungen starten; Cache/Cooldown nutzen.');
  }
  if (results.every((r) => r.ok === false)) {
    lines.push('Alle Reports schlagen fehl. Das spricht eher für Auth/Property/Quota als für einzelne Report-Komplexität.');
  }

  return lines.length ? lines : ['Kein eindeutiger Musterbruch erkannt. Siehe Einzelzeiten und Fehlertypen.'];
}

async function runReport(analytics, property, test, timeout) {
  const started = Date.now();
  const summary = summarizeBody(test.body);
  process.stdout.write(`\n[RUN] ${test.id}\n  ${test.purpose}\n  ${JSON.stringify(summary)}\n`);

  try {
    const response = await analytics.properties.runReport(
      { property, requestBody: test.body },
      {
        timeout,
        retryConfig: {
          retry: 0,
          httpMethodsToRetry: ['POST'],
          statusCodesToRetry: [],
          noResponseRetries: 0,
        },
      }
    );
    const durationMs = Date.now() - started;
    const rowCount = response.data.rows?.length || 0;
    console.log(`  OK ${durationMs}ms, rows=${rowCount}`);
    return {
      id: test.id,
      ok: true,
      durationMs,
      rowCount,
      summary,
    };
  } catch (error) {
    const durationMs = Date.now() - started;
    const classified = classifyError(error);
    console.log(`  FAIL ${durationMs}ms, type=${classified.type}, status=${classified.status ?? '-'}: ${classified.message}`);
    return {
      id: test.id,
      ok: false,
      durationMs,
      errorType: classified.type,
      status: classified.status,
      message: classified.message,
      summary,
      requestBody: test.body,
    };
  }
}

async function main() {
  const args = parseArgs();
  const [{ google }, { JWT }] = await Promise.all([
    import('googleapis'),
    import('google-auth-library'),
  ]);
  const property = args.property.startsWith('properties/') ? args.property : `properties/${args.property}`;
  const auth = createAuth(JWT);
  const analytics = google.analyticsdata({ version: 'v1beta', auth });
  const allReports = reportDefinitions(args);
  const reports = args.suite === 'all' ? allReports : allReports.filter((report) => report.id !== 'ai-source-date');

  console.log('GA4 Diagnose startet');
  console.log(JSON.stringify({
    property,
    start: args.start,
    end: args.end,
    timeout: args.timeout,
    limit: args.limit,
    suite: args.suite,
    reports: reports.map((report) => report.id),
  }, null, 2));

  const results = [];
  for (const report of reports) {
    results.push(await runReport(analytics, property, report, args.timeout));
  }

  const diagnosis = buildDiagnosis(results);
  console.log('\n=== DIAGNOSE ===');
  diagnosis.forEach((line) => console.log(`- ${line}`));

  const payload = {
    generatedAt: new Date().toISOString(),
    args,
    results,
    diagnosis,
  };

  if (args.json) {
    const outPath = path.isAbsolute(args.json) ? args.json : path.join(repoRoot, args.json);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));
    console.log(`\nJSON geschrieben: ${outPath}`);
  }

  const hasFailure = results.some((result) => !result.ok);
  process.exitCode = hasFailure ? 1 : 0;
}

main().catch((error) => {
  console.error('\nDiagnose konnte nicht gestartet werden:', error);
  process.exit(2);
});
