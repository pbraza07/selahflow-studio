-- Setup preferences are separate from verified merchant connections and payments.
-- A Helcim request never enables collection or modifies existing Stripe billing.
CREATE TABLE IF NOT EXISTS business_payment_preferences (
 business_id TEXT PRIMARY KEY REFERENCES businesses(id),
 preferred_provider TEXT NOT NULL DEFAULT 'stripe' CHECK (preferred_provider IN ('stripe','helcim')),
 helcim_requested_at TIMESTAMPTZ,
 updated_by TEXT NOT NULL REFERENCES users(id),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
