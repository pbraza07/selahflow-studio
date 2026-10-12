import {getPool} from './database.mjs';
import {sendWebPush,configured} from './push-crypto.mjs';
export async function notifyCustomerBooking(owner,bookingId,status){
 if(!configured())return {delivered:0};
 const pool=getPool();
 const subs=(await pool.query("SELECT p.id,p.endpoint,p.p256dh,p.auth,a.token_hash FROM customer_booking_push p JOIN customer_booking_access a ON a.owner_id=p.owner_id AND a.booking_id=p.booking_id AND a.token_hash=p.token_hash WHERE p.owner_id=$1 AND p.booking_id=$2 AND a.expires_at>now()",[owner,bookingId])).rows;
 let delivered=0;
 for(const sub of subs){
  const payload={title:'SelahFlow · Booking '+status,body:'Your booking status is '+status+'. Tap to view your booking details.',url:'/customer/booking?id='+encodeURIComponent(bookingId),tag:'selah-customer-'+bookingId};
  // Access tokens never appear in push payloads or URLs; the receiving browser uses its locally stored token.

  const result=await sendWebPush({endpoint:sub.endpoint,keys:{p256dh:sub.p256dh,auth:sub.auth}},payload);
  if(result.status==='submitted')delivered++;
  if(result.status==='gone'||result.status==='invalid_subscription')await pool.query('DELETE FROM customer_booking_push WHERE id=$1',[sub.id]);
 }
 return {delivered};
}
