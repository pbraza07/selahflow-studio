-- Identifiers are exactly first initial + last initial + MMDD.
-- Preserve legacy history while enforcing the six-character format going forward.
ALTER TABLE customer_memberships ADD CONSTRAINT customer_memberships_member_number_six
 CHECK (member_number IS NULL OR member_number ~ '^[A-Z]{2}[0-9]{4}$') NOT VALID;
ALTER TABLE customer_booking_ids ADD CONSTRAINT customer_booking_ids_member_number_six
 CHECK (member_number ~ '^[A-Z]{2}[0-9]{4}$') NOT VALID;
ALTER TABLE business_client_profiles ADD CONSTRAINT business_client_profiles_member_number_six
 CHECK (member_number IS NULL OR member_number ~ '^[A-Z]{2}[0-9]{4}$') NOT VALID;
