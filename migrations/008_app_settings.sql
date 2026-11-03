-- Globale Einstellungen als Schlüssel/Wert, zuerst für das Design (Farben, Rahmen, Schatten).

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
