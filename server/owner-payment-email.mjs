import {randomUUID} from 'node:crypto';
import {queueApprovedBooking} from './booking-client-notifications.mjs';
import {bookingReceiptSnapshot,bookingReceiptMessage} from './booking-receipts.mjs';
import {validEmail,maskDestination} from './notification-delivery.mjs';
import {paymentConfigured} from './membership-payments.mjs';
const fail=(message,status=409)=>Object.assign(Error(message),{status});
const uuid=s=>typeof s==='string'&&/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(s);
const obj=s=>typeof s==='string'?JSON.parse(s):s||{};
export async function queueOwnerPaymentEmail(pool,{owner,input,origin}){
 if(!input||!uuid(input.bookingId)||!uuid(input.key)||input.confirmed!==true)throw fail('Review and confirm the payment email.',400);
 const db=await pool.connect();try{await db.query('BEGIN');await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',[owner+':schedule']);
 const row=(await db.query("SELECT a.*,b.id AS business_id FROM appointments a JOIN businesses b ON b.owner_id=a.owner AND b.status='active' WHERE a.owner=$1 AND a.id=$2 FOR UPDATE OF a",[owner,input.bookingId])).rows[0];if(!row)throw fail('Appointment unavailable in this business.',404);
 const d=obj(row.data),amount=Math.round(Number(d.price)*100),email=String(d.email||'').trim();
 if(!['Confirmed','Scheduled','Checked in','Checked-in','Completed','No-show'].includes(row.status)||d.membershipCovered===true||d.paymentStatus==='paid'||!Number.isSafeInteger(amount)||amount<50||amount>99999999)throw fail('This appointment has no eligible online payment due.');
 if(!validEmail(email))throw fail('Add a valid client email address before requesting payment.',400);
 if(String(input.expectedEmail||'').trim().toLowerCase()!==email.toLowerCase()||input.expectedAmountCents!==amount)throw fail('The client email or amount changed. Refresh and review before sending.');
 const requests=(await db.query('SELECT id,status,appointment_id FROM booking_requests WHERE business_id=$1 AND (appointment_id=$2 OR id=$3)',[row.business_id,row.id,d.bookingRequestId||''])).rows;
 if(requests.some(r=>r.status!=='accepted'||r.appointment_id!==row.id)||d.bookingRequestId&&!requests.some(r=>r.id===d.bookingRequestId))throw fail('Approve this booking before emailing a payment link.');
 const payment=(await db.query('SELECT status,terminal_payment_intent_id FROM booking_payments WHERE business_id=$1 AND booking_id=$2',[row.business_id,row.id])).rows[0];if(payment?.status==='paid')throw fail('Payment has already been received.');
 if(payment?.status==='pending'&&payment.terminal_payment_intent_id)throw fail('Check or cancel the open phone card collection before emailing a payment link.');
 const duplicate=(await db.query('SELECT booking_id,status,attempts FROM booking_client_messages WHERE id=$1',[input.key])).rows[0];if(duplicate){if(duplicate.booking_id!==row.id)throw fail('Payment email request reference is unavailable.');await db.query('COMMIT');return {ok:true,queued:['queued','not_configured'].includes(duplicate.status)||duplicate.status==='failed'&&duplicate.attempts<3,alreadyQueued:true,destination:maskDestination(email,'email')};}
 const previous=(await db.query("SELECT id,status,attempts,updated_at,destination,message FROM booking_client_messages WHERE booking_id=$1 AND event_type='payment_link' AND channel='email' FOR UPDATE",[row.id])).rows[0];
 if(previous&&['processing','unknown'].includes(previous.status))throw fail('Check the existing email delivery outcome before sending another payment email.');
 const currentFlow=(await db.query('SELECT expires_at FROM booking_client_flows WHERE booking_id=$1 AND business_id=$2',[row.id,row.business_id])).rows[0];
 const sameManualEmail=previous&&obj(previous.message).ownerPaymentEmail===true&&obj(previous.message).quotedAmountCents===amount&&previous.destination.toLowerCase()===email.toLowerCase()&&new Date(currentFlow?.expires_at||0).getTime()>Date.now();
 if(sameManualEmail&&(['queued','not_configured'].includes(previous.status)||previous.status==='failed'&&previous.attempts<3||previous.status==='submitted'&&Date.now()-new Date(previous.updated_at).getTime()<60000)){await db.query('COMMIT');return {ok:true,queued:previous.status!=='submitted',alreadyQueued:true,destination:maskDestination(email,'email')};}
 if(!paymentConfigured()||!(await db.query("SELECT 1 FROM merchant_accounts WHERE business_id=$1 AND provider='stripe' AND charges_enabled=true AND onboarding_complete=true",[row.business_id])).rows.length)throw fail('Complete Stripe setup in Payment setup before emailing an online payment link.',400);
 // Only this owner-authorized action can enable online payment on an onsite-only booking.
 const next={...d,ownerEmailPaymentAllowed:true};
 await db.query('UPDATE appointments SET data=$1 WHERE owner=$2 AND id=$3',[JSON.stringify(next),owner,row.id]);
 await queueApprovedBooking(db,{bookingId:row.id,requestId:requests[0]?.id||null,origin,notify:false,refreshExpired:true});
 const flow=(await db.query('SELECT payment_url FROM booking_client_flows WHERE booking_id=$1 AND business_id=$2',[row.id,row.business_id])).rows[0];if(!flow)throw fail('Payment link could not be prepared.');
 const receipt=await bookingReceiptSnapshot(db,{owner,bookingId:row.id,date:row.date,start:row.start,duration:row.duration,staff:row.staff,data:next,origin,pending:false});
 const message={...bookingReceiptMessage(receipt,{event:'payment_link',paymentLink:flow.payment_url}),ownerPaymentEmail:true,quotedAmountCents:amount};
 await db.query("INSERT INTO booking_client_messages(id,booking_id,event_type,channel,destination,destination_masked,message,client_delivery_authorized_at) VALUES($1,$2,'payment_link','email',$3,$4,$5::jsonb,now()) ON CONFLICT(booking_id,event_type,channel) DO UPDATE SET id=excluded.id,destination=excluded.destination,destination_masked=excluded.destination_masked,message=excluded.message,status='queued',attempts=0,detail='',next_attempt_at=now(),updated_at=now(),created_at=now(),client_delivery_authorized_at=now()",[input.key,row.id,email,maskDestination(email,'email'),JSON.stringify(message)]);
 await db.query("INSERT INTO events(id,owner,created,kind,data) VALUES($1,$2,$3,'payment_email_requested',$4)",[randomUUID(),owner,new Date().toISOString(),JSON.stringify({appointment:row.id,messageId:input.key,onlinePaymentAuthorized:true})]);
 await db.query('COMMIT');return {ok:true,queued:true,destination:maskDestination(email,'email')};
 }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
}
