import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { syncDashboardProjectSnapshot } from '@/lib/sync/dashboard';
import {
  claimProjectSyncJob,
  enqueueProjectSyncJob,
  finishProjectSyncJob,
  getProjectSyncJob,
} from '@/lib/sync/job-queue';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 300;

const DATE_RANGES = new Set(['30d', '3m', '6m', '12m', '18m', '24m']);

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

  await enqueueProjectSyncJob({
    userId: id,
    jobType: 'dashboard',
    dateRange,
    payload: { dateRange, reason: 'interactive-dashboard-request' },
    priority: 200,
  });

  const job = await claimProjectSyncJob(id, 'dashboard', dateRange);
  if (!job) {
    const existing = await getProjectSyncJob(id, 'dashboard', dateRange);
    return NextResponse.json({
      success: false,
      pending: true,
      status: existing?.status ?? 'pending',
    }, { status: 202 });
  }

  try {
    await syncDashboardProjectSnapshot(id, dateRange);
    await finishProjectSyncJob(job, { success: true });
    return NextResponse.json({ success: true, pending: false }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await finishProjectSyncJob(job, { success: false, error: message });
    return NextResponse.json({ success: false, pending: true, message }, { status: 502 });
  }
}
