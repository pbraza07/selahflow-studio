-- Keep existing authorizations and first-of-next-month collection unchanged.
ALTER TABLE commission_billing_profiles ADD COLUMN collection_day INTEGER NOT NULL DEFAULT 0 CHECK(collection_day BETWEEN 0 AND 31);
ALTER TABLE commission_monthly_statements ADD COLUMN collection_on DATE;
CREATE TABLE commission_billing_schedule_changes (
 id UUID PRIMARY KEY, business_id TEXT NOT NULL REFERENCES businesses(id), owner_id TEXT NOT NULL REFERENCES users(id),
 collection_day INTEGER NOT NULL CHECK(collection_day BETWEEN 0 AND 31), snapshot TEXT NOT NULL, accepted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
