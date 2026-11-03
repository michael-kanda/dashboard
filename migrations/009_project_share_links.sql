-- Gastlinks: 24 Stunden gültige Nur-Lese-Ansicht eines Projekts. Gespeichert wird nur der Hash des Tokens.

CREATE TABLE IF NOT EXISTS project_share_links (
  id BIGSERIAL PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  project_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS project_share_links_project_idx ON project_share_links (project_id, expires_at);
