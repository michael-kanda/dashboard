import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  getProjectIndexingProgress,
  getProjectIndexingStatus,
} from '@/lib/indexing-status';
import {
  claimProjectSyncJob,
  enqueueProjectSyncJob,
  finishProjectSyncJob,
  getProjectSyncJob,
} from '@/lib/sync/job-queue';
import { syncIndexingProjectSnapshot } from '@/lib/sync/indexing';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 60;

const MANUAL_SYNC_DEADLINE_MS = 45_000;
const MANUAL_MAX_INSPECTIONS = 24;

async function authorize(projectId: string, write = false) {
  const session = await auth();
  if (!session?.user) return { error: 'Nicht autorisiert', status: 401 };
  const role = session.user.role;
  const isAdmin = role === 'ADMIN' || role === 'SUPERADMIN';
  if (write && !isAdmin) return { error: 'Nur Admins dürfen einen Abgleich starten.', status: 403 };
  if (!isAdmin && session.user.id !== projectId) {
    return { error: 'Zugriff verweigert', status: 403 };
  }
  return { session };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const permission = await authorize(id);
  if ('error' in permission) {
    return NextResponse.json({ message: permission.error }, { status: permission.status });
  }
  if (request.nextUrl.searchParams.get('progress') === '1') {
    try {
      const [progress, queuedJob] = await Promise.all([
        getProjectIndexingProgress(id),
        getProjectSyncJob(id, 'indexing'),
      ]);
      const queued = queuedJob?.status === 'pending' || queuedJob?.status === 'running';
      return NextResponse.json(queued ? {
        ...progress,
        status: 'running',
        progressStage: queuedJob?.status === 'pending' ? 'idle' : progress.progressStage,
      } : progress, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      });
    } catch {
      return NextResponse.json({ message: 'Fortschritt noch nicht verfügbar' }, { status: 503 });
    }
  }
  return NextResponse.json(await getProjectIndexingStatus(id));
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const permission = await authorize(id, true);
  if ('error' in permission) {
    return NextResponse.json({ message: permission.error }, { status: permission.status });
  }

  try {
    await enqueueProjectSyncJob({
      userId: id,
      jobType: 'indexing',
      priority: 100,
      payload: { force: true },
    });

    const job = await claimProjectSyncJob(id, 'indexing');
    if (!job) {
      const current = await getProjectIndexingStatus(id);
      return NextResponse.json({
        ...current,
        status: 'running',
        progressStage: current.progressStage === 'error' ? 'idle' : current.progressStage,
      }, { status: 202 });
    }

    try {
      const result = await syncIndexingProjectSnapshot(id, {
        force: true,
        maxInspections: MANUAL_MAX_INSPECTIONS,
        deadlineAt: Date.now() + MANUAL_SYNC_DEADLINE_MS,
      });
      await finishProjectSyncJob(job, { success: true });
      return NextResponse.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Indexierungsabgleich fehlgeschlagen';
      await finishProjectSyncJob(job, { success: false, error: message });
      return NextResponse.json({ message }, { status: 502 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Indexierungsabgleich konnte nicht eingereiht werden';
    return NextResponse.json({ message }, { status: 502 });
  }
}
