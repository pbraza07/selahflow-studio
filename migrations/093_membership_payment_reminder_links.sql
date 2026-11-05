-- Private payment access for automated reminders is separate from owner-sent
-- invitations, so reminders never inflate the manual Send for Payment counter.
CREATE TABLE membership_payment_reminder_links (
 membership_id TEXT PRIMARY KEY REFERENCES customer_memberships(id) ON DELETE CASCADE,
 business_id TEXT NOT NULL REFERENCES businesses(id),
 token_hash TEXT NOT NULL UNIQUE,
 destination TEXT NOT NULL,
 payment_url TEXT NOT NULL,
 expires_at TIMESTAMPTZ NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX membership_payment_reminder_links_business_idx ON membership_payment_reminder_links(business_id);
