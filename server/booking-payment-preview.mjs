import {tokenHash} from './security.mjs';
/** Read-only: email security scanners cannot create a Checkout Session. */
export async function bookingPaymentPreview(pool,{slug,bookingId,token}){
 if(typeof token!=='string'||!/^[a-f0-9]{64}$/i.test(token)||typeof slug!=='string'||typeof bookingId!=='string')throw Error('Invalid booking payment link.');
 const r=(await pool.query("SELECT b.name,a.date,a.start,a.status,a.data,p.status AS payment_status FROM businesses b JOIN customer_booking_access c ON c.owner_id=b.owner_id AND c.booking_id=$2 AND c.token_hash=$3 AND c.expires_at>now() LEFT JOIN booking_requests r ON r.id=c.booking_id AND r.business_id=b.id JOIN appointments a ON a.id=COALESCE(r.appointment_id,c.booking_id) AND a.owner=b.owner_id LEFT JOIN booking_payments p ON p.booking_id=a.id AND p.business_id=b.id WHERE b.slug=$1 AND b.status='active' AND (r.id IS NULL OR r.status='accepted')",[slug,bookingId,tokenHash(token)])).rows[0];
 if(!r||r.status==='Cancelled')throw Error('This payment link is unavailable or expired. Contact the business.');
 const d=typeof r.data==='string'?JSON.parse(r.data):r.data;
 return {business:r.name,date:r.date,start:r.start,amountCents:Math.round(Number(d.price)*100),status:r.payment_status==='paid'?'paid':'ready'};
}
