-- A private booking access token may register multiple browser devices.
-- The existing owner/booking/endpoint unique constraint keeps subscriptions scoped.
ALTER TABLE customer_booking_push DROP CONSTRAINT IF EXISTS customer_booking_push_token_hash_key;
