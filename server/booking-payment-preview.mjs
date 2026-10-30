import {bookingServicePaymentOptions} from './service-payment-options.mjs';
import {tokenHash} from './security.mjs';
import {pendingDirectBooking} from './direct-booking-approval.mjs';
import {sessionIsFull,SESSION_FULL_MESSAGE} from './session-capacity.mjs';
import {requiresBookingApproval} from './booking-review.mjs';
/** Read-only: email security scanners cannot create a Checkout Session. */
export async function bookingPaymentPreview(pool,{slug,bookingId,token}){
 if(typeof token!=='string'||!/^[a-f0-9]{64}$/i.test(token)||typeof slug!=='string'||typeof bookingId!=='string')throw Error('Invalid booking payment link.');
 const r=(await pool.query("SELECT b.name,s.data AS settings,a.date,a.start,a.status,a.data,p.status AS payment_status FROM businesses b LEFT JOIN settings s ON s.owner=b.owner_id JOIN customer_booking_access c ON c.owner_id=b.owner_id AND c.booking_id=$2 AND c.token_hash=$3 AND c.expires_at>now() LEFT JOIN booking_requests r ON r.id=c.booking_id AND r.business_id=b.id JOIN appointments a ON a.id=COALESCE(r.appointment_id,c.booking_id) AND a.owner=b.owner_id LEFT JOIN booking_payments p ON p.booking_id=a.id AND p.business_id=b.id WHERE b.slug=$1 AND b.status='active' AND (r.id IS NULL OR r.status='accepted')",[slug,bookingId,tokenHash(token)])).rows[0];
 if(!r){
  const pending=await pendingDirectBooking(pool,{slug,bookingId,token},{allowApproval:true});
  if(pending){
   const {row,config,services}=pending;
   const full=await sessionIsFull(pool,{owner:row.owner_id,config,date:row.date,staff:row.staff_id,services,start:row.start_minute});
   return {business:row.business_name,date:row.date,start:Number(row.start_minute),amountCents:Math.round(Number(pending.details.quotedPrice)*100),status:full?'full':requiresBookingApproval(services)?'awaiting_approval':'ready',message:full?SESSION_FULL_MESSAGE:undefined,pendingReservation:true};
  }
 }
 if(!r||r.status==='Cancelled')throw Error('This payment link is unavailable or expired. Contact the business.');
 const d=typeof r.data==='string'?JSON.parse(r.data):r.data;
 const config=typeof r.settings==='string'?JSON.parse(r.settings):r.settings||{};
 const options=bookingServicePaymentOptions(config,d);
 if(r.payment_status!=='paid'&&d.paymentStatus!=='paid'&&(d.membershipCovered||Number(d.price)===0))return {business:r.name,amountCents:0,status:'covered'};
 if(r.payment_status!=='paid'&&d.paymentStatus!=='paid'&&!options.online)return {business:r.name,date:r.date,start:r.start,amountCents:Math.round(Number(d.price)*100),status:'onsite'};
 return {business:r.name,date:r.date,start:r.start,amountCents:Math.round(Number(d.price)*100),status:r.payment_status==='paid'||d.paymentStatus==='paid'?'paid':'ready'};
}
