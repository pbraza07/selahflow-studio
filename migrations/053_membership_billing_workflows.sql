ALTER TABLE membership_plans ADD COLUMN interval_count INTEGER NOT NULL DEFAULT 1 CHECK(interval_count BETWEEN 1 AND 12);
ALTER TABLE customer_memberships ADD COLUMN initial_paid_at TIMESTAMPTZ;
ALTER TABLE customer_memberships ADD COLUMN billing_start_override DATE;
ALTER TABLE customer_memberships ADD COLUMN credit_period_start TIMESTAMPTZ;
ALTER TABLE customer_memberships ADD COLUMN credit_period_end TIMESTAMPTZ;
ALTER TABLE customer_memberships ADD COLUMN monthly_sessions INTEGER;
ALTER TABLE customer_memberships ADD COLUMN stripe_interval_count INTEGER NOT NULL DEFAULT 1;
ALTER TABLE customer_memberships ADD COLUMN first_invoice_cents INTEGER;
ALTER TABLE customer_memberships ADD COLUMN renewal_invoice_cents INTEGER;
UPDATE customer_memberships m SET initial_paid_at=m.last_paid_at,paid_through=COALESCE(m.paid_through,m.last_paid_at+interval '1 month'),credit_period_start=m.last_paid_at,credit_period_end=m.last_paid_at+interval '1 month',monthly_sessions=p.sessions_included FROM membership_plans p WHERE p.id=m.plan_id AND p.business_id=m.business_id AND m.last_paid_at IS NOT NULL;
CREATE TABLE membership_credit_periods(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),business_id TEXT NOT NULL REFERENCES businesses(id),membership_id TEXT NOT NULL REFERENCES customer_memberships(id) ON DELETE CASCADE,period_start TIMESTAMPTZ NOT NULL,period_end TIMESTAMPTZ NOT NULL,sessions_included INTEGER NOT NULL,sessions_used INTEGER NOT NULL,UNIQUE(membership_id,period_start));
CREATE TABLE business_coupons(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),business_id TEXT NOT NULL REFERENCES businesses(id),code TEXT NOT NULL,description TEXT NOT NULL DEFAULT '',kind TEXT NOT NULL CHECK(kind IN ('percent','fixed')),value INTEGER NOT NULL CHECK(value>0),duration TEXT NOT NULL DEFAULT 'once' CHECK(duration IN ('once','forever')),expires_at TIMESTAMPTZ,active BOOLEAN NOT NULL DEFAULT true,stripe_coupon_id TEXT,stripe_account_id TEXT,created_at TIMESTAMPTZ NOT NULL DEFAULT now(),UNIQUE(business_id,code),CHECK(kind<>'percent' OR value<=100));
CREATE TABLE membership_payment_invitations(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),business_id TEXT NOT NULL REFERENCES businesses(id),membership_id TEXT NOT NULL REFERENCES customer_memberships(id) ON DELETE CASCADE,token_hash TEXT NOT NULL UNIQUE,expires_at TIMESTAMPTZ NOT NULL,destination TEXT NOT NULL,message JSONB NOT NULL,status TEXT NOT NULL DEFAULT 'queued',detail TEXT NOT NULL DEFAULT '',attempts INTEGER NOT NULL DEFAULT 0,next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE session_team_assignments(business_id TEXT NOT NULL REFERENCES businesses(id),session_id TEXT NOT NULL,staff_ids JSONB NOT NULL DEFAULT '[]',note TEXT NOT NULL DEFAULT '',updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),PRIMARY KEY(business_id,session_id));
ALTER TABLE participation_waivers ADD COLUMN media_consent BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE participation_waivers ADD COLUMN media_statement TEXT;

UPDATE settings SET data=jsonb_set(data::jsonb,'{services}',COALESCE((SELECT jsonb_agg(s||'{"requiresApproval":true}'::jsonb ORDER BY ord) FROM jsonb_array_elements(settings.data::jsonb->'services') WITH ORDINALITY AS src(s,ord)),'[]'::jsonb))::text WHERE jsonb_typeof(data::jsonb->'services')='array';
