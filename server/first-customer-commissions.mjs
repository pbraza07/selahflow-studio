import {CASH_BILLING_TERMS_VERSION} from './cash-commission-terms.mjs';
import {createHash,randomUUID} from 'node:crypto';
import {stripeApi,paymentConfigured} from './membership-payments.mjs';
export const COMMISSION_TERMS='first-booking-and-membership-10-min5-v2';
export function commissionCents(cents){if(!Number.isSafeInteger(cents)||cents<0)throw Error('Invalid commission basis.');return Math.min(Math.max(0,cents-1),Math.max(500,Math.round(cents/10)));}
export async function commissionSettings(db,businessId){
 const policy=(await db.query('SELECT booking_enabled,membership_enabled,booking_enabled_at,membership_enabled_at,terms_version,accepted_at FROM business_commission_policies WHERE business_id=$1',[businessId])).rows[0];
 const totals=(await db.query("SELECT kind,count(*) FILTER(WHERE status IN ('paid','refunded'))::int AS paid_count,COALESCE(sum(fee_cents) FILTER(WHERE status IN ('paid','refunded')),0)::bigint AS collected_cents,COALESCE(sum(refunded_fee_cents),0)::bigint AS refunded_cents FROM first_customer_commissions WHERE business_id=$1 GROUP BY kind",[businessId])).rows;
 const recent=(await db.query('SELECT id,kind,source_id,status,gross_cents,eligible_cents,fee_cents,refunded_fee_cents,created_at,paid_at FROM first_customer_commissions WHERE business_id=$1 ORDER BY created_at DESC LIMIT 30',[businessId])).rows;
 return {bookingEnabled:policy?.booking_enabled===true,membershipEnabled:policy?.membership_enabled===true,termsVersion:COMMISSION_TERMS,acceptedAt:policy?.terms_version===COMMISSION_TERMS?policy.accepted_at:null,ratePercent:10,minimumFeeCents:500,configured:paymentConfigured(),totals:totals.map(t=>({...t,collected_cents:Number(t.collected_cents),refunded_cents:Number(t.refunded_cents)})),recent};
}
export async function saveCommissionSettings(db,{businessId,actor,bookingEnabled,membershipEnabled,acceptTerms}){
 if(typeof bookingEnabled!=='boolean'||typeof membershipEnabled!=='boolean')throw Error('Choose both commission settings.');
 const business=(await db.query('SELECT id,status FROM businesses WHERE id=$1',[businessId])).rows[0];if(!business)throw Error('Business unavailable.');
 await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',[businessId+':commission-settings']);
 const old=(await db.query('SELECT * FROM business_commission_policies WHERE business_id=$1 FOR UPDATE',[businessId])).rows[0];
 const enabling=(bookingEnabled&&!old?.booking_enabled)||(membershipEnabled&&!old?.membership_enabled);
 if(enabling&&business.status!=='active')throw Error('Business must be active before enabling commissions.');
 if(enabling&&(old?.terms_version!==COMMISSION_TERMS||!old?.accepted_at)&&acceptTerms!==true)throw Error('Review and accept the 10% or $5 minimum commission terms before activation.');
 // Turning a condition off must remain possible when Stripe is unavailable.
 if(enabling){
  if(!paymentConfigured())throw Error('Configure Stripe payments before activating commissions.');
  if(!(await db.query("SELECT 1 FROM merchant_accounts WHERE business_id=$1 AND provider='stripe' AND charges_enabled=true AND onboarding_complete=true",[businessId])).rows.length)throw Error('Connect and verify this business Stripe account first.');
 }
 await db.query(`INSERT INTO business_commission_policies(business_id,booking_enabled,membership_enabled,booking_enabled_at,membership_enabled_at,terms_version,accepted_by,accepted_at) VALUES($1,$2,$3,CASE WHEN $2 THEN now() END,CASE WHEN $3 THEN now() END,$4,$5,CASE WHEN $6 THEN now() END) ON CONFLICT(business_id) DO UPDATE SET booking_enabled=$2,membership_enabled=$3,booking_enabled_at=CASE WHEN $2 THEN COALESCE(business_commission_policies.booking_enabled_at,now()) ELSE business_commission_policies.booking_enabled_at END,membership_enabled_at=CASE WHEN $3 THEN COALESCE(business_commission_policies.membership_enabled_at,now()) ELSE business_commission_policies.membership_enabled_at END,terms_version=CASE WHEN $6 THEN $4 ELSE business_commission_policies.terms_version END,accepted_by=CASE WHEN $6 THEN $5 ELSE business_commission_policies.accepted_by END,accepted_at=CASE WHEN $6 THEN now() ELSE business_commission_policies.accepted_at END,updated_at=now()`,[businessId,bookingEnabled,membershipEnabled,COMMISSION_TERMS,actor,acceptTerms===true]);
 await db.query("INSERT INTO events(id,owner,created,kind,data) SELECT $1,owner_id,$2,'commission_settings',$3 FROM businesses WHERE id=$4",[randomUUID(),new Date().toISOString(),JSON.stringify({bookingEnabled,membershipEnabled,ratePercent:10,minimumFeeCents:500,termsVersion:COMMISSION_TERMS,actor}),businessId]);
 return commissionSettings(db,businessId);
}
/** Caller owns a transaction. Change one condition without overwriting the other or accepting business terms. */
export async function setPlatformCommissionEnabled(db,{businessId,actor,kind,enabled}){
 if(!['booking','membership'].includes(kind)||typeof enabled!=='boolean')throw Error('Choose a commission type and an enabled or disabled state.');
 await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',[businessId+':commission-settings']);
 const old=(await db.query('SELECT booking_enabled,membership_enabled FROM business_commission_policies WHERE business_id=$1 FOR UPDATE',[businessId])).rows[0];
 return saveCommissionSettings(db,{businessId,actor,bookingEnabled:kind==='booking'?enabled:old?.booking_enabled===true,membershipEnabled:kind==='membership'?enabled:old?.membership_enabled===true,acceptTerms:false});
}
/** Caller owns a transaction. Separate once-per-identity claims for booking and membership. */
export async function reserveCommission(db,{businessId,kind,memberNumber,sourceId,account,grossCents,eligibleCents=grossCents,collectionMethod='stripe'},api=stripeApi){
 if(!['booking','membership'].includes(kind))throw Error('Invalid commission category.');
 const policy=(await db.query('SELECT * FROM business_commission_policies WHERE business_id=$1',[businessId])).rows[0];
 if(!policy?.[kind+'_enabled']||policy.terms_version!==COMMISSION_TERMS||!policy.accepted_at)return null;
 const fee=commissionCents(eligibleCents);if(!fee)return null;
 const identity=(await db.query('SELECT identity_key FROM business_member_ids WHERE business_id=$1 AND member_number=$2 AND retired_at IS NULL',[businessId,memberNumber||''])).rows[0];
 if(!identity)return null; // Legacy records without a verified identity are never guessed from email.
 const digest=createHash('sha256').update(policy.identity_salt+'|'+businessId+'|'+identity.identity_key).digest('hex');
 await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',[businessId+':commission:'+kind+':'+digest]);
 let prior=(await db.query('SELECT * FROM first_customer_commissions WHERE business_id=$1 AND identity_digest=$2 AND kind=$3 FOR UPDATE',[businessId,digest,kind])).rows[0];
 if(prior&&['paid','refunded','accrued','invoiced'].includes(prior.status))return null;
 if(prior?.stripe_checkout_session_id&&(prior.source_id!==sourceId||collectionMethod==='cash')&&prior.status==='reserved'){
  const session=await api('checkout/sessions/'+prior.stripe_checkout_session_id,{method:'GET',account:prior.stripe_account_id});
  if(session.status!=='expired')throw Error('Another first-time '+kind+' payment is open or processing for this client. Complete it or ask the business to expire the unpaid checkout first.');
 }
 if(prior?.stripe_payment_intent_id&&prior.status==='reserved'){
  const intent=await api('payment_intents/'+prior.stripe_payment_intent_id,{method:'GET',account:prior.stripe_account_id});
  if(intent.status!=='canceled')throw Error('Another onsite first-time payment is open or processing for this client. Cancel or complete it first.');
 }
 // Preserve returning/legacy/imported booking clients at activation. Membership is independently eligible.
 if(kind==='booking'){
  const old=(await db.query('SELECT 1 FROM business_client_profiles p JOIN businesses b ON b.owner_id=p.owner WHERE b.id=$1 AND p.member_number=$2 AND (p.created_at<$3::timestamptz OR p.commission_existing_client=true) LIMIT 1',[businessId,memberNumber,policy.booking_enabled_at])).rows.length;
  if(old)return null;
  const paid=(await db.query("SELECT 1 FROM appointments a JOIN businesses b ON b.owner_id=a.owner LEFT JOIN booking_payments p ON p.booking_id=a.id AND p.business_id=b.id WHERE b.id=$1 AND a.id<>$3 AND a.data::jsonb->>'memberNumber'=$2 AND (p.status='paid' OR a.data::jsonb->>'paymentStatus'='paid' OR a.status='Completed') LIMIT 1",[businessId,memberNumber,sourceId])).rows.length;
  if(paid)return null;
 }else{
  const paid=(await db.query("SELECT 1 FROM customer_memberships m WHERE m.business_id=$1 AND m.member_number=$2 AND (m.initial_paid_at IS NOT NULL OR m.last_paid_at IS NOT NULL OR m.paid_through IS NOT NULL OR m.status='active' OR EXISTS(SELECT 1 FROM membership_session_ledger l WHERE l.membership_id=m.id AND l.business_id=m.business_id AND l.event_type='payment_confirmed' AND l.amount_cents>0)) LIMIT 1",[businessId,memberNumber])).rows.length;
  if(paid)return null;
 }
 if(collectionMethod==='cash'){
  const billing=(await db.query('SELECT p.authorized_at FROM commission_billing_profiles p JOIN commission_billing_consents c ON c.id=p.active_consent_id WHERE p.business_id=$1 AND p.stripe_payment_method_id IS NOT NULL AND c.activated_at IS NOT NULL AND c.terms_version=$2',[businessId,CASH_BILLING_TERMS_VERSION])).rows[0];
  if(!billing?.authorized_at)throw Error('Authorize monthly cash commission billing in Business settings → Payment setup before recording this eligible cash payment.');
 }
 if(prior){
  await db.query("UPDATE first_customer_commissions SET source_id=$1,stripe_account_id=$2,stripe_checkout_session_id=NULL,stripe_payment_intent_id=NULL,gross_cents=$3,eligible_cents=$4,fee_cents=$5,status='reserved',updated_at=now() WHERE id=$6 AND business_id=$7",[sourceId,account,grossCents,eligibleCents,fee,prior.id,businessId]);
  return {...prior,source_id:sourceId,stripe_checkout_session_id:null,fee_cents:fee};
 }
 return (await db.query('INSERT INTO first_customer_commissions(business_id,identity_digest,kind,source_id,stripe_account_id,gross_cents,eligible_cents,fee_cents) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',[businessId,digest,kind,sourceId,account,grossCents,eligibleCents,fee])).rows[0];
}
export async function attachCommissionSession(db,claim,session){if(claim)await db.query('UPDATE first_customer_commissions SET stripe_checkout_session_id=$1,updated_at=now() WHERE id=$2 AND business_id=$3',[session.id,claim.id,claim.business_id]);}
export async function settleCommission(db,{businessId,account,session},api=stripeApi){
 const claim=(await db.query('SELECT * FROM first_customer_commissions WHERE business_id=$1 AND stripe_account_id=$2 AND stripe_checkout_session_id=$3 FOR UPDATE',[businessId,account,session.id])).rows[0];if(!claim||['paid','refunded'].includes(claim.status))return;
 if(session.payment_status!=='paid'||session.currency!=='usd'||session.amount_total!==claim.gross_cents||session.metadata?.commission_claim_id!==claim.id||typeof session.payment_intent!=='string')throw Error('Commission payment needs reconciliation.');
 const pi=await api('payment_intents/'+session.payment_intent+'?expand[]=latest_charge',{method:'GET',account});
 if(pi.status!=='succeeded'||pi.currency!=='usd'||pi.amount_received!==claim.gross_cents||pi.application_fee_amount!==claim.fee_cents)throw Error('Stripe commission amount does not match.');
 const fee=typeof pi.latest_charge?.application_fee==='string'?pi.latest_charge.application_fee:pi.latest_charge?.application_fee?.id;
 await db.query("UPDATE first_customer_commissions SET status='paid',stripe_payment_intent_id=$1,stripe_application_fee_id=$2,paid_at=now(),updated_at=now() WHERE id=$3 AND business_id=$4",[pi.id,fee||null,claim.id,businessId]);
 if(Number(pi.latest_charge?.amount_refunded)>0)await refundCommission(db,{businessId,account,charge:pi.latest_charge},api);
}
export async function expireCommissionCheckout(db,{businessId,id},api=stripeApi){
 const r=(await db.query('SELECT * FROM first_customer_commissions WHERE business_id=$1 AND id=$2::uuid FOR UPDATE',[businessId,id])).rows[0];
 if(!r||r.status!=='reserved'||!r.stripe_checkout_session_id)throw Error('Choose an unpaid commission checkout.');
 const path='checkout/sessions/'+r.stripe_checkout_session_id;
 const session=await api(path,{method:'GET',account:r.stripe_account_id});
 if(session.payment_status==='paid'||!['open','expired'].includes(session.status))throw Error('A paid or processing checkout cannot be expired.');
 if(session.status==='open'){const expired=await api(path+'/expire',{account:r.stripe_account_id,idempotencyKey:'commission-expire-'+r.id});if(expired.status!=='expired')throw Error('Stripe did not confirm checkout expiry.');}
 await db.query("UPDATE first_customer_commissions SET status='expired',updated_at=now() WHERE id=$1 AND business_id=$2",[r.id,businessId]);
 if(r.kind==='booking')await db.query("UPDATE booking_payments SET status='expired',updated_at=now() WHERE business_id=$1 AND stripe_account_id=$2 AND stripe_checkout_session_id=$3 AND status='pending'",[businessId,r.stripe_account_id,r.stripe_checkout_session_id]);return {ok:true};
}
export async function refundCommission(db,{businessId,account,charge},api=stripeApi){
 const pi=typeof charge.payment_intent==='string'?charge.payment_intent:charge.payment_intent?.id;if(!pi)return;
 const r=(await db.query('SELECT * FROM first_customer_commissions WHERE business_id=$1 AND stripe_account_id=$2 AND stripe_payment_intent_id=$3 FOR UPDATE',[businessId,account,pi])).rows[0];if(!r||!['paid','refunded'].includes(r.status))return;
 const actual=await api('charges/'+charge.id,{method:'GET',account});
 if(actual.currency!=='usd'||actual.amount!==r.gross_cents||actual.payment_intent!==pi||!Number.isSafeInteger(actual.amount_refunded))throw Error('Refund commission needs reconciliation.');
 const target=Math.min(r.fee_cents,Math.round(r.fee_cents*actual.amount_refunded/actual.amount));if(target<=r.refunded_fee_cents)return;
 const feeId=r.stripe_application_fee_id||(typeof actual.application_fee==='string'?actual.application_fee:actual.application_fee?.id);if(!feeId)throw Error('Stripe application fee unavailable for refund.');
 const fee=await api('application_fees/'+feeId,{method:'GET'});
 const delta=Math.max(0,target-Number(fee.amount_refunded||0));
 if(delta)await api('application_fees/'+feeId+'/refunds',{idempotencyKey:'commission-refund-'+r.id+'-'+target,params:{amount:delta}});
 await db.query("UPDATE first_customer_commissions SET refunded_fee_cents=$1,status=CASE WHEN $1=fee_cents THEN 'refunded' ELSE 'paid' END,updated_at=now() WHERE id=$2 AND business_id=$3",[Math.min(r.fee_cents,Math.max(target,Number(fee.amount_refunded||0))),r.id,businessId]);
}

/** Owner consent never changes activation; serialize it against administrator toggles. */
export async function acceptCommissionTerms(db,{businessId,actor}){
 await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',[businessId+':commission-settings']);
 const old=(await db.query('SELECT booking_enabled,membership_enabled FROM business_commission_policies WHERE business_id=$1 FOR UPDATE',[businessId])).rows[0];
 return saveCommissionSettings(db,{businessId,actor,bookingEnabled:old?.booking_enabled===true,membershipEnabled:old?.membership_enabled===true,acceptTerms:true});
}

export async function attachCommissionIntent(db,claim,intent){if(claim)await db.query('UPDATE first_customer_commissions SET stripe_checkout_session_id=NULL,stripe_payment_intent_id=$1,updated_at=now() WHERE id=$2 AND business_id=$3',[intent.id,claim.id,claim.business_id]);}
export async function settleTerminalCommission(db,{businessId,account,intent},api=stripeApi){
 const claim=(await db.query('SELECT * FROM first_customer_commissions WHERE business_id=$1 AND stripe_account_id=$2 AND stripe_payment_intent_id=$3 FOR UPDATE',[businessId,account,intent.id])).rows[0];
 if(!claim||['paid','refunded'].includes(claim.status))return;
 if(intent.status!=='succeeded'||intent.currency!=='usd'||intent.amount_received!==claim.gross_cents||intent.application_fee_amount!==claim.fee_cents||intent.metadata?.commission_claim_id!==claim.id)throw Error('Stripe onsite commission needs reconciliation.');
 const fee=typeof intent.latest_charge?.application_fee==='string'?intent.latest_charge.application_fee:intent.latest_charge?.application_fee?.id;
 await db.query("UPDATE first_customer_commissions SET status='paid',stripe_application_fee_id=$1,paid_at=now(),updated_at=now() WHERE id=$2 AND business_id=$3",[fee||null,claim.id,businessId]);
 if(Number(intent.latest_charge?.amount_refunded)>0)await refundCommission(db,{businessId,account,charge:intent.latest_charge},api);
}
