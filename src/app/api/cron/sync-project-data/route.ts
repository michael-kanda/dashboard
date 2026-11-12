import { NextRequest, NextResponse } from 'next/server';
import { trySyncDashboardProjectSnapshot, classifyDashboardJobFailure } from '@/lib/sync/dashboard';
import { syncGscHistoryForProject } from '@/lib/sync/gsc-history';
import { syncIndexingProjectSnapshot } from '@/lib/sync/indexing';
import {
  claimNextProjectSyncJob,
  deferProjectSyncJob,
  finishProjectSyncJob,
  seedDueProjectSyncJobs,
  getQueueSourceStates,
  type ProjectSyncFailureKind,
  type ProjectSyncJob,
} from '@/lib/sync/job-queue';
import {
  isRetryableInfrastructureError,
  withInfrastructureRetry,
} from '@/lib/sync/retry';
import { pickNextProjectSyncJobType } from '@/lib/sync/dispatcher-policy';
import { logger } from '@/lib/logger';

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
const JOB_TYPE_RESERVE_MS: Record<ProjectSyncJob['jobType'], number> = {
  indexing: 100_000,
  dashboard: 130_000,
  'gsc-history': 100_000,
};

type JobOutcome =
  | { kind: 'done'; message: string }
  | { kind: 'defer'; reason: string; delaySeconds: number };

function retryDatabaseOperation<T>(label: string, operation: () => Promise<T>) {
  return withInfrastructureRetry(operation, {
    onRetry: (_error, nextAttempt) => {
      console.warn(`[Sync Dispatcher] ${label}: temporärer Datenbankfehler, Versuch ${nextAttempt}/3`);
    },
  });
}

async function executeJob(job: ProjectSyncJob, deadlineAt: number): Promise<JobOutcome> {
  switch (job.jobType) {
    case 'dashboard': {
      const dateRange = job.dateRange || String(job.payload.dateRange ?? '30d');
      const result = await trySyncDashboardProjectSnapshot(job.userId, dateRange, { deadlineAt });
      if (!result.acquired) {
        return { kind: 'defer', reason: 'Source-Lease belegt', delaySeconds: 30 };
      }
      return { kind: 'done', message: `Dashboard ${dateRange} aktualisiert` };
    }
    case 'gsc-history': {
      const result = await syncGscHistoryForProject(job.userId, { deadlineAt });
      return {
        kind: 'done',
        message: `${result.updatedPages} Landingpages und ${result.dailyRows} GSC-Tage aktualisiert`,
      };
    }
    case 'indexing': {
      const indexingDeadline = Math.min(deadlineAt, Date.now() + 90_000);
      const { status, skipped } = await syncIndexingProjectSnapshot(job.userId, {
        force: job.payload.force === true,
        maxInspections: 150,
        inspectionConcurrency: 6,
        inspectionReserveMs: 15_000,
        deadlineAt: indexingDeadline,
      });
      // Nur eine fremde Sperre lässt die Arbeit offen; für 'not-due' und 'quota'
      // plant next_sync_at die Fortsetzung bereits über den Seed ein.
      if (skipped === 'locked') {
        return { kind: 'defer', reason: 'Indexierung übersprungen (locked)', delaySeconds: 300 };
      }
      return {
        kind: 'done',
        message: skipped
          ? `Indexierung übersprungen (${skipped})`
          : `${status.indexedUrls}/${status.totalUrls} URLs indexiert`,
      };
    }
    default: {
      const exhaustive: never = job.jobType;
      throw new Error(`Unbekannter Sync-Job: ${exhaustive}`);
    }
  }
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error('[Sync Dispatcher] CRON_SECRET ist nicht gesetzt.');
    return NextResponse.json({ message: 'CRON_SECRET nicht konfiguriert' }, { status: 500 });
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const startedAt = Date.now();
  const deadlineAt = startedAt + DISPATCH_DEADLINE_MS;
  try {
    const seeded = await retryDatabaseOperation('Jobs einplanen', seedDueProjectSyncJobs);
    const sourceStates = await retryDatabaseOperation('Queue-Zustand lesen', getQueueSourceStates);
    const jobTimings: Array<{ type: string; jobId: string; durationMs: number }> = [];
    const results: Array<{
      jobId: string;
      type: string;
      projectId: string;
      success: boolean;
      failureKind?: ProjectSyncFailureKind;
      message: string;
    }> = [];
    const remainingQuota: Record<ProjectSyncJob['jobType'], number> = { ...JOB_TYPE_QUOTA };
    const processedByType: Record<ProjectSyncJob['jobType'], number> = {
      dashboard: 0,
      'gsc-history': 0,
      indexing: 0,
    };
    const exhaustedTypes = new Set<ProjectSyncJob['jobType']>();

    const timeLeft = () => deadlineAt - Date.now();
    const fits = (type: ProjectSyncJob['jobType']) => JOB_TYPE_RESERVE_MS[type] <= timeLeft();
    const pickNextType = () => pickNextProjectSyncJobType({
      remainingQuota,
      processedByType,
      exhaustedTypes,
      fits,
      sourceStates,
    });

    const minReserve = Math.min(...Object.values(JOB_TYPE_RESERVE_MS));
    while (results.length < MAX_JOBS_PER_RUN && timeLeft() > minReserve) {
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
      // Never claim a type that the remaining runtime cannot accommodate.
      const job = preferredJob;
      if (!job) break;
      if (!fits(job.jobType)) {
        await retryDatabaseOperation(
          'Job wegen Zeitbudget verschieben',
          () => deferProjectSyncJob(job, 60, 'Zeitbudget des Laufs reicht nicht mehr'),
        );
        break;
      }
      remainingQuota[job.jobType] = Math.max(0, remainingQuota[job.jobType] - 1);
      processedByType[job.jobType] += 1;
      const jobStartedAt = Date.now();
      try {
        const outcome = await executeJob(job, deadlineAt);
        if (outcome.kind === 'defer') {
          const deferResult = await retryDatabaseOperation(
            'Job verschieben',
            () => deferProjectSyncJob(job, outcome.delaySeconds, outcome.reason),
          );
          results.push({
            jobId: job.id,
            type: job.jobType,
            projectId: job.userId,
            success: !deferResult.escalated,
            failureKind: deferResult.escalated ? 'transient' : undefined,
            message: deferResult.escalated
              ? `${outcome.reason} - nach ${deferResult.deferCount} Verschiebungen abgebrochen`
              : `${outcome.reason} (Verschiebung ${deferResult.deferCount})`,
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
          message: outcome.message,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const failureKind = classifyDashboardJobFailure(error);
        await retryDatabaseOperation(
          'Fehlgeschlagenen Job speichern',
          () => finishProjectSyncJob(job, { success: false, error: message, kind: failureKind }),
        );
        results.push({
          jobId: job.id,
          type: job.jobType,
          projectId: job.userId,
          success: false,
          failureKind,
          message,
        });
      } finally {
        jobTimings.push({ type: job.jobType, jobId: job.id, durationMs: Date.now() - jobStartedAt });
      }
    }

    const queueAfter = await retryDatabaseOperation('Queue-Rueckstau lesen', getQueueSourceStates);
    logger.info('[Sync Dispatcher] Kapazitaet', JSON.stringify({ sourceStates, queueAfter, jobTimings }));
    const failures = results.filter((result) => !result.success);
    const transientFailures = failures.filter((result) => result.failureKind !== 'permanent');
    const permanentFailures = failures.length - transientFailures.length;
    return NextResponse.json({
      success: transientFailures.length === 0,
      degraded: permanentFailures > 0,
      seeded,
      processed: results.length,
      successful: results.filter((result) => result.success).length,
      failed: failures.length,
      failedTransient: transientFailures.length,
      failedPermanent: permanentFailures,
      durationSeconds: Math.round((Date.now() - startedAt) / 100) / 10,
      queueBefore: sourceStates,
      queueAfter,
      jobTimings,
      results,
    }, {
      status: transientFailures.length > 0 ? 500 : 200,
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
