ALTER TABLE business_email_campaigns ADD COLUMN attachments jsonb NOT NULL DEFAULT '[]'::jsonb;
