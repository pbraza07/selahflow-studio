-- Exact-recipient approval is written only after authenticated owner Send confirmation.
ALTER TABLE business_communication_recipients ADD COLUMN IF NOT EXISTS client_delivery_authorized_at TIMESTAMPTZ;
ALTER TABLE business_communication_recipients ADD COLUMN IF NOT EXISTS provider_message_id TEXT NOT NULL DEFAULT '';
ALTER TABLE business_communication_recipients ADD COLUMN IF NOT EXISTS email_provider TEXT NOT NULL DEFAULT '';
-- Preserve already confirmed unsent campaigns without replaying submitted or unknown messages.
UPDATE business_communication_recipients r SET client_delivery_authorized_at=c.queued_at
FROM business_email_campaigns c WHERE c.id=r.campaign_id AND c.business_id=r.business_id
AND c.status='queued' AND c.queued_at IS NOT NULL AND r.status IN ('queued','failed','not_configured')
AND r.client_delivery_authorized_at IS NULL;
