/** Outbound transactional notifications. Never expose provider secrets to the browser. */
import {randomBytes,randomUUID} from 'node:crypto';
import {getPool} from './database.mjs';
import {tokenHash} from './security.mjs';
export const validEmail=x=>typeof x==='string'&&x.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x);
export const validE164=x=>typeof x==='string'&&/^\+[1-9]\d{7,14}$/.test(x);
export function deliveryProviderStatus(env=process.env){
 return {emailConfigured:!!(env.RESEND_API_KEY&&env.RESEND_FROM_EMAIL),smsConfigured:!!(env.TWILIO_ACCOUNT_SID&&env.TWILIO_AUTH_TOKEN&&env.TWILIO_FROM_NUMBER)};
}
export function notificationRecipient(config,ownerEmail){
 const reviewer=config.bookingApprovalReviewer||'owner';
 if(reviewer==='owner')return {reviewer:'owner',name:'Business owner',email:(config.bookingNotifyOwnerEmail||ownerEmail||'').trim(),phone:(config.bookingNotifyOwnerPhone||'').trim()};
 const staff=(config.staff||[]).find(x=>x.id===reviewer);
 if(!staff)return {reviewer,name:'',email:'',phone:''};
 return {reviewer,name:staff.name||'Team reviewer',email:(staff.notificationEmail||'').trim(),phone:(staff.notificationPhone||'').trim()};
}
export function maskDestination(x,channel){
 if(channel==='email'){const [local,domain]=x.split('@');return (local?.slice(0,2)||'**')+'***@'+(domain||'');}
 return '•••'+x.slice(-4);
}
const safeValue=x=>String(x??'').replace(/[<>\r\n]/g,' ').slice(0,120);
const timeOf=minute=>((Math.floor(minute/60)%12)||12)+':'+String(minute%60).padStart(2,'0')+(minute<720?' AM':' PM')+' Eastern';
export function notificationMessage({businessName,request,link}){
 const d=typeof request.details==='string'?JSON.parse(request.details):request.details;
 const summary=`New booking request — ${safeValue(businessName)}\nCustomer: ${safeValue(d.customerName)}\nServices: ${(d.services||[]).map(safeValue).join(', ')}\nDate: ${safeValue(request.date)} at ${timeOf(request.start_minute)}\nDuration: ${request.duration} minutes\nCustomer email: ${safeValue(d.customerEmail)}\nCustomer phone: ${safeValue(d.customerPhone||'Not supplied')}\nQuoted price: $${Number(d.quotedPrice||0).toFixed(2)}\n\nReview request: ${link}\n\nOpening this link does not accept or decline automatically. Select an action and confirm on the review page. Link expires in 72 hours. If the time becomes unavailable, acceptance will be blocked.`;
 return {subject:`SelahFlow: Booking approval needed — ${safeValue(businessName)}`,text:summary,sms:`SelahFlow ${safeValue(businessName)}: ${safeValue(d.customerName)}, ${safeValue(request.date)} ${timeOf(request.start_minute)}, ${(d.services||[]).map(safeValue).join('+').slice(0,65)}. Review Accept/Decline: ${link}`};
}
export async function sendNotificationChannel(channel,destination,message,env=process.env,fetcher=fetch){
 const cfg=deliveryProviderStatus(env);
 if(channel==='email'&&!cfg.emailConfigured)return {status:'not_configured',detail:'Resend email is not configured'};
 if(channel==='sms'&&!cfg.smsConfigured)return {status:'not_configured',detail:'Twilio SMS is not configured'};
 if(channel==='email'&&!validEmail(destination)||channel==='sms'&&!validE164(destination))return {status:'invalid_destination',detail:'Invalid recipient'};
 try{
  if(channel==='email'){
   const result=await fetcher('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json','User-Agent':'SelahFlow/1.3.10'},body:JSON.stringify({from:env.RESEND_FROM_EMAIL,to:[destination],subject:message.subject,text:message.text}),signal:AbortSignal.timeout(7500)});
   if(!result.ok)return {status:'failed',detail:'Email provider rejected request (HTTP '+result.status+')'};
   return {status:'submitted',detail:'Accepted by email provider'};
  }
  const sid=env.TWILIO_ACCOUNT_SID,form=new URLSearchParams({From:env.TWILIO_FROM_NUMBER,To:destination,Body:message.sms});
  const result=await fetcher('https://api.twilio.com/2010-04-01/Accounts/'+encodeURIComponent(sid)+'/Messages.json',{method:'POST',headers:{Authorization:'Basic '+Buffer.from(sid+':'+env.TWILIO_AUTH_TOKEN).toString('base64'),'Content-Type':'application/x-www-form-urlencoded'},body:form.toString(),signal:AbortSignal.timeout(7500)});
  if(!result.ok)return {status:'failed',detail:'SMS provider rejected request (HTTP '+result.status+')'};
  return {status:'submitted',detail:'Accepted by SMS provider'};
 }catch{return {status:'failed',detail:'Provider request failed or timed out'};}
}
/** @param {{requestId:string,origin:string}} input */
export async function notifyBookingRequest({requestId,origin}){
 const pool=getPool();
 const data=(await pool.query("SELECT r.id,r.date,r.start_minute,r.duration,r.details,r.reviewer,r.status,b.name AS business_name,s.data AS settings_data,u.email AS owner_email FROM booking_requests r JOIN businesses b ON b.id=r.business_id JOIN settings s ON s.owner=r.owner_id JOIN users u ON u.id=r.owner_id WHERE r.id=$1",[requestId])).rows[0];
 if(!data||data.status!=='pending')return {email:'not_requested',sms:'not_requested'};
 const config=JSON.parse(data.settings_data||'{}');
 const selected={email:config.bookingNotifyEmail===true,sms:config.bookingNotifySms===true};
 if(!selected.email&&!selected.sms)return {email:'not_requested',sms:'not_requested'};
 const recent=(await pool.query("SELECT channel,status,attempted_at FROM booking_notification_attempts WHERE request_id=$1 ORDER BY attempted_at DESC",[requestId])).rows;
 const disabled={};
 for(const channel of ['email','sms']){
  const channelRecords=recent.filter(r=>r.channel===channel);
  if(channelRecords.some(r=>r.status==='submitted'))disabled[channel]='already_submitted';
  else if(channelRecords.filter(r=>Date.now()-new Date(r.attempted_at).getTime()<3600000).length>=3)disabled[channel]='rate_limited';
 }
 if(Object.keys(selected).every(c=>!selected[c]||disabled[c]))return {email:disabled.email||'not_requested',sms:disabled.sms||'not_requested'};
 const recipient=notificationRecipient(config,data.owner_email);
 const rawToken=randomBytes(32).toString('hex');
 await pool.query("INSERT INTO booking_action_tokens(id,request_id,reviewer,token_hash,expires_at) VALUES($1,$2,$3,$4,now()+interval '72 hours')",[randomUUID(),requestId,recipient.reviewer,tokenHash(rawToken)]);
 const host=new URL(origin);
 if(host.protocol!=='https:'&&host.hostname!=='localhost')throw Error('A secure application URL is required for review links.');
 const link=new URL('/booking/respond/'+rawToken,host).toString();
 const message=notificationMessage({businessName:data.business_name,request:data,link});
 const result={email:'not_requested',sms:'not_requested'};
 for(const channel of ['email','sms']){
  if(!selected[channel]||disabled[channel]){result[channel]=disabled[channel]||'not_requested';continue;}
  const dest=channel==='email'?recipient.email:recipient.phone;
  const attempt=await sendNotificationChannel(channel,dest,message);
  result[channel]=attempt.status;
  await pool.query("INSERT INTO booking_notification_attempts(id,request_id,channel,destination_masked,status,detail) VALUES($1,$2,$3,$4,$5,$6)",[randomUUID(),requestId,channel,dest?maskDestination(dest,channel):'',attempt.status,attempt.detail]);
 }
 return result;
}

/** Membership requests use the owner's enabled channels, never another business. */
export async function notifyMembershipRequest({requestId,origin}){
 const pool=getPool();
 const r=(await pool.query("SELECT r.id,r.status,b.slug,b.name,b.owner_id,u.email,s.data AS settings_data FROM membership_requests r JOIN businesses b ON b.id=r.business_id JOIN users u ON u.id=b.owner_id LEFT JOIN settings s ON s.owner=b.owner_id WHERE r.id=$1",[requestId])).rows[0];
 if(!r||r.status!=='pending')return;
 const settings=JSON.parse(r.settings_data||'{}');
 const link=new URL('/studio/'+encodeURIComponent(r.slug),origin).toString();
 const message={subject:'MEMBERSHIP REQUEST · '+r.name,text:'MEMBERSHIP REQUEST\nA customer has requested a membership at '+r.name+'. Sign in to review and approve: '+link,sms:'MEMBERSHIP REQUEST · '+r.name+'. Sign in to review: '+link};
 const result={};
 if(settings.bookingNotifyEmail===true)result.email=await sendNotificationChannel('email',settings.bookingNotifyOwnerEmail||r.email,message);
 if(settings.bookingNotifySms===true)result.sms=await sendNotificationChannel('sms',settings.bookingNotifyOwnerPhone||'',message);
 await pool.query("INSERT INTO events(id,owner,created,kind,data) VALUES($1,$2,$3,'membership_request_notification',$4)",[randomUUID(),r.owner_id,new Date().toISOString(),JSON.stringify({requestId,result})]);
 return result;
}
