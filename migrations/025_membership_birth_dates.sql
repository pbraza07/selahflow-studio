ALTER TABLE customer_memberships ADD COLUMN IF NOT EXISTS date_of_birth DATE;
CREATE UNIQUE INDEX IF NOT EXISTS customer_memberships_identity_dob_unique ON customer_memberships(business_id, lower(trim(customer_name)), date_of_birth) WHERE date_of_birth IS NOT NULL;
