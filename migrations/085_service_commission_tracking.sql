-- Accounting snapshots only: no enrollment, fee activation or provider calls.
CREATE TABLE service_payment_audit (
 id BIGSERIAL PRIMARY KEY, business_id TEXT NOT NULL REFERENCES businesses(id),
 owner_id TEXT NOT NULL, business_name TEXT NOT NULL,
 source_type TEXT NOT NULL CHECK(source_type IN ('booking','cash_sale')), source_id TEXT NOT NULL,
 staff_id TEXT, staff_name TEXT NOT NULL, service_names JSONB NOT NULL DEFAULT '[]',
 service_cents INTEGER CHECK(service_cents>=0), service_date TEXT NOT NULL,
 paid_at TIMESTAMPTZ, payment_provider TEXT NOT NULL, payment_reference TEXT NOT NULL,
 attribution_basis TEXT NOT NULL, commission_id UUID REFERENCES first_customer_commissions(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(business_id,source_type,source_id)
);
CREATE UNIQUE INDEX service_payment_commission_once ON service_payment_audit(commission_id) WHERE commission_id IS NOT NULL;
CREATE INDEX service_payment_business_date ON service_payment_audit(business_id,service_date,staff_id);

CREATE FUNCTION record_booking_service_payment(a appointments, historical BOOLEAN DEFAULT false) RETURNS void LANGUAGE plpgsql AS $$
DECLARE b businesses; d JSONB; cfg JSONB; member_name TEXT; cents INTEGER; claim UUID; observed_paid_at TIMESTAMPTZ;
BEGIN
 d:=a.data::jsonb;
 SELECT * INTO b FROM businesses WHERE owner_id=a.owner;
 IF b.id IS NULL OR NOT (COALESCE(d->>'paymentStatus','')='paid' OR EXISTS(SELECT 1 FROM booking_payments WHERE business_id=b.id AND booking_id=a.id AND status='paid')) THEN RETURN; END IF;
 SELECT data::jsonb INTO cfg FROM settings WHERE owner=a.owner;
 SELECT value->>'name' INTO member_name FROM jsonb_array_elements(COALESCE(cfg->'staff','[]')) WHERE value->>'id'=a.staff LIMIT 1;
 cents:=CASE WHEN d->>'membershipCovered'='true' THEN 0 WHEN COALESCE(d->>'price','') ~ '^[0-9]+(\.[0-9]+)?$' THEN round((d->>'price')::numeric*100)::integer ELSE NULL END;
 SELECT id INTO claim FROM first_customer_commissions WHERE business_id=b.id AND kind='booking' AND source_id=a.id ORDER BY (status IN ('paid','refunded','accrued','invoiced')) DESC,created_at DESC LIMIT 1;
 SELECT paid_at INTO observed_paid_at FROM booking_payments WHERE business_id=b.id AND booking_id=a.id AND status='paid';
 IF observed_paid_at IS NULL THEN SELECT min(e.created::timestamptz) INTO observed_paid_at FROM events e WHERE e.owner=a.owner AND e.kind='cash_sale' AND e.data::jsonb->>'bookingId'=a.id; END IF;
 IF observed_paid_at IS NULL AND NOT historical THEN observed_paid_at:=now(); END IF;
 INSERT INTO service_payment_audit(business_id,owner_id,business_name,source_type,source_id,staff_id,staff_name,service_names,service_cents,service_date,paid_at,payment_provider,payment_reference,attribution_basis,commission_id)
 VALUES(b.id,a.owner,b.name,'booking',a.id,NULLIF(a.staff,''),COALESCE(member_name,CASE WHEN NULLIF(a.staff,'') IS NULL THEN 'Owner / unassigned' ELSE 'Former team member' END),
 CASE WHEN jsonb_typeof(d->'services')='array' THEN d->'services' ELSE '[]'::jsonb END,cents,a.date,observed_paid_at,
 COALESCE(d->>'paymentProvider','recorded payment'),COALESCE(d->>'paymentReference',a.id),CASE WHEN historical AND observed_paid_at IS NULL THEN 'Retained booking assignment; payment time unavailable' WHEN historical THEN 'Retained booking assignment' ELSE 'Booking assignment at payment' END,claim)
 ON CONFLICT DO NOTHING;
END $$;
CREATE FUNCTION capture_booking_service_payment() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN PERFORM record_booking_service_payment(NEW,false); RETURN NEW; END $$;
CREATE TRIGGER service_payment_booking_capture AFTER INSERT OR UPDATE OF data ON appointments FOR EACH ROW EXECUTE FUNCTION capture_booking_service_payment();

CREATE FUNCTION record_cash_service_payment(e events,historical BOOLEAN DEFAULT false) RETURNS void LANGUAGE plpgsql AS $$
DECLARE b businesses; d JSONB; cfg JSONB; lines JSONB; amount NUMERIC; member_id TEXT; member_name TEXT; claim UUID;
BEGIN
 IF e.kind<>'cash_sale' THEN RETURN; END IF;
 d:=e.data::jsonb;
 IF NULLIF(d->>'bookingId','') IS NOT NULL OR jsonb_typeof(d->'lines')<>'array' THEN RETURN; END IF;
 SELECT jsonb_agg(value),CASE WHEN bool_and(COALESCE(value->>'price','') ~ '^[0-9]+(\.[0-9]+)?$' AND COALESCE(value->>'qty','') ~ '^[0-9]+$') THEN sum(CASE WHEN COALESCE(value->>'price','') ~ '^[0-9]+(\.[0-9]+)?$' AND COALESCE(value->>'qty','') ~ '^[0-9]+$' THEN round((value->>'price')::numeric*100)*(value->>'qty')::numeric ELSE NULL END) ELSE NULL END
 INTO lines,amount FROM jsonb_array_elements(d->'lines') WHERE value->>'type'='service';
 IF lines IS NULL THEN RETURN; END IF;
 SELECT * INTO b FROM businesses WHERE owner_id=e.owner; IF b.id IS NULL THEN RETURN; END IF;
 SELECT data::jsonb INTO cfg FROM settings WHERE owner=e.owner;
 SELECT value->>'id',value->>'name' INTO member_id,member_name FROM jsonb_array_elements(COALESCE(cfg->'staff','[]')) WHERE value->>'id'=d->>'staffId' LIMIT 1;
 IF member_id IS NULL AND d->>'confirmedRole'='team' THEN
 SELECT a.staff_id,COALESCE(s.value->>'name','Former team member') INTO member_id,member_name FROM team_accounts a LEFT JOIN LATERAL jsonb_array_elements(COALESCE(cfg->'staff','[]')) s(value) ON s.value->>'id'=a.staff_id WHERE a.id=d->>'confirmedBy' AND a.business_id=b.id;
 END IF;
 SELECT id INTO claim FROM first_customer_commissions WHERE business_id=b.id AND kind='booking' AND source_id=e.id ORDER BY (status IN ('paid','refunded','accrued','invoiced')) DESC,created_at DESC LIMIT 1;
 INSERT INTO service_payment_audit(business_id,owner_id,business_name,source_type,source_id,staff_id,staff_name,service_names,service_cents,service_date,paid_at,payment_provider,payment_reference,attribution_basis,commission_id)
 VALUES(b.id,b.owner_id,b.name,'cash_sale',e.id,member_id,COALESCE(member_name,'Owner / unassigned'),(SELECT jsonb_agg(value->>'name') FROM jsonb_array_elements(lines)),amount::integer,(e.created::timestamptz AT TIME ZONE 'America/New_York')::date::text,e.created::timestamptz,'cash',e.id,CASE WHEN historical THEN 'Retained cash receipt' ELSE 'Cash receipt assignment' END,claim) ON CONFLICT DO NOTHING;
END $$;
CREATE FUNCTION capture_cash_service_payment() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN PERFORM record_cash_service_payment(NEW,false); RETURN NEW; END $$;
CREATE TRIGGER service_payment_cash_capture AFTER INSERT ON events FOR EACH ROW WHEN(NEW.kind='cash_sale') EXECUTE FUNCTION capture_cash_service_payment();

-- Reconstruct retained receipts only; unidentified/deleted sources remain explicit
-- in reports. Never alter original appointments, fees, consents or settlements.
SELECT record_booking_service_payment(a,true) FROM appointments a WHERE a.data::jsonb->>'paymentStatus'='paid' OR EXISTS(SELECT 1 FROM booking_payments p JOIN businesses b ON b.id=p.business_id WHERE p.booking_id=a.id AND b.owner_id=a.owner AND p.status='paid');
SELECT record_cash_service_payment(e,true) FROM events e WHERE e.kind='cash_sale';

-- A delayed claim can attach to an already retained receipt, but source deletion
-- never detaches a durable financial link or changes its assignment/amount.
CREATE FUNCTION link_service_payment_commission() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.kind='booking' AND NEW.source_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM service_payment_audit WHERE commission_id=NEW.id) THEN
  UPDATE service_payment_audit SET commission_id=NEW.id WHERE id=(SELECT id FROM service_payment_audit WHERE business_id=NEW.business_id AND source_id=NEW.source_id AND commission_id IS NULL ORDER BY source_type,id LIMIT 1);
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER service_payment_claim_link AFTER INSERT OR UPDATE OF source_id,status ON first_customer_commissions FOR EACH ROW EXECUTE FUNCTION link_service_payment_commission();
