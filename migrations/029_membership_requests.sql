ALTER TABLE membership_plans ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS membership_requests (
 id TEXT PRIMARY KEY,
 business_id TEXT NOT NULL REFERENCES businesses(id),
 plan_id TEXT NOT NULL REFERENCES membership_plans(id),
 details JSONB NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','declined')),
 membership_id TEXT REFERENCES customer_memberships(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 reviewed_at TIMESTAMPTZ,
 owner_read_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS membership_requests_business_status ON membership_requests(business_id,status,created_at DESC);
