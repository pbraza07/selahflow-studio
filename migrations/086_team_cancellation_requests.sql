CREATE TABLE IF NOT EXISTS team_cancellation_requests (
 id TEXT PRIMARY KEY,
 business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
 owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 appointment_id TEXT NOT NULL,
 requester_id TEXT REFERENCES team_accounts(id) ON DELETE SET NULL,
 staff_id TEXT NOT NULL,
 staff_name TEXT NOT NULL,
 reason TEXT NOT NULL CHECK(length(btrim(reason)) BETWEEN 1 AND 500),
 snapshot JSONB NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','declined')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 reviewed_at TIMESTAMPTZ,
 reviewed_by TEXT,
 owner_read_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS team_cancellation_pending ON team_cancellation_requests(business_id,appointment_id) WHERE status='pending';
CREATE INDEX IF NOT EXISTS team_cancellation_owner ON team_cancellation_requests(owner_id,status,created_at DESC);
CREATE INDEX IF NOT EXISTS team_cancellation_requester ON team_cancellation_requests(requester_id,created_at DESC);
