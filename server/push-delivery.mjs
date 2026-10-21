import {registrationNotificationLines} from './registration-questions.mjs';
import {randomBytes,randomUUID} from 'node:crypto';
import {bookingNotificationLines} from './booking-custom-fields.mjs';
import {businessDeviceName} from './business-device-name.mjs';
import {getPool} from './database.mjs';
import {tokenHash,trustedOrigin} from './security.mjs';
import {configured,sendWebPush} from './push-crypto.mjs';
const trim=(x,max=100)=>String(x||'').replace(/[<>\r\n]/g,' ').slice(0,max);
/** Notify the specific owner's devices plus the currently designated team reviewer.
 * Invalid subscriptions are removed. Each reviewer has their own push/browser permission.
 */
export async function pushBookingRequest(requestId){
 if(!configured())return {status:'not_configured',delivered:0};
 const pool=getPool();
 const r=(await pool.query("SELECT r.id,r.business_id,r.reviewer,r.date,r.start_minute,r.details,r.status,b.slug,b.name,s.data AS settings_data FROM booking_requests r JOIN businesses b ON b.id=r.business_id JOIN settings s ON s.owner=b.owner_id WHERE r.id=$1 AND b.status='active'",[requestId])).rows[0];
 if(!r||r.status!=='pending')return {status:'no_pending_request',delivered:0};
 const settings=JSON.parse(r.settings_data||'{}');
 if(settings.bookingApprovalEnabled!==true)return {status:'disabled',delivered:0};
 const detail=JSON.parse(r.details||'{}');
 const reviewers=r.reviewer==='owner'?['owner']:['owner',r.reviewer];
 const result=await pool.query("SELECT id,reviewer,endpoint,p256dh,auth FROM business_push_subscriptions WHERE business_id=$1 AND reviewer=ANY($2::text[]) ORDER BY created_at DESC LIMIT 40",[r.business_id,reviewers]);
 let delivered=0,failed=0;
 for(const sub of result.rows){
  let url='/studio/'+encodeURIComponent(r.slug)+'#booking-notifications';
  if(sub.reviewer!=='owner'){
   const raw=randomBytes(32).toString('hex');
   await pool.query("INSERT INTO booking_action_tokens(id,request_id,reviewer,token_hash,expires_at) VALUES($1,$2,$3,$4,now()+interval '72 hours')",[randomUUID(),r.id,sub.reviewer,tokenHash(raw)]);
   url='/booking/respond/'+raw;
  }
  const payload={title:businessDeviceName(r.name),body:'New booking request · '+trim(registrationNotificationLines(settings,'booking',{memberNumber:detail.memberNumber,dateOfBirth:detail.dateOfBirth,firstName:detail.firstName,lastName:detail.lastName,email:detail.customerEmail||detail.email,phone:detail.customerPhone||detail.phone},detail.customAnswers||{}).join(' · '),220),
   url,tag:'selah-booking-'+r.business_id+'-'+requestId,businessId:r.business_id};
  const response=await sendWebPush({endpoint:sub.endpoint,keys:{p256dh:sub.p256dh,auth:sub.auth}},payload);
  if(response.status==='submitted')delivered++;
  else {failed++;if(response.status==='gone'||response.status==='invalid_subscription')await pool.query('DELETE FROM business_push_subscriptions WHERE id=$1',[sub.id]);}
 }
 return {status:delivered?'submitted':result.rows.length?'failed':'no_subscribed_devices',delivered,failed};
}

/** Explicit membership alerts, scoped to this business's owner devices. */
export async function pushMembershipRequest(requestId){
 if(!configured())return {status:'not_configured',delivered:0};
 const pool=getPool();
 const r=(await pool.query("SELECT r.business_id,r.status,b.slug,b.name FROM membership_requests r JOIN businesses b ON b.id=r.business_id WHERE r.id=$1 AND b.status='active'",[requestId])).rows[0];
 if(!r||r.status!=='pending')return {status:'no_pending_request',delivered:0};
 const subs=(await pool.query("SELECT id,endpoint,p256dh,auth FROM business_push_subscriptions WHERE business_id=$1 AND reviewer='owner' LIMIT 40",[r.business_id])).rows;
 let delivered=0;
 for(const sub of subs){const result=await sendWebPush({endpoint:sub.endpoint,keys:{p256dh:sub.p256dh,auth:sub.auth}},{title:'MEMBERSHIP REQUEST · '+businessDeviceName(r.name),body:'A membership registration is waiting for your approval.',url:'/studio/'+encodeURIComponent(r.slug),tag:'membership-request-'+requestId,businessId:r.business_id});if(result.status==='submitted')delivered++;else if(['gone','invalid_subscription'].includes(result.status))await pool.query('DELETE FROM business_push_subscriptions WHERE id=$1',[sub.id]);}
 return {status:delivered?'submitted':'no_delivery',delivered};
}
