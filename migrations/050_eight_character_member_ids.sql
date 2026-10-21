-- Eight-character issuance with compatibility for existing six-character records.
-- Do not rewrite signed documents, historical appointments, payments or identities.
UPDATE businesses SET member_id_policy='initials_birthdate';
CREATE OR REPLACE FUNCTION persisted_member_number_allowed(scope TEXT,n TEXT,owner_scope BOOLEAN DEFAULT FALSE) RETURNS BOOLEAN LANGUAGE sql IMMUTABLE AS $$ SELECT n IS NULL OR n ~ '^[A-Z]{2}([0-9]{4}|[0-9]{6})$' $$;
ALTER TABLE business_member_ids DROP CONSTRAINT business_member_ids_six;
ALTER TABLE business_member_ids ADD CONSTRAINT business_member_ids_format CHECK(retired_at IS NOT NULL OR member_number ~ '^[A-Z]{2}([0-9]{4}|[0-9]{6})$') NOT VALID;
ALTER TABLE member_id_history_aliases DROP CONSTRAINT member_id_history_aliases_current_number_check;
ALTER TABLE member_id_history_aliases ADD CONSTRAINT member_id_history_aliases_current_number_check CHECK(current_number ~ '^[A-Z]{2}([0-9]{4}|[0-9]{6})$');
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
 IF TG_OP='UPDATE' AND NEW.registration_identity IS DISTINCT FROM OLD.registration_identity THEN RAISE EXCEPTION 'Registration identity is immutable'; END IF;
 INSERT INTO business_member_ids(business_id,member_number,identity_key) VALUES(biz,NEW.member_number,who) ON CONFLICT DO NOTHING;
 SELECT identity_key,retired_at INTO saved,retired FROM business_member_ids WHERE business_id=biz AND member_number=NEW.member_number;
 IF saved IS DISTINCT FROM who OR retired IS NOT NULL THEN RAISE EXCEPTION 'Membership ID already belongs to another active client in this business' USING ERRCODE='23505'; END IF;
 RETURN NEW;
END $$;
