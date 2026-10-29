-- Separate identities cannot authenticate to owner APIs. Existing staff and records remain intact.
CREATE TABLE team_accounts (
 id TEXT PRIMARY KEY, business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
 staff_id TEXT NOT NULL, email TEXT NOT NULL, password_hash TEXT NOT NULL,
 must_change_password BOOLEAN NOT NULL DEFAULT true, active BOOLEAN NOT NULL DEFAULT true,
 profile JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(business_id,staff_id), UNIQUE(business_id,email)
);
CREATE TABLE team_sessions(token_hash TEXT PRIMARY KEY,account_id TEXT NOT NULL REFERENCES team_accounts(id) ON DELETE CASCADE,expires_at TIMESTAMPTZ NOT NULL);
CREATE TABLE team_client_notes(account_id TEXT NOT NULL REFERENCES team_accounts(id) ON DELETE CASCADE,appointment_id TEXT NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,description TEXT NOT NULL DEFAULT '',PRIMARY KEY(account_id,appointment_id));
CREATE TABLE team_media(id TEXT PRIMARY KEY,account_id TEXT NOT NULL REFERENCES team_accounts(id) ON DELETE CASCADE,appointment_id TEXT REFERENCES appointments(id) ON DELETE CASCADE,kind TEXT NOT NULL CHECK(kind IN ('portrait','client','service')),bytes BYTEA NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT now(),CHECK((kind='portrait' AND appointment_id IS NULL) OR (kind<>'portrait' AND appointment_id IS NOT NULL)));
CREATE UNIQUE INDEX team_portrait ON team_media(account_id) WHERE kind='portrait';
CREATE INDEX team_media_account ON team_media(account_id,appointment_id);
