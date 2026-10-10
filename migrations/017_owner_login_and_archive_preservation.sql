-- SelahFlow v1.3.25: lossless business archive metadata and audited owner login email changes.
-- Business removal remains a status change only; original tenant-owned data stays in place.
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS restored_at TIMESTAMPTZ;
UPDATE businesses SET archived_at=updated_at WHERE status='archived' AND archived_at IS NULL;
ALTER TABLE platform_business_audit DROP CONSTRAINT IF EXISTS platform_business_audit_action_check;
ALTER TABLE platform_business_audit ADD CONSTRAINT platform_business_audit_action_check
 CHECK(action IN ('create','edit','archive','restore','suspend','activate','reset_password','change_owner_email'));
CREATE INDEX IF NOT EXISTS businesses_archived_at_idx
 ON businesses(archived_at DESC) WHERE status='archived';
