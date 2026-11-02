import {trackingDateRange} from './calendar-team-tracking.mjs';
const records=`WITH records AS (
 SELECT 'payment-'||a.id AS transaction_id,a.business_id,b.name AS business_name,a.owner_id,a.source_id,a.staff_id,a.staff_name,a.service_names,
 a.service_cents AS gross_cents,true AS source_paid,true AS receipt_present,a.payment_provider,a.payment_reference,a.attribution_basis,
 COALESCE((a.paid_at AT TIME ZONE 'America/New_York')::date::text,(c.paid_at AT TIME ZONE 'America/New_York')::date::text,a.service_date) AS transaction_date,
 COALESCE(a.paid_at,c.paid_at) AS paid_at,a.service_date,c.id AS commission_id,COALESCE(c.status,'none') AS commission_status,
 COALESCE(c.fee_cents,0) AS original_fee_cents,COALESCE(c.refunded_fee_cents,0) AS refunded_cents,
 CASE WHEN c.status IN ('paid','refunded') THEN c.fee_cents-c.refunded_fee_cents ELSE 0 END AS collected_cents,
 CASE WHEN c.status IN ('accrued','invoiced') THEN c.fee_cents-c.refunded_fee_cents ELSE 0 END AS outstanding_cents,
 CASE WHEN c.status='reserved' THEN c.fee_cents ELSE 0 END AS pending_cents
 FROM service_payment_audit a JOIN businesses b ON b.id=a.business_id LEFT JOIN first_customer_commissions c ON c.id=a.commission_id AND c.business_id=a.business_id AND c.kind='booking'
 UNION ALL
 SELECT 'commission-'||c.id,c.business_id,b.name,b.owner_id,c.source_id,a.staff,COALESCE(s.member->>'name',CASE WHEN a.staff IS NULL OR a.staff='' THEN 'Owner / unassigned' ELSE 'Former team member' END),
 COALESCE(a.data::jsonb->'services','[]'::jsonb),c.eligible_cents,c.status IN ('paid','refunded','accrued','invoiced'),false,c.collection_method,COALESCE(c.stripe_payment_intent_id,c.source_id,c.id::text),
 CASE WHEN a.id IS NULL THEN 'Commission retained; source assignment unavailable' ELSE 'Retained booking assignment' END,
 (COALESCE(c.paid_at,c.earned_at,c.created_at) AT TIME ZONE 'America/New_York')::date::text,c.paid_at,a.date,c.id,c.status,c.fee_cents,c.refunded_fee_cents,
 CASE WHEN c.status IN ('paid','refunded') THEN c.fee_cents-c.refunded_fee_cents ELSE 0 END,
 CASE WHEN c.status IN ('accrued','invoiced') THEN c.fee_cents-c.refunded_fee_cents ELSE 0 END,
 CASE WHEN c.status='reserved' THEN c.fee_cents ELSE 0 END
 FROM first_customer_commissions c JOIN businesses b ON b.id=c.business_id
 LEFT JOIN appointments a ON a.owner=b.owner_id AND a.id=c.source_id
 LEFT JOIN settings cfg ON cfg.owner=b.owner_id
 LEFT JOIN LATERAL (SELECT member FROM jsonb_array_elements(COALESCE(cfg.data::jsonb->'staff','[]')) member WHERE member->>'id'=a.staff LIMIT 1) s ON true
 WHERE c.kind='booking' AND NOT EXISTS(SELECT 1 FROM service_payment_audit p WHERE p.commission_id=c.id)
), filtered AS (SELECT * FROM records WHERE ($1::text IS NULL OR business_id=$1) AND transaction_date BETWEEN $2 AND $3 AND ($4::text IS NULL OR COALESCE(staff_id,'')=$4))`;
const metrics=`count(*) FILTER(WHERE receipt_present)::int AS transaction_count,
 COALESCE(sum(gross_cents) FILTER(WHERE receipt_present),0)::bigint AS service_cents,
 COALESCE(sum(collected_cents),0)::bigint AS collected_cents,COALESCE(sum(outstanding_cents),0)::bigint AS outstanding_cents,
 COALESCE(sum(pending_cents),0)::bigint AS pending_cents,COALESCE(sum(refunded_cents),0)::bigint AS refunded_cents,
 count(*) FILTER(WHERE gross_cents IS NULL AND receipt_present)::int AS unknown_amount_count,
 count(*) FILTER(WHERE NOT receipt_present AND source_paid)::int AS unmatched_receipt_count`;
const numbers=r=>Object.fromEntries(Object.entries(r).map(([k,v])=>[k,/_cents$/.test(k)||/_count$/.test(k)?v===null?null:Number(v):v]));
/** Scope is supplied by the authenticated route; never inferred from request business/staff fields. */
export async function serviceCommissionReport(pool,{businessId=/** @type {string|null} */ (null),from,to,staffId=/** @type {string|null} */ (null),page=0}){
 trackingDateRange(from,to);if(!Number.isInteger(page)||page<0||page>100000)throw Error('Choose a valid transaction page.');
 const args=[businessId,from,to,staffId],totalsArgs=[businessId,from,to,null];
 const buckets=(await pool.query(records+` SELECT business_id,business_name,owner_id,staff_id,max(staff_name) AS staff_name,${metrics} FROM filtered GROUP BY business_id,business_name,owner_id,staff_id ORDER BY business_name,staff_name`,totalsArgs)).rows.map(numbers);
 const summaries=(await pool.query(records+` SELECT business_id,business_name,owner_id,${metrics} FROM filtered GROUP BY business_id,business_name,owner_id ORDER BY business_name`,totalsArgs)).rows.map(numbers);
 const rows=(await pool.query(records+' SELECT * FROM filtered ORDER BY transaction_date DESC,transaction_id DESC LIMIT 101 OFFSET $5',[...args,page*100])).rows;
 const businesses=(await pool.query('SELECT b.id,b.name,u.email AS owner_email FROM businesses b JOIN users u ON u.id=b.owner_id WHERE ($1::text IS NULL OR b.id=$1) ORDER BY b.name,b.id',[businessId])).rows;
 return {from,to,page,hasMore:rows.length>100,businesses,summaries,buckets,rows:rows.slice(0,100).map(numbers)};
}

/** Allocate the recorded platform cost across service lines once, preserving cents. */
export function allocatePlatformServiceFees(rows){
 const groups=new Map();for(const r of rows){const key=r.business_id+':'+r.appointment_id;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r);}
 for(const items of groups.values()){
  items.sort((a,b)=>a.line_number-b.line_number);const total=items.reduce((n,r)=>n+r.amount_cents,0),fee=Number(items[0].platform_fee_total||0);let used=0;
  for(let i=0;i<items.length;i++){const r=items[i];r.platformFeeCents=i===items.length-1?fee-used:total>0?Math.floor(fee*r.amount_cents/total):0;used+=r.platformFeeCents;r.ownerNetCents=(r.voided?0:r.owner_cents)-r.platformFeeCents;}
 }
 return rows;
}
