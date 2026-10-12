CREATE TABLE IF NOT EXISTS customer_booking_push (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, booking_id TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE, endpoint TEXT NOT NULL, p256dh TEXT NOT NULL, auth TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(owner_id,booking_id,endpoint));
CREATE INDEX IF NOT EXISTS customer_booking_push_booking ON customer_booking_push(owner_id,booking_id);
CREATE TABLE IF NOT EXISTS customer_booking_access (token_hash TEXT PRIMARY KEY, owner_id TEXT NOT NULL, booking_id TEXT NOT NULL, expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '180 days'));
CREATE INDEX IF NOT EXISTS customer_booking_access_booking ON customer_booking_access(owner_id,booking_id);
