-- Business-scoped campaigns. Recipient addresses are never exposed to other recipients.
CREATE TABLE IF NOT EXISTS business_email_campaigns (
 id TEXT PRIMARY KEY,
 business_id TEXT NOT NULL REFERENCES businesses(id),
 subject TEXT NOT NULL CHECK(length(subject) BETWEEN 1 AND 180),
 body TEXT NOT NULL CHECK(length(body) BETWEEN 1 AND 10000),
 action_label TEXT NOT NULL DEFAULT '',
 action_url TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','queued','cancelled')),
 brand_digest TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 queued_at TIMESTAMPTZ,
 UNIQUE(id,business_id),
 CHECK(length(action_label)<=60 AND length(action_url)<=2000)
);
CREATE TABLE IF NOT EXISTS business_communication_recipients (
 id TEXT PRIMARY KEY,
 campaign_id TEXT NOT NULL,
 business_id TEXT NOT NULL REFERENCES businesses(id),
 contact_id TEXT NOT NULL,
 email TEXT NOT NULL,
 names TEXT NOT NULL,
 source_ids JSONB NOT NULL DEFAULT '[]',
 unsubscribe_hash TEXT NOT NULL UNIQUE,
 unsubscribe_url TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','queued','processing','submitted','failed','not_configured','invalid_destination','unknown','skipped')),
 attempts INTEGER NOT NULL DEFAULT 0,
 detail TEXT NOT NULL DEFAULT '',
 next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(campaign_id,contact_id),
 FOREIGN KEY(campaign_id,business_id) REFERENCES business_email_campaigns(id,business_id) ON DELETE CASCADE,
 CHECK(jsonb_typeof(source_ids)='array')
);
CREATE INDEX IF NOT EXISTS communication_recipient_due ON business_communication_recipients(status,next_attempt_at);
CREATE INDEX IF NOT EXISTS business_campaign_recent ON business_email_campaigns(business_id,created_at DESC);
CREATE TABLE IF NOT EXISTS business_communication_suppressions (
 business_id TEXT NOT NULL REFERENCES businesses(id),
 contact_id TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(business_id,contact_id)
);

CREATE INDEX IF NOT EXISTS communication_recipient_contact ON business_communication_recipients(business_id,contact_id);
CREATE INDEX IF NOT EXISTS communication_recipient_sources ON business_communication_recipients USING gin(source_ids);
