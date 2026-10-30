-- One transactional sequence per business. Existing client IDs are untouched.
ALTER TABLE businesses ADD COLUMN member_id_sequence INTEGER NOT NULL DEFAULT 1000 CHECK(member_id_sequence BETWEEN 1000 AND 9999);
-- An ID-less profile may receive its first immutable registration identity.
CREATE OR REPLACE FUNCTION protect_business_member_id() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE biz TEXT; who TEXT; saved TEXT; retired TIMESTAMPTZ;
BEGIN
 IF NEW.member_number IS NULL THEN RETURN NEW; END IF;
 IF NEW.member_number !~ '^[A-Z]{2}([0-9]{4}|[0-9]{6})$' THEN RAISE EXCEPTION 'Membership IDs must contain two letters and four or six digits' USING ERRCODE='23514'; END IF;
 IF TG_TABLE_NAME='business_client_profiles' THEN SELECT id INTO biz FROM businesses WHERE owner_id=NEW.owner;who:=member_identity_key(NEW.name,NEW.date_of_birth);
 ELSIF TG_TABLE_NAME='customer_booking_ids' THEN biz:=NEW.business_id;who:=member_identity_key(NEW.first_name||' '||NEW.last_name,NEW.date_of_birth);
 ELSE biz:=NEW.business_id;who:=member_identity_key(NEW.customer_name,NEW.date_of_birth); END IF;
 IF NEW.registration_identity IS NOT NULL THEN
  who:='registration:'||NEW.registration_identity::text;
  IF EXISTS(SELECT 1 FROM deleted_client_records WHERE business_id=biz AND source_table='registration_identity' AND record_digest=md5(NEW.registration_identity::text)) THEN RAISE EXCEPTION 'Deleted registration cannot be restored'; END IF;
 END IF;
 IF TG_OP='UPDATE' AND NEW.registration_identity IS DISTINCT FROM OLD.registration_identity AND NOT(OLD.registration_identity IS NULL AND OLD.member_number IS NULL) THEN RAISE EXCEPTION 'Registration identity is immutable'; END IF;
 INSERT INTO business_member_ids(business_id,member_number,identity_key) VALUES(biz,NEW.member_number,who) ON CONFLICT DO NOTHING;
 SELECT identity_key,retired_at INTO saved,retired FROM business_member_ids WHERE business_id=biz AND member_number=NEW.member_number;
 IF saved IS DISTINCT FROM who OR retired IS NOT NULL THEN RAISE EXCEPTION 'Membership ID already belongs to another active client in this business' USING ERRCODE='23505'; END IF;
 RETURN NEW;
END $$;
