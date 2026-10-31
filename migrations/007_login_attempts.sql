-- Fehlgeschlagene Logins für die Sperre bei wiederholten Fehlversuchen.

CREATE TABLE IF NOT EXISTS login_attempts (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  ip TEXT,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS login_attempts_email_idx ON login_attempts (email, attempted_at);
CREATE INDEX IF NOT EXISTS login_attempts_ip_idx ON login_attempts (ip, attempted_at);
