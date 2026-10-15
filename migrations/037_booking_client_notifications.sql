-- Durable client messages are committed with approval/payment, never a browser redirect.
CREATE TABLE IF NOT EXISTS booking_client_flows (
 booking_id TEXT PRIMARY KEY REFERENCES appointments(id) ON DELETE CASCADE,
 business_id TEXT NOT NULL REFERENCES businesses(id),
 request_id TEXT NOT NULL UNIQUE REFERENCES booking_requests(id) ON DELETE CASCADE,
 payment_url TEXT NOT NULL,
 expires_at TIMESTAMPTZ NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS booking_client_messages (
 id TEXT PRIMARY KEY,
 booking_id TEXT NOT NULL REFERENCES booking_client_flows(booking_id) ON DELETE CASCADE,
 event_type TEXT NOT NULL CHECK(event_type IN ('payment_link','payment_confirmation')),
 channel TEXT NOT NULL CHECK(channel IN ('email','sms')),
 destination TEXT NOT NULL,
 destination_masked TEXT NOT NULL,
 message JSONB NOT NULL,
 status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','processing','submitted','failed','not_configured','invalid_destination','unknown','superseded')),
 attempts INTEGER NOT NULL DEFAULT 0,
 detail TEXT NOT NULL DEFAULT '',
 next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(booking_id,event_type,channel)
);
CREATE INDEX IF NOT EXISTS booking_client_messages_due ON booking_client_messages(status,next_attempt_at);
