-- Opt-in only: no existing business is enrolled or charged by this migration.
CREATE TABLE commission_billing_consents (
 id UUID PRIMARY KEY, business_id TEXT NOT NULL REFERENCES businesses(id), owner_id TEXT NOT NULL REFERENCES users(id),
 terms_version TEXT NOT NULL, signature_name TEXT NOT NULL, snapshot TEXT NOT NULL,
 accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(), activated_at TIMESTAMPTZ, stripe_setup_session_id TEXT UNIQUE
);
CREATE TABLE commission_billing_profiles (
 business_id TEXT PRIMARY KEY REFERENCES businesses(id), stripe_customer_id TEXT UNIQUE, stripe_payment_method_id TEXT,
 active_consent_id UUID REFERENCES commission_billing_consents(id), pending_consent_id UUID REFERENCES commission_billing_consents(id),
 authorized_at TIMESTAMPTZ, updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE commission_monthly_statements (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), business_id TEXT NOT NULL REFERENCES businesses(id), period TEXT NOT NULL CHECK(period ~ '^\d{4}-\d{2}$'),
 amount_cents INTEGER NOT NULL CHECK(amount_cents>0), stripe_customer_id TEXT NOT NULL, stripe_invoice_id TEXT UNIQUE,
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','open','failed','paid','void','uncollectible','review')),
 hosted_invoice_url TEXT, invoice_pdf TEXT, paid_at TIMESTAMPTZ, checked_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(business_id,period)
);
ALTER TABLE first_customer_commissions DROP CONSTRAINT first_customer_commissions_status_check;
ALTER TABLE first_customer_commissions ADD CONSTRAINT first_customer_commissions_status_check CHECK(status IN ('reserved','paid','expired','refunded','accrued','invoiced'));
ALTER TABLE first_customer_commissions ADD COLUMN collection_method TEXT NOT NULL DEFAULT 'stripe' CHECK(collection_method IN ('stripe','cash'));
ALTER TABLE first_customer_commissions ADD COLUMN earned_at TIMESTAMPTZ;
ALTER TABLE first_customer_commissions ADD COLUMN billing_statement_id UUID REFERENCES commission_monthly_statements(id);
CREATE INDEX cash_commission_unbilled_idx ON first_customer_commissions(business_id,earned_at) WHERE collection_method='cash' AND status='accrued';
