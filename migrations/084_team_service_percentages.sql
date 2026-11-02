-- Prospective only: no historical backfill, customer charge or employee debit.
CREATE TABLE team_service_rates (
 business_id TEXT NOT NULL REFERENCES businesses(id), staff_id TEXT NOT NULL,
 service_id TEXT NOT NULL DEFAULT '*', rate_bps INTEGER NOT NULL CHECK(rate_bps BETWEEN 0 AND 10000),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY(business_id,staff_id,service_id)
);
CREATE TABLE team_service_ledger (
 id BIGSERIAL PRIMARY KEY, business_id TEXT NOT NULL REFERENCES businesses(id),
 appointment_id TEXT NOT NULL, line_number INTEGER NOT NULL, staff_id TEXT NOT NULL,
 staff_name TEXT NOT NULL, service_id TEXT NOT NULL, service_name TEXT NOT NULL,
 service_date TEXT NOT NULL, client_name TEXT NOT NULL, amount_cents INTEGER NOT NULL CHECK(amount_cents>=0),
 rate_bps INTEGER NOT NULL CHECK(rate_bps BETWEEN 0 AND 10000), owner_cents INTEGER NOT NULL CHECK(owner_cents>=0),
 allocation TEXT NOT NULL, payment_status TEXT NOT NULL, voided BOOLEAN NOT NULL DEFAULT false,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(business_id,appointment_id,line_number)
);
CREATE INDEX team_service_ledger_bucket ON team_service_ledger(business_id,staff_id,service_date,id);
CREATE TABLE team_service_settlements (
 id BIGSERIAL PRIMARY KEY, business_id TEXT NOT NULL REFERENCES businesses(id), ledger_id BIGINT NOT NULL UNIQUE REFERENCES team_service_ledger(id),
 amount_cents INTEGER NOT NULL CHECK(amount_cents>0), reference TEXT NOT NULL,
 recorded_by TEXT NOT NULL REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE FUNCTION capture_team_service_percentage() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
 bid TEXT; cfg JSONB; d JSONB; ids JSONB; names JSONB; lines JSONB; item JSONB;
 n INTEGER; i INTEGER; total INTEGER; cents INTEGER; allocated INTEGER:=0; weight NUMERIC; weights NUMERIC:=0;
 sid TEXT; sname TEXT; staffname TEXT; rate INTEGER;
BEGIN
 SELECT id INTO bid FROM businesses WHERE owner_id=NEW.owner;
 IF bid IS NULL THEN RETURN NEW; END IF;
 d:=NEW.data::jsonb;
 -- Existing snapshots are never repriced or reassigned. Attendance corrections
 -- reverse/reinstate the same entries; settlement history remains intact.
 UPDATE team_service_ledger SET voided=NEW.status IN ('Cancelled','No-show'),payment_status=COALESCE(d->>'paymentStatus','unpaid')
 WHERE business_id=bid AND appointment_id=NEW.id;
 IF NEW.status NOT IN ('Checked in','Completed') THEN RETURN NEW; END IF;
 IF EXISTS(SELECT 1 FROM team_service_ledger WHERE business_id=bid AND appointment_id=NEW.id) THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' THEN
  IF OLD.status IN ('Checked in','Completed') THEN RETURN NEW; END IF;
 END IF;
 SELECT data::jsonb INTO cfg FROM settings WHERE owner=NEW.owner;
 SELECT value->>'name' INTO staffname FROM jsonb_array_elements(COALESCE(cfg->'staff','[]')) WHERE value->>'id'=NEW.staff LIMIT 1;
 staffname:=COALESCE(staffname,'Former team member');
 ids:=CASE WHEN jsonb_typeof(d->'serviceIds')='array' THEN d->'serviceIds' ELSE '[]'::jsonb END;
 names:=CASE WHEN jsonb_typeof(d->'services')='array' THEN d->'services' ELSE '[]'::jsonb END;
 lines:=CASE WHEN jsonb_typeof(d->'paymentLines')='array' THEN d->'paymentLines' ELSE '[]'::jsonb END;
 n:=GREATEST(jsonb_array_length(ids),jsonb_array_length(names),1);
 total:=CASE WHEN d->>'membershipCovered'='true' THEN 0 ELSE GREATEST(0,round(COALESCE(NULLIF(d->>'price',''),'0')::numeric*100))::integer END;
 FOR i IN 0..n-1 LOOP
  SELECT value INTO item FROM jsonb_array_elements(lines) WHERE value->>'id'=ids->>i LIMIT 1;
  IF item IS NULL OR NOT COALESCE(item->>'price','') ~ '^[0-9]+(\.[0-9]+)?$' THEN weights:=0; EXIT; END IF;
  weights:=weights+(item->>'price')::numeric;
 END LOOP;
 FOR i IN 0..n-1 LOOP
  sid:=COALESCE(ids->>i,'legacy:'||i);
  SELECT value->>'name' INTO sname FROM jsonb_array_elements(COALESCE(cfg->'services','[]')) WHERE value->>'id'=sid LIMIT 1;
  sname:=COALESCE(names->>i,sname,'Retained service');
  IF weights>0 THEN
   SELECT (value->>'price')::numeric INTO weight FROM jsonb_array_elements(lines) WHERE value->>'id'=sid LIMIT 1;
  ELSE weight:=1; END IF;
  cents:=CASE WHEN i=n-1 THEN total-allocated ELSE floor(total*weight/CASE WHEN weights>0 THEN weights ELSE n END)::integer END;
  allocated:=allocated+cents;
  SELECT rate_bps INTO rate FROM team_service_rates WHERE business_id=bid AND staff_id=NEW.staff AND service_id IN (sid,'*') ORDER BY (service_id=sid) DESC LIMIT 1;
  rate:=COALESCE(rate,0);
  INSERT INTO team_service_ledger(business_id,appointment_id,line_number,staff_id,staff_name,service_id,service_name,service_date,client_name,amount_cents,rate_bps,owner_cents,allocation,payment_status)
  VALUES(bid,NEW.id,i,NEW.staff,staffname,sid,sname,NEW.date,COALESCE(d->>'name','Client'),cents,rate,round(cents::numeric*rate/10000)::integer,
   CASE WHEN n=1 THEN 'Saved booking price' WHEN weights>0 THEN 'Saved itemized price allocation' ELSE 'Equal allocation of saved booking total' END,COALESCE(d->>'paymentStatus','unpaid'))
  ON CONFLICT DO NOTHING;
 END LOOP;
 RETURN NEW;
END $$;
CREATE TRIGGER team_service_percentage_capture AFTER INSERT OR UPDATE ON appointments FOR EACH ROW EXECUTE FUNCTION capture_team_service_percentage();
