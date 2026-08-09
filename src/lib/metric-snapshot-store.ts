import { sql, type VercelPoolClient } from '@vercel/postgres';
import type { MetricMetadata } from './metric-metadata';

export async function persistMetricSnapshotsWithClient(
  client: VercelPoolClient,
  userId: string,
  dateRange: string,
  values: Record<string, number>,
  metadata: Record<string, MetricMetadata>,
) {
  const entries = Object.entries(values)
    .map(([key, value]) => ({ key, value, metadata: metadata[key] }))
    .filter((entry): entry is { key: string; value: number; metadata: MetricMetadata } => Boolean(entry.metadata));
  if (entries.length === 0) {
    await client.query(
      `DELETE FROM project_metric_snapshots
       WHERE user_id = $1::uuid AND date_range = $2`,
      [userId, dateRange],
    );
    return;
  }

  await client.query(
    `DELETE FROM project_metric_snapshots
     WHERE user_id = $1::uuid
       AND date_range = $2
       AND NOT (metric_key = ANY($3::text[]))`,
    [userId, dateRange, entries.map((entry) => entry.key)],
  );
  await client.query(
    `INSERT INTO project_metric_snapshots (
      user_id, date_range, metric_key, value, unit, source,
      source_updated_at, period_start, period_end, coverage_status,
      coverage_note, calculation_method, calculation_version, updated_at
    )
    SELECT
      $1::uuid, $2, metric_key, value, unit, source,
      source_updated_at::timestamptz, period_start::date, period_end::date,
      coverage_status, coverage_note, calculation_method,
      calculation_version, NOW()
    FROM UNNEST(
      $3::text[], $4::double precision[], $5::text[], $6::text[],
      $7::text[], $8::text[], $9::text[], $10::text[], $11::text[],
      $12::text[], $13::integer[]
    ) AS snapshot(
      metric_key, value, unit, source, source_updated_at, period_start,
      period_end, coverage_status, coverage_note, calculation_method,
      calculation_version
    )
    ON CONFLICT (user_id, date_range, metric_key)
    DO UPDATE SET
      value = EXCLUDED.value,
      unit = EXCLUDED.unit,
      source = EXCLUDED.source,
      source_updated_at = EXCLUDED.source_updated_at,
      period_start = EXCLUDED.period_start,
      period_end = EXCLUDED.period_end,
      coverage_status = EXCLUDED.coverage_status,
      coverage_note = EXCLUDED.coverage_note,
      calculation_method = EXCLUDED.calculation_method,
      calculation_version = EXCLUDED.calculation_version,
      updated_at = NOW()`,
    [
      userId,
      dateRange,
      entries.map((entry) => entry.key),
      entries.map((entry) => entry.value),
      entries.map((entry) => entry.metadata.unit),
      entries.map((entry) => entry.metadata.source),
      entries.map((entry) => entry.metadata.updatedAt),
      entries.map((entry) => entry.metadata.period.from),
      entries.map((entry) => entry.metadata.period.to),
      entries.map((entry) => entry.metadata.coverage.status),
      entries.map((entry) => entry.metadata.coverage.note),
      entries.map((entry) => entry.metadata.calculation.method),
      entries.map((entry) => entry.metadata.calculation.version),
    ],
  );
}

export async function persistMetricSnapshots(
  userId: string,
  dateRange: string,
  values: Record<string, number>,
  metadata: Record<string, MetricMetadata>,
) {
  const client = await sql.connect();
  try {
    await client.query('BEGIN');
    await persistMetricSnapshotsWithClient(client, userId, dateRange, values, metadata);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
