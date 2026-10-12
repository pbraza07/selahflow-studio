ALTER TABLE customer_memberships ADD COLUMN IF NOT EXISTS member_number TEXT;
ALTER TABLE customer_memberships ADD COLUMN IF NOT EXISTS sessions_included INTEGER NOT NULL DEFAULT 0;
ALTER TABLE customer_memberships ADD COLUMN IF NOT EXISTS sessions_used INTEGER NOT NULL DEFAULT 0;
ALTER TABLE membership_plans ADD COLUMN IF NOT EXISTS sessions_included INTEGER NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX IF NOT EXISTS customer_memberships_number_unique ON customer_memberships(business_id,member_number) WHERE member_number IS NOT NULL;
CREATE TABLE IF NOT EXISTS business_entitlement_overrides (business_id TEXT PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,limits JSONB NOT NULL DEFAULT '{}'::jsonb,updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
