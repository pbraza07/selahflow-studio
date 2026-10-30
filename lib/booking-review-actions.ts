import {randomUUID} from 'node:crypto';
import {getPool} from '../server/database.mjs';
import {confirmBooking} from '../server/booking-approvals.mjs';
import {today} from './defaults';
import {notifyCustomerBooking} from '../server/customer-push.mjs';
export async function reviewPendingRequest(owner:string,id:string,reviewer:string,accepted:boolean,origin:string){
 if(!/^[a-f0-9-]{36}$/i.test(id))throw Error('Invalid booking request.');
 const pool=getPool();
 const row=(await pool.query("SELECT r.id,r.business_id,r.owner_id,r.date,r.staff_id,r.start_minute,r.duration,r.details,r.status,r.reviewer,s.data AS settings_data FROM booking_requests r JOIN settings s ON s.owner=r.owner_id JOIN businesses b ON b.id=r.business_id WHERE r.id=$1 AND r.owner_id=$2 AND b.status='active'",[id,owner])).rows[0];
 if(!row||row.status!=='pending')throw Error('This booking request has already been reviewed.');
 if(reviewer!=='owner'&&row.reviewer!==reviewer)throw Error('This request is assigned to another reviewer.');
 if(!accepted){
  const q=await pool.query("UPDATE booking_requests SET status='declined',reviewed_by=$1,reviewed_at=now() WHERE id=$2 AND owner_id=$3 AND status='pending' AND ($1='owner' OR reviewer=$1)",[reviewer,id,owner]);
  if(!q.rowCount)throw Error('This request has already been reviewed.');
  try{await notifyCustomerBooking(owner,id,'Declined');}catch(error){console.error('Customer decline push delivery failed',error);}
  return {ok:true,status:'declined'};
 }
 if(row.date<today())throw Error('This request is in the past. Decline it or ask the customer to book a future date.');
 if(row.date===today()){
  const currentClock=new Intl.DateTimeFormat('en-GB',{timeZone:'America/New_York',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date()).split(':').map(Number);
  if(row.start_minute<=currentClock[0]*60+currentClock[1])throw Error('This appointment time has already passed. Ask the customer to choose a future slot.');
 }
 const config=JSON.parse(row.settings_data||'{}'),data=JSON.parse(row.details||'{}');
 const services=(config.services||[]).filter((s:{id:string})=>(data.serviceIds||[]).includes(s.id));
 const staff=(config.staff||[]).find((s:{id:string})=>s.id===row.staff_id);
 if(!services.length||services.length!==data.serviceIds?.length||!staff||!services.every((s:{id:string})=>staff.services.includes(s.id)))throw Error('The assigned staff or services changed. Decline and ask the customer to rebook.');
 if(services.reduce((sum:number,s:{duration:number})=>sum+s.duration,0)!==row.duration)throw Error('Service duration changed. Decline and ask the customer to rebook.');
 if(row.start_minute<config.open*60||row.start_minute+row.duration+config.buffer>config.close*60)throw Error('This appointment no longer fits business hours.');
 const appointmentId=randomUUID();
 const payload:any={paymentChoice:data.paymentChoice,hostTeamIds:data.hostTeamIds,memberNumber:data.memberNumber||null,firstName:data.firstName,lastName:data.lastName,dateOfBirth:data.dateOfBirth,membershipCovered:data.membershipCovered===true,membershipCreditAllowed:data.membershipCreditAllowed===true,paymentLines:data.paymentLines,coupon:data.coupon||null,customFieldTypes:data.customFieldTypes||{},name:data.customerName,email:data.customerEmail,phone:data.customerPhone,services:services.map((s:{name:string})=>s.name),
  serviceIds:services.map((s:{id:string})=>s.id),price:data.quotedPrice,channel:'Approved online booking',created:new Date().toISOString(),reviewedBy:reviewer,bookingRequestId:id,sessionId:data.sessionId||null,customAnswers:data.customAnswers||{},customFieldLabels:data.customFieldLabels||{},originalSubmission:data.originalSubmission||null,bookingDetailsEditedAt:data.correctedAt||null,policyAccepted:data.policyAccepted===true,policyAcceptedAt:data.policyAcceptedAt||null};
 await confirmBooking({owner,services,staff:row.staff_id,date:row.date,start:row.start_minute,duration:row.duration,
  buffer:config.buffer,id:appointmentId,data:payload,pendingId:id,expectedReviewer:reviewer,notificationOrigin:origin});
 try{await notifyCustomerBooking(owner,id,'Confirmed');}catch(error){console.error('Customer confirmation push delivery failed',error);}
 return {ok:true,status:'accepted',appointmentId};
}
