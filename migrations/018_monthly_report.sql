-- Monatsbericht per E-Mail (src/lib/monthly-report).
-- Pro Projekt einschaltbar (standardmäßig aus). Am 1. jedes Monats geht ein Bericht mit den
-- Kennzahlen der letzten 30 Tage an die Login-Adresse des Projekts, die zugewiesenen Betreuer
-- bekommen ihn in Kopie. Abmelden geht pro Empfänger über den Link in der E-Mail.

ALTER TABLE users ADD COLUMN IF NOT EXISTS monthly_report_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- Ein Eintrag pro Projekt und Monat: verhindert doppelten Versand, wenn der Cron mehrfach läuft.
CREATE TABLE IF NOT EXISTS monthly_report_runs (
  project_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period TEXT NOT NULL,              -- 'YYYY-MM' des berichteten Monats
  status TEXT NOT NULL CHECK (status IN ('sent', 'no_data', 'no_recipients', 'failed')),
  recipient_count INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (project_id, period)
);

-- Abmeldungen pro Empfänger und Projekt. Die Adresse liegt nur als HMAC vor.
CREATE TABLE IF NOT EXISTS monthly_report_optouts (
  project_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (project_id, email_hash)
);
