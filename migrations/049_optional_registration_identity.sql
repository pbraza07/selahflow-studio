-- Optional answers must not merge unrelated clients with incomplete identity.
ALTER TABLE customer_booking_ids ALTER COLUMN date_of_birth DROP NOT NULL;
ALTER TABLE customer_booking_ids ADD COLUMN registration_identity UUID;
ALTER TABLE customer_memberships ADD COLUMN registration_identity UUID;
ALTER TABLE business_client_profiles ADD COLUMN registration_identity UUID;
CREATE UNIQUE INDEX booking_registration_identity_unique ON customer_booking_ids(business_id,registration_identity) WHERE registration_identity IS NOT NULL;
CREATE UNIQUE INDEX membership_registration_identity_unique ON customer_memberships(business_id,registration_identity) WHERE registration_identity IS NOT NULL;
CREATE UNIQUE INDEX profile_registration_identity_unique ON business_client_profiles(owner,registration_identity) WHERE registration_identity IS NOT NULL;
CREATE OR REPLACE FUNCTION protect_business_member_id() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE biz TEXT; who TEXT; saved TEXT; retired TIMESTAMPTZ;
BEGIN
 IF NEW.member_number IS NULL THEN RETURN NEW; END IF;
 IF NEW.member_number !~ '^[A-Z]{2}[0-9]{4}$' THEN RAISE EXCEPTION 'Membership IDs must contain exactly two letters and four digits' USING ERRCODE='23514'; END IF;
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
-- Existing triggers cover all updates; identity references cannot be reassigned.
CREATE TRIGGER booking_registration_guard BEFORE UPDATE OF registration_identity ON customer_booking_ids FOR EACH ROW EXECUTE FUNCTION protect_business_member_id();
CREATE TRIGGER membership_registration_guard BEFORE UPDATE OF registration_identity ON customer_memberships FOR EACH ROW EXECUTE FUNCTION protect_business_member_id();
CREATE TRIGGER profile_registration_guard BEFORE UPDATE OF registration_identity ON business_client_profiles FOR EACH ROW EXECUTE FUNCTION protect_business_member_id();
ALTER TABLE customer_memberships DROP CONSTRAINT customer_memberships_customer_name_check;
ALTER TABLE customer_memberships ADD CONSTRAINT customer_memberships_customer_name_check CHECK(length(trim(customer_name)) BETWEEN 2 AND 100 OR registration_identity IS NOT NULL AND length(trim(customer_name))<=100);
ALTER TABLE business_client_profiles DROP CONSTRAINT business_client_profiles_name_check;
ALTER TABLE business_client_profiles ADD CONSTRAINT business_client_profiles_name_check CHECK(length(btrim(name)) BETWEEN 1 AND 100 OR registration_identity IS NOT NULL AND name='');
