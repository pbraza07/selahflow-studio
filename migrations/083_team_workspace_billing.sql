-- Existing team access stays free; no employee is enrolled or charged by migration.
ALTER TABLE team_accounts ADD COLUMN can_create_sessions BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE team_accounts ADD COLUMN workspace_fee_cents INTEGER NOT NULL DEFAULT 0 CHECK(workspace_fee_cents BETWEEN 0 AND 10000000);
ALTER TABLE team_accounts ADD COLUMN workspace_interval TEXT NOT NULL DEFAULT 'month' CHECK(workspace_interval IN ('week','month','year'));
ALTER TABLE team_accounts ADD COLUMN workspace_price_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE team_accounts ADD COLUMN workspace_paid_through TIMESTAMPTZ;
ALTER TABLE team_accounts ADD COLUMN workspace_billing_status TEXT NOT NULL DEFAULT 'free';
ALTER TABLE team_accounts ADD COLUMN workspace_stripe_account_id TEXT;
ALTER TABLE team_accounts ADD COLUMN workspace_checkout_id TEXT;
ALTER TABLE team_accounts ADD COLUMN workspace_checkout_generation INTEGER NOT NULL DEFAULT 0;
ALTER TABLE team_accounts ADD COLUMN workspace_subscription_id TEXT;
ALTER TABLE team_accounts ADD COLUMN workspace_customer_id TEXT;
ALTER TABLE team_accounts ADD COLUMN workspace_risk_hold BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE team_accounts ADD COLUMN workspace_consent_at TIMESTAMPTZ;
ALTER TABLE team_accounts ADD COLUMN workspace_consent_version INTEGER;
CREATE UNIQUE INDEX team_workspace_subscription ON team_accounts(workspace_stripe_account_id,workspace_subscription_id) WHERE workspace_subscription_id IS NOT NULL;
CREATE TABLE team_workspace_payments(
 stripe_account_id TEXT NOT NULL, invoice_id TEXT NOT NULL, business_id TEXT NOT NULL REFERENCES businesses(id),
 account_id TEXT NOT NULL REFERENCES team_accounts(id), subscription_id TEXT NOT NULL,
 amount_cents INTEGER NOT NULL, paid_through TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(stripe_account_id,invoice_id)
);
ALTER TABLE team_workspace_payments ADD COLUMN payment_intent_id TEXT;
ALTER TABLE team_workspace_payments ADD COLUMN charge_id TEXT;
CREATE TABLE team_workspace_risk_signals(event_id TEXT PRIMARY KEY,business_id TEXT NOT NULL REFERENCES businesses(id),stripe_account_id TEXT NOT NULL,payment_intent_id TEXT,charge_id TEXT,event_type TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT now());
