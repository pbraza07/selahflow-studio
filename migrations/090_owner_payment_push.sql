-- New payment alerts only. No history backfill, payment changes or provider calls.
CREATE TABLE owner_payment_push_events (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
 kind TEXT NOT NULL CHECK(kind IN ('booking','membership','package')),
 source_id TEXT NOT NULL,
 amount_cents INTEGER NOT NULL CHECK(amount_cents>0),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(business_id,kind,source_id)
);
CREATE TABLE owner_payment_push_deliveries (
 event_id UUID NOT NULL REFERENCES owner_payment_push_events(id) ON DELETE CASCADE,
 subscription_id TEXT NOT NULL REFERENCES business_push_subscriptions(id) ON DELETE CASCADE,
 status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','processing','submitted','failed','unknown','skipped')),
 attempts INTEGER NOT NULL DEFAULT 0,
 next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(event_id,subscription_id)
);
CREATE INDEX owner_payment_push_due ON owner_payment_push_deliveries(status,next_attempt_at);

-- Capture only devices already opted in at completion. A later opt-in never
-- replays old payments, and unsubscribe cascades away any pending delivery.
CREATE FUNCTION capture_owner_payment_devices() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO owner_payment_push_deliveries(event_id,subscription_id)
 SELECT NEW.id,s.id FROM business_push_subscriptions s
 JOIN businesses b ON b.id=s.business_id AND b.status='active'
 WHERE s.business_id=NEW.business_id AND s.reviewer='owner'
 ON CONFLICT DO NOTHING;
 RETURN NEW;
END $$;
CREATE TRIGGER owner_payment_devices AFTER INSERT ON owner_payment_push_events
 FOR EACH ROW EXECUTE FUNCTION capture_owner_payment_devices();

CREATE FUNCTION capture_owner_booking_payment() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.status<>'paid' OR NEW.amount_cents<=0 OR NEW.stripe_payment_intent_id IS NULL OR
    (TG_OP='UPDATE' AND OLD.status='paid') THEN RETURN NEW; END IF;
 -- A verified receipt is written in the same transaction before status changes.
 INSERT INTO owner_payment_push_events(business_id,kind,source_id,amount_cents)
 SELECT NEW.business_id,'booking',NEW.booking_id,NEW.amount_cents
 FROM businesses b JOIN appointments a ON a.owner=b.owner_id AND a.id=NEW.booking_id
 WHERE b.id=NEW.business_id AND b.status='active' AND EXISTS(
  SELECT 1 FROM stripe_payment_receipts r WHERE r.business_id=NEW.business_id
   AND r.booking_id=NEW.booking_id AND r.stripe_account_id=NEW.stripe_account_id
   AND r.provider_reference=NEW.stripe_payment_intent_id AND r.amount_cents=NEW.amount_cents)
 ON CONFLICT DO NOTHING;
 RETURN NEW;
END $$;
CREATE TRIGGER owner_booking_payment AFTER INSERT OR UPDATE OF status ON booking_payments
 FOR EACH ROW EXECUTE FUNCTION capture_owner_booking_payment();

CREATE FUNCTION capture_owner_cash_booking_payment() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE d JSONB;
BEGIN
 d:=NEW.data::jsonb;
 IF d->>'payment' IS DISTINCT FROM 'Cash recorded manually' OR NULLIF(d->>'bookingId','') IS NULL THEN RETURN NEW; END IF;
 INSERT INTO owner_payment_push_events(business_id,kind,source_id,amount_cents)
 SELECT b.id,'booking',a.id,price.cents::integer
 FROM businesses b JOIN appointments a ON a.owner=b.owner_id AND a.id=d->>'bookingId'
 CROSS JOIN LATERAL(SELECT CASE WHEN length(a.data::jsonb->>'price')<20 AND
  COALESCE(a.data::jsonb->>'price','') ~ '^[0-9]+(\.[0-9]+)?$'
  THEN round((a.data::jsonb->>'price')::numeric*100) ELSE 0 END AS cents) price
 WHERE b.owner_id=NEW.owner AND b.status='active'
  AND COALESCE(a.data::jsonb->>'membershipCovered','false')<>'true'
  AND price.cents BETWEEN 1 AND 2147483647
 ON CONFLICT DO NOTHING;
 RETURN NEW;
END $$;
CREATE TRIGGER owner_cash_booking_payment AFTER INSERT ON events
 FOR EACH ROW WHEN(NEW.kind='cash_sale') EXECUTE FUNCTION capture_owner_cash_booking_payment();

CREATE FUNCTION capture_owner_membership_payment() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.event_type<>'payment_confirmed' OR NEW.amount_cents<=0 THEN RETURN NEW; END IF;
 INSERT INTO owner_payment_push_events(business_id,kind,source_id,amount_cents)
 SELECT NEW.business_id,CASE WHEN m.billing_type='package' THEN 'package' ELSE 'membership' END,NEW.id,NEW.amount_cents
 FROM customer_memberships m JOIN businesses b ON b.id=m.business_id AND b.status='active'
 WHERE m.id=NEW.membership_id AND m.business_id=NEW.business_id
 ON CONFLICT DO NOTHING;
 RETURN NEW;
END $$;
CREATE TRIGGER owner_membership_payment AFTER INSERT ON membership_session_ledger
 FOR EACH ROW EXECUTE FUNCTION capture_owner_membership_payment();
