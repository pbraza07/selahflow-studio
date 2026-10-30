-- v1.3.186: durable, per-team-member read state for appointment confirmation bells.
ALTER TABLE team_booking_push_jobs ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS team_booking_bell_unread ON team_booking_push_jobs(account_id,created_at DESC) WHERE read_at IS NULL;
