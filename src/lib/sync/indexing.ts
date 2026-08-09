import { syncProjectIndexingStatus, type IndexingSyncOptions } from '@/lib/indexing-status';
import {
  createMetricMetadata,
  extractIndexingMetricValues,
  type MetricMetadata,
} from '@/lib/metric-metadata';
import { persistMetricSnapshots } from '@/lib/metric-snapshot-store';

export async function syncIndexingProjectSnapshot(
  userId: string,
  options: IndexingSyncOptions = {},
) {
  const status = await syncProjectIndexingStatus(userId, options);
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
  return status;
}
