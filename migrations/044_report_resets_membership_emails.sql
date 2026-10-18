CREATE TABLE IF NOT EXISTS owner_report_hidden_payments (
 owner TEXT NOT NULL REFERENCES users(id),
 payment_key TEXT NOT NULL,
 reset_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(owner,payment_key)
);
CREATE TABLE IF NOT EXISTS membership_payment_emails (
 payment_id TEXT PRIMARY KEY REFERENCES membership_session_ledger(id) ON DELETE CASCADE,
 business_id TEXT NOT NULL REFERENCES businesses(id),
 membership_id TEXT NOT NULL REFERENCES customer_memberships(id) ON DELETE CASCADE,
 destination TEXT NOT NULL,
 destination_masked TEXT NOT NULL,
 snapshot JSONB NOT NULL,
 message JSONB NOT NULL,
 status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','processing','submitted','failed','not_configured','invalid_destination','unknown','superseded')),
 attempts INTEGER NOT NULL DEFAULT 0,
 detail TEXT NOT NULL DEFAULT '',
 next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS membership_payment_emails_due ON membership_payment_emails(status,next_attempt_at);
