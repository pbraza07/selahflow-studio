import {db} from './database';
import {getPool} from '../server/database.mjs';
import {appointmentData,overlaps,easternClock,bookingDateRange,computeDayAvailability,selectedSession,sessionsForDate,validateBookableSessions,validateExistingSessionReservations} from '../server/session-scheduling.mjs';
import {validateBookingFields,sanitizeBookingAnswers} from '../server/booking-custom-fields.mjs';
import {validateApprovalVisibleFields} from '../server/booking-approval-display.mjs';
import {requireOwner} from './auth';
import {tokenHash,validOrigin,trustedOrigin} from '../server/security.mjs';
import {notifyBookingRequest,validEmail,validE164} from '../server/notification-delivery.mjs';
import {pushBookingRequest} from '../server/push-delivery.mjs';

import {defaultSettings,today} from './defaults';
import {validDuration,isCalendarUnit} from './service-terms';
import {validSlotCapacity,serviceCapacityOpen,confirmBooking} from '../server/booking-approvals.mjs';
import {approvalSettings,bookingRequestDetail} from '../server/booking-review.mjs';

const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
async function context(req:Request,isPublic=false){const slug=isPublic?new URL(req.url).searchParams.get('slug'):null;const account=isPublic?(slug?await db().prepare("SELECT owner_id AS id FROM businesses WHERE slug=? AND status='active'").bind(slug).first<{id:string}>():await db().prepare("SELECT owner_id AS id FROM businesses WHERE slug='crawford' AND status='active'").first<{id:string}>()):null;const owner=isPublic?account?.id:await requireOwner(req);if(!owner)throw Error('Studio is not configured yet.');if(!isPublic){const business=await db().prepare('SELECT status FROM businesses WHERE owner_id=?').bind(owner).first<{status:string}>();if(!business||business.status!=='active')throw Error('Business awaiting platform approval.');}const row=await db().prepare('SELECT data FROM settings WHERE owner=?').bind(owner).first<{data:string}>();return {owner,config:row?JSON.parse(row.data):structuredClone(defaultSettings)};}
export async function ownerGet(req:Request){try{const {owner,config}=await context(req);const a=await db().prepare('SELECT * FROM appointments WHERE owner=? ORDER BY date,start').bind(owner).all();const e=await db().prepare('SELECT * FROM events WHERE owner=? ORDER BY created DESC LIMIT 500').bind(owner).all();return reply({config,appointments:a.results.map((r:any)=>({...r,...JSON.parse(r.data)})),events:e.results.map((r:any)=>({...r,...JSON.parse(r.data)}))});}catch(e){return reply({error:(e as Error).message==='AUTH_REQUIRED'?'Please sign in.':'Studio data is unavailable or this business is waiting for approval.'},(e as Error).message==='AUTH_REQUIRED'?401:503);}}
export async function studioPost(req:Request,isPublic=false){try{if(!validOrigin(req))return reply({error:'Invalid origin'},403);const raw=await req.text();if(raw.length>(isPublic?20000:120000))return reply({error:'Request too large.'},413);let b;try{b=JSON.parse(raw);}catch{return reply({error:'Invalid request.'},400);}if(!b||typeof b!=='object')return reply({error:'Invalid request.'},400);if(isPublic&&!['availability','book','calendar'].includes(b.action))return reply({error:'Action not permitted.'},403);const {owner,config}=await context(req,isPublic);if(isPublic){if(b.website)return reply({error:'Unable to process request.'},400);const ip=(req.headers.get('x-forwarded-for')||'unknown').split(',').at(-1)!.trim();if(!await takeLimit('public:'+owner+':'+tokenHash(ip),120))return reply({error:'Too many requests. Please try again in 15 minutes.'},429);if(b.action==='book'){if(b.policyAccepted!==true)return reply({error:'Please accept the booking policy.'},400);if(!await takeLimit('book:'+owner+':'+tokenHash(ip),12))return reply({error:'Booking limit reached. Please contact the studio.'},429);if(typeof b.email==='string'&&!await takeLimit('email:'+owner+':'+tokenHash(b.email.trim().toLowerCase()),6))return reply({error:'Too many booking requests for this email. Please contact the studio.'},429);}}const audit=(kind:string,data:any)=>db().prepare('INSERT OR IGNORE INTO events(id,owner,created,kind,data) VALUES(?,?,?,?,?)').bind(typeof b.key==='string'&&/^[0-9a-f-]{36}$/.test(b.key)?b.key:crypto.randomUUID(),owner,new Date().toISOString(),kind,JSON.stringify(data));
if(b.action==='settings'){const c=b.config;
 validateBookingFields(c?.bookingCustomFields||[],c?.bookingPushFields||['customerName','services','date']);
 validateApprovalVisibleFields(c);
 if(!c||!Array.isArray(c.staff)||!Array.isArray(c.services)||c.staff.length>100||c.services.length>150)throw Error('Check team and service catalog.');
 const plan=await db().prepare('SELECT s.plan_code,s.status FROM business_subscriptions s JOIN businesses b ON b.id=s.business_id WHERE b.owner_id=?').bind(owner).first<{plan_code:string;status:string}>();
 const cap=plan?.status==='active'?({free:1,professional:3,business:10} as Record<string,number>)[plan.plan_code]||1:1;
 const oldTeam=Array.isArray(config.staff)?config.staff:[];
 if(c.staff.length>cap&&c.staff.some((member:any)=>!oldTeam.some((previous:any)=>previous.id===member.id)))throw Error('Team member limit reached for your subscription. Existing members remain; upgrade before adding another.');
 if(new Set(c.staff.map((p:any)=>p.id)).size!==c.staff.length||new Set(c.services.map((p:any)=>p.id)).size!==c.services.length)throw Error('Duplicate service or team IDs.');
 if(!c.staff.every((p:any)=>typeof p.id==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(p.id)&&typeof p.name==='string'&&p.name.trim()&&p.name.length<=100&&typeof p.role==='string'&&p.role.length<=100&&Array.isArray(p.services)&&p.services.every((id:any)=>c.services.some((v:any)=>v.id===id))))throw Error('Check team members and assigned services.');
 if(!c.services.every((p:any)=>typeof p.id==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(p.id)&&typeof p.name==='string'&&p.name.trim()&&p.name.length<=100&&typeof p.category==='string'&&p.category.trim()&&p.category.length<=60))throw Error('Check service types and names.');
 for(const id of oldTeam.filter((p:any)=>!c.staff.some((q:any)=>q.id===p.id)).map((p:any)=>p.id)){const pending=await db().prepare("SELECT 1 FROM appointments WHERE owner=? AND staff=? AND date>=? AND status NOT IN ('Cancelled','No-show','Completed') LIMIT 1").bind(owner,id,today()).first();if(pending)throw Error('Cancel or complete future bookings before removing this team member.');}
if((c.city!==undefined&&(typeof c.city!=='string'||c.city.length>80))||(c.region!==undefined&&(typeof c.region!=='string'||c.region.length>80))||(typeof c.address!=='string'||c.address.length>350||/[<>\u0000-\u001f]/.test(c.address)))throw Error('Check business address and location.');
if(!c?.name?.trim()||c.name.length>100||!Array.isArray(c.services)||!Array.isArray(c.staff)||!Number.isInteger(c.open)||!Number.isInteger(c.close)||c.open<0||c.close>24||c.open>=c.close||!Number.isInteger(c.buffer)||c.buffer<0||c.buffer>60||c.buffer%15!==0||!Number.isFinite(c.tax)||c.tax<0||c.tax>20)throw Error('Check business name, whole-hour opening times, 15-minute buffer and tax.');if(!c.staff.every((m:any)=>(m.notificationEmail===undefined||m.notificationEmail===''||validEmail(m.notificationEmail))&&(m.notificationPhone===undefined||m.notificationPhone===''||validE164(m.notificationPhone))))throw Error('Team notification contacts require valid email and phone in +1XXXXXXXXXX format.');
 if(c.bookingNotifyOwnerEmail!==undefined&&c.bookingNotifyOwnerEmail!==''&&!validEmail(c.bookingNotifyOwnerEmail))throw Error('Enter a valid owner notification email.');
 if(c.bookingNotifyOwnerPhone!==undefined&&c.bookingNotifyOwnerPhone!==''&&!validE164(c.bookingNotifyOwnerPhone))throw Error('Owner SMS phone must include country code (example: +18135550123).');
 if((c.bookingNotifyEmail!==undefined&&typeof c.bookingNotifyEmail!=='boolean')||(c.bookingNotifySms!==undefined&&typeof c.bookingNotifySms!=='boolean'))throw Error('Invalid notification channels.');
 if(c.bookingApprovalEnabled&&(c.bookingNotifyEmail===true||c.bookingNotifySms===true)){
  const reviewer=c.bookingApprovalReviewer||'owner',member=c.staff.find((m:any)=>m.id===reviewer);
  const recipient=reviewer==='owner'?{email:c.bookingNotifyOwnerEmail||((await db().prepare('SELECT email FROM users WHERE id=?').bind(owner).first<{email:string}>())?.email||''),phone:c.bookingNotifyOwnerPhone||''}:member?{email:member.notificationEmail||'',phone:member.notificationPhone||''}:{email:'',phone:''};
  if(c.bookingNotifyEmail===true&&!validEmail(recipient.email))throw Error('Add a valid email for the selected booking reviewer.');
  if(c.bookingNotifySms===true&&!validE164(recipient.phone))throw Error('Add a phone in +1XXXXXXXXXX format for the selected booking reviewer.');
 }
 if(c.bookingApprovalEnabled!==undefined&&typeof c.bookingApprovalEnabled!=='boolean')throw Error('Invalid booking approval toggle.');
 if(c.bookingApprovalReviewer!==undefined&&c.bookingApprovalReviewer!=='owner'&&!c.staff.some((s:any)=>s.id===c.bookingApprovalReviewer))throw Error('Choose the owner or an existing team member to review requests.');
 validateBookableSessions(c);
for(const s of c.services)if(!validSlotCapacity(s.maxSlots??1))throw Error('Service slots must be between 1 and 20.');
 for(const s of c.services)if(!s.name||s.price<0||!Number.isFinite(s.price)||!validDuration(s))throw Error('Enter a valid service duration (minutes, hours, days, weeks, months or years); prices cannot be negative.');const pool=getPool(),client=await pool.connect();
try{
 await client.query('BEGIN');
 await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[owner+':schedule']);
 const persisted=(await client.query('SELECT data FROM settings WHERE owner=$1',[owner])).rows[0];
 const oldConfig=persisted?JSON.parse(persisted.data):config;
 const reservationRows=(await client.query(
  "SELECT date,staff,start,duration,data,status FROM appointments WHERE owner=$1 AND status NOT IN ('Cancelled','No-show') AND data LIKE '%sessionId%'",
  [owner])).rows;
 validateExistingSessionReservations(oldConfig,c,reservationRows);

 const existingSchedules=(await client.query(
  "SELECT date,staff,start,duration,status,data FROM appointments WHERE owner=$1 AND status NOT IN ('Cancelled','No-show')",
  [owner])).rows;
 // Any generated occurrence must not overlap an existing ordinary booking or
 // a different booked group session. Reservations on edited series are already
 // protected by validateExistingSessionReservations.
 const cache=new Map();
 for(const a of existingSchedules){
  const key=a.date+'|'+a.staff;
  if(!cache.has(key))cache.set(key,sessionsForDate(c,a.date,a.staff));
  const ownSessionId=appointmentData(a).sessionId;
  if(cache.get(key).some(session=>
    ownSessionId!==session.id&&overlaps(
      session.start,session.duration+c.buffer,
      Number(a.start),Number(a.duration)+c.buffer)))
    throw Error('A scheduled or recurring session overlaps an existing confirmed appointment for the selected team member.');
 }
 await client.query('INSERT INTO settings(owner,data) VALUES($1,$2) ON CONFLICT(owner) DO UPDATE SET data=excluded.data',[owner,JSON.stringify(c)]);
 await client.query('UPDATE businesses SET name=$1,city=COALESCE($2,city),region=COALESCE($3,region),updated_at=now() WHERE owner_id=$4',
  [c.name,typeof c.city==='string'?c.city:null,typeof c.region==='string'?c.region:null,owner]);
 await client.query('INSERT INTO events(id,owner,created,kind,data) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING',
  [crypto.randomUUID(),owner,new Date().toISOString(),'settings','{}']);
 await client.query('COMMIT');
} catch(error){await client.query('ROLLBACK');throw error;} finally {client.release();}
return reply({ok:true});}
if(b.action==='calendar'){
 if(!Array.isArray(b.services)||b.services.length===0||b.services.length>10||!b.services.every((id:unknown)=>typeof id==='string'))
  throw Error('Choose services for the calendar.');
 const services=config.services.filter((s:any)=>b.services.includes(s.id));
 if(services.length!==b.services.length||!services.every((s:any)=>isCalendarUnit(s.durationUnit||'minutes')))
  throw Error('Choose valid appointment services.');
 const staff=config.staff.find((x:any)=>x.id===b.staff);
 if(!staff||!services.every((s:any)=>staff.services.includes(s.id)))throw Error('Choose a qualified team member.');
 const days=bookingDateRange(b.date,b.view);
 const appointments=(await db().prepare(
  "SELECT date,staff,start,duration,status,data FROM appointments WHERE owner=? AND date>=? AND date<=? AND status NOT IN ('Cancelled','No-show')"
 ).bind(owner,days[0],days[days.length-1]).all()).results as any[];
 const reservations=(await db().prepare(
  "SELECT date,minute FROM slots WHERE owner=? AND staff=? AND date>=? AND date<=?"
 ).bind(owner,b.staff,days[0],days[days.length-1]).all()).results as any[];
 const clock=easternClock();
 const now=clock.minutes,current=clock.date;
 const lastFuture=new Date(Date.now()+366*86400000).toISOString().slice(0,10);
 return reply({timezone:'America/New_York',days:days.map((date:string)=>{
  if(date<current||date>lastFuture)return {date,available:0,sessions:[]};
  const result=computeDayAvailability({config,date,staff:b.staff,services,
   appointments:appointments.filter((a:any)=>a.date===date),
   reservedSlots:reservations.filter((x:any)=>x.date===date).map((x:any)=>x.minute),
   today:current,nowMinutes:now,capacityOpen:serviceCapacityOpen});
  return {date,available:result.slots.length,sessions:result.sessions};
 })});
}
if(b.action==='availability'||b.action==='book'){if(!Array.isArray(b.services)||b.services.length>10||!b.services.every((id:unknown)=>typeof id==='string'))throw Error('Choose valid services.');const services=config.services.filter((s:any)=>b.services.includes(s.id));if(!services.length||services.length!==b.services.length)throw Error('Choose valid services.');if(!services.every((s:any)=>isCalendarUnit(s.durationUnit||'minutes')&&Number.isInteger(s.duration)&&s.duration>=15&&s.duration<=480))throw Error('Term services are tracked as enrollments, not scheduled as same-day appointments. Contact the business to enroll.');const staff=config.staff.find((s:any)=>s.id===b.staff);if(!staff||!services.every((s:any)=>staff.services.includes(s.id)))throw Error('Choose a qualified team member.');if(!/^\d{4}-\d{2}-\d{2}$/.test(b.date)||new Date(b.date+'T12:00:00Z').toISOString().slice(0,10)!==b.date||b.date<today()||b.date>new Date(Date.now()+366*86400000).toISOString().slice(0,10))throw Error('Choose a date in the next year.');const duration=services.reduce((a:number,s:any)=>a+s.duration,0);
const occupied=(await db().prepare('SELECT minute FROM slots WHERE owner=? AND date=? AND staff=?')
 .bind(owner,b.date,b.staff).all()).results.map((x:any)=>x.minute);
const sameDay=(await db().prepare(
 "SELECT staff,start,duration,status,data FROM appointments WHERE owner=? AND date=? AND status NOT IN ('Cancelled','No-show')"
).bind(owner,b.date).all()).results as any[];
const clock=easternClock();
const availability=computeDayAvailability({config,date:b.date,staff:b.staff,services,
 appointments:sameDay,reservedSlots:occupied,today:clock.date,
 nowMinutes:clock.minutes,capacityOpen:serviceCapacityOpen});
const available=availability.slots;
if(b.action==='availability')return reply({slots:available,sessionAvailability:availability.sessionAvailability,
 sessions:availability.sessions,earliestStart:availability.earliestStart,firstAvailable:availability.firstAvailable,timezone:'America/New_York',duration,price:services.reduce((a:number,s:any)=>a+s.price,0)});
if(b.key){const prior=await db().prepare('SELECT id FROM appointments WHERE owner=? AND id=?').bind(owner,b.key).first();if(prior)return reply({ok:true,id:prior.id});const pending=await db().prepare('SELECT id,status,appointment_id FROM booking_requests WHERE owner_id=? AND id=?').bind(owner,b.key).first<{id:string;status:string;appointment_id:string|null}>();if(pending)return reply({ok:true,id:pending.id,pending:pending.status==='pending',status:pending.status,appointmentId:pending.appointment_id});}if(b.expectedPrice!==services.reduce((a:number,s:any)=>a+s.price,0)||b.expectedDuration!==duration)return reply({error:'Service prices or durations changed. Refresh the studio and review your booking again.'},409);if(!available.includes(b.start))return reply({error:'That time is no longer available. Please choose another.'},409);if(typeof b.name!=='string'||typeof b.email!=='string'||!b.name.trim()||b.name.length>100||!/^\S+@\S+\.\S+$/.test(b.email)||b.email.length>200)throw Error('Enter a name and valid email.');const customAnswers=sanitizeBookingAnswers(config.bookingCustomFields||[],b.customAnswers);
const id=typeof b.key==='string'&&/^[0-9a-f-]{36}$/.test(b.key)?b.key:crypto.randomUUID();const data:any={name:b.name.trim(),email:b.email,phone:String(b.phone||'').slice(0,40),services:services.map((s:any)=>s.name),price:services.reduce((a:number,s:any)=>a+s.price,0),channel:isPublic?'Online booking':b.channel==='Booking portal'?'Booking portal':'Front desk',created:new Date().toISOString()};data.serviceIds=services.map((s:any)=>s.id);data.customAnswers=customAnswers;data.policyAccepted=isPublic?b.policyAccepted===true:null;data.policyAcceptedAt=isPublic?new Date().toISOString():null;data.customFieldLabels=Object.fromEntries((config.bookingCustomFields||[]).map((field:any)=>[field.id,field.label]));const bookedSession=selectedSession(config,b.date,b.staff,services,b.start);if(bookedSession)data.sessionId=bookedSession.id;
 if(isPublic&&approvalSettings(config).enabled){
  const approval=approvalSettings(config);
  const business=await db().prepare("SELECT id FROM businesses WHERE owner_id=? AND status='active'").bind(owner).first<{id:string}>();
  if(!business)return reply({error:'Business is not active.'},403);
  const details={...bookingRequestDetail({services,staff:b.staff,date:b.date,start:b.start,duration,buffer:config.buffer,name:b.name,email:b.email,phone:String(b.phone||''),price:data.price,reviewer:approval.reviewer}),customAnswers,customFieldLabels:data.customFieldLabels,policyAccepted:true,policyAcceptedAt:data.policyAcceptedAt,sessionId:bookedSession?.id||null};
  try{
   await db().prepare("INSERT INTO booking_requests(id,business_id,owner_id,date,staff_id,start_minute,duration,details,reviewer) VALUES(?,?,?,?,?,?,?,?,?)").bind(id,business.id,owner,b.date,b.staff,b.start,duration,JSON.stringify(details),approval.reviewer).first();
  }catch(error){if((error as {code?:string}).code!=='23505')throw error;return reply({ok:true,id,pending:true});}
  try{await pushBookingRequest(id);}catch(e){console.error('Web Push dispatch failed for request',id);}
  let delivery:any={email:'not_requested',sms:'not_requested'};
  try{delivery=await notifyBookingRequest({requestId:id,origin:trustedOrigin(req)});}
  catch(error){console.error('Booking notification dispatch error for request',id);delivery={email:config.bookingNotifyEmail===true?'failed':'not_requested',sms:config.bookingNotifySms===true?'failed':'not_requested'};}
  return reply({ok:true,id,pending:true,status:'pending',notificationDelivery:delivery,message:'Booking request received, awaiting approval. The appointment is not confirmed until accepted.'});
 }
 try{await confirmBooking({owner,services,staff:b.staff,date:b.date,start:b.start,duration,buffer:config.buffer,id,data});}
 catch(error){return reply({error:(error as Error).message},(error as {status?:number}).status||409);}
 await db().batch([audit('booking',{appointment:id})]);
 return reply({ok:true,id,pending:false,status:'confirmed'});}
if(b.action==='status'){if(!['Checked in','Completed','Cancelled','No-show'].includes(b.status))throw Error('Invalid status');const old=await db().prepare('SELECT * FROM appointments WHERE owner=? AND id=?').bind(owner,b.id).first();if(!old) return reply({error:'Appointment not found'},404);if(['Completed','Cancelled','No-show'].includes(String(old.status)))throw Error('This appointment is already closed.');const stm=[db().prepare('UPDATE appointments SET status=? WHERE owner=? AND id=?').bind(b.status,owner,b.id),audit('status',{appointment:b.id,status:b.status})];if(b.status==='Cancelled'||b.status==='No-show')stm.push(db().prepare('DELETE FROM slots WHERE owner=? AND appointment=?').bind(owner,b.id));await db().batch(stm);return reply({ok:true});}
if(b.action==='sale'){if(!Array.isArray(b.items)||!b.items.length)throw Error('Add items to checkout.');const lines=b.items.map((l:any)=>{const item=[...config.services.map((s:any)=>({...s,type:'service',cost:null})),...config.products.map((p:any)=>({...p,type:'product'}))].find((x:any)=>x.id===l.id);if(!item||!Number.isInteger(l.qty)||l.qty<1||l.qty>50)throw Error('Invalid checkout item.');return {...item,qty:l.qty};});const total=lines.reduce((n:number,l:any)=>n+l.qty*l.price,0);await db().batch([audit('cash_sale',{lines,total,tax:total*config.tax/100,payment:'Cash recorded manually'})]);return reply({ok:true});}
if(b.action==='handoff'){if(!String(b.message||'').trim())throw Error('Enter a message');await db().batch([audit('handoff',{message:String(b.message).slice(0,2000),status:'Open'})]);return reply({ok:true});}return reply({error:'Unknown action'},400);
}catch(e){return reply({error:(e as Error).message==='AUTH_REQUIRED'?'Please sign in.':((e as {code?:string}).code?'Unable to save right now. Please try again.':(e as Error).message)||'Unable to save. Please try again.'},(e as Error).message==='AUTH_REQUIRED'?401:400);}}

async function takeLimit(key:string,max:number){const row=await db().prepare("INSERT INTO public_limits(key,count,window_start) VALUES(?,1,now()) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN public_limits.window_start<now()-interval '15 minutes' THEN 1 ELSE public_limits.count+1 END,window_start=CASE WHEN public_limits.window_start<now()-interval '15 minutes' THEN now() ELSE public_limits.window_start END RETURNING count").bind(key).first<{count:number}>();return !!row&&row.count<=max;}
export async function publicGet(req:Request){try{const {config,owner}=await context(req,true);const brand=await db().prepare('SELECT slug,brand_primary,brand_background,business_model FROM businesses WHERE owner_id=?').bind(owner).first<{slug:string;brand_primary:string;brand_background:string;business_model:string}>();return reply({config:{slug:brand?.slug,brand_primary:brand?.brand_primary,brand_background:brand?.brand_background,business_model:brand?.business_model,theme:config.theme||null,name:config.name,tagline:config.tagline,address:config.address,phone:config.phone,timezone:config.timezone,open:config.open,close:config.close,buffer:config.buffer,policy:config.policy,bookingApprovalEnabled:approvalSettings(config).enabled,bookingCustomFields:(config.bookingCustomFields||[]).map((f:any)=>({id:f.id,label:f.label,type:f.type,required:f.required,options:f.type==='select'?f.options:[]})),services:config.services.map((s:any)=>({id:s.id,name:s.name,category:s.category,duration:s.duration,durationValue:s.durationValue??s.duration,durationUnit:s.durationUnit||'minutes',maxSlots:s.maxSlots??1,price:s.price,description:s.description})),staff:config.staff.map((s:any)=>({id:s.id,name:s.name,role:s.role,initials:s.initials,services:s.services}))}});}catch{return reply({error:'Online booking is temporarily unavailable. Please contact the studio.'},503);}}
