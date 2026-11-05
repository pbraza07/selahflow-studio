-- Preserve all receipts. Fully discounted memberships/packages need an idempotent
-- provider receipt even though no money changes hands. Service receipts stay paid.
ALTER TABLE stripe_payment_receipts DROP CONSTRAINT stripe_payment_receipts_amount_cents_check;
ALTER TABLE stripe_payment_receipts ADD CONSTRAINT stripe_payment_receipts_amount_cents_check
 CHECK(amount_cents>0 OR (amount_cents=0 AND membership_id IS NOT NULL AND booking_id IS NULL));
