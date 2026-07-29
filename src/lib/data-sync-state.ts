import { sql } from '@vercel/postgres';

export type DataSyncSource = 'gsc-daily' | 'dashboard-30d';

export async function ensureDataSyncStateSchema(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS project_data_sync_state (
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      source VARCHAR(40) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'idle',
      last_attempt_at TIMESTAMPTZ NULL,
      last_success_at TIMESTAMPTZ NULL,
      next_sync_at TIMESTAMPTZ NULL,
      consecutive_failures INTEGER NOT NULL DEFAULT 0,
      last_error TEXT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, source)
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_project_data_sync_due
    ON project_data_sync_state(source, next_sync_at, last_attempt_at)
  `;
}

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
