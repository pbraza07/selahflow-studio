-- Additive staging checkout tracking. Existing bookings and manual payments stay intact.
ALTER TABLE customer_memberships ADD COLUMN IF NOT EXISTS stripe_sessions_per_period INTEGER;
ALTER TABLE customer_memberships ADD COLUMN IF NOT EXISTS stripe_signup_fingerprint TEXT;
ALTER TABLE customer_memberships ADD COLUMN IF NOT EXISTS stripe_interval_unit TEXT;
CREATE TABLE IF NOT EXISTS booking_payments (
 booking_id TEXT PRIMARY KEY,
 business_id TEXT NOT NULL REFERENCES businesses(id),
 stripe_account_id TEXT NOT NULL,
 amount_cents INTEGER NOT NULL CHECK(amount_cents>0),
 lines JSONB NOT NULL,
 stripe_checkout_session_id TEXT UNIQUE,
 stripe_payment_intent_id TEXT,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','paid','expired')),
 paid_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS stripe_payment_receipts (
 stripe_account_id TEXT NOT NULL,
 provider_reference TEXT NOT NULL,
 business_id TEXT NOT NULL REFERENCES businesses(id),
 booking_id TEXT,
 membership_id TEXT,
 amount_cents INTEGER NOT NULL CHECK(amount_cents>0),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(stripe_account_id,provider_reference)
);
