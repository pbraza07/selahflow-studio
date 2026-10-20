-- Each waiver belongs to an actual business-scoped booking identity, not a
-- globally guessable membership number. Consent survives deletion, detached from the active identity.
CREATE TABLE participation_waivers (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 business_id TEXT NOT NULL REFERENCES businesses(id),
 customer_id UUID REFERENCES customer_booking_ids(id) ON DELETE SET NULL,
 member_number VARCHAR(8) NOT NULL,
 participant_name TEXT NOT NULL,
 date_of_birth DATE NOT NULL,
 signer_name TEXT NOT NULL,
 signer_role TEXT NOT NULL CHECK (signer_role IN ('self','parent','guardian')),
 signed_date DATE NOT NULL,
 signed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 document_version TEXT NOT NULL,
 document_hash TEXT NOT NULL,
 document JSONB NOT NULL,
 request_ip INET,
 user_agent TEXT NOT NULL DEFAULT '',
 audit_id UUID NOT NULL DEFAULT gen_random_uuid(),
 retention_status TEXT NOT NULL DEFAULT 'legal_hold',
 UNIQUE(business_id,customer_id,document_version)
);
CREATE INDEX participation_waivers_business_signed_idx ON participation_waivers(business_id,signed_at DESC);
