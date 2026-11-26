-- Optionale Analytics-Quelle je Projekt: GA4 (Standard) oder Vercel Web Analytics.

ALTER TABLE users ADD COLUMN IF NOT EXISTS analytics_source TEXT NOT NULL DEFAULT 'ga4';
ALTER TABLE users ADD COLUMN IF NOT EXISTS vercel_project_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS vercel_team_id TEXT;
-- Kommagetrennte Namen eigener Vercel-Events, die als Conversion zählen.
ALTER TABLE users ADD COLUMN IF NOT EXISTS vercel_conversion_events TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_analytics_source_check'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_analytics_source_check CHECK (analytics_source IN ('ga4', 'vercel'));
  END IF;
END $$;

-- Kennzahl-Historie: Quelle 'vercel' zulassen. Der Name der ursprünglichen
-- CHECK-Regel wurde automatisch vergeben, deshalb über den Inhalt suchen.
DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  FOR constraint_name IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'project_metric_snapshots'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%source%'
      AND pg_get_constraintdef(oid) NOT ILIKE '%vercel%'
  LOOP
    EXECUTE format('ALTER TABLE project_metric_snapshots DROP CONSTRAINT %I', constraint_name);
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'project_metric_snapshots'::regclass
      AND conname = 'project_metric_snapshots_source_check_v2'
  ) THEN
    ALTER TABLE project_metric_snapshots
      ADD CONSTRAINT project_metric_snapshots_source_check_v2
      CHECK (source IN ('gsc', 'ga4', 'vercel', 'google-ads', 'local-seo', 'indexing'));
  END IF;
END $$;
