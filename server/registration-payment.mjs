import {randomBytes} from 'node:crypto';
import {tokenHash} from './security.mjs';
import {paymentConfigured} from './membership-payments.mjs';
import {startBookingCheckout} from './stripe-checkout.mjs';

const dataOf=value=>{try{return typeof value==='string'?JSON.parse(value):value||{};}catch{return {};}};
export async function registrationPaymentSummary(pool,owner,appointmentId){
 if(!appointmentId)return {state:'awaiting_approval'};
 const row=(await pool.query(`SELECT a.status,a.data,b.slug,r.id AS request_id,r.status AS request_status,p.status AS payment_status,
 ma.charges_enabled,ma.onboarding_complete FROM appointments a JOIN businesses b ON b.owner_id=a.owner AND b.status='active'
 LEFT JOIN booking_requests r ON r.appointment_id=a.id AND r.business_id=b.id
 LEFT JOIN booking_payments p ON p.booking_id=a.id AND p.business_id=b.id
 LEFT JOIN merchant_accounts ma ON ma.business_id=b.id AND ma.provider='stripe'
 WHERE a.owner=$1 AND a.id=$2`,[owner,appointmentId])).rows[0];
 if(!row)return {state:'unavailable'};
 if(row.payment_status==='paid')return {state:'paid'};
 if(!['Confirmed','Checked in','Checked-in','Completed','No-show'].includes(row.status)||row.request_id&&row.request_status!=='accepted')return {state:'unavailable'};
 const data=dataOf(row.data),amountCents=Math.round(Number(data.price)*100);
 if(data.membershipCovered===true||amountCents===0)return {state:'covered'};
 if(!Number.isSafeInteger(amountCents)||amountCents<50||amountCents>100000000)return {state:'unavailable'};
 if(!paymentConfigured()||!row.charges_enabled||!row.onboarding_complete)return {state:'contact_business',amountCents};
 return {state:'due',amountCents,slug:row.slug,bookingId:row.request_id||appointmentId};
}

/** The ID-only lookup never exposes a private access token or registration contacts. */
export async function startRegistrationPayment(pool,{slug,bookingId,memberNumber,dateOfBirth,origin},checkout=startBookingCheckout){
 if(typeof slug!=='string'||!/^[-a-f0-9]{36}$/i.test(bookingId||'')||!/^[A-Z]{2}[0-9]{4}$/.test(memberNumber||'')||!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth||''))throw Error('Enter your membership ID and registration date of birth.');
 const row=(await pool.query(`SELECT b.owner_id,a.data FROM businesses b JOIN appointments a ON a.owner=b.owner_id
 LEFT JOIN booking_requests r ON r.business_id=b.id AND r.appointment_id=a.id
 WHERE b.slug=$1 AND b.status='active' AND (r.id=$2 OR a.id=$2)`,[slug,bookingId])).rows[0];
 const data=dataOf(row?.data);
 if(!row||String(data.memberNumber||'').trim().toUpperCase()!==memberNumber||String(data.dateOfBirth||'').slice(0,10)!==dateOfBirth)throw Error('Registration details do not match. Check the date of birth or contact the business.');
 const token=randomBytes(32).toString('hex'),hash=tokenHash(token);
 await pool.query("INSERT INTO customer_booking_access(token_hash,owner_id,booking_id,expires_at) VALUES($1,$2,$3,now()+interval '10 minutes')",[hash,row.owner_id,bookingId]);
 try{return await checkout(pool,{slug,bookingId,token,origin});}
 finally{await pool.query('DELETE FROM customer_booking_access WHERE token_hash=$1',[hash]);}
}
