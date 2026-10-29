-- Match the platform's explicit permanent-business purge workflow.
-- Ordinary archive/restore retains these setup preferences unchanged.
ALTER TABLE business_payment_preferences DROP CONSTRAINT business_payment_preferences_business_id_fkey;
ALTER TABLE business_payment_preferences ADD CONSTRAINT business_payment_preferences_business_id_fkey
 FOREIGN KEY(business_id) REFERENCES businesses(id) ON DELETE CASCADE;
ALTER TABLE business_payment_preferences ALTER COLUMN updated_by DROP NOT NULL;
ALTER TABLE business_payment_preferences DROP CONSTRAINT business_payment_preferences_updated_by_fkey;
ALTER TABLE business_payment_preferences ADD CONSTRAINT business_payment_preferences_updated_by_fkey
 FOREIGN KEY(updated_by) REFERENCES users(id) ON DELETE SET NULL;
