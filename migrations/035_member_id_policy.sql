ALTER TABLE businesses ADD COLUMN IF NOT EXISTS member_id_policy TEXT NOT NULL DEFAULT 'initials_birthdate'
 CHECK(member_id_policy IN ('initials_birthdate','initials_sequence','random'));
CREATE TABLE IF NOT EXISTS business_member_ids (
 business_id TEXT NOT NULL REFERENCES businesses(id),
 member_number TEXT NOT NULL,
 identity_key TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(business_id,member_number)
);
CREATE INDEX IF NOT EXISTS business_member_ids_identity ON business_member_ids(business_id,identity_key);
CREATE OR REPLACE FUNCTION member_identity_key(n TEXT,d DATE) RETURNS TEXT
 LANGUAGE sql IMMUTABLE AS $$ SELECT lower(trim(regexp_replace(n,'\s+',' ','g')))||'|'||COALESCE(d::text,'') $$;
-- Prefer live identity sources over anonymized, deleted directory profiles.
INSERT INTO business_member_ids(business_id,member_number,identity_key)
 SELECT DISTINCT ON (business_id,member_number) business_id,member_number,identity_key FROM (
 SELECT business_id,member_number,member_identity_key(customer_name,date_of_birth) AS identity_key,1 AS priority FROM customer_memberships WHERE member_number IS NOT NULL
 UNION ALL SELECT business_id,member_number,member_identity_key(first_name||' '||last_name,date_of_birth),2 FROM customer_booking_ids
 UNION ALL SELECT b.id,p.member_number,member_identity_key(p.name,p.date_of_birth),CASE WHEN p.deleted_at IS NULL THEN 3 ELSE 4 END FROM business_client_profiles p JOIN businesses b ON b.owner_id=p.owner WHERE p.member_number IS NOT NULL
 ) ids ORDER BY business_id,member_number,priority
 ON CONFLICT DO NOTHING;
CREATE OR REPLACE FUNCTION protect_business_member_id() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE biz TEXT; who TEXT; saved TEXT;
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
 SELECT identity_key INTO saved FROM business_member_ids WHERE business_id=biz AND member_number=NEW.member_number;
 IF saved IS DISTINCT FROM who THEN RAISE EXCEPTION 'Membership ID already belongs to another client in this business' USING ERRCODE='23505'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER membership_id_guard BEFORE INSERT OR UPDATE OF member_number ON customer_memberships FOR EACH ROW EXECUTE FUNCTION protect_business_member_id();
CREATE TRIGGER booking_id_guard BEFORE INSERT OR UPDATE OF member_number ON customer_booking_ids FOR EACH ROW EXECUTE FUNCTION protect_business_member_id();
CREATE TRIGGER profile_id_guard BEFORE INSERT OR UPDATE OF member_number ON business_client_profiles FOR EACH ROW EXECUTE FUNCTION protect_business_member_id();
