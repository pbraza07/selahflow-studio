-- Submission receipts exist before an appointment is approved. No payment tokens
-- or financial state are changed by this separate durable email outbox.
CREATE TABLE IF NOT EXISTS booking_receipt_emails (
 booking_key TEXT NOT NULL,
 event_type TEXT NOT NULL CHECK(event_type IN ('submission','approval')),
 business_id TEXT NOT NULL REFERENCES businesses(id),
 destination TEXT NOT NULL,
 destination_masked TEXT NOT NULL,
 message JSONB NOT NULL,
 status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','processing','submitted','failed','not_configured','invalid_destination','unknown','superseded')),
 attempts INTEGER NOT NULL DEFAULT 0,
 detail TEXT NOT NULL DEFAULT '',
 next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(booking_key,event_type)
);
CREATE INDEX IF NOT EXISTS booking_receipt_emails_due ON booking_receipt_emails(status,next_attempt_at);
