-- Zugangsanfragen von der Landingpage (www.datapeak.at, Formular „Zugang anfragen“).
-- Dient als Nachweis, falls die E-Mail nicht ankommt, und zur Begrenzung pro IP.
-- Die IP wird nur als Hash gespeichert. Einträge werden nach 180 Tagen gelöscht (beim nächsten Eingang).

CREATE TABLE IF NOT EXISTS access_requests (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  company TEXT,
  email TEXT NOT NULL,
  website TEXT,
  message TEXT,
  ip_hash TEXT,
  mail_sent BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS access_requests_ip_created_idx ON access_requests (ip_hash, created_at);
