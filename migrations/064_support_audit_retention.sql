-- A deliberate business/account purge must not be blocked by support metadata.
-- Keep opaque audit actor/business IDs after deletion; never reattribute the action.
ALTER TABLE platform_support_sessions DROP CONSTRAINT IF EXISTS platform_support_sessions_business_id_fkey;
ALTER TABLE platform_support_sessions ADD CONSTRAINT platform_support_sessions_business_id_fkey
 FOREIGN KEY(business_id) REFERENCES businesses(id) ON DELETE CASCADE;
ALTER TABLE platform_support_audit DROP CONSTRAINT IF EXISTS platform_support_audit_business_id_fkey;
ALTER TABLE platform_support_audit DROP CONSTRAINT IF EXISTS platform_support_audit_actor_id_fkey;
