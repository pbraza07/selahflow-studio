CREATE TABLE IF NOT EXISTS business_service_agreements (
 id TEXT PRIMARY KEY, business_id TEXT NOT NULL REFERENCES businesses(id), owner_id TEXT NOT NULL REFERENCES users(id),
 version TEXT NOT NULL, plan_code TEXT NOT NULL, signature_name TEXT NOT NULL, snapshot JSONB NOT NULL, digest TEXT NOT NULL,
 accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(), ip_hash TEXT
);
ALTER TABLE business_subscriptions ADD COLUMN IF NOT EXISTS requested_plan_code TEXT;
ALTER TABLE business_subscriptions ADD COLUMN IF NOT EXISTS billing_status TEXT NOT NULL DEFAULT 'none';
ALTER TABLE business_subscriptions ADD COLUMN IF NOT EXISTS billing_price_id TEXT;
ALTER TABLE business_subscriptions ADD COLUMN IF NOT EXISTS billing_checkout_session_id TEXT;
ALTER TABLE business_subscriptions ADD COLUMN IF NOT EXISTS billing_checkout_plan TEXT;
ALTER TABLE business_subscriptions ADD COLUMN IF NOT EXISTS billing_period_end TIMESTAMPTZ;
ALTER TABLE business_subscriptions ADD COLUMN IF NOT EXISTS billing_managed BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE business_subscriptions ADD COLUMN IF NOT EXISTS billing_risk_hold BOOLEAN NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS platform_billing_receipts(invoice_id TEXT PRIMARY KEY,business_id TEXT NOT NULL REFERENCES businesses(id),subscription_id TEXT NOT NULL,amount_cents INTEGER NOT NULL,currency TEXT NOT NULL,period_end TIMESTAMPTZ NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS platform_payment_refs(payment_intent_id TEXT PRIMARY KEY,invoice_id TEXT NOT NULL REFERENCES platform_billing_receipts(invoice_id),business_id TEXT NOT NULL REFERENCES businesses(id));
CREATE TABLE IF NOT EXISTS platform_billing_events(event_id TEXT PRIMARY KEY,event_type TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT now());
