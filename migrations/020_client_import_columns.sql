ALTER TABLE business_client_profiles ADD COLUMN IF NOT EXISTS import_columns JSONB NOT NULL DEFAULT '{}'::jsonb;
