-- Only an already-authorized business purge removes these dependent records.
-- The existing purge guard still blocks connected payment obligations/history.
ALTER TABLE business_service_agreements DROP CONSTRAINT IF EXISTS business_service_agreements_business_id_fkey;
ALTER TABLE business_service_agreements ADD CONSTRAINT business_service_agreements_business_id_fkey FOREIGN KEY(business_id) REFERENCES businesses(id) ON DELETE CASCADE;
ALTER TABLE platform_payment_refs DROP CONSTRAINT IF EXISTS platform_payment_refs_invoice_id_fkey;
ALTER TABLE platform_payment_refs ADD CONSTRAINT platform_payment_refs_invoice_id_fkey FOREIGN KEY(invoice_id) REFERENCES platform_billing_receipts(invoice_id) ON DELETE CASCADE;
ALTER TABLE platform_payment_refs DROP CONSTRAINT IF EXISTS platform_payment_refs_business_id_fkey;
ALTER TABLE platform_payment_refs ADD CONSTRAINT platform_payment_refs_business_id_fkey FOREIGN KEY(business_id) REFERENCES businesses(id) ON DELETE CASCADE;
ALTER TABLE platform_billing_receipts DROP CONSTRAINT IF EXISTS platform_billing_receipts_business_id_fkey;
ALTER TABLE platform_billing_receipts ADD CONSTRAINT platform_billing_receipts_business_id_fkey FOREIGN KEY(business_id) REFERENCES businesses(id) ON DELETE CASCADE;
-- Signup records commission consent even while both fee switches remain off.
ALTER TABLE business_commission_policies DROP CONSTRAINT IF EXISTS business_commission_policies_business_id_fkey;
ALTER TABLE business_commission_policies ADD CONSTRAINT business_commission_policies_business_id_fkey FOREIGN KEY(business_id) REFERENCES businesses(id) ON DELETE CASCADE;
