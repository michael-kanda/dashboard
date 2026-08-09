CREATE TABLE IF NOT EXISTS google_place_preview_cache (
  project_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  location_key TEXT NOT NULL,
  lookup_key CHAR(64) NOT NULL,
  data JSONB NOT NULL,
  source_updated_at TIMESTAMPTZ NOT NULL,
  last_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_error TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (project_id, location_key)
);

CREATE INDEX IF NOT EXISTS idx_google_place_preview_cache_updated
  ON google_place_preview_cache (project_id, source_updated_at DESC);
