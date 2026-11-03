-- Supporting evidence only. Never merges client profiles or changes saved fees.
CREATE TABLE IF NOT EXISTS commission_contact_evidence (
 business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
 identity_digest TEXT NOT NULL,
 contact_type TEXT NOT NULL CHECK(contact_type IN ('email','phone')),
 contact_digest TEXT NOT NULL,
 name_digest TEXT NOT NULL,
 birth_digest TEXT NOT NULL DEFAULT '',
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(business_id,identity_digest,contact_type,contact_digest,name_digest,birth_digest)
);
CREATE INDEX IF NOT EXISTS commission_contact_lookup ON commission_contact_evidence(business_id,name_digest,contact_digest);
CREATE TABLE IF NOT EXISTS commission_identity_links (
 business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
 identity_digest TEXT NOT NULL,
 target_digest TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(business_id,identity_digest,target_digest)
);
CREATE INDEX IF NOT EXISTS commission_profile_email ON business_client_profiles(owner,lower(btrim(email)));
CREATE INDEX IF NOT EXISTS commission_profile_phone ON business_client_profiles(owner,(regexp_replace(phone,'[^0-9]','','g')));
CREATE INDEX IF NOT EXISTS commission_booking_email ON customer_booking_ids(business_id,lower(btrim(email)));
CREATE INDEX IF NOT EXISTS commission_booking_phone ON customer_booking_ids(business_id,(regexp_replace(phone,'[^0-9]','','g')));
CREATE INDEX IF NOT EXISTS commission_membership_email ON customer_memberships(business_id,lower(btrim(customer_email)));
CREATE INDEX IF NOT EXISTS commission_membership_phone ON customer_memberships(business_id,(regexp_replace(customer_phone,'[^0-9]','','g')));
