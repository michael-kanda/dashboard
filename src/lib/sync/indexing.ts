import { syncProjectIndexingStatus, type IndexingSyncOptions } from '@/lib/indexing-status';
import {
  createMetricMetadata,
  extractIndexingMetricValues,
  type MetricMetadata,
} from '@/lib/metric-metadata';
import { persistMetricSnapshots } from '@/lib/metric-snapshot-store';

export type IndexingSkipReason = 'locked' | 'not-due' | 'quota';

export interface IndexingSyncResult {
  status: Awaited<ReturnType<typeof syncProjectIndexingStatus>>;
  skipped?: IndexingSkipReason;
}

export async function syncIndexingProjectSnapshot(
  userId: string,
  options: IndexingSyncOptions = {},
): Promise<IndexingSyncResult> {
  const status = await syncProjectIndexingStatus(userId, options);
  const skipped = status.skipped;
  if (skipped) return { status, skipped };
  const updatedAt = status.lastSyncedAt ?? new Date().toISOString();
  const values = extractIndexingMetricValues(status);
  // Ein veralteter Prüfstand ist genauso unvollständig wie eine offene Erstabdeckung.
  const isComplete = status.isVerificationComplete && status.staleUrls === 0;
  const metadata = Object.fromEntries(
    Object.keys(values).map((key) => [
      key,
      createMetricMetadata(key, 'snapshot', updatedAt, {
        status: key === 'indexing.total' || isComplete ? 'complete' : 'partial',
      }),
    ]),
  ) as Record<string, MetricMetadata>;

  await persistMetricSnapshots(userId, 'indexing', values, metadata);
  return { status };
}
