-- v1.3.65: preserve booking-style registration answers entered by an owner
-- directly in the Client Directory.  This is separate from spreadsheet data.
ALTER TABLE business_client_profiles
 ADD COLUMN IF NOT EXISTS registration_answers JSONB NOT NULL DEFAULT '{}'::jsonb,
 ADD COLUMN IF NOT EXISTS registration_field_labels JSONB NOT NULL DEFAULT '{}'::jsonb;
