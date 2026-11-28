-- Tageszähler für DataMax in der öffentlichen Demo (/demo-anwalt), ohne Anmeldung.
-- Pro Besucher zählt ein Hash der IP-Adresse (mit Geheimnis gesalzen, nicht umkehrbar),
-- Grenzen im Code (src/lib/demo-chat-quota.ts). Zeilen älter als 7 Tage löscht der Code selbst.

CREATE TABLE IF NOT EXISTS demo_chat_usage (
  ip_hash TEXT NOT NULL,
  usage_date DATE NOT NULL,
  question_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (ip_hash, usage_date)
);
