-- Prospective, explicitly activated business fees. Existing financial history stays intact.
CREATE TABLE IF NOT EXISTS business_commission_policies (
 business_id TEXT PRIMARY KEY REFERENCES businesses(id),
 identity_salt UUID NOT NULL DEFAULT gen_random_uuid(),
 booking_enabled BOOLEAN NOT NULL DEFAULT false,
 membership_enabled BOOLEAN NOT NULL DEFAULT false,
 booking_enabled_at TIMESTAMPTZ,
 membership_enabled_at TIMESTAMPTZ,
 terms_version TEXT,
 accepted_by TEXT,
 accepted_at TIMESTAMPTZ,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS first_customer_commissions (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 business_id TEXT NOT NULL REFERENCES businesses(id),
 identity_digest TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('booking','membership')),
 source_id TEXT,
 stripe_account_id TEXT NOT NULL,
 stripe_checkout_session_id TEXT,
 stripe_payment_intent_id TEXT,
 stripe_application_fee_id TEXT,
 gross_cents INTEGER NOT NULL CHECK(gross_cents>0),
 eligible_cents INTEGER NOT NULL CHECK(eligible_cents>0 AND eligible_cents<=gross_cents),
 fee_cents INTEGER NOT NULL CHECK(fee_cents>0 AND fee_cents<gross_cents),
 refunded_fee_cents INTEGER NOT NULL DEFAULT 0 CHECK(refunded_fee_cents>=0 AND refunded_fee_cents<=fee_cents),
 status TEXT NOT NULL DEFAULT 'reserved' CHECK(status IN ('reserved','paid','expired','refunded')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 paid_at TIMESTAMPTZ,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(business_id,identity_digest,kind)
);
CREATE INDEX IF NOT EXISTS commission_business_source_idx ON first_customer_commissions(business_id,kind,source_id);
CREATE UNIQUE INDEX IF NOT EXISTS commission_session_idx ON first_customer_commissions(stripe_checkout_session_id) WHERE stripe_checkout_session_id IS NOT NULL;
ALTER TABLE customer_memberships ADD COLUMN IF NOT EXISTS stripe_initial_checkout_mode TEXT;
ALTER TABLE customer_memberships ADD COLUMN IF NOT EXISTS stripe_renewal_product_id TEXT;
ALTER TABLE customer_memberships ADD COLUMN IF NOT EXISTS stripe_renewal_coupon_id TEXT;
ALTER TABLE customer_memberships ADD COLUMN IF NOT EXISTS stripe_initial_paid_at TIMESTAMPTZ;
ALTER TABLE customer_memberships ADD COLUMN IF NOT EXISTS stripe_recurring_authorized_at TIMESTAMPTZ;

ALTER TABLE business_client_profiles ADD COLUMN IF NOT EXISTS commission_existing_client BOOLEAN NOT NULL DEFAULT false;
