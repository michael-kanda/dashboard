CREATE TABLE IF NOT EXISTS project_sync_jobs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_type VARCHAR(32) NOT NULL CHECK (job_type IN ('dashboard', 'gsc-history', 'indexing')),
  date_range VARCHAR(20) NOT NULL DEFAULT '',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  priority INTEGER NOT NULL DEFAULT 0,
  run_after TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts INTEGER NOT NULL DEFAULT 5 CHECK (max_attempts > 0),
  lease_until TIMESTAMPTZ,
  last_error TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, job_type, date_range)
);

CREATE INDEX IF NOT EXISTS idx_project_sync_jobs_due
  ON project_sync_jobs (status, run_after, priority DESC);

CREATE INDEX IF NOT EXISTS idx_project_sync_jobs_user
  ON project_sync_jobs (user_id, job_type, date_range);

CREATE TABLE IF NOT EXISTS project_metric_snapshots (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date_range VARCHAR(20) NOT NULL,
  metric_key VARCHAR(80) NOT NULL,
  value DOUBLE PRECISION NOT NULL DEFAULT 0,
  unit VARCHAR(20) NOT NULL CHECK (unit IN ('count', 'percent', 'seconds', 'currency')),
  source VARCHAR(32) NOT NULL
    CHECK (source IN ('gsc', 'ga4', 'google-ads', 'local-seo', 'indexing')),
  source_updated_at TIMESTAMPTZ NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  coverage_status VARCHAR(20) NOT NULL
    CHECK (coverage_status IN ('complete', 'partial', 'modeled', 'unknown')),
  coverage_note TEXT,
  calculation_method TEXT NOT NULL,
  calculation_version INTEGER NOT NULL DEFAULT 1 CHECK (calculation_version > 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (period_start <= period_end),
  PRIMARY KEY (user_id, date_range, metric_key)
);

CREATE INDEX IF NOT EXISTS idx_project_metric_snapshots_source
  ON project_metric_snapshots (user_id, source, source_updated_at DESC);
