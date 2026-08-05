CREATE TABLE IF NOT EXISTS project_sync_leases (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source VARCHAR(32) NOT NULL,
  owner_token UUID NOT NULL,
  lease_until TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, source)
);

CREATE INDEX IF NOT EXISTS idx_project_sync_leases_expiry
  ON project_sync_leases (lease_until);

-- Alte, automatisch erzeugte Langzeit-Jobs nicht mehr abarbeiten. Höher
-- priorisierte, durch einen tatsächlichen Seitenaufruf erzeugte Jobs bleiben erhalten.
UPDATE project_sync_jobs
SET
  status = 'completed',
  completed_at = NOW(),
  lease_until = NULL,
  last_error = NULL,
  updated_at = NOW()
WHERE job_type = 'dashboard'
  AND date_range <> '30d'
  AND status = 'pending'
  AND priority <= 10;
