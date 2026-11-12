-- No historical appointments are automatically marked on rollout.
ALTER TABLE businesses ADD COLUMN auto_no_show_enabled BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE businesses ADD COLUMN auto_no_show_after TIMESTAMPTZ NOT NULL DEFAULT now();
CREATE TABLE kiosk_devices (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
 token_hash TEXT UNIQUE NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), expires_at TIMESTAMPTZ NOT NULL,
 revoked_at TIMESTAMPTZ
);
CREATE TABLE kiosk_grants (
 token_hash TEXT PRIMARY KEY, device_id UUID NOT NULL REFERENCES kiosk_devices(id) ON DELETE CASCADE,
 purpose TEXT NOT NULL, data JSONB NOT NULL, expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX kiosk_grants_expiry_idx ON kiosk_grants(expires_at);
CREATE TABLE automatic_attendance (
 appointment_id TEXT PRIMARY KEY REFERENCES appointments(id) ON DELETE CASCADE,
 owner TEXT NOT NULL REFERENCES users(id), status TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0,
 detail TEXT NOT NULL DEFAULT '', updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE participation_waivers ADD COLUMN superseded_at TIMESTAMPTZ;
