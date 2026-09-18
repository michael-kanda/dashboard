import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { auth } from '@/lib/auth';
import { DashboardSourceError, trySyncDashboardProjectSnapshot } from '@/lib/sync/dashboard';
import { isDashboardSnapshotStale } from '@/lib/sync/cache-policy';
import { isDashboardSnapshotCompatible } from '@/lib/sync/dashboard-snapshot-contract';
import {
  claimProjectSyncJob,
  deferProjectSyncJob,
  enqueueProjectSyncJob,
  finishProjectSyncJob,
  PERMANENT_FAILURE_COOLDOWN_HOURS,
  TRANSIENT_FAILURE_COOLDOWN_HOURS,
  type ProjectSyncFailureKind,
} from '@/lib/sync/job-queue';
import { classifyGoogleApiError } from '@/lib/sync/google-api-error';
import type { ProjectDashboardData } from '@/lib/dashboard-shared';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 300;

const DATE_RANGES = new Set(['7d', '30d', '3m', '6m', '12m', '18m', '24m']);

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({}, { status: 401 });
  if (session.user.id !== id && !['ADMIN', 'SUPERADMIN'].includes(session.user.role)) {
    return NextResponse.json({}, { status: 403 });
  }
  const dateRange = request.nextUrl.searchParams.get('dateRange') ?? '';
  if (!DATE_RANGES.has(dateRange)) return NextResponse.json({}, { status: 400 });
  const { rows } = await sql`
    SELECT status, run_after, lease_until, failure_kind, updated_at,
      EXISTS (
        SELECT 1 FROM google_data_cache cache
        WHERE cache.user_id = ${id}::uuid
          AND cache.date_range = ${dateRange}
          AND cache.data IS NOT NULL
      ) AS has_snapshot
    FROM project_sync_jobs
    WHERE user_id = ${id}::uuid AND job_type = 'dashboard' AND date_range = ${dateRange}
  `;
  const job = rows[0];
  const running = job?.status === 'running' && new Date(job.lease_until).getTime() > Date.now();
  const failed = job?.status === 'failed';
  const cooldownHours = job?.failure_kind === 'permanent'
    ? PERMANENT_FAILURE_COOLDOWN_HOURS
    : TRANSIENT_FAILURE_COOLDOWN_HOURS;
  return NextResponse.json({
    status: running ? 'running' : failed ? 'failed' : job?.status === 'completed' && job.has_snapshot ? 'ready' : 'scheduled',
    nextAttemptAt: failed
      ? new Date(new Date(job.updated_at).getTime() + cooldownHours * 3_600_000).toISOString()
      : job?.run_after ?? null,
  }, { headers: { 'Cache-Control': 'no-store' } });
}

function classifyJobFailure(error: unknown): ProjectSyncFailureKind {
  if (error instanceof DashboardSourceError) return error.kind;
  return classifyGoogleApiError(error).kind === 'permanent' ? 'permanent' : 'transient';
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
  }
  const isAdmin = session.user.role === 'ADMIN' || session.user.role === 'SUPERADMIN';
  if (!isAdmin && session.user.id !== id) {
    return NextResponse.json({ message: 'Zugriff verweigert' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const dateRange = typeof body.dateRange === 'string' ? body.dateRange : '';
  if (!DATE_RANGES.has(dateRange)) {
    return NextResponse.json({ message: 'Ungültiger Zeitraum' }, { status: 400 });
  }

  const { rows: cacheRows } = await sql`
    SELECT cache.data, cache.last_fetched, users.google_ads_sheet_id
    FROM users
    LEFT JOIN google_data_cache cache
      ON cache.user_id = users.id
      AND cache.date_range = ${dateRange}
    WHERE users.id = ${id}::uuid
    LIMIT 1
  `;
  if (cacheRows.length === 0) {
    return NextResponse.json({ message: 'Projekt nicht gefunden' }, { status: 404 });
  }

  const cachedData = cacheRows[0]?.data as ProjectDashboardData | null | undefined;
  const lastFetchedAt = cacheRows[0]?.last_fetched
    ? String(cacheRows[0].last_fetched)
    : null;
  const configuredSheetId = cacheRows[0]?.google_ads_sheet_id
    ? String(cacheRows[0].google_ads_sheet_id)
    : null;
  const cacheIsFresh = Boolean(cachedData)
    && isDashboardSnapshotCompatible(cachedData, configuredSheetId)
    && !isDashboardSnapshotStale(dateRange, lastFetchedAt);

  if (cacheIsFresh) {
    return NextResponse.json({
      success: true,
      pending: false,
      fromCache: true,
    }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  await enqueueProjectSyncJob({
    userId: id,
    jobType: 'dashboard',
    dateRange,
    payload: { dateRange },
    priority: 100,
    restartFailed: false,
    preservePending: true,
  });
  const job = await claimProjectSyncJob(id, 'dashboard', dateRange);
  if (!job) {
    return NextResponse.json({
      success: false,
      pending: true,
      status: 'busy',
    }, {
      status: 202,
      headers: { 'Retry-After': '4', 'Cache-Control': 'no-store' },
    });
  }

  try {
    const result = await trySyncDashboardProjectSnapshot(id, dateRange, { deadlineAt: Date.now() + 220_000 });
    if (!result.acquired) {
      await deferProjectSyncJob(job, 30, 'Dashboard-Quelle wird bereits aktualisiert');
      return NextResponse.json({
        success: false,
        pending: true,
        status: 'busy',
      }, {
        status: 202,
        headers: { 'Retry-After': '4', 'Cache-Control': 'no-store' },
      });
    }
    await finishProjectSyncJob(job, { success: true });
    return NextResponse.json({ success: true, pending: false }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await finishProjectSyncJob(job, {
      success: false,
      error: message,
      kind: classifyJobFailure(error),
    });
    return NextResponse.json({ success: false, pending: true, message }, { status: 502 });
  }
}
