-- Passwort selbst ändern und über einen Link zurücksetzen.

-- Einmalige Links aus „Passwort vergessen?“. Gespeichert wird nur der SHA-256-Hash
-- des Tokens; der Token selbst steht ausschließlich in der E-Mail.
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS password_reset_tokens_user_idx ON password_reset_tokens (user_id, created_at);

-- Anfragen für die Begrenzung pro E-Mail und pro IP. Beides nur als HMAC-Hash,
-- auch für Adressen ohne Konto. Einträge älter als ein Tag werden beim nächsten Eingang gelöscht.
CREATE TABLE IF NOT EXISTS password_reset_requests (
  id BIGSERIAL PRIMARY KEY,
  email_hash TEXT NOT NULL,
  ip_hash TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS password_reset_requests_email_idx ON password_reset_requests (email_hash, requested_at);
CREATE INDEX IF NOT EXISTS password_reset_requests_ip_idx ON password_reset_requests (ip_hash, requested_at);

-- Login-Protokoll: neben Anmeldungen auch Passwortänderungen und Zurücksetzungen.
ALTER TABLE login_logs ADD COLUMN IF NOT EXISTS event TEXT NOT NULL DEFAULT 'login';
