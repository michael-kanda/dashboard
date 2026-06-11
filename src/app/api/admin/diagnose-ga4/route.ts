import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { sql } from '@vercel/postgres';
import { google } from 'googleapis';
import { JWT } from 'google-auth-library';
import { buildAiTrafficDimensionFilter } from '@/lib/ai-sources';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

type DiagnoseSuite = 'core' | 'all';

interface DiagnoseArgs {
  property: string;
  start: string;
  end: string;
  timeout: number;
  limit: string;
  suite: DiagnoseSuite;
  projectId?: string;
  projectLabel?: string;
  reports?: string[];
}

function createAuth(): JWT {
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
    throw new Error('Google Credentials fehlen.');
  }

  return new JWT({
    email: clientEmail,
    key: Buffer.from(privateKeyBase64, 'base64').toString('utf8'),
    scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
  });
}

function clampNumber(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function defaultDateRange() {
  const end = new Date();
  end.setDate(end.getDate() - 1);
  const start = new Date(end);
  start.setDate(start.getDate() - 90);
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  };
}

function summarizeBody(body: any) {
  return {
    dimensions: (body.dimensions || []).map((dimension: any) => dimension.name),
    metrics: (body.metrics || []).map((metric: any) => metric.name),
    hasFilter: Boolean(body.dimensionFilter),
    limit: body.limit,
  };
}

function classifyError(error: unknown) {
  const err = error as any;
  const message = (
    err?.cause?.message ||
    err?.response?.data?.error?.message ||
    err?.message ||
    String(error)
  );
  const lower = message.toLowerCase();
  const status = err?.status || err?.code || err?.response?.status || null;
  const aborted =
    lower.includes('aborted') ||
    err?.error?.type === 'aborted' ||
    err?.cause?.type === 'aborted' ||
    err?.config?.signal?.aborted === true;

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

function reportDefinitions(args: Pick<DiagnoseArgs, 'start' | 'end' | 'limit'>) {
  const dateRanges = [{ startDate: args.start, endDate: args.end }];
  const aiSourceFilter = buildAiTrafficDimensionFilter();
  const qualityMetrics = [
    { name: 'sessions' },
    { name: 'totalUsers' },
    { name: 'averageSessionDuration' },
    { name: 'bounceRate' },
    { name: 'conversions' },
    { name: 'screenPageViewsPerSession' },
    { name: 'engagementRate' },
  ];

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
      purpose: 'Dashboard-Basisdaten: Date-Trend mit nur Sessions + Users',
      body: {
        dateRanges,
        dimensions: [{ name: 'date' }],
        metrics: [{ name: 'sessions' }, { name: 'totalUsers' }],
        orderBys: [{ dimension: { dimensionName: 'date' } }],
      },
    },
    {
      id: 'basis-totals-no-dimension',
      purpose: 'Dashboard-Basisdaten: 7 Metriken ohne Date-Dimension',
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
      purpose: 'KI-Traffic V2 Hauptreport wie Produktion',
      body: {
        dateRanges,
        dimensions: [{ name: 'sessionSource' }, { name: 'landingPagePlusQueryString' }],
        metrics: qualityMetrics,
        dimensionFilter: aiSourceFilter,
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: args.limit,
      },
    },
    {
      id: 'ai-main-lite',
      purpose: 'KI-Traffic V2 Hauptreport: gleiche Dimensionen, nur Sessions + Users',
      body: {
        dateRanges,
        dimensions: [{ name: 'sessionSource' }, { name: 'landingPagePlusQueryString' }],
        metrics: [{ name: 'sessions' }, { name: 'totalUsers' }],
        dimensionFilter: aiSourceFilter,
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: args.limit,
      },
    },
    {
      id: 'ai-source-only-full',
      purpose: 'KI-Traffic: nur sessionSource mit 7 Metriken',
      body: {
        dateRanges,
        dimensions: [{ name: 'sessionSource' }],
        metrics: qualityMetrics,
        dimensionFilter: aiSourceFilter,
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: args.limit,
      },
    },
    {
      id: 'ai-landingpage-only-full',
      purpose: 'KI-Traffic: nur landingPagePlusQueryString mit 7 Metriken',
      body: {
        dateRanges,
        dimensions: [{ name: 'landingPagePlusQueryString' }],
        metrics: qualityMetrics,
        dimensionFilter: aiSourceFilter,
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: args.limit,
      },
    },
    {
      id: 'ai-source-date',
      purpose: 'KI-Traffic Trend: date + sessionSource',
      body: {
        dateRanges,
        dimensions: [{ name: 'date' }, { name: 'sessionSource' }],
        metrics: [{ name: 'sessions' }, { name: 'totalUsers' }],
        dimensionFilter: aiSourceFilter,
        orderBys: [{ dimension: { dimensionName: 'date' } }],
        limit: '10000',
      },
    },
  ];
}

function buildDiagnosis(results: any[]) {
  const byId = new Map(results.map((result) => [result.id, result]));
  const fail = (id: string) => byId.get(id)?.ok === false;
  const pass = (id: string) => byId.get(id)?.ok === true;
  const lines: string[] = [];

  if (fail('basis-date-full') && pass('basis-date-lite')) {
    lines.push('Basisdaten: Date-Report kippt durch viele Metriken. Trend und Qualitätsmetriken trennen.');
  }
  if (fail('basis-date-full') && pass('basis-totals-no-dimension')) {
    lines.push('Basisdaten: Date-Dimension ist der Kostentreiber. Trend stärker cachen oder in kleinere Zeiträume splitten.');
  }
  if (fail('ai-main-exact') && pass('ai-main-lite')) {
    lines.push('KI-Traffic: 7 Metriken + Source/Landingpage sind zu schwer. Hauptreport schlanker machen und Qualitätsmetriken optional nachladen.');
  }
  if (fail('ai-main-exact') && pass('ai-source-only-full') && fail('ai-landingpage-only-full')) {
    lines.push('KI-Traffic: landingPagePlusQueryString ist der Kardinalitäts-Treiber. Landingpage-Report separat, mit kleinerem Limit oder Cache laden.');
  }
  if (fail('ai-main-exact') && pass('ai-source-only-full') && pass('ai-landingpage-only-full')) {
    lines.push('KI-Traffic: Erst Source + Landingpage zusammen kippt. Dimensionen trennen.');
  }
  if (results.some((result) => result.errorType === 'quota')) {
    lines.push('Quota: Mindestens ein Report lief in GA4-Quota. Keine parallelen Wiederholungen starten, Cooldown/Cache verwenden.');
  }
  if (results.every((result) => result.ok === false)) {
    lines.push('Alle Reports schlagen fehl. Das spricht eher für Auth, Property-Zugriff oder globale GA4-Quota.');
  }

  return lines.length ? lines : ['Kein eindeutiger Musterbruch erkannt. Einzelzeiten und Fehlertypen prüfen.'];
}

async function resolveArgs(request: NextRequest): Promise<DiagnoseArgs> {
  const searchParams = request.nextUrl.searchParams;
  const defaults = defaultDateRange();
  const projectId = searchParams.get('projectId') || undefined;
  let property = searchParams.get('property') || '';
  let projectLabel = '';

  if (projectId) {
    const { rows } = await sql`
      SELECT id::text, email, domain, ga4_property_id
      FROM users
      WHERE id = ${projectId}::uuid
      LIMIT 1
    `;
    const project = rows[0];
    if (!project) throw new Error(`Projekt nicht gefunden: ${projectId}`);
    if (!project.ga4_property_id) throw new Error(`Projekt hat keine GA4 Property ID: ${project.domain || project.email}`);
    property = project.ga4_property_id;
    projectLabel = project.domain || project.email || project.id;
  }

  if (!property) {
    throw new Error('Parameter fehlt: projectId oder property');
  }

  return {
    projectId,
    projectLabel,
    property: property.startsWith('properties/') ? property : `properties/${property}`,
    start: searchParams.get('start') || defaults.start,
    end: searchParams.get('end') || defaults.end,
    timeout: clampNumber(searchParams.get('timeout'), 55_000, 5_000, 90_000),
    limit: String(clampNumber(searchParams.get('limit'), 1000, 10, 10000)),
    suite: searchParams.get('suite') === 'all' ? 'all' : 'core',
    reports: searchParams.get('reports')?.split(',').map((item) => item.trim()).filter(Boolean),
  };
}

async function runReport(analytics: any, property: string, report: any, timeout: number) {
  const startedAt = Date.now();
  const summary = summarizeBody(report.body);

  try {
    const response = await analytics.properties.runReport(
      { property, requestBody: report.body },
      {
        timeout,
        retryConfig: {
          retry: 0,
          httpMethodsToRetry: ['POST'],
          statusCodesToRetry: [],
          noResponseRetries: 0,
        },
      } as any
    );
    return {
      id: report.id,
      purpose: report.purpose,
      ok: true,
      durationMs: Date.now() - startedAt,
      rowCount: response.data.rows?.length || 0,
      summary,
    };
  } catch (error) {
    const classified = classifyError(error);
    return {
      id: report.id,
      purpose: report.purpose,
      ok: false,
      durationMs: Date.now() - startedAt,
      errorType: classified.type,
      status: classified.status,
      message: classified.message,
      summary,
    };
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (session?.user?.role !== 'SUPERADMIN') {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    const args = await resolveArgs(request);
    const authClient = createAuth();
    const analytics = google.analyticsdata({ version: 'v1beta', auth: authClient });
    const allReports = reportDefinitions(args);
    let reports = args.suite === 'all'
      ? allReports
      : allReports.filter((report) => report.id !== 'ai-source-date');
    if (args.reports?.length) {
      const wanted = new Set(args.reports);
      reports = reports.filter((report) => wanted.has(report.id));
    }
    if (reports.length === 0) {
      return NextResponse.json(
        {
          message: 'Keine Diagnose-Reports ausgewählt.',
          availableReports: allReports.map((report) => report.id),
        },
        { status: 400 }
      );
    }

    const startedAt = Date.now();
    const results = [];
    for (const report of reports) {
      results.push(await runReport(analytics, args.property, report, args.timeout));
    }

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      args: {
        ...args,
        property: args.property.replace(/^properties\//, ''),
      },
      reportCount: reports.length,
      diagnosis: buildDiagnosis(results),
      results,
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'GA4 Diagnose fehlgeschlagen' },
      { status: 500 }
    );
  }
}
