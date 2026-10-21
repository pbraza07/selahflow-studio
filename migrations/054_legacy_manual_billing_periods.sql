-- Correct only legacy manual periods backfilled by 053. Provider periods and
-- explicit later renewals stay authoritative; monthly session boundaries remain monthly.
UPDATE customer_memberships m
SET paid_through=m.last_paid_at+CASE p.interval_unit WHEN 'year' THEN interval '1 year' WHEN 'week' THEN interval '1 week' END,
 status=CASE WHEN m.status='expired' AND m.last_paid_at+CASE p.interval_unit WHEN 'year' THEN interval '1 year' WHEN 'week' THEN interval '1 week' END>now() THEN 'active' ELSE m.status END
FROM membership_plans p
WHERE p.id=m.plan_id AND p.business_id=m.business_id
 AND p.interval_unit IN ('week','year') AND m.stripe_subscription_id IS NULL
 AND m.last_paid_at IS NOT NULL AND m.initial_paid_at=m.last_paid_at
 AND m.paid_through=m.last_paid_at+interval '1 month';
