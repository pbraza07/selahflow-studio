import {tokenHash} from './security.mjs';
import {bookingServicePaymentOptions} from './service-payment-options.mjs';
const obj=x=>typeof x==='string'?JSON.parse(x):x||{};
/** A preference is never a financial receipt. Private links and POST prevent scanner side effects. */
export async function chooseBookingOnsite(pool,{slug,bookingId,token}){
 if(typeof token!=='string'||!/^[a-f0-9]{64}$/i.test(token)||typeof bookingId!=='string'||typeof slug!=='string')throw Error('Invalid booking payment link.');
 const db=await pool.connect();try{
  await db.query('BEGIN');
  const b=(await db.query("SELECT b.id,b.owner_id,s.data AS settings FROM businesses b JOIN customer_booking_access c ON c.owner_id=b.owner_id AND c.booking_id=$2 AND c.token_hash=$3 AND c.expires_at>now() LEFT JOIN settings s ON s.owner=b.owner_id WHERE b.slug=$1 AND b.status='active'",[slug,bookingId,tokenHash(token)])).rows[0];
  if(!b)throw Error('This payment link is unavailable or expired.');
  const r=(await db.query('SELECT * FROM booking_requests WHERE id=$1 AND business_id=$2 FOR UPDATE',[bookingId,b.id])).rows[0];
  if(r&&r.status!=='accepted'){
   if(!['pending','pending_approval'].includes(r.status))throw Error('This booking is unavailable.');
   const d=obj(r.details);if(!bookingServicePaymentOptions(obj(b.settings),d).onsite)throw Error('Pay on Site is not enabled for this service.');
   await db.query("UPDATE booking_requests SET details=(details::jsonb||'{\"paymentChoice\":\"onsite\"}'::jsonb)::text WHERE id=$1 AND business_id=$2",[r.id,b.id]);
   await db.query('COMMIT');return {onsite:true,pending:true,paid:false};
  }
  const a=(await db.query('SELECT data,status FROM appointments WHERE id=$1 AND owner=$2 FOR UPDATE',[r?.appointment_id||bookingId,b.owner_id])).rows[0];
  if(!a||a.status==='Cancelled')throw Error('This booking is unavailable.');
  const d=obj(a.data),p=(await db.query('SELECT status FROM booking_payments WHERE booking_id=$1 AND business_id=$2',[r?.appointment_id||bookingId,b.id])).rows[0];
  if(d.paymentStatus==='paid'||p?.status==='paid'){await db.query('COMMIT');return {paid:true};}
  if(d.membershipCovered||Number(d.price)===0)throw Error('No payment is due for this booking.');
  if(!bookingServicePaymentOptions(obj(b.settings),d).onsite)throw Error('Pay on Site is not enabled for this service.');
  await db.query("UPDATE appointments SET data=(data::jsonb||'{\"paymentChoice\":\"onsite\"}'::jsonb)::text WHERE id=$1 AND owner=$2",[r?.appointment_id||bookingId,b.owner_id]);
  await db.query('COMMIT');return {onsite:true,paid:false};
 }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
}
