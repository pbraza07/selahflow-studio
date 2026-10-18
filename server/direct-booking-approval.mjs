import {tokenHash} from './security.mjs';
import {requiresBookingApproval} from './booking-review.mjs';
import {confirmBooking} from './booking-approvals.mjs';
const object=x=>typeof x==='string'?JSON.parse(x):x||{};
/** Read-only: permission comes from the booking's private access token, never its ID alone. */
export async function pendingDirectBooking(db,{slug,bookingId,token}){
 const row=(await db.query("SELECT r.*,b.name AS business_name,s.data AS settings FROM businesses b JOIN booking_requests r ON r.business_id=b.id AND r.owner_id=b.owner_id JOIN customer_booking_access c ON c.owner_id=b.owner_id AND c.booking_id=r.id AND c.token_hash=$3 AND c.expires_at>now() JOIN settings s ON s.owner=b.owner_id WHERE b.slug=$1 AND b.status='active' AND r.id=$2 AND r.status='pending'",[slug,bookingId,tokenHash(token)])).rows[0];
 return directContext(row);
}
function directContext(row){
 if(!row)return null;
 const config=object(row.settings),details=object(row.details),ids=details.serviceIds;
 if(!Array.isArray(ids)||!ids.length||new Set(ids).size!==ids.length)return null;
 const services=ids.map(id=>(config.services||[]).find(s=>s.id===id));
 if(services.some(s=>!s)||requiresBookingApproval(services))return null;
 return {row,config,details,services};
}
/** Only an intentional checkout click confirms an old request; preview never reserves a seat. */
export async function confirmDirectBookingForPayment(pool,args){
 const context=await pendingDirectBooking(pool,args);
 if(!context)return;
 return confirmUncheckedRequest(pool,context,args.origin);
}
async function confirmUncheckedRequest(pool,context,origin){
 const {row,config,details:d,services}=context;
 const data={memberNumber:d.memberNumber||null,firstName:d.firstName,lastName:d.lastName,dateOfBirth:d.dateOfBirth,
  name:d.customerName,email:d.customerEmail,phone:d.customerPhone,services:services.map(s=>s.name),serviceIds:services.map(s=>s.id),
  price:Number(d.quotedPrice),membershipCovered:d.membershipCovered===true,membershipCreditAllowed:d.membershipCreditAllowed===true,
  paymentLines:d.paymentLines,sessionId:d.sessionId||null,customAnswers:d.customAnswers||{},customFieldLabels:d.customFieldLabels||{},customFieldTypes:d.customFieldTypes||{},
  originalSubmission:d.originalSubmission||null,policyAccepted:d.policyAccepted===true,policyAcceptedAt:d.policyAcceptedAt||null,
  bookingRequestId:row.id,channel:'Online booking',created:d.created||new Date().toISOString(),reviewedBy:'automatic:catalog-no-approval'};
 try{
  await confirmBooking({pool,owner:row.owner_id,services,staff:row.staff_id,date:row.date,start:Number(row.start_minute),duration:Number(row.duration),buffer:Number(config.buffer)||0,
   id:row.id,data,pendingId:row.id,autoConfirmRequest:row,notificationOrigin:origin});
 }catch(error){
  // Concurrent checkout/owner review may already have confirmed this same request.
  const latest=(await pool.query("SELECT status FROM booking_requests WHERE id=$1 AND business_id=$2",[row.id,row.business_id])).rows[0];
  if(latest?.status!=='accepted')throw error;
 }
}
/** Trusted background reconciliation only: no public route accepts booking IDs as permission.
 * A cursor ensures unavailable requests cannot starve later eligible requests.
 * Confirmation uses the same locked policy/price/capacity validation as checkout.
 */
export async function reconcileUncheckedBookings(pool,{origin,after='',limit=25}={}){
 const url=new URL(origin);
 if(url.protocol!=='https:'&&url.hostname!=='localhost')throw Error('A secure application URL is required.');
 const rows=(await pool.query("SELECT r.*,s.data AS settings FROM booking_requests r JOIN businesses b ON b.id=r.business_id AND b.owner_id=r.owner_id JOIN settings s ON s.owner=r.owner_id WHERE b.status='active' AND r.status='pending' AND r.date>=to_char(now() AT TIME ZONE 'America/New_York','YYYY-MM-DD') AND r.id>$1 ORDER BY r.id LIMIT $2",[after,Math.min(100,Math.max(1,limit))])).rows;
 let eligible=0,confirmed=0,unavailable=0;
 for(const row of rows){
  const context=directContext(row);if(!context)continue;eligible++;
  try{await confirmUncheckedRequest(pool,context,url.origin);confirmed++;}
  catch(error){if(error.status===409){unavailable++;continue;}throw error;}
 }
 return {scanned:rows.length,eligible,confirmed,unavailable,next:rows.at(-1)?.id||''};
}
