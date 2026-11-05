-- Per-member opt-in leaves every existing and future member on the plan limit.
ALTER TABLE customer_memberships ADD COLUMN weekly_limit_override BOOLEAN NOT NULL DEFAULT false;
-- Server-issued admission proof lets already accepted visits retain their weekly
-- exemption after the checkbox is turned off. Deleted appointments lose the
-- usable reference while the affected month's allocation history is retained.
CREATE TABLE membership_weekly_override_bookings (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 business_id TEXT NOT NULL REFERENCES businesses(id),
 membership_id TEXT NOT NULL REFERENCES customer_memberships(id) ON DELETE CASCADE,
 appointment_id TEXT REFERENCES appointments(id) ON DELETE SET NULL,
 authorized_date TEXT NOT NULL CHECK(authorized_date ~ '^\d{4}-\d{2}-\d{2}$'),
 authorized_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(business_id,membership_id,appointment_id)
);
CREATE INDEX membership_weekly_override_month ON membership_weekly_override_bookings(business_id,membership_id,authorized_date);
