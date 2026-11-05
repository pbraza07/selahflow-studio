import {getPool} from './database.mjs';
import {configured,sendWebPush} from './push-crypto.mjs';
import {businessDeviceName} from './business-device-name.mjs';

/** Financial writes enqueue transactionally; each opted-in owner device has its
 * own claim. A confirmed provider rejection can retry, an uncertain send cannot. */
export async function deliverOwnerPaymentPush(pool,{enabled=configured(),send=sendWebPush,limit=30}={}){
 if(!enabled)return {processed:0};
 await pool.query("UPDATE owner_payment_push_deliveries SET status='unknown',updated_at=now() WHERE status='processing' AND updated_at<now()-interval '2 minutes'");
 let processed=0;
 for(let i=0;i<limit;i++){
  const job=(await pool.query(`UPDATE owner_payment_push_deliveries SET status='processing',updated_at=now()
   WHERE (event_id,subscription_id) IN (SELECT event_id,subscription_id FROM owner_payment_push_deliveries
    WHERE status IN ('queued','failed') AND attempts<3 AND next_attempt_at<=now()
    ORDER BY next_attempt_at FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *`)).rows[0];
  if(!job)break;
  processed++;
  let sendStarted=false;
  try{
   const r=(await pool.query(`SELECT e.*,s.endpoint,s.p256dh,s.auth,b.slug,b.name FROM owner_payment_push_events e
    JOIN businesses b ON b.id=e.business_id AND b.status='active'
    JOIN business_push_subscriptions s ON s.id=$2 AND s.business_id=e.business_id AND s.reviewer='owner'
    WHERE e.id=$1 AND e.created_at>now()-interval '24 hours' AND (
     (e.kind='booking' AND EXISTS(SELECT 1 FROM appointments a WHERE a.id=e.source_id AND a.owner=b.owner_id AND (
      EXISTS(SELECT 1 FROM booking_payments p JOIN stripe_payment_receipts receipt
       ON receipt.stripe_account_id=p.stripe_account_id AND receipt.provider_reference=p.stripe_payment_intent_id
       AND receipt.business_id=p.business_id AND receipt.booking_id=p.booking_id AND receipt.amount_cents=p.amount_cents
       WHERE p.business_id=e.business_id AND p.booking_id=a.id AND p.status='paid' AND p.amount_cents=e.amount_cents)
      OR (a.data::jsonb->>'paymentStatus'='paid' AND a.data::jsonb->>'paymentProvider'='cash' AND EXISTS(
       SELECT 1 FROM events receipt WHERE receipt.owner=b.owner_id AND receipt.kind='cash_sale'
        AND receipt.id=a.data::jsonb->>'paymentReference' AND receipt.data::jsonb->>'bookingId'=a.id
        AND receipt.data::jsonb->>'payment'='Cash recorded manually')))))
     OR (e.kind IN ('membership','package') AND EXISTS(SELECT 1 FROM membership_session_ledger l
      JOIN customer_memberships m ON m.id=l.membership_id AND m.business_id=l.business_id
      WHERE l.id=e.source_id AND l.business_id=e.business_id AND l.event_type='payment_confirmed' AND l.amount_cents=e.amount_cents)))`,[job.event_id,job.subscription_id])).rows[0];
   if(!r){await finish(pool,job,'skipped');continue;}
   const label=r.kind==='booking'?'Session':r.kind==='package'?'Service package':'Membership';
   const amount=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(r.amount_cents)/100);
   sendStarted=true;
   const result=await send({endpoint:r.endpoint,keys:{p256dh:r.p256dh,auth:r.auth}},
    {title:businessDeviceName(r.name),body:label+' payment completed · '+amount+'. Tap to view payments.',url:'/studio/'+encodeURIComponent(r.slug)+'#reports',tag:'selah-payment-'+r.id,businessId:r.business_id});
   if(['gone','invalid_subscription'].includes(result.status)){
    await pool.query("DELETE FROM business_push_subscriptions WHERE id=$1 AND business_id=$2 AND reviewer='owner'",[job.subscription_id,r.business_id]);
   }else{
    // HTTP rejection is known not accepted. A transport error/timeout can have
    // arrived at the provider, so keep it unknown instead of alerting twice.
    const retryable=result.status==='not_configured'||result.status==='failed'&&Number.isInteger(result.httpStatus);
    await finish(pool,job,result.status==='submitted'?'submitted':retryable?'failed':'unknown');
   }
  }catch{await finish(pool,job,sendStarted?'unknown':'failed');}
 }
 return {processed};
}
async function finish(pool,job,status){
 await pool.query("UPDATE owner_payment_push_deliveries SET status=$3,attempts=attempts+1,next_attempt_at=now()+interval '5 minutes',updated_at=now() WHERE event_id=$1 AND subscription_id=$2 AND status='processing'",[job.event_id,job.subscription_id,status]);
}
export function startOwnerPaymentPushWorker(){
 const key=Symbol.for('selahflow.owner.payment.push');if(globalThis[key])return;
 let busy=false;
 const run=async()=>{if(busy)return;busy=true;try{await deliverOwnerPaymentPush(getPool());}catch{console.warn('Owner payment push sweep unavailable.');}finally{busy=false;}};
 globalThis[key]=setInterval(run,10000);globalThis[key].unref?.();setTimeout(run,1000).unref?.();
}
