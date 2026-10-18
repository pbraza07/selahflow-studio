ALTER TABLE business_member_ids ADD COLUMN IF NOT EXISTS retired_at TIMESTAMPTZ;
CREATE TABLE IF NOT EXISTS staging_registration_resets (
 operation_id TEXT PRIMARY KEY,
 business_id TEXT NOT NULL REFERENCES businesses(id),
 profile_id TEXT NOT NULL,
 result JSONB NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Direct bookings use the same private payment/delivery flow without an approval request.
ALTER TABLE booking_client_flows ALTER COLUMN request_id DROP NOT NULL;
CREATE TABLE IF NOT EXISTS owner_history_hidden (
 owner TEXT NOT NULL REFERENCES users(id),
 history_id TEXT NOT NULL,
 PRIMARY KEY(owner,history_id)
);
CREATE TABLE IF NOT EXISTS staging_email_verifications (
 operation_id TEXT PRIMARY KEY,
 business_id TEXT NOT NULL REFERENCES businesses(id),
 result JSONB NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- A retired reservation cannot be recreated by an older instance during rollout.
CREATE OR REPLACE FUNCTION protect_business_member_id() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE biz TEXT; who TEXT; saved TEXT; retired TIMESTAMPTZ;
BEGIN
 IF NEW.member_number IS NULL THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' AND NEW.member_number IS NOT DISTINCT FROM OLD.member_number THEN RETURN NEW; END IF;
 IF TG_TABLE_NAME='business_client_profiles' THEN
  SELECT id INTO biz FROM businesses WHERE owner_id=NEW.owner;
  who:=member_identity_key(NEW.name,NEW.date_of_birth);
 ELSIF TG_TABLE_NAME='customer_booking_ids' THEN
  biz:=NEW.business_id;who:=member_identity_key(NEW.first_name||' '||NEW.last_name,NEW.date_of_birth);
 ELSE
  biz:=NEW.business_id;who:=member_identity_key(NEW.customer_name,NEW.date_of_birth);
 END IF;
 INSERT INTO business_member_ids(business_id,member_number,identity_key) VALUES(biz,NEW.member_number,who) ON CONFLICT DO NOTHING;
 SELECT identity_key,retired_at INTO saved,retired FROM business_member_ids WHERE business_id=biz AND member_number=NEW.member_number;
 IF saved IS DISTINCT FROM who THEN RAISE EXCEPTION 'Membership ID already belongs to another client in this business' USING ERRCODE='23505'; END IF;
 IF retired IS NOT NULL THEN RAISE EXCEPTION 'This registration ID was retired. Register again for a new six-character ID' USING ERRCODE='23505'; END IF;
 RETURN NEW;
END $$;
