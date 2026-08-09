import { sql } from '@vercel/postgres';
import { getDashboardCacheDurationHours } from './cache-policy';

export type ProjectSyncJobType = 'dashboard' | 'gsc-history' | 'indexing';
export type ProjectSyncJobStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface ProjectSyncJob {
  id: string;
  userId: string;
  jobType: ProjectSyncJobType;
  dateRange: string;
  payload: Record<string, unknown>;
  status: ProjectSyncJobStatus;
  attempts: number;
  maxAttempts: number;
}

function mapJob(row: Record<string, unknown>): ProjectSyncJob {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    jobType: row.job_type as ProjectSyncJobType,
    dateRange: String(row.date_range ?? ''),
    payload: (row.payload && typeof row.payload === 'object'
      ? row.payload
      : {}) as Record<string, unknown>,
    status: row.status as ProjectSyncJobStatus,
    attempts: Number(row.attempts ?? 0),
    maxAttempts: Number(row.max_attempts ?? 5),
  };
}

export async function enqueueProjectSyncJob({
  userId,
  jobType,
  dateRange = '',
  payload = {},
  priority = 0,
  runAfter = new Date(),
  restartFailed = true,
  preservePending = false,
}: {
  userId: string;
  jobType: ProjectSyncJobType;
  dateRange?: string;
  payload?: Record<string, unknown>;
  priority?: number;
  runAfter?: Date;
  restartFailed?: boolean;
  preservePending?: boolean;
}) {
  await sql`
    INSERT INTO project_sync_jobs (
      user_id, job_type, date_range, payload, status, priority,
      run_after, attempts, lease_until, last_error, updated_at
    ) VALUES (
      ${userId}::uuid, ${jobType}, ${dateRange}, ${JSON.stringify(payload)}::jsonb,
      'pending', ${priority}, ${runAfter.toISOString()}::timestamptz,
      0, NULL, NULL, NOW()
    )
    ON CONFLICT (user_id, job_type, date_range)
    DO UPDATE SET
      payload = EXCLUDED.payload,
      priority = GREATEST(project_sync_jobs.priority, EXCLUDED.priority),
      run_after = CASE
        WHEN project_sync_jobs.status = 'pending' AND ${preservePending}
        THEN project_sync_jobs.run_after
        ELSE LEAST(project_sync_jobs.run_after, EXCLUDED.run_after)
      END,
      status = CASE
        WHEN project_sync_jobs.status = 'running'
          AND project_sync_jobs.lease_until > NOW()
        THEN project_sync_jobs.status
        WHEN project_sync_jobs.status = 'failed' AND ${restartFailed} = FALSE
        THEN project_sync_jobs.status
        WHEN project_sync_jobs.status = 'pending' AND ${preservePending}
        THEN project_sync_jobs.status
        ELSE 'pending'
      END,
      attempts = CASE
        WHEN project_sync_jobs.status = 'running'
          AND project_sync_jobs.lease_until > NOW()
        THEN project_sync_jobs.attempts
        WHEN project_sync_jobs.status = 'failed' AND ${restartFailed} = FALSE
        THEN project_sync_jobs.attempts
        WHEN project_sync_jobs.status = 'pending' AND ${preservePending}
        THEN project_sync_jobs.attempts
        ELSE 0
      END,
      lease_until = CASE
        WHEN project_sync_jobs.status = 'running'
          AND project_sync_jobs.lease_until > NOW()
        THEN project_sync_jobs.lease_until
        ELSE NULL
      END,
      last_error = CASE
        WHEN project_sync_jobs.status = 'failed' AND ${restartFailed} = FALSE
        THEN project_sync_jobs.last_error
        ELSE NULL
      END,
      updated_at = NOW()
  `;
}

export async function seedDueProjectSyncJobs() {
  const dashboardRefreshHours = getDashboardCacheDurationHours('30d');
  await sql`
    UPDATE project_sync_jobs
    SET
      status = 'failed', lease_until = NULL,
      last_error = COALESCE(last_error, 'Synchronisierung nach mehreren Laufabbrüchen beendet.'),
      updated_at = NOW()
    WHERE status = 'running'
      AND lease_until <= NOW()
      AND attempts >= max_attempts
  `;

  const dashboard = await sql`
    INSERT INTO project_sync_jobs (
      user_id, job_type, date_range, payload, status, priority, run_after, updated_at
    )
    SELECT
      u.id, 'dashboard', '30d',
      jsonb_build_object('dateRange', '30d'),
      'pending', 10, NOW(), NOW()
    FROM users u
    LEFT JOIN google_data_cache cache
      ON cache.user_id = u.id AND cache.date_range = '30d'
    WHERE u.role = 'BENUTZER'
      AND (
        NULLIF(BTRIM(u.gsc_site_url), '') IS NOT NULL
        OR NULLIF(BTRIM(u.ga4_property_id), '') IS NOT NULL
        OR NULLIF(BTRIM(u.google_ads_sheet_id), '') IS NOT NULL
      )
      AND (
        cache.last_fetched IS NULL
        OR cache.last_fetched < NOW() - (${dashboardRefreshHours} * INTERVAL '1 hour')
      )
    ON CONFLICT (user_id, job_type, date_range)
    DO UPDATE SET
      status = 'pending', attempts = 0, run_after = NOW(),
      priority = GREATEST(project_sync_jobs.priority, 10), updated_at = NOW()
    WHERE project_sync_jobs.status = 'completed'
      OR (
        project_sync_jobs.status = 'failed'
        AND project_sync_jobs.updated_at < NOW() - INTERVAL '6 hours'
      )
    RETURNING id
  `;

  const gsc = await sql`
    INSERT INTO project_sync_jobs (
      user_id, job_type, date_range, payload, status, priority, run_after, updated_at
    )
    SELECT u.id, 'gsc-history', '', '{}'::jsonb, 'pending', 5, NOW(), NOW()
    FROM users u
    LEFT JOIN project_data_sync_state state
      ON state.user_id = u.id AND state.source = 'gsc-daily'
    WHERE u.role = 'BENUTZER'
      AND NULLIF(BTRIM(u.gsc_site_url), '') IS NOT NULL
      AND (state.next_sync_at IS NULL OR state.next_sync_at <= NOW())
    ON CONFLICT (user_id, job_type, date_range)
    DO UPDATE SET
      status = 'pending', attempts = 0, run_after = NOW(), updated_at = NOW()
    WHERE project_sync_jobs.status = 'completed'
      OR (
        project_sync_jobs.status = 'failed'
        AND project_sync_jobs.updated_at < NOW() - INTERVAL '6 hours'
      )
    RETURNING id
  `;

  const indexing = await sql`
    INSERT INTO project_sync_jobs (
      user_id, job_type, date_range, payload, status, priority, run_after, updated_at
    )
    SELECT u.id, 'indexing', '', '{}'::jsonb, 'pending', 3, NOW(), NOW()
    FROM users u
    LEFT JOIN project_indexing_sync state ON state.user_id = u.id
    WHERE u.role = 'BENUTZER'
      AND NULLIF(BTRIM(u.gsc_site_url), '') IS NOT NULL
      AND (
        state.user_id IS NULL
        OR state.next_sync_at IS NULL
        OR state.next_sync_at <= NOW()
      )
    ON CONFLICT (user_id, job_type, date_range)
    DO UPDATE SET
      status = 'pending', attempts = 0, run_after = NOW(), updated_at = NOW()
    WHERE project_sync_jobs.status = 'completed'
      OR (
        project_sync_jobs.status = 'failed'
        AND project_sync_jobs.updated_at < NOW() - INTERVAL '6 hours'
      )
    RETURNING id
  `;

  return {
    dashboard: dashboard.rowCount ?? dashboard.rows.length,
    gscHistory: gsc.rowCount ?? gsc.rows.length,
    indexing: indexing.rowCount ?? indexing.rows.length,
  };
}

export async function claimNextProjectSyncJob(
  preferredType?: ProjectSyncJobType,
): Promise<ProjectSyncJob | null> {
  const query = preferredType ? sql`
    WITH candidate AS (
      SELECT id
      FROM project_sync_jobs
      WHERE job_type = ${preferredType}
        AND attempts < max_attempts
        AND (
          (status = 'pending' AND run_after <= NOW())
          OR (status = 'running' AND lease_until <= NOW())
        )
      ORDER BY priority DESC, run_after ASC, updated_at ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    UPDATE project_sync_jobs job
    SET
      status = 'running', attempts = job.attempts + 1,
      started_at = NOW(), lease_until = NOW() + INTERVAL '240 seconds',
      updated_at = NOW()
    FROM candidate
    WHERE job.id = candidate.id
    RETURNING job.*
  ` : sql`
    WITH candidate AS (
      SELECT id
      FROM project_sync_jobs
      WHERE attempts < max_attempts
        AND (
          (status = 'pending' AND run_after <= NOW())
          OR (status = 'running' AND lease_until <= NOW())
        )
      ORDER BY priority DESC, run_after ASC, updated_at ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    UPDATE project_sync_jobs job
    SET
      status = 'running',
      attempts = job.attempts + 1,
      started_at = NOW(),
      lease_until = NOW() + INTERVAL '240 seconds',
      updated_at = NOW()
    FROM candidate
    WHERE job.id = candidate.id
    RETURNING job.*
  `;
  const { rows } = await query;
  return rows[0] ? mapJob(rows[0]) : null;
}

export async function claimProjectSyncJob(
  userId: string,
  jobType: ProjectSyncJobType,
  dateRange = '',
): Promise<ProjectSyncJob | null> {
  const { rows } = await sql`
    WITH candidate AS (
      SELECT id
      FROM project_sync_jobs
      WHERE user_id = ${userId}::uuid
        AND job_type = ${jobType}
        AND date_range = ${dateRange}
        AND attempts < max_attempts
        AND (
          (status = 'pending' AND run_after <= NOW())
          OR (status = 'running' AND lease_until <= NOW())
        )
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    UPDATE project_sync_jobs job
    SET
      status = 'running',
      attempts = job.attempts + 1,
      started_at = NOW(),
      lease_until = NOW() + INTERVAL '240 seconds',
      updated_at = NOW()
    FROM candidate
    WHERE job.id = candidate.id
    RETURNING job.*
  `;
  return rows[0] ? mapJob(rows[0]) : null;
}

export async function getProjectSyncJob(
  userId: string,
  jobType: ProjectSyncJobType,
  dateRange = '',
): Promise<ProjectSyncJob | null> {
  const { rows } = await sql`
    SELECT *
    FROM project_sync_jobs
    WHERE user_id = ${userId}::uuid
      AND job_type = ${jobType}
      AND date_range = ${dateRange}
    LIMIT 1
  `;
  return rows[0] ? mapJob(rows[0]) : null;
}

export async function finishProjectSyncJob(
  job: ProjectSyncJob,
  result: { success: boolean; error?: string },
) {
  if (result.success) {
    await sql`
      UPDATE project_sync_jobs
      SET
        status = 'completed', completed_at = NOW(), lease_until = NULL,
        last_error = NULL, priority = 0, updated_at = NOW()
      WHERE id = ${job.id}::bigint
    `;
    return;
  }

  const exhausted = job.attempts >= job.maxAttempts;
  const retryDelayMinutes = Math.min(60, 2 ** Math.max(0, job.attempts - 1) * 5);
  await sql`
    UPDATE project_sync_jobs
    SET
      status = ${exhausted ? 'failed' : 'pending'},
      run_after = NOW() + (${retryDelayMinutes} * INTERVAL '1 minute'),
      lease_until = NULL,
      last_error = ${result.error ?? 'Unbekannter Synchronisierungsfehler'},
      updated_at = NOW()
    WHERE id = ${job.id}::bigint
  `;
}

export async function deferProjectSyncJob(job: ProjectSyncJob, delaySeconds = 30) {
  await sql`
    UPDATE project_sync_jobs
    SET
      status = 'pending',
      attempts = GREATEST(attempts - 1, 0),
      run_after = NOW() + (${delaySeconds} * INTERVAL '1 second'),
      lease_until = NULL,
      last_error = NULL,
      updated_at = NOW()
    WHERE id = ${job.id}::bigint
  `;
}
