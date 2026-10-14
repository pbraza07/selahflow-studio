-- v1.3.63: membership-only client cards use a stable membership-<uuid> source key.
-- These cards can now be removed from and restored to an owner's directory.
ALTER TABLE business_client_profiles DROP CONSTRAINT IF EXISTS client_profile_source_length;
ALTER TABLE business_client_profiles ADD CONSTRAINT client_profile_source_length
 CHECK (source_key IS NULL OR length(source_key) BETWEEN 1 AND 64);
