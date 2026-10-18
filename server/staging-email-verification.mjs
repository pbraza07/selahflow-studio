import {bookingReceiptSnapshot,bookingReceiptMessage} from './booking-receipts.mjs';
import {createHash} from 'node:crypto';
import {assertStagingDatabase,isStaging} from './staging-safety.mjs';
import {validEmail} from './notification-delivery.mjs';
import {processClientMessages} from './booking-client-notifications.mjs';
import {processBookingReceipts} from './booking-receipts.mjs';
const object=x=>typeof x==='string'?JSON.parse(x):x;
/** Retries at most one existing, valid email of each kind for one saved recipient. */
export async function verifyStagingClientEmails(pool,target,env=process.env,{payments=processClientMessages,receipts=processBookingReceipts}={}){
 if(!isStaging(env))throw Error('Email verification is restricted to staging.');assertStagingDatabase(env);
 if(!validEmail(target?.recipient)||!target?.businessSlug)throw Error('Invalid email verification target.');
 const recipient=target.recipient.trim().toLowerCase(),operationId=createHash('sha256').update('email-verification-v103|'+JSON.stringify(target)).digest('hex');
 const prior=(await pool.query('SELECT result FROM staging_email_verifications WHERE operation_id=$1',[operationId])).rows[0];
 if(prior){const r=object(prior.result);return {...r.summary,alreadyApplied:true};}
 const business=(await pool.query("SELECT id FROM businesses WHERE slug=$1 AND status='active'",[target.businessSlug])).rows[0];if(!business)throw Error('Email verification business unavailable.');
 const selected=[];
 for(const type of ['payment_link','payment_confirmation']){
  const row=(await pool.query("SELECT m.id,m.booking_id,m.status,m.detail,m.event_type FROM booking_client_messages m JOIN booking_client_flows f ON f.booking_id=m.booking_id JOIN businesses b ON b.id=f.business_id JOIN appointments a ON a.id=f.booking_id AND a.owner=b.owner_id LEFT JOIN booking_payments p ON p.booking_id=a.id AND p.business_id=b.id WHERE b.id=$1 AND m.channel='email' AND lower(trim(m.destination))=$2 AND m.event_type=$3 AND m.status IN ('not_configured','failed','submitted') AND a.status<>'Cancelled' AND (($3='payment_link' AND p.status IS DISTINCT FROM 'paid' AND f.expires_at>now()) OR ($3='payment_confirmation' AND p.status='paid')) ORDER BY CASE WHEN m.status='submitted' THEN 1 ELSE 0 END,m.updated_at DESC,m.id LIMIT 1",[business.id,recipient,type])).rows[0];
  if(row)selected.push({...row,table:'booking_client_messages'});
 }
 const receipt=(await pool.query("SELECT m.booking_key,m.event_type,m.status,m.detail FROM booking_receipt_emails m JOIN businesses b ON b.id=m.business_id JOIN appointments a ON a.id=m.booking_key AND a.owner=b.owner_id WHERE b.id=$1 AND lower(trim(m.destination))=$2 AND m.status IN ('not_configured','failed','submitted') AND a.status<>'Cancelled' ORDER BY CASE WHEN m.status='submitted' THEN 1 ELSE 0 END,CASE WHEN m.event_type='approval' THEN 0 ELSE 1 END,m.updated_at DESC LIMIT 1",[business.id,recipient])).rows[0];
 if(receipt)selected.push({...receipt,table:'booking_receipt_emails'});
 const initial={bookingReceipt:'unavailable',paymentLink:'unavailable',paymentConfirmation:'unavailable'};
 const claimed=await pool.query('INSERT INTO staging_email_verifications(operation_id,business_id,result) VALUES($1,$2,$3::jsonb) ON CONFLICT DO NOTHING RETURNING operation_id',[operationId,business.id,JSON.stringify({selected,summary:initial})]);
 if(!claimed.rows.length)return {alreadyApplied:true};
 // Rebuild only unsent verification messages from the saved booking, with current balances and CTA labels.
 for(const item of selected.filter(r=>r.status!=='submitted')){
  const bookingId=item.booking_id||item.booking_key;
  const row=(await pool.query('SELECT a.*,f.payment_url FROM appointments a JOIN businesses b ON b.owner_id=a.owner LEFT JOIN booking_client_flows f ON f.booking_id=a.id AND f.business_id=b.id WHERE a.id=$1 AND b.id=$2',[bookingId,business.id])).rows[0];
  if(!row)continue;
  const origin=env.APP_URL||env.RENDER_EXTERNAL_URL;
  const snapshot=await bookingReceiptSnapshot(pool,{owner:row.owner,bookingId:row.id,date:row.date,start:row.start,duration:row.duration,staff:row.staff,data:object(row.data),origin,pending:false});
  const message=bookingReceiptMessage(snapshot,{event:item.event_type,paymentLink:item.event_type==='payment_link'?row.payment_url:''});
  if(item.table==='booking_client_messages')await pool.query("UPDATE booking_client_messages SET message=$1::jsonb WHERE id=$2 AND status IN ('failed','not_configured')",[JSON.stringify(message),item.id]);
  else await pool.query("UPDATE booking_receipt_emails SET message=$1::jsonb WHERE business_id=$2 AND booking_key=$3 AND event_type=$4 AND status IN ('failed','not_configured')",[JSON.stringify(message),business.id,item.booking_key,item.event_type]);
 }
 const paymentIds=selected.filter(r=>r.table==='booking_client_messages'&&r.status!=='submitted').map(r=>r.id);
 const receiptKeys=selected.filter(r=>r.table==='booking_receipt_emails'&&r.status!=='submitted').map(r=>r.booking_key);
 await pool.query("UPDATE booking_client_messages SET status='queued',attempts=0,next_attempt_at=now(),client_delivery_authorized_at=now(),updated_at=now() WHERE id=ANY($1::text[]) AND channel='email' AND status IN ('failed','not_configured')",[paymentIds]);
 if(receiptKeys.length)await pool.query("UPDATE booking_receipt_emails SET status='queued',attempts=0,next_attempt_at=now(),client_delivery_authorized_at=now(),updated_at=now() WHERE business_id=$1 AND booking_key=ANY($2::text[]) AND event_type=$3 AND status IN ('failed','not_configured')",[business.id,receiptKeys,receipt.event_type]);
 if(paymentIds.length)await payments(pool,{messageIds:paymentIds,limit:paymentIds.length});
 if(receiptKeys.length)await receipts(pool,{bookingKeys:receiptKeys,limit:1});
 const summary={...initial},details={};
 for(const selectedRow of selected){
  const row=selectedRow.table==='booking_client_messages'?(await pool.query('SELECT status,detail FROM booking_client_messages WHERE id=$1',[selectedRow.id])).rows[0]:(await pool.query('SELECT status,detail FROM booking_receipt_emails WHERE business_id=$1 AND booking_key=$2 AND event_type=$3',[business.id,selectedRow.booking_key,selectedRow.event_type])).rows[0];
  const key=selectedRow.table==='booking_receipt_emails'?'bookingReceipt':selectedRow.event_type==='payment_link'?'paymentLink':'paymentConfirmation';
  summary[key]=row?.status||'unavailable';details[key]=row?.detail||'';
 }
 await pool.query('UPDATE staging_email_verifications SET result=$1::jsonb,updated_at=now() WHERE operation_id=$2',[JSON.stringify({selected,summary,details}),operationId]);
 return {...summary,details};
}
