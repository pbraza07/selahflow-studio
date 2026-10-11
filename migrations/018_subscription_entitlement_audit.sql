-- SelahFlow v1.3.29: audited manual plan entitlement changes only.
-- No Stripe charges or fake payment/subscription records are created.
CREATE TABLE IF NOT EXISTS business_plan_entitlement_audit (
 id TEXT PRIMARY KEY,
 business_id TEXT NOT NULL REFERENCES businesses(id),
 actor_id TEXT NOT NULL REFERENCES users(id),
 previous_plan TEXT NOT NULL CHECK (previous_plan IN ('free','professional','business')),
 new_plan TEXT NOT NULL CHECK (new_plan IN ('free','professional','business')),
 reason TEXT NOT NULL CHECK (char_length(reason) BETWEEN 10 AND 1000),
 change_source TEXT NOT NULL DEFAULT 'manual_admin' CHECK (change_source='manual_admin'),
 payment_collected BOOLEAN NOT NULL DEFAULT FALSE CHECK (payment_collected=FALSE),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS business_plan_entitlement_history_idx
 ON business_plan_entitlement_audit(business_id,created_at DESC);
