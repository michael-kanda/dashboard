-- Sync hardening: bounded deferrals, classified failures and URL Inspection budget.

ALTER TABLE project_sync_jobs
  ADD COLUMN IF NOT EXISTS defer_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE project_sync_jobs
  ADD COLUMN IF NOT EXISTS failure_kind TEXT;

ALTER TABLE project_sync_jobs
  DROP CONSTRAINT IF EXISTS project_sync_jobs_failure_kind_check;
ALTER TABLE project_sync_jobs
  ADD CONSTRAINT project_sync_jobs_failure_kind_check
  CHECK (failure_kind IS NULL OR failure_kind IN ('transient', 'permanent'));

UPDATE project_sync_jobs
SET defer_count = 0, failure_kind = NULL
WHERE status IN ('pending', 'running');

CREATE TABLE IF NOT EXISTS url_inspection_budget (
  property_key TEXT NOT NULL,
  usage_date DATE NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (property_key, usage_date)
);

CREATE INDEX IF NOT EXISTS url_inspection_budget_date_idx
  ON url_inspection_budget (usage_date);
CREATE INDEX IF NOT EXISTS google_data_cache_user_range_idx
  ON google_data_cache (user_id, date_range);
CREATE INDEX IF NOT EXISTS project_data_sync_state_user_source_idx
  ON project_data_sync_state (user_id, source);
CREATE INDEX IF NOT EXISTS project_sync_jobs_dispatch_idx
  ON project_sync_jobs (job_type, status, run_after, priority DESC);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;
