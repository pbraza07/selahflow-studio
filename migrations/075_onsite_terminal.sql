-- Appointment-bound native collection. Existing payment history is retained.
CREATE TABLE IF NOT EXISTS business_terminal_settings (
 business_id TEXT PRIMARY KEY REFERENCES businesses(id),
 stripe_account_id TEXT NOT NULL,
 location_id TEXT NOT NULL,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE booking_payments ADD COLUMN IF NOT EXISTS terminal_payment_intent_id TEXT;
CREATE TABLE IF NOT EXISTS booking_terminal_attempts (
 payment_intent_id TEXT PRIMARY KEY,
 business_id TEXT NOT NULL REFERENCES businesses(id),
 booking_id TEXT NOT NULL,
 stripe_account_id TEXT NOT NULL,
 location_id TEXT NOT NULL,
 amount_cents INTEGER NOT NULL CHECK(amount_cents>0),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS booking_terminal_attempts_booking ON booking_terminal_attempts(business_id,booking_id);
CREATE TABLE IF NOT EXISTS native_payment_authorizations (
 code_hash TEXT PRIMARY KEY,
 challenge TEXT NOT NULL,
 state TEXT NOT NULL,
 session_hash TEXT NOT NULL,
 business_id TEXT NOT NULL REFERENCES businesses(id),
 booking_id TEXT NOT NULL,
 expires_at TIMESTAMPTZ NOT NULL DEFAULT now()+interval '2 minutes',
 grant_hash TEXT UNIQUE,
 grant_expires_at TIMESTAMPTZ,
 consumed_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS native_payment_authorizations_expiry ON native_payment_authorizations(expires_at);
