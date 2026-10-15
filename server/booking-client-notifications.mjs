import {randomBytes,randomUUID} from 'node:crypto';
import {getPool} from './database.mjs';
import {tokenHash} from './security.mjs';
import {paymentConfigured} from './membership-payments.mjs';
import {validEmail,validE164,maskDestination,sendNotificationChannel} from './notification-delivery.mjs';

const clean=x=>String(x||'').replace(/[<>\r\n]/g,' ').slice(0,150);
const dataOf=x=>typeof x==='string'?JSON.parse(x):x||{};
export const clientSmsPhone=x=>String(x||'').trim().replace(/[\s().-]/g,'');
export function clientPaymentMessage({business,date,start,data,event,link}){
 const time=`${Math.floor(start/60)%12||12}:${String(start%60).padStart(2,'0')} ${start<720?'AM':'PM'} Eastern`;
 const amount=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(data.price));
 const confirmed=event==='payment_confirmation';
 const summary=`${clean(business)}: ${confirmed?'Payment received':'Booking approved — payment requested'}. ${clean(date)} at ${time}. ${(data.services||[]).map(clean).join(', ')}. ${amount}${confirmed?' paid.':' due.'}`;
 return {subject:`${confirmed?'Payment confirmation':'Your booking payment link'} — ${clean(business)}`,text:`Hello ${clean(data.name)},\n\n${summary}\n\n${confirmed?'Thank you. Your Stripe payment has been verified.':`Pay securely with Stripe: ${link}\nThis private link expires in 30 days. Do not forward it.`}\n\nQuestions? Contact the business.`,sms:`${summary}${confirmed?' Thank you!':` Pay securely: ${link}`}`};
}
async function enqueue(db,row,event,link){
 const data=dataOf(row.data),message=clientPaymentMessage({business:row.name,date:row.date,start:row.start,data,event,link});
 for(const channel of ['email','sms']){
  const destination=channel==='email'?String(data.email||'').trim():clientSmsPhone(data.phone);
  await db.query('INSERT INTO booking_client_messages(id,booking_id,event_type,channel,destination,destination_masked,message) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb) ON CONFLICT(booking_id,event_type,channel) DO NOTHING',[randomUUID(),row.id,event,channel,destination,destination?maskDestination(destination,channel):'',JSON.stringify(message)]);
 }
}
/** Called inside the same transaction that accepts a pending request. */
export async function queueApprovedBooking(db,{bookingId,requestId,origin}){
 const row=(await db.query("SELECT a.*,b.id AS business_id,b.name,b.slug FROM appointments a JOIN businesses b ON b.owner_id=a.owner WHERE a.id=$1 AND b.status='active'",[bookingId])).rows[0];
 if(!row)return;
 const data=dataOf(row.data);
 if(data.membershipCovered===true||!(Number(data.price)>0))return;
 const host=new URL(origin);
 if(host.protocol!=='https:'&&host.hostname!=='localhost')throw Error('A secure application URL is required.');
 const token=randomBytes(32).toString('hex'),expiry=new Date(Date.now()+30*86400000).toISOString();
 // A fragment keeps the private token out of server access logs and referrers.
 const link=host.origin+'/payment/'+encodeURIComponent(row.slug)+'#booking_id='+encodeURIComponent(requestId)+'&token='+token;
 const inserted=await db.query('INSERT INTO booking_client_flows(booking_id,business_id,request_id,payment_url,expires_at) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING RETURNING booking_id',[bookingId,row.business_id,requestId,link,expiry]);
 if(!inserted.rowCount)return;
 await db.query('INSERT INTO customer_booking_access(token_hash,owner_id,booking_id,expires_at) VALUES($1,$2,$3,$4)',[tokenHash(token),row.owner,requestId,expiry]);
 await enqueue(db,row,'payment_link',link);
}
/** Called inside the verified financial receipt transaction. */
export async function queueBookingPaid(db,businessId,bookingId){
 const row=(await db.query("SELECT a.*,b.name,p.amount_cents FROM booking_client_flows f JOIN businesses b ON b.id=f.business_id JOIN appointments a ON a.id=f.booking_id AND a.owner=b.owner_id JOIN booking_payments p ON p.booking_id=f.booking_id AND p.business_id=f.business_id AND p.status='paid' WHERE f.business_id=$1 AND f.booking_id=$2 AND b.status='active'",[businessId,bookingId])).rows[0];
 if(!row)return;
 await db.query("UPDATE booking_client_messages SET status='superseded',detail='Payment already received',updated_at=now() WHERE booking_id=$1 AND event_type='payment_link' AND status NOT IN ('submitted','processing','unknown')",[bookingId]);
 await enqueue(db,{...row,data:{...dataOf(row.data),price:row.amount_cents/100}},'payment_confirmation','');
}
/** DB row claims serialize workers across instances. Network calls happen outside transactions. */
export async function processClientMessages(pool=getPool(),{send=sendNotificationChannel,limit=10}={}){
 // A crashed/ambiguous send is never blindly retried, including across deployment.
 await pool.query("UPDATE booking_client_messages SET status='unknown',detail='Delivery outcome unknown; check provider before resending',updated_at=now() WHERE status='processing' AND updated_at<now()-interval '2 minutes'");
 let processed=0;
 for(let i=0;i<limit;i++){
  const item=(await pool.query("UPDATE booking_client_messages SET status='processing',updated_at=now() WHERE id=(SELECT m.id FROM booking_client_messages m JOIN booking_client_flows f ON f.booking_id=m.booking_id JOIN businesses b ON b.id=f.business_id WHERE b.status='active' AND ((m.status IN ('queued','failed') AND m.attempts<3) OR m.status='not_configured') AND m.next_attempt_at<=now() ORDER BY m.next_attempt_at FOR UPDATE OF m SKIP LOCKED LIMIT 1) RETURNING *")).rows[0];
  if(!item)break;
  processed++;
  try{
   const state=(await pool.query("SELECT a.status AS appointment_status,f.expires_at,p.status AS payment_status,ma.charges_enabled,ma.onboarding_complete FROM booking_client_flows f JOIN businesses b ON b.id=f.business_id JOIN appointments a ON a.id=f.booking_id AND a.owner=b.owner_id LEFT JOIN booking_payments p ON p.booking_id=f.booking_id AND p.business_id=f.business_id LEFT JOIN merchant_accounts ma ON ma.business_id=f.business_id AND ma.provider='stripe' WHERE f.booking_id=$1 AND b.status='active'",[item.booking_id])).rows[0];
   let result;
   if(!state||item.event_type==='payment_link'&&(state.appointment_status==='Cancelled'||state.payment_status==='paid'||new Date(state.expires_at)<=new Date()))result={status:'superseded',detail:'Booking cancelled, paid, or link expired'};
   else if(item.channel==='email'?!validEmail(item.destination):!validE164(item.destination))result={status:'invalid_destination',detail:item.channel==='sms'?'Registration phone missing or invalid; use +country code and number':'Registration email missing or invalid'};
   else if(item.event_type==='payment_link'&&(!paymentConfigured()||!state.charges_enabled||!state.onboarding_complete))result={status:'not_configured',detail:'Connect and enable Stripe payments for this business'};
   else result=await send(item.channel,item.destination,{...dataOf(item.message),idempotencyKey:'client-message-'+item.id,trackAmbiguous:true});
   await pool.query("UPDATE booking_client_messages SET status=$1,detail=$2,attempts=attempts+CASE WHEN $1='failed' THEN 1 ELSE 0 END,next_attempt_at=now()+interval '5 minutes',updated_at=now() WHERE id=$3 AND status='processing'",[result.status,result.detail,item.id]);
  }catch{
   await pool.query("UPDATE booking_client_messages SET status='unknown',detail='Delivery outcome unknown; check provider before resending',updated_at=now() WHERE id=$1 AND status='processing'",[item.id]);
  }
 }
 return {processed};
}
export async function listClientMessages(pool,owner){
 return (await pool.query("SELECT m.id,m.booking_id,m.event_type,m.channel,m.destination_masked,m.status,m.detail,m.updated_at::text AS updated_at,a.date,a.start,p.status AS payment_status FROM booking_client_messages m JOIN booking_client_flows f ON f.booking_id=m.booking_id JOIN businesses b ON b.id=f.business_id JOIN appointments a ON a.id=f.booking_id AND a.owner=b.owner_id LEFT JOIN booking_payments p ON p.booking_id=f.booking_id AND p.business_id=f.business_id WHERE b.owner_id=$1 AND b.status='active' ORDER BY f.created_at DESC,m.event_type,m.channel LIMIT 200",[owner])).rows;
}
export async function retryClientMessages(pool,owner,bookingId){
 const result=await pool.query("UPDATE booking_client_messages m SET status='queued',attempts=0,next_attempt_at=now(),updated_at=now() FROM booking_client_flows f JOIN businesses b ON b.id=f.business_id WHERE m.booking_id=f.booking_id AND b.owner_id=$1 AND b.status='active' AND f.booking_id=$2 AND m.status IN ('failed','not_configured') AND m.updated_at<now()-interval '1 minute' RETURNING m.id",[owner,bookingId]);
 return {ok:true,queued:result.rowCount};
}
let started=false,busy=false;
export function startClientMessageWorker(){
 if(started)return;started=true;
 const tick=async()=>{if(busy)return;busy=true;try{await processClientMessages();}catch{console.error('Client message queue temporarily unavailable');}finally{busy=false;}};
 setInterval(tick,15000).unref();void tick();
}
