-- Tageszähler für DataMax (Chat-Fragen und KI-Analysen) pro angemeldeter Person.
-- Grenzen stehen im Code (src/lib/datamax-quota.ts): Kunden 10, Admins 50, Superadmins unbegrenzt.
-- Der Tag richtet sich nach Wiener Zeit; alte Zeilen können gefahrlos gelöscht werden.

CREATE TABLE IF NOT EXISTS datamax_usage (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  usage_date DATE NOT NULL,
  question_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, usage_date)
);
