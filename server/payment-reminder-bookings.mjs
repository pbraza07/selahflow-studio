import {bookingServicePaymentOptions} from './service-payment-options.mjs';
import {validEmail} from './notification-delivery.mjs';
import {tokenHash} from './security.mjs';
import {stripeApi,paymentConfigured} from './membership-payments.mjs';
import {assertTestPayment} from './stripe-checkout.mjs';

const obj=value=>{try{return typeof value==='string'?JSON.parse(value):value||{};}catch{return {};}};
const clean=value=>String(value??'').replace(/[<>\r\n]/g,' ').trim().slice(0,400);
const stamp=value=>{const n=new Date(value||'').getTime();return Number.isFinite(n)?new Date(n).toISOString():null;};
const statuses=new Set(['Confirmed','Scheduled','Checked in','Checked-in','Completed']);

async function rows(db,{businessId,sourceId=null,lock=false}){
 if(typeof businessId!=='string'||!businessId)return [];
 return (await db.query(`SELECT a.*,b.id AS business_id,b.name AS business_name,b.slug,s.data AS settings,
  p.status AS payment_status,p.terminal_payment_intent_id,p.amount_cents AS checkout_amount_cents,
  p.stripe_account_id,p.stripe_checkout_session_id,p.stripe_payment_intent_id,
  f.payment_url,f.expires_at AS flow_expires_at,f.created_at AS flow_created_at,f.request_id AS flow_request_id,
  COALESCE((SELECT jsonb_agg(jsonb_build_object('id',r.id,'status',r.status,'appointmentId',r.appointment_id,'reviewedAt',r.reviewed_at,'createdAt',r.created_at))
   FROM booking_requests r WHERE r.business_id=b.id AND r.owner_id=b.owner_id
    AND (r.appointment_id=a.id OR r.id=a.data::jsonb->>'bookingRequestId' OR r.id=f.request_id)),'[]'::jsonb) AS requests,
  EXISTS(SELECT 1 FROM events e WHERE e.owner=b.owner_id AND e.kind='cash_sale' AND e.data::jsonb->>'bookingId'=a.id) AS linked_payment,
  (SELECT MAX(n.notice_at) FROM (
    SELECT COALESCE(m.client_delivery_authorized_at,m.created_at) AS notice_at FROM booking_client_messages m
     WHERE m.booking_id=a.id AND m.channel='email' AND m.event_type='payment_link'
    UNION ALL SELECT COALESCE(m.client_delivery_authorized_at,m.created_at) FROM booking_receipt_emails m
     WHERE m.business_id=b.id AND m.event_type IN ('submission','approval')
      AND (m.booking_key=a.id OR m.booking_key=a.data::jsonb->>'bookingRequestId' OR m.booking_key=f.request_id)
   ) n) AS last_notice_at
 FROM appointments a JOIN businesses b ON b.owner_id=a.owner AND b.status='active'
 LEFT JOIN settings s ON s.owner=b.owner_id
 LEFT JOIN booking_payments p ON p.booking_id=a.id AND p.business_id=b.id
 LEFT JOIN booking_client_flows f ON f.booking_id=a.id AND f.business_id=b.id
 WHERE b.id=$1 AND ($2::text IS NULL OR a.id=$2)
  AND a.status IN ('Confirmed','Scheduled','Checked in','Checked-in','Completed')
  AND (p.status IS NULL OR p.status<>'paid')
  AND COALESCE(a.data::jsonb->>'paymentStatus','')<>'paid'
  AND COALESCE(a.data::jsonb->>'membershipCovered','')<>'true'
 ORDER BY a.date,a.start,a.id ${lock?'FOR UPDATE OF a':''}`,[businessId,sourceId])).rows;
}

function candidate(row,{destination=null}={}){
 const d=obj(row.data),config=obj(row.settings),email=String(d.email||d.customerEmail||'').trim().toLowerCase();
 if(config.dailyPaymentReminders===false||!statuses.has(row.status)||!validEmail(email)||destination&&email!==String(destination).trim().toLowerCase())return null;
 if(d.membershipCovered===true||d.paymentStatus==='paid'||row.payment_status==='paid'||row.linked_payment||row.payment_status==='pending'&&row.terminal_payment_intent_id)return null;
 const amount=Math.round(Number(d.price)*100);
 if(!Number.isSafeInteger(amount)||amount<=0||amount>100000000)return null;
 // Saved checkout totals remain authoritative; do not email an amount the private
 // checkout will reject because the owner changed a quote after checkout started.
 if(row.checkout_amount_cents!=null&&Number(row.checkout_amount_cents)!==amount)return null;
 const requests=Array.isArray(row.requests)?row.requests:obj(row.requests);
 if(!Array.isArray(requests)||requests.some(r=>r.status!=='accepted'||r.appointmentId!==row.id))return null;
 if(d.bookingRequestId&&!requests.some(r=>r.id===d.bookingRequestId)||row.flow_request_id&&!requests.some(r=>r.id===row.flow_request_id))return null;
 const services=Array.isArray(config.services)?config.services:[],ids=Array.isArray(d.serviceIds)?d.serviceIds:[],names=Array.isArray(d.services)?d.services:[];
 // Removed catalog items are not unpaid obligations in the financial report.
 // Skip partially removed quotes too, rather than asking for the old full amount.
 if(ids.length?ids.some(id=>!services.some(s=>s.id===id)):!names.length||names.some(name=>!services.some(s=>s.name===name)))return null;
 if(Array.isArray(d.paymentLines)&&d.paymentLines.length){
  if(d.paymentLines.some(line=>line.type==='service'&&!services.some(s=>s.id===line.id)))return null;
  const totals=d.paymentLines.map(line=>Number.isInteger(Number(line.qty))&&Number(line.qty)>0?Math.round(Number(line.price)*100)*Number(line.qty):NaN);
  if(totals.some(n=>!Number.isSafeInteger(n)||n<0)||totals.reduce((a,b)=>a+b,0)!==amount)return null;
 }
 const options=bookingServicePaymentOptions(config,d),online=options.online&&amount>=50&&row.status!=='Scheduled';
 const reviewed=requests.map(r=>stamp(r.reviewedAt)).filter(Boolean).sort().at(-1);
 return {kind:'booking',sourceId:row.id,businessId:row.business_id,destination:email,businessName:clean(row.business_name),
  clientName:clean(d.name||d.customerName||'Client'),label:clean(names.join(', ')||'Session'),amountCents:amount,
  eligibleSince:reviewed||stamp(d.created)||stamp(row.flow_created_at)||stamp(row.date),lastNoticeAt:stamp(row.last_notice_at),
  date:row.date,start:Number(row.start),paymentOptions:{...options,online},
  note:!online?(options.onsite?'Payment remains due at the business until it is recorded.':'Contact the business for payment options.'):'',
  actionLabel:online?'Pay for session':'View session payment details'};
}

/** Read-only candidate discovery. Never prepares checkout or changes payment policy. */
export async function listBookingReminderCandidates(pool,{businessId,destination=null,now=new Date()}={}){
 // A supplied clock is accepted for the shared scheduler contract; timestamps are
 // returned to the scheduler, which decides the 24-hour daily reminder boundary.
 void now;
 return (await rows(pool,{businessId})).map(row=>candidate(row,{destination})).filter(Boolean);
}

async function providerStillUnpaid(row,{api,configured}){
 const references=new Set([row.stripe_payment_intent_id,row.terminal_payment_intent_id].filter(Boolean));
 if(!row.stripe_checkout_session_id&&!references.size)return true;
 if(!configured||!/^acct_[A-Za-z0-9]+$/.test(row.stripe_account_id||''))throw Error('Booking payment status is unavailable.');
 const account=row.stripe_account_id;
 if(row.stripe_checkout_session_id){
  if(!/^cs_[A-Za-z0-9_]+$/.test(row.stripe_checkout_session_id))throw Error('Booking checkout reference requires review.');
  const session=await api('checkout/sessions/'+row.stripe_checkout_session_id,{method:'GET',account});assertTestPayment(session);
  if(session.id!==row.stripe_checkout_session_id||session.mode!=='payment'||session.client_reference_id!==row.id||session.metadata?.booking_id!==row.id||session.metadata?.selahflow_business_id!==row.business_id||session.currency!=='usd'||session.amount_total!==Number(row.checkout_amount_cents))throw Error('Booking checkout details require review.');
  if(['paid','no_payment_required'].includes(session.payment_status)||session.status==='complete')return false;
  if(session.payment_status!=='unpaid'||!['open','expired'].includes(session.status))throw Error('Booking checkout status is unavailable.');
  if(session.payment_intent)references.add(typeof session.payment_intent==='string'?session.payment_intent:session.payment_intent.id);
 }
 for(const reference of references){
  if(!/^pi_[A-Za-z0-9]+$/.test(reference||''))throw Error('Booking payment reference requires review.');
  const intent=await api('payment_intents/'+reference,{method:'GET',account});assertTestPayment(intent);
  if(intent.id!==reference||intent.currency!=='usd'||intent.amount!==Number(row.checkout_amount_cents)||intent.metadata?.booking_id!==row.id||intent.metadata?.selahflow_business_id&&intent.metadata.selahflow_business_id!==row.business_id||reference===row.terminal_payment_intent_id&&intent.metadata?.selahflow_business_id!==row.business_id)throw Error('Booking payment details require review.');
  if(['processing','succeeded','requires_capture'].includes(intent.status))return false;
  if(!['requires_payment_method','requires_confirmation','requires_action','canceled'].includes(intent.status))throw Error('Booking payment status is unavailable.');
 }
 return true;
}

/** Recheck one business/recipient immediately before composing a daily email.
 * Only private access links are created/refreshed; no charge, approval or payment
 * preference is created. Existing transaction clients can be passed by workers.
 */
export async function prepareBookingReminder(pool,{businessId,sourceId,origin,now=new Date(),destination=null,api=stripeApi,configured=paymentConfigured()}={}){
 if(typeof sourceId!=='string'||!sourceId)return null;
 const host=new URL(origin);if(host.protocol!=='https:'&&host.hostname!=='localhost')throw Error('A secure application URL is required.');
 const owns=typeof pool.connect==='function'&&typeof pool.release!=='function',db=owns?await pool.connect():pool;
 try{
  if(owns)await db.query('BEGIN');
  let row=(await rows(db,{businessId,sourceId,lock:true}))[0];
  let item=row&&candidate(row,{destination});
  if(!item){if(owns)await db.query('COMMIT');return null;}
  if(!await providerStillUnpaid(row,{api,configured})){if(owns)await db.query('COMMIT');return null;}
  // Provider reads can outlast a webhook or owner update. Never prepare a link
  // against replacement payment references or a newly settled local balance.
  const fresh=(await rows(db,{businessId,sourceId,lock:true}))[0],freshItem=fresh&&candidate(fresh,{destination:item.destination});
  if(!freshItem){if(owns)await db.query('COMMIT');return null;}
  if(['stripe_account_id','stripe_checkout_session_id','stripe_payment_intent_id','terminal_payment_intent_id'].some(key=>row[key]!==fresh[key])||item.amountCents!==freshItem.amountCents)throw Error('Booking payment changed while preparing its reminder.');
  row=fresh;item=freshItem;
  const requests=Array.isArray(row.requests)?row.requests:obj(row.requests),requestId=requests.find(r=>r.id===row.flow_request_id)?.id||requests.find(r=>r.id===obj(row.data).bookingRequestId)?.id||requests[0]?.id||null;
  const reference=requestId||sourceId;
  let valid=false;
  try{
   const url=new URL(row.payment_url),hash=new URLSearchParams(url.hash.slice(1)),token=hash.get('token');
   valid=url.origin===host.origin&&url.pathname==='/payment/'+encodeURIComponent(row.slug)&&hash.get('booking_id')===reference&&/^[a-f0-9]{64}$/i.test(token||'')&&new Date(row.flow_expires_at)>new Date(now);
   if(valid)valid=(await db.query('SELECT 1 FROM customer_booking_access WHERE owner_id=$1 AND booking_id=$2 AND token_hash=$3 AND expires_at>now()',[row.owner,reference,tokenHash(token)])).rows.length>0;
  }catch{valid=false;}
  if(!valid){
   // Refresh damaged/expired links through the existing token issuer; retained
   // older access tokens remain subject to their original expiry and scope.
   await db.query('UPDATE booking_client_flows SET expires_at=now() WHERE booking_id=$1 AND business_id=$2',[sourceId,businessId]);
   const {queueApprovedBooking}=await import('./booking-client-notifications.mjs');
   await queueApprovedBooking(db,{bookingId:sourceId,requestId,origin:host.origin,notify:false,refreshExpired:true});
  }
  const flow=(await db.query('SELECT payment_url FROM booking_client_flows WHERE booking_id=$1 AND business_id=$2',[sourceId,businessId])).rows[0];
  if(!flow)throw Error('Reminder payment details unavailable.');
  if(owns)await db.query('COMMIT');
  return {...item,url:flow.payment_url};
 }catch(error){if(owns)await db.query('ROLLBACK');throw error;}finally{if(owns)db.release();}
}
