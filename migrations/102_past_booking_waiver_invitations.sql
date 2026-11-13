CREATE TABLE IF NOT EXISTS booking_waiver_invitations (
 token_hash TEXT PRIMARY KEY,
 business_id TEXT NOT NULL REFERENCES businesses(id),
 appointment_id TEXT NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
 destination TEXT NOT NULL,
 participant_name TEXT NOT NULL,
 member_number TEXT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 expires_at TIMESTAMPTZ NOT NULL DEFAULT (now()+interval '30 days'),
 completed_at TIMESTAMPTZ,
 waiver_id UUID,
 UNIQUE(appointment_id)
);
ALTER TABLE booking_receipt_emails DROP CONSTRAINT IF EXISTS booking_receipt_emails_event_type_check;
ALTER TABLE booking_receipt_emails ADD CONSTRAINT booking_receipt_emails_event_type_check CHECK(event_type IN ('submission','approval','waiver_request'));
