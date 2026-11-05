-- One durable email digest per business, recipient and Eastern calendar day.
-- Existing payment records and manual payment-request counters are untouched.
CREATE TABLE payment_reminder_runs (
 business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
 reminder_day DATE NOT NULL,
 status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','processing','complete','failed')),
 attempts INTEGER NOT NULL DEFAULT 0,
 next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(business_id,reminder_day)
);
CREATE INDEX payment_reminder_runs_due ON payment_reminder_runs(reminder_day,status,next_attempt_at,business_id);
CREATE TABLE daily_payment_reminders (
 id TEXT PRIMARY KEY,
 business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
 reminder_day DATE NOT NULL,
 destination TEXT NOT NULL CHECK(destination=lower(btrim(destination))),
 destination_masked TEXT NOT NULL,
 sources JSONB NOT NULL CHECK(jsonb_typeof(sources)='array'),
 status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','processing','submitted','failed','not_configured','invalid_destination','unknown','superseded')),
 attempts INTEGER NOT NULL DEFAULT 0,
 detail TEXT NOT NULL DEFAULT '',
 provider TEXT,
 provider_message_id TEXT,
 next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(business_id,destination,reminder_day)
);
CREATE INDEX daily_payment_reminders_due ON daily_payment_reminders(reminder_day,status,next_attempt_at);
