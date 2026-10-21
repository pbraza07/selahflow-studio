import {membershipAllows} from './membership-eligibility.mjs';
import {hasUsableMembership} from './member-badge-state.mjs';
import {queueOwnerFormNotification} from './owner-form-notifications.mjs';
import {assertBookingWaiver} from './participation-waivers.mjs';
import {isBlocked} from './booking-blockouts.mjs';
import {queueApprovedBooking} from './booking-client-notifications.mjs';
import {queueBookingReceipt} from './booking-receipts.mjs';
import {requiresBookingApproval} from './booking-review.mjs';
import {SESSION_FULL_MESSAGE} from './session-capacity.mjs';

import {getPool} from './database.mjs';
import {appointmentData,bookedSessionCount,selectedSession,sessionTimeRestricted,sessionsForDate,easternClock} from './session-scheduling.mjs';
export function slotCapacity(service){const n=service?.maxSlots??1;return Number.isInteger(n)&&n>=1&&n<=20?n:1;}
export function validSlotCapacity(n){return Number.isInteger(n)&&n>=1&&n<=20;}
export function overlaps(start,duration,otherStart,otherDuration){return start<otherStart+otherDuration&&otherStart<start+duration;}
export function serviceCapacityOpen(existing,services,start,duration){
 return services.every(s=>{
  let busy=0;
  for(const appointment of existing){
   if(['Cancelled','No-show'].includes(appointment.status) || appointmentData(appointment).sessionId)continue;
   if(!overlaps(start,duration,Number(appointment.start),Number(appointment.duration)))continue;
   let data={};try{data=typeof appointment.data==='string'?JSON.parse(appointment.data):appointment.data||{};}catch{}
   const ids=Array.isArray(data.serviceIds)?data.serviceIds:[];
   const names=Array.isArray(data.services)?data.services:[];
   if(ids.includes(s.id)||names.includes(s.name))busy++;
  }
  return busy<slotCapacity(s);
 });
}
export async function checkCapacity(pool,owner,date,services,start,duration){
 const appointments=(await pool.query("SELECT start,duration,status,data FROM appointments WHERE owner=$1 AND date=$2 AND status NOT IN ('Cancelled','No-show')",[owner,date])).rows;
 return serviceCapacityOpen(appointments,services,start,duration);
}
/** Atomic staff slot + service capacity booking; advisory lock serializes bookings by business/date. */
/** @param {any} options Booking input validated by owner/team route handlers. */
export async function confirmBooking(options){
 const {owner,services,staff,date,start,duration,buffer,id,data,pendingId=null,expectedReviewer=null}=options;
 const pool=options.pool || getPool(),client=await pool.connect();
 const conflict=message=>{const e=new Error(message);e.status=409;return e;};
 try{
  await client.query('BEGIN');
  // Serializes all booking approvals and session-capacity edits for one business.
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[owner+':schedule']);
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[owner+':'+date]);
  let pendingRequest=null;
  if(pendingId){
   const pending=await client.query("SELECT * FROM booking_requests WHERE id=$1 FOR UPDATE",[pendingId]);
   pendingRequest=pending.rows[0];
   if(!pending.rows[0]||pending.rows[0].owner_id!==owner||pending.rows[0].status!=='pending'||(expectedReviewer&&expectedReviewer!=='owner'&&pending.rows[0].reviewer!==expectedReviewer))
    throw conflict('This request has already been reviewed or is unavailable.');
  }
  const prior=await client.query('SELECT id FROM appointments WHERE id=$1 AND owner=$2',[id,owner]);
  if(prior.rowCount){await client.query('COMMIT');return {id,duplicate:true};}
  const settingRow=await client.query('SELECT data FROM settings WHERE owner=$1',[owner]);
  const config=settingRow.rows[0] ? JSON.parse(settingRow.rows[0].data) : {};
  await assertBookingWaiver(client,{owner,config,serviceIds:services.map(s=>s.id),memberNumber:data.memberNumber});
  if(options.autoConfirmRequest){
   const saved=options.autoConfirmRequest;
   if(!pendingRequest||pendingRequest.details!==saved.details||pendingRequest.date!==date||pendingRequest.staff_id!==staff||Number(pendingRequest.start_minute)!==start||Number(pendingRequest.duration)!==duration)throw conflict('Booking details changed. Check your registration before paying.');
   const current=services.map(s=>(config.services||[]).find(v=>v.id===s.id));
   if(!current.length||current.some(s=>!s)||requiresBookingApproval(current))throw conflict('The business must approve this booking before you can pay.');
   const member=config.staff?.find(s=>s.id===staff),clock=easternClock();
   if(!member||!current.every(s=>member.services.includes(s.id))||current.reduce((n,s)=>n+s.duration,0)!==duration||!data.membershipCovered&&Math.round(current.reduce((n,s)=>n+Number(s.price),0)*100)!==Math.round(Number(data.price)*100))throw conflict('Service details changed. Contact the business before paying.');
   if(date<clock.date||date===clock.date&&start<=clock.minutes||start<config.open*60||start+duration+Number(buffer||0)>config.close*60)throw conflict('This booking time is no longer available. Choose another appointment.');
  }
  if(isBlocked(config,date,staff,start,duration+(Number(buffer)||0)))throw conflict('This date and time is blocked by the business. Choose another time.');
  const session=selectedSession(config,date,staff,services,start);
  const sessionId=data?.sessionId || null;
  if(data.membershipCovered===true){
   const member=(await client.query('SELECT m.status,m.sessions_included,m.sessions_used,p.credit_eligibility FROM customer_memberships m JOIN businesses b ON b.id=m.business_id JOIN membership_plans p ON p.id=m.plan_id AND p.business_id=m.business_id WHERE b.owner_id=$1 AND m.member_number=$2',[owner,data.memberNumber])).rows[0];
   const current=services.map(s=>(config.services||[]).find(v=>v.id===s.id)||s);
   const allowed=session?session.membershipCreditAllowed!==false:current.every(s=>s.membershipCreditAllowed!==false);
   if(!member||!hasUsableMembership(member)||!allowed||!membershipAllows(member.credit_eligibility,{serviceIds:services.map(s=>s.id),sessionId,seriesId:session?.seriesId}))throw conflict('Membership credits do not cover this booking anymore. Refresh and book with the current price.');
  }

  if(sessionId && (!session || session.id!==sessionId))
   throw conflict('This session was changed or removed. Ask the customer to select an available session.');
  if(!sessionId && session)throw conflict('This time is a group session. Refresh availability and select the session.');
  const existing=(await client.query(
   "SELECT start,duration,status,data,staff FROM appointments WHERE owner=$1 AND date=$2 AND status NOT IN ('Cancelled','No-show')",
   [owner,date])).rows;
  const bufferMinutes=Number(buffer)||0;
  const conflictingStaff=existing.some(a=>a.staff===staff &&
    overlaps(start,duration+bufferMinutes,Number(a.start),Number(a.duration)+bufferMinutes) &&
    (!session || appointmentData(a).sessionId!==session.id));
  if(conflictingStaff)throw conflict('The selected team member already has another appointment at this time.');
  const taken=await client.query(
   "SELECT a.data FROM slots sl JOIN appointments a ON a.id=sl.appointment WHERE sl.owner=$1 AND sl.date=$2 AND sl.staff=$3 AND sl.minute >= $4 AND sl.minute < $5",
   [owner,date,staff,start,start+duration+bufferMinutes]);
  if(taken.rows.some(x=>!session || appointmentData(x).sessionId!==session.id))
   throw conflict('The selected team member is no longer available. Choose another time.');
  if(session){
   if(start+duration+bufferMinutes > config.close*60 || start < config.open*60)
    throw conflict('This session no longer fits the business opening hours.');
   if(bookedSessionCount(existing,session.id)>=session.capacity)
    throw conflict(SESSION_FULL_MESSAGE);
  }else{
   if(sessionTimeRestricted(config,staff,services))throw conflict('Choose a scheduled session start time.');
   const clashes=sessionsForDate(config,date,staff).some(s=>
    overlaps(start,duration+bufferMinutes,s.start,s.duration+bufferMinutes));
   if(clashes)throw conflict('This time is reserved for a scheduled session.');
   if(!serviceCapacityOpen(existing,services,start,duration))
    throw conflict('Service capacity has been reached. Choose another time or team member.');
  }
  await client.query(
   "INSERT INTO appointments(id,owner,date,staff,start,duration,data,status) VALUES($1,$2,$3,$4,$5,$6,$7,'Confirmed')",
   [id,owner,date,staff,start,duration,JSON.stringify(data)]);
  // A group session shares the coach and start time. Only standard bookings
  // use the unique staff-minute slots table.
  if(!session)for(let minute=start;minute<start+duration+bufferMinutes;minute+=15){
   await client.query('INSERT INTO slots(owner,date,staff,minute,appointment) VALUES($1,$2,$3,$4,$5)',
    [owner,date,staff,minute,id]);
  }
  if(pendingId)await client.query(
   "UPDATE booking_requests SET status='accepted',appointment_id=$1,reviewed_by=$2,reviewed_at=now() WHERE id=$3",
   [id,data.reviewedBy||'owner',pendingId]);
  if(pendingId&&options.notificationOrigin)await queueApprovedBooking(client,{bookingId:id,requestId:pendingId,origin:options.notificationOrigin});
  if(options.submissionOrigin&&!pendingId){const business=(await client.query('SELECT id FROM businesses WHERE owner_id=$1',[owner])).rows[0];if(business)await queueOwnerFormNotification(client,{businessId:business.id,sourceId:id,form:'booking',values:data,answers:data.customAnswers});}
  const bookingReceipt=options.submissionOrigin?await queueBookingReceipt(client,{owner,bookingId:id,date,start,duration,staff,data,origin:options.submissionOrigin,pending:false}):null;
  if(options.submissionOrigin&&Number(data.price)>0&&!data.membershipCovered)await queueApprovedBooking(client,{bookingId:id,requestId:null,origin:options.submissionOrigin});
  await client.query('COMMIT');
  return {id,duplicate:false,sessionId:session?.id||null,bookingReceipt};
 }catch(e){
  await client.query('ROLLBACK');
  if(e.code==='23505')throw conflict('That time was booked by another customer. Choose another time.');
  throw e;
 }finally{client.release();}
}
