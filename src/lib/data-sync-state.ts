import { sql } from '@vercel/postgres';

export type DataSyncSource = 'gsc-daily' | 'dashboard-30d';

export async function markDataSyncStarted(
  userId: string,
  source: DataSyncSource,
): Promise<void> {
  await sql`
    INSERT INTO project_data_sync_state (
      user_id, source, status, last_attempt_at, next_sync_at, updated_at
    )
    VALUES (
      ${userId}::uuid, ${source}, 'running', NOW(), NOW() + INTERVAL '6 hours', NOW()
    )
    ON CONFLICT (user_id, source)
    DO UPDATE SET
      status = 'running',
      last_attempt_at = NOW(),
      next_sync_at = NOW() + INTERVAL '6 hours',
      updated_at = NOW()
  `;
}

export async function markDataSyncFinished(
  userId: string,
  source: DataSyncSource,
  result: { success: true } | { success: false; error: string },
): Promise<void> {
  if (result.success) {
    await sql`
      INSERT INTO project_data_sync_state (
        user_id, source, status, last_attempt_at, last_success_at,
        next_sync_at, consecutive_failures, last_error, updated_at
      )
      VALUES (
        ${userId}::uuid, ${source}, 'ok', NOW(), NOW(),
        NOW() + INTERVAL '20 hours', 0, NULL, NOW()
      )
      ON CONFLICT (user_id, source)
      DO UPDATE SET
        status = 'ok',
        last_success_at = NOW(),
        next_sync_at = NOW() + INTERVAL '20 hours',
        consecutive_failures = 0,
        last_error = NULL,
        updated_at = NOW()
    `;
    return;
  }

  await sql`
    INSERT INTO project_data_sync_state (
      user_id, source, status, last_attempt_at, next_sync_at,
      consecutive_failures, last_error, updated_at
    )
    VALUES (
      ${userId}::uuid, ${source}, 'error', NOW(), NOW() + INTERVAL '6 hours',
      1, ${result.error}, NOW()
    )
    ON CONFLICT (user_id, source)
    DO UPDATE SET
      status = 'error',
      next_sync_at = NOW() + INTERVAL '6 hours',
      consecutive_failures = project_data_sync_state.consecutive_failures + 1,
      last_error = EXCLUDED.last_error,
      updated_at = NOW()
  `;
}
