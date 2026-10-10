-- SelahFlow v1.3.24: manually approved, business-specific extra team seats.
-- No change to business_subscriptions or automated billing.
CREATE TABLE IF NOT EXISTS business_team_seat_requests (
 id TEXT PRIMARY KEY,
 business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
 requested_by TEXT NOT NULL REFERENCES users(id),
 team_member_name TEXT NOT NULL CHECK (char_length(team_member_name) BETWEEN 2 AND 100),
 reason TEXT NOT NULL CHECK (char_length(reason) BETWEEN 5 AND 1000),
 status TEXT NOT NULL DEFAULT 'pending'
   CHECK (status IN ('pending','approved','declined','withdrawn','revoked')),
 review_note TEXT NOT NULL DEFAULT '' CHECK (char_length(review_note)<=1000),
 reviewed_by TEXT REFERENCES users(id),
 reviewed_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS business_team_seat_one_pending_idx
 ON business_team_seat_requests(business_id) WHERE status='pending';
CREATE INDEX IF NOT EXISTS business_team_seat_review_idx
 ON business_team_seat_requests(status,created_at DESC);
CREATE INDEX IF NOT EXISTS business_team_seat_business_idx
 ON business_team_seat_requests(business_id,created_at DESC);
