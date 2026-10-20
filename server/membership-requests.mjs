import {queueOwnerFormNotification} from './owner-form-notifications.mjs';
import {issueMemberId} from './member-id-policy.mjs';
import {ensureMemberBookingIdentity} from './shared-member-identity.mjs';
import {randomUUID} from 'node:crypto';
import {customRegistrationFields,validateStandardRegistration} from './registration-questions.mjs';
import {sanitizeBookingAnswers} from './booking-custom-fields.mjs';
export function membershipRequestDetails(config,input){
 const firstName=String(input.firstName||'').trim(),lastName=String(input.lastName||'').trim(),email=String(input.email||'').trim().toLowerCase(),dateOfBirth=String(input.dateOfBirth||'');
 if(!firstName||!lastName||firstName.length>50||lastName.length>50||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>200)throw Error('Enter your first name, last name and a valid email.');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)||!Number.isFinite(Date.parse(dateOfBirth))||new Date(dateOfBirth).toISOString().slice(0,10)!==dateOfBirth||dateOfBirth>new Date().toISOString().slice(0,10))throw Error('Enter a valid birth date.');
 validateStandardRegistration(config,'membership',input);
 const memberNumber=String(input.memberNumber||'').trim().toUpperCase();if(memberNumber&&!/^[A-Z]{2}[0-9]{4}$/.test(memberNumber))throw Error('Enter a valid membership ID.');
 const fields=customRegistrationFields(config,'membership');
 return {firstName,lastName,name:(firstName+' '+lastName).trim(),email,dateOfBirth,memberNumber,phone:String(input.phone||'').trim().slice(0,40),customAnswers:sanitizeBookingAnswers(fields,input.customAnswers),fieldLabels:Object.fromEntries(fields.map(f=>[f.id,f.label]))};
}
/** Owner-scoped, transactional and idempotent. Caller owns the transaction. */
export async function reviewMembershipRequest(client,{owner,id,approve}){
 await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[owner+':membership-requests']);
 const request=(await client.query("SELECT r.*,b.owner_id,p.price_cents,p.active AS plan_active FROM membership_requests r JOIN businesses b ON b.id=r.business_id JOIN membership_plans p ON p.id=r.plan_id AND p.business_id=b.id WHERE r.id=$1 AND b.owner_id=$2 AND b.status='active' FOR UPDATE OF r",[id,owner])).rows[0];
 if(!request)throw Error('Membership request not found.');
 if(request.status!=='pending')return {ok:true,alreadyReviewed:true,membershipId:request.membership_id};
 if(!approve){await client.query("UPDATE membership_requests SET status='declined',reviewed_at=now() WHERE id=$1",[id]);return {ok:true};}
 if(!request.plan_active)throw Error('This package is no longer available. Publish it before approving.');
 const d=typeof request.details==='string'?JSON.parse(request.details):request.details;
 const normalizedName=d.name.normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase();
 const identity=request.business_id+'|'+normalizedName+'|'+d.dateOfBirth;
 await client.query('SELECT pg_advisory_xact_lock(hashtext($1),hashtext($2))',[request.business_id,identity]);
 const existing=(await client.query('SELECT id,member_number,customer_name,date_of_birth::text AS date_of_birth FROM customer_memberships WHERE business_id=$1 AND lower(customer_name)=lower($2) AND date_of_birth=$3::date FOR UPDATE',[request.business_id,d.name,d.dateOfBirth])).rows[0];
 const number=await issueMemberId(client,{businessId:request.business_id,name:d.name,dateOfBirth:d.dateOfBirth,requested:d.memberNumber});
 if(d.memberNumber&&d.memberNumber!==number)throw Error('The submitted member ID does not match this player. Review their registration details.');
 const collision=(await client.query('SELECT 1 FROM customer_memberships WHERE business_id=$1 AND member_number=$2 AND id<>$3',[request.business_id,number,existing?.id||''])).rowCount;
 if(collision)throw Error('This six-character ID belongs to another player. Resolve the ID before approving.');
 let membershipId=existing?.id;
 if(!membershipId){
  const otherBooking=(await client.query('SELECT 1 FROM customer_booking_ids WHERE business_id=$1 AND member_number=$2 AND NOT(lower(first_name)=lower($3) AND lower(last_name)=lower($4) AND date_of_birth=$5::date)',[request.business_id,number,d.firstName,d.lastName,d.dateOfBirth])).rowCount;
  if(otherBooking)throw Error('This six-character ID belongs to another player.');
  membershipId=randomUUID();
  await client.query("INSERT INTO customer_memberships(id,business_id,plan_id,customer_name,customer_email,customer_phone,date_of_birth,member_number,status,stripe_account_id,price_cents,sessions_included,sessions_used,registration_answers,registration_field_labels) VALUES($1,$2,$3,$4,$5,$6,$7::date,$8,'pending_payment','',$9,0,0,$10::jsonb,$11::jsonb)",[membershipId,request.business_id,request.plan_id,d.name,d.email,d.phone,d.dateOfBirth,number,request.price_cents,JSON.stringify(d.customAnswers),JSON.stringify(d.fieldLabels)]);
 }
 // Membership and first-time booking now create/reuse the SAME client identity.
 // Previous membership credits, existing answers and history are never reset.
 await ensureMemberBookingIdentity(client,{businessId:request.business_id,ownerId:owner,
  firstName:d.firstName,lastName:d.lastName,email:d.email,dateOfBirth:d.dateOfBirth,
  phone:d.phone,memberNumber:number,customAnswers:d.customAnswers,source:'Membership signup'});
 await client.query("UPDATE membership_requests SET status='approved',membership_id=$1,reviewed_at=now() WHERE id=$2",[membershipId,id]);
 await client.query("INSERT INTO events(id,owner,created,kind,data) VALUES($1,$2,$3,'membership_request_approved',$4)",[randomUUID(),owner,new Date().toISOString(),JSON.stringify({requestId:id,membershipId,memberNumber:number,planId:request.plan_id})]);
 return {ok:true,membershipId,memberNumber:number,existingMember:!!existing};
}

/**
 * Public membership registration is immediate but has no payment/credits.
 * Reuses the checked owner transaction and keeps historical requests auditable.
 */
export async function registerMembershipWithoutApproval(pool,{businessId,ownerId,planId,requestId,details}){
 const db=await pool.connect();
 try{
  await db.query('BEGIN');
  const prior=(await db.query('SELECT business_id,plan_id,details FROM membership_requests WHERE id=$1 FOR UPDATE',[requestId])).rows[0];
  if(prior){
   const saved=typeof prior.details==='string'?JSON.parse(prior.details):prior.details;
   if(prior.business_id!==businessId||prior.plan_id!==planId||saved.email!==details.email||saved.name!==details.name||saved.dateOfBirth!==details.dateOfBirth)
    throw Error('This registration reference belongs to another enrollment. Refresh and try again.');
  }else{
   await db.query('INSERT INTO membership_requests(id,business_id,plan_id,details) VALUES($1,$2,$3,$4::jsonb)',[requestId,businessId,planId,JSON.stringify(details)]);
  }
  const reviewed=await reviewMembershipRequest(db,{owner:ownerId,id:requestId,approve:true});
  if(!reviewed.membershipId)throw Error('Membership registration could not be completed.');
  const member=(await db.query('SELECT member_number,status FROM customer_memberships WHERE id=$1 AND business_id=$2',[reviewed.membershipId,businessId])).rows[0];
  if(!member)throw Error('Membership registration was not found.');
  await queueOwnerFormNotification(db,{businessId,sourceId:requestId,form:'membership',values:{...details,memberNumber:member.member_number},answers:details.customAnswers});
  await db.query('COMMIT');
  return {ok:true,registered:true,membershipId:reviewed.membershipId,memberNumber:member.member_number,paymentPending:member.status==='pending_payment',status:member.status};
 }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
}
