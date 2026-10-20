-- Only future registrations enqueue rows; no historical contact backfill.
CREATE TABLE owner_form_notifications (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 business_id TEXT NOT NULL REFERENCES businesses(id),
 source_id TEXT NOT NULL,
 form TEXT NOT NULL CHECK(form IN ('booking','membership')),
 channel TEXT NOT NULL CHECK(channel IN ('email','sms','push')),
 destination TEXT NOT NULL,
 message JSONB NOT NULL,
 status TEXT NOT NULL DEFAULT 'queued',
 attempts INTEGER NOT NULL DEFAULT 0,
 next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(business_id,source_id,form,channel,destination)
);
