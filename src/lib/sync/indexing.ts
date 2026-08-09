import { syncProjectIndexingStatus } from '@/lib/indexing-status';
import {
  createMetricMetadata,
  extractIndexingMetricValues,
  type MetricMetadata,
} from '@/lib/metric-metadata';
import { persistMetricSnapshots } from '@/lib/metric-snapshot-store';

export async function syncIndexingProjectSnapshot(
  userId: string,
  options: { force?: boolean; maxInspections?: number; deadlineAt?: number } = {},
) {
  const status = await syncProjectIndexingStatus(userId, options);
  const updatedAt = status.lastSyncedAt ?? new Date().toISOString();
  const values = extractIndexingMetricValues(status);
  const metadata = Object.fromEntries(
    Object.keys(values).map((key) => [
      key,
      createMetricMetadata(key, 'snapshot', updatedAt, {
        status: key === 'indexing.total' || status.isVerificationComplete ? 'complete' : 'partial',
      }),
    ]),
  ) as Record<string, MetricMetadata>;

  await persistMetricSnapshots(userId, 'indexing', values, metadata);
  return status;
}
