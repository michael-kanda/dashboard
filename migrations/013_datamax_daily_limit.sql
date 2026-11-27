-- Eigenes DataMax-Tageslimit pro Benutzer bzw. Projekt-Login, einstellbar im System-Bereich.
-- NULL = Standard nach Rolle (Kunden 10, Admins 50; siehe src/lib/datamax-quota.ts).
ALTER TABLE users ADD COLUMN IF NOT EXISTS datamax_daily_limit INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_datamax_daily_limit_range'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_datamax_daily_limit_range
      CHECK (datamax_daily_limit IS NULL OR datamax_daily_limit BETWEEN 1 AND 1000);
  END IF;
END $$;
