import { NextRequest, NextResponse } from 'next/server';
import { trySyncDashboardProjectSnapshot } from '@/lib/sync/dashboard';
import { syncGscHistoryForProject } from '@/lib/sync/gsc-history';
import { syncIndexingProjectSnapshot } from '@/lib/sync/indexing';
import {
  claimNextProjectSyncJob,
  deferProjectSyncJob,
  finishProjectSyncJob,
  seedDueProjectSyncJobs,
  type ProjectSyncJob,
} from '@/lib/sync/job-queue';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const DISPATCH_DEADLINE_MS = 235_000;
const MAX_JOBS_PER_RUN = 6;

function isRetryableInfrastructureError(error: unknown) {
  const candidate = error as { message?: string; code?: string; ['neon:retryable']?: boolean };
  if (candidate?.['neon:retryable'] === true) return true;
  const message = `${candidate?.message ?? ''} ${candidate?.code ?? ''}`.toLowerCase();
  return [
    'control plane request failed',
    'connection terminated',
    'connection reset',
    'econnreset',
    'fetch failed',
    'temporarily unavailable',
    'timeout',
  ].some((fragment) => message.includes(fragment));
}

async function executeJob(job: ProjectSyncJob, deadlineAt: number): Promise<string | null> {
  switch (job.jobType) {
    case 'dashboard': {
      const dateRange = job.dateRange || String(job.payload.dateRange ?? '30d');
      const result = await trySyncDashboardProjectSnapshot(job.userId, dateRange);
      if (!result.acquired) return null;
      return `Dashboard ${dateRange} aktualisiert`;
    }
    case 'gsc-history': {
      const result = await syncGscHistoryForProject(job.userId);
      return `${result.updatedPages} Landingpages und ${result.dailyRows} GSC-Tage aktualisiert`;
    }
    case 'indexing': {
      const indexingDeadline = Math.min(deadlineAt, Date.now() + 75_000);
      const status = await syncIndexingProjectSnapshot(job.userId, {
        force: job.payload.force === true,
        maxInspections: 80,
        deadlineAt: indexingDeadline,
      });
      return `${status.indexedUrls}/${status.totalUrls} URLs indexiert`;
    }
    default: {
      const exhaustive: never = job.jobType;
      throw new Error(`Unbekannter Sync-Job: ${exhaustive}`);
    }
  }
}

export async function GET(request: NextRequest) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const startedAt = Date.now();
  const deadlineAt = startedAt + DISPATCH_DEADLINE_MS;
  try {
    const seeded = await seedDueProjectSyncJobs();
    const results: Array<{
      jobId: string;
      type: string;
      projectId: string;
      success: boolean;
      message: string;
    }> = [];
    const jobTypes = ['dashboard', 'gsc-history', 'indexing'] as const;
    const rotationOffset = Math.floor(new Date().getUTCMinutes() / 10) % jobTypes.length;

    while (results.length < MAX_JOBS_PER_RUN && Date.now() + 20_000 < deadlineAt) {
      const preferredType = jobTypes[(rotationOffset + results.length) % jobTypes.length];
      const job = await claimNextProjectSyncJob(preferredType)
        ?? await claimNextProjectSyncJob();
      if (!job) break;
      try {
        const message = await executeJob(job, deadlineAt);
        if (message === null) {
          await deferProjectSyncJob(job);
          results.push({
            jobId: job.id,
            type: job.jobType,
            projectId: job.userId,
            success: true,
            message: 'Wegen laufender Projektsynchronisierung kurz verschoben',
          });
          continue;
        }
        await finishProjectSyncJob(job, { success: true });
        results.push({
          jobId: job.id,
          type: job.jobType,
          projectId: job.userId,
          success: true,
          message,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await finishProjectSyncJob(job, { success: false, error: message });
        results.push({
          jobId: job.id,
          type: job.jobType,
          projectId: job.userId,
          success: false,
          message,
        });
      }
    }

    return NextResponse.json({
      success: true,
      seeded,
      processed: results.length,
      successful: results.filter((result) => result.success).length,
      failed: results.filter((result) => !result.success).length,
      durationSeconds: Math.round((Date.now() - startedAt) / 100) / 10,
      results,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const retryable = isRetryableInfrastructureError(error);
    console.error(`[Sync Dispatcher] ${retryable ? 'Temporär' : 'Fatal'}:`, error);
    return NextResponse.json(
      { success: false, retryable, message },
      {
        status: retryable ? 503 : 500,
        headers: retryable ? { 'Retry-After': '60' } : undefined,
      },
    );
  }
}
