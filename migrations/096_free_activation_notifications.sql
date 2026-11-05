-- A verified zero-total membership receipt is an activation, not a cash payment.
ALTER TABLE owner_payment_push_events DROP CONSTRAINT owner_payment_push_events_amount_cents_check;
ALTER TABLE owner_payment_push_events ADD CONSTRAINT owner_payment_push_events_amount_cents_check
 CHECK(amount_cents>0 OR (amount_cents=0 AND kind IN ('membership','package')));
CREATE OR REPLACE FUNCTION capture_owner_membership_payment() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.event_type<>'payment_confirmed' OR NEW.amount_cents<0 THEN RETURN NEW; END IF;
 IF NEW.amount_cents=0 AND NOT EXISTS(
  SELECT 1 FROM stripe_payment_receipts r JOIN customer_memberships m
   ON m.id=r.membership_id AND m.business_id=r.business_id
  WHERE r.business_id=NEW.business_id AND r.membership_id=NEW.membership_id
   AND r.stripe_account_id=m.stripe_account_id AND r.amount_cents=0
   AND NEW.appointment_id='stripe:'||r.provider_reference
 ) THEN RETURN NEW; END IF;
 INSERT INTO owner_payment_push_events(business_id,kind,source_id,amount_cents)
 SELECT NEW.business_id,CASE WHEN m.billing_type='package' THEN 'package' ELSE 'membership' END,NEW.id,NEW.amount_cents
 FROM customer_memberships m JOIN businesses b ON b.id=m.business_id AND b.status='active'
 WHERE m.id=NEW.membership_id AND m.business_id=NEW.business_id
 ON CONFLICT DO NOTHING;
 RETURN NEW;
END $$;
