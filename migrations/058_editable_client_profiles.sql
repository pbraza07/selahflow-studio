-- Explicit name parts and prior ID links preserve corrected profiles and their history.
ALTER TABLE business_client_profiles ADD COLUMN IF NOT EXISTS first_name TEXT NOT NULL DEFAULT '';
ALTER TABLE business_client_profiles ADD COLUMN IF NOT EXISTS last_name TEXT NOT NULL DEFAULT '';
ALTER TABLE business_client_profiles ADD COLUMN IF NOT EXISTS previous_member_numbers JSONB NOT NULL DEFAULT '[]'::jsonb;
