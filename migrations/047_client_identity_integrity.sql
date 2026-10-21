-- No new writes may use historical eight-character membership numbers.
CREATE OR REPLACE FUNCTION persisted_member_number_allowed(scope TEXT,n TEXT,owner_scope BOOLEAN DEFAULT FALSE) RETURNS BOOLEAN LANGUAGE sql IMMUTABLE AS $$ SELECT n IS NULL OR n ~ '^[A-Z]{2}[0-9]{4}$' $$;
ALTER TABLE business_member_ids ADD CONSTRAINT business_member_ids_six CHECK(retired_at IS NOT NULL OR member_number ~ '^[A-Z]{2}[0-9]{4}$') NOT VALID;
CREATE TABLE client_financial_retention (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 business_id TEXT NOT NULL REFERENCES businesses(id),
 source_digest TEXT NOT NULL UNIQUE,
 entry_kind TEXT NOT NULL,
 amount_cents BIGINT NOT NULL,
 tax_cents BIGINT NOT NULL DEFAULT 0,
 currency TEXT NOT NULL DEFAULT 'usd',
 occurred_at TIMESTAMPTZ NOT NULL,
 retained_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Only accounting facts; never names, contact details, client/booking IDs or raw provider references.
CREATE TABLE deleted_client_records (
 business_id TEXT NOT NULL REFERENCES businesses(id),
 source_table TEXT NOT NULL,
 record_digest TEXT NOT NULL,
 deleted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(business_id,source_table,record_digest)
);
CREATE TABLE client_integrity_maintenance (
 operation_id TEXT PRIMARY KEY,
 result JSONB NOT NULL,
 completed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE OR REPLACE FUNCTION reject_deleted_client_record() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE biz TEXT;
BEGIN
 IF TG_TABLE_NAME IN ('appointments','events','business_client_profiles') THEN SELECT id INTO biz FROM businesses WHERE owner_id=NEW.owner;
 ELSE biz:=NEW.business_id; END IF;
 IF EXISTS(SELECT 1 FROM deleted_client_records WHERE business_id=biz AND source_table=TG_TABLE_NAME AND record_digest=md5(NEW.id::text)) THEN RAISE EXCEPTION 'This deleted client record cannot be restored. Register as a new client.' USING ERRCODE='23505'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER deleted_profile_guard BEFORE INSERT ON business_client_profiles FOR EACH ROW EXECUTE FUNCTION reject_deleted_client_record();
CREATE TRIGGER deleted_identity_guard BEFORE INSERT ON customer_booking_ids FOR EACH ROW EXECUTE FUNCTION reject_deleted_client_record();
CREATE TRIGGER deleted_membership_guard BEFORE INSERT ON customer_memberships FOR EACH ROW EXECUTE FUNCTION reject_deleted_client_record();
CREATE TRIGGER deleted_appointment_guard BEFORE INSERT ON appointments FOR EACH ROW EXECUTE FUNCTION reject_deleted_client_record();
CREATE TRIGGER deleted_request_guard BEFORE INSERT ON booking_requests FOR EACH ROW EXECUTE FUNCTION reject_deleted_client_record();
CREATE TRIGGER deleted_membership_request_guard BEFORE INSERT ON membership_requests FOR EACH ROW EXECUTE FUNCTION reject_deleted_client_record();
CREATE TRIGGER deleted_event_guard BEFORE INSERT ON events FOR EACH ROW EXECUTE FUNCTION reject_deleted_client_record();
CREATE OR REPLACE FUNCTION protect_business_member_id() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE biz TEXT; who TEXT; saved TEXT; retired TIMESTAMPTZ;
BEGIN
 IF NEW.member_number IS NULL THEN RETURN NEW; END IF;
 IF NEW.member_number !~ '^[A-Z]{2}[0-9]{4}$' THEN RAISE EXCEPTION 'Membership IDs must contain exactly two letters and four digits' USING ERRCODE='23514'; END IF;
 IF TG_TABLE_NAME='business_client_profiles' THEN SELECT id INTO biz FROM businesses WHERE owner_id=NEW.owner;who:=member_identity_key(NEW.name,NEW.date_of_birth);
 ELSIF TG_TABLE_NAME='customer_booking_ids' THEN biz:=NEW.business_id;who:=member_identity_key(NEW.first_name||' '||NEW.last_name,NEW.date_of_birth);
 ELSE biz:=NEW.business_id;who:=member_identity_key(NEW.customer_name,NEW.date_of_birth); END IF;
 INSERT INTO business_member_ids(business_id,member_number,identity_key) VALUES(biz,NEW.member_number,who) ON CONFLICT DO NOTHING;
 SELECT identity_key,retired_at INTO saved,retired FROM business_member_ids WHERE business_id=biz AND member_number=NEW.member_number;
 IF saved IS DISTINCT FROM who OR retired IS NOT NULL THEN RAISE EXCEPTION 'Membership ID already belongs to another active client in this business' USING ERRCODE='23505'; END IF;
 RETURN NEW;
END $$;

-- No automatic expiry: legal retention periods must be reviewed per jurisdiction.
CREATE TABLE client_deletion_audit (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 business_id TEXT NOT NULL REFERENCES businesses(id),
 target_digest TEXT NOT NULL,
 result JSONB NOT NULL,
 deleted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE client_deletion_authorizations (
 operation_id UUID PRIMARY KEY,
 business_id TEXT NOT NULL REFERENCES businesses(id),
 profile_id TEXT NOT NULL,
 database_name TEXT NOT NULL,
 backup_sha256 TEXT NOT NULL CHECK(backup_sha256 ~ '^[a-f0-9]{64}$'),
 restore_evidence_sha256 TEXT NOT NULL CHECK(restore_evidence_sha256 ~ '^[a-f0-9]{64}$'),
 verified_at TIMESTAMPTZ NOT NULL,
 expires_at TIMESTAMPTZ NOT NULL,
 consumed_at TIMESTAMPTZ,
 UNIQUE(business_id,profile_id,operation_id)
);

-- Historical references are searchable without admitting malformed active IDs.
CREATE TABLE member_id_history_aliases (
 business_id TEXT NOT NULL REFERENCES businesses(id),
 previous_number TEXT NOT NULL,
 current_number TEXT NOT NULL CHECK(current_number ~ '^[A-Z]{2}[0-9]{4}$'),
 changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(business_id,previous_number)
);
