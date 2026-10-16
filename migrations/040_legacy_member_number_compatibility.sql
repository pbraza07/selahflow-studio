-- Preserve IDs that predate six-character issuance without allowing new legacy IDs.
CREATE TABLE IF NOT EXISTS legacy_business_member_numbers (
 business_id TEXT NOT NULL REFERENCES businesses(id),
 member_number TEXT NOT NULL,
 PRIMARY KEY(business_id,member_number)
);
INSERT INTO legacy_business_member_numbers(business_id,member_number)
 SELECT business_id,member_number FROM business_member_ids WHERE member_number !~ '^[A-Z]{2}[0-9]{4}$'
 UNION SELECT business_id,member_number FROM customer_booking_ids WHERE member_number !~ '^[A-Z]{2}[0-9]{4}$'
 UNION SELECT business_id,member_number FROM customer_memberships WHERE member_number !~ '^[A-Z]{2}[0-9]{4}$'
 UNION SELECT b.id,p.member_number FROM business_client_profiles p JOIN businesses b ON b.owner_id=p.owner WHERE p.member_number !~ '^[A-Z]{2}[0-9]{4}$'
 ON CONFLICT DO NOTHING;
CREATE OR REPLACE FUNCTION persisted_member_number_allowed(scope TEXT,n TEXT,owner_scope BOOLEAN DEFAULT FALSE) RETURNS BOOLEAN
 LANGUAGE sql STABLE AS $$
 SELECT n IS NULL OR n ~ '^[A-Z]{2}[0-9]{4}$' OR EXISTS (
  SELECT 1 FROM legacy_business_member_numbers l JOIN businesses b ON b.id=l.business_id
  WHERE l.member_number=n AND CASE WHEN owner_scope THEN b.owner_id=scope ELSE b.id=scope END
 ) $$;
ALTER TABLE customer_memberships DROP CONSTRAINT customer_memberships_member_number_six;
ALTER TABLE customer_memberships ADD CONSTRAINT customer_memberships_member_number_six
 CHECK (persisted_member_number_allowed(business_id,member_number)) NOT VALID;
ALTER TABLE customer_booking_ids DROP CONSTRAINT customer_booking_ids_member_number_six;
ALTER TABLE customer_booking_ids ADD CONSTRAINT customer_booking_ids_member_number_six
 CHECK (persisted_member_number_allowed(business_id,member_number)) NOT VALID;
ALTER TABLE business_client_profiles DROP CONSTRAINT business_client_profiles_member_number_six;
ALTER TABLE business_client_profiles ADD CONSTRAINT business_client_profiles_member_number_six
 CHECK (persisted_member_number_allowed(owner,member_number,TRUE)) NOT VALID;
