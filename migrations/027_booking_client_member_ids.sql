-- Link booking-generated IDs to persistent business client profiles without creating duplicates.
ALTER TABLE business_client_profiles ADD COLUMN IF NOT EXISTS member_number TEXT;
ALTER TABLE business_client_profiles ADD COLUMN IF NOT EXISTS date_of_birth DATE;
CREATE UNIQUE INDEX IF NOT EXISTS business_client_profiles_member_number_unique
 ON business_client_profiles(owner,member_number)
 WHERE member_number IS NOT NULL AND deleted_at IS NULL;
