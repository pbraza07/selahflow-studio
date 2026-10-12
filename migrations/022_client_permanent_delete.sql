ALTER TABLE business_client_profiles ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS business_client_profiles_deleted_at_idx ON business_client_profiles(owner,deleted_at) WHERE deleted_at IS NOT NULL;
