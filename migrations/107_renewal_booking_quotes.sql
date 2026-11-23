-- A confirmed visit on/after a recurring plan's renewal date must not acquire
-- a standalone fee because the next period was unpaid when it was booked.
WITH candidates AS (
 SELECT a.id, a.data::jsonb AS d, m.id AS membership_id
 FROM appointments a
 JOIN businesses b ON b.owner_id=a.owner
 JOIN settings s ON s.owner=a.owner
 JOIN customer_memberships m ON m.business_id=b.id AND m.member_number=a.data::jsonb->>'memberNumber'
 JOIN membership_plans p ON p.id=m.plan_id AND p.business_id=b.id
 WHERE a.status='Confirmed' AND a.date>=to_char(now() AT TIME ZONE 'America/New_York','YYYY-MM-DD')
 AND p.weekly_sessions>0 AND m.status='active' AND m.billing_type='membership' AND m.initial_paid_at IS NOT NULL
 AND m.sessions_included>m.sessions_used AND m.paid_through>now()
 AND a.date>=to_char(m.paid_through AT TIME ZONE 'America/New_York','YYYY-MM-DD')
 AND a.data::jsonb->>'paymentStatus' IS DISTINCT FROM 'paid'
 AND a.data::jsonb->>'membershipCreditAllowed' IS DISTINCT FROM 'false'
 AND a.data::jsonb->>'membershipCovered' IS DISTINCT FROM 'true'
 AND jsonb_typeof(a.data::jsonb->'price')='number' AND (a.data::jsonb->>'price')::numeric>0
 AND EXISTS (
   SELECT 1 FROM jsonb_array_elements(s.data::jsonb->'services') svc
   WHERE (a.data::jsonb->'serviceIds'=jsonb_build_array(svc->>'id')
      OR (a.data::jsonb->'serviceIds' IS NULL AND a.data::jsonb->'services'=jsonb_build_array(svc->>'name')
          AND (SELECT count(*) FROM jsonb_array_elements(s.data::jsonb->'services') other WHERE other->>'name'=svc->>'name')=1))
   AND svc->>'membershipCreditAllowed' IS DISTINCT FROM 'false'
   AND (p.credit_eligibility IS NULL OR p.credit_eligibility->>'mode'='all'
     OR (p.credit_eligibility->>'mode'='selected' AND (p.credit_eligibility->'serviceIds' ? (svc->>'id')
       OR p.credit_eligibility->'sessionIds' ? (a.data::jsonb->>'sessionId')
       OR p.credit_eligibility->'sessionIds' ? regexp_replace(a.data::jsonb->>'sessionId','__[0-9]{8}$',''))))
 )
 AND NOT EXISTS (SELECT 1 FROM booking_payments bp WHERE bp.business_id=b.id AND bp.booking_id=a.id AND bp.status IN ('pending','paid'))
 AND NOT EXISTS (SELECT 1 FROM stripe_payment_receipts r WHERE r.business_id=b.id AND r.booking_id=a.id)
 AND NOT EXISTS (SELECT 1 FROM events e WHERE e.owner=a.owner AND e.kind='cash_sale' AND e.data::jsonb->>'bookingId'=a.id)
)
UPDATE appointments a SET data=(c.d || jsonb_build_object('price',0,'membershipCovered',true,
 'membershipRenewalRequired',true,'previousSessionPrice',c.d->'price','paymentTracking','completed'))::text
FROM candidates c WHERE a.id=c.id;
