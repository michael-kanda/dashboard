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
import {
  isRetryableInfrastructureError,
  withInfrastructureRetry,
} from '@/lib/sync/retry';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const DISPATCH_DEADLINE_MS = 235_000;
const MAX_JOBS_PER_RUN = 9;

// Reservierte Slots je Lauf. Indexing bekommt den größten Anteil, weil ein Projekt
// mehrere Chargen braucht, bis alle Sitemap-URLs geprüft sind.
const JOB_TYPE_QUOTA: Record<ProjectSyncJob['jobType'], number> = {
  indexing: 4,
  dashboard: 3,
  'gsc-history': 2,
};
const JOB_TYPE_RANK: Record<ProjectSyncJob['jobType'], number> = {
  indexing: 0,
  dashboard: 1,
  'gsc-history': 2,
};

function retryDatabaseOperation<T>(label: string, operation: () => Promise<T>) {
  return withInfrastructureRetry(operation, {
    onRetry: (_error, nextAttempt) => {
      console.warn(`[Sync Dispatcher] ${label}: temporärer Datenbankfehler, Versuch ${nextAttempt}/3`);
    },
  });
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
      const indexingDeadline = Math.min(deadlineAt, Date.now() + 90_000);
      const status = await syncIndexingProjectSnapshot(job.userId, {
        force: job.payload.force === true,
        maxInspections: 150,
        inspectionConcurrency: 6,
        inspectionReserveMs: 15_000,
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
    const seeded = await retryDatabaseOperation('Jobs einplanen', seedDueProjectSyncJobs);
    const results: Array<{
      jobId: string;
      type: string;
      projectId: string;
      success: boolean;
      message: string;
    }> = [];
    const remainingQuota: Record<ProjectSyncJob['jobType'], number> = { ...JOB_TYPE_QUOTA };
    const exhaustedTypes = new Set<ProjectSyncJob['jobType']>();

    const pickNextType = () => (Object.keys(remainingQuota) as Array<ProjectSyncJob['jobType']>)
      .filter((type) => remainingQuota[type] > 0 && !exhaustedTypes.has(type))
      .sort((a, b) => remainingQuota[b] - remainingQuota[a] || JOB_TYPE_RANK[a] - JOB_TYPE_RANK[b])[0];

    while (results.length < MAX_JOBS_PER_RUN && Date.now() + 20_000 < deadlineAt) {
      const preferredType = pickNextType();
      const preferredJob = preferredType
        ? await retryDatabaseOperation(
          `Job ${preferredType} reservieren`,
          () => claimNextProjectSyncJob(preferredType),
        )
        : null;
      if (preferredType && !preferredJob) {
        // Für diesen Typ steht nichts an – Slot freigeben statt den Lauf zu verschwenden.
        exhaustedTypes.add(preferredType);
        if (pickNextType()) continue;
      }
      const job = preferredJob ?? await retryDatabaseOperation(
        'Nächsten Job reservieren',
        () => claimNextProjectSyncJob(),
      );
      if (!job) break;
      remainingQuota[job.jobType] = Math.max(0, remainingQuota[job.jobType] - 1);
      try {
        const message = await executeJob(job, deadlineAt);
        if (message === null) {
          await retryDatabaseOperation('Job verschieben', () => deferProjectSyncJob(job));
          results.push({
            jobId: job.id,
            type: job.jobType,
            projectId: job.userId,
            success: true,
            message: 'Wegen laufender Projektsynchronisierung kurz verschoben',
          });
          continue;
        }
        await retryDatabaseOperation(
          'Job abschließen',
          () => finishProjectSyncJob(job, { success: true }),
        );
        results.push({
          jobId: job.id,
          type: job.jobType,
          projectId: job.userId,
          success: true,
          message,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await retryDatabaseOperation(
          'Fehlgeschlagenen Job speichern',
          () => finishProjectSyncJob(job, { success: false, error: message }),
        );
        results.push({
          jobId: job.id,
          type: job.jobType,
          projectId: job.userId,
          success: false,
          message,
        });
      }
    }

    const failed = results.filter((result) => !result.success).length;
    return NextResponse.json({
      success: failed === 0,
      seeded,
      processed: results.length,
      successful: results.filter((result) => result.success).length,
      failed,
      durationSeconds: Math.round((Date.now() - startedAt) / 100) / 10,
      results,
    }, {
      status: failed > 0 ? 500 : 200,
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
