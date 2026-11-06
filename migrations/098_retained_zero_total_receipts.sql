-- Membership/client deletion detaches receipts instead of erasing provider
-- idempotency and accounting evidence. A retained $0 membership receipt has no
-- membership_id after deletion. Continue rejecting negatives and $0 bookings.
ALTER TABLE stripe_payment_receipts DROP CONSTRAINT stripe_payment_receipts_amount_cents_check;
ALTER TABLE stripe_payment_receipts ADD CONSTRAINT stripe_payment_receipts_amount_cents_check
 CHECK(amount_cents>0 OR (amount_cents=0 AND booking_id IS NULL));
