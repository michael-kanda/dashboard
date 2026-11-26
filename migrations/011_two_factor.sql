-- Zwei-Faktor-Anmeldung (TOTP, Authenticator-App). Pflicht für Admins und
-- Superadmins, freiwillig für Projekt-Logins.

-- Verschlüsseltes TOTP-Geheimnis (AES-256-GCM); gesetzt ab Beginn der Einrichtung.
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret_enc TEXT;
-- Zeitpunkt der Aktivierung; NULL = Zwei-Faktor-Anmeldung nicht aktiv.
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_enabled_at TIMESTAMPTZ;
-- Zuletzt akzeptierter 30-Sekunden-Schritt; verhindert die Wiederverwendung eines Codes.
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_last_step BIGINT;
-- SHA-256-Hashes der noch unbenutzten Wiederherstellungscodes.
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_recovery_hashes TEXT[];
