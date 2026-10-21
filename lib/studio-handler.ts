import {membershipAllows} from '../server/membership-eligibility.mjs';
import {ensureParticipationWaiver,assertBookingWaiver,publicWaiverDocument} from '../server/participation-waivers.mjs';
import {recordCashSale} from '../server/record-cash-sale.mjs';
import {queueBookingReceipt} from '../server/booking-receipts.mjs';
import {issueMemberId} from '../server/member-id-policy.mjs';
import {loadMembershipReportPayments,reportSaleEvents,reconcileStripeBookingReceipts} from '../server/report-payments.mjs';
import {visibleReportPayments} from '../server/report-reset.mjs';
import {validatePageContent} from '../server/page-content.mjs';
import {memberIdMembershipSummary} from '../server/member-id-summary.mjs';
import {registrationPaymentSummary} from '../server/registration-payment.mjs';
import {themeIsValid,resolveTheme} from '../server/themes.mjs';
import {validateBlockouts,isBlocked} from '../server/booking-blockouts.mjs';
import {registrationQuestions,customRegistrationFields,validateRegistrationQuestions,validateStandardRegistration,publicRegistrationSettings} from '../server/registration-questions.mjs';
import {randomInt,randomBytes} from 'node:crypto';
import {db} from './database';
import {getPool} from '../server/database.mjs';
import {changeAppointmentStatus} from '../server/appointment-membership-usage.mjs';
import {loadOwnerMemberRoster,decorateOwnerAppointments} from '../server/owner-appointment-members.mjs';
import {bookableTeamLimit} from '../server/team-seat-policy.mjs';
import {checkSubscriptionLimits,planEntitlements} from '../server/plan-entitlements.mjs';
import {appointmentData,overlaps,easternClock,bookingDateRange,computeDayAvailability,selectedSession,sessionsForDate,sessionRemaining,validateBookableSessions,validateExistingSessionReservations} from '../server/session-scheduling.mjs';
import {validateBookingFields,sanitizeBookingAnswers} from '../server/booking-custom-fields.mjs';
import {validateApprovalVisibleFields} from '../server/booking-approval-display.mjs';
import {requireOwner} from './auth';
import {tokenHash,validOrigin,trustedOrigin} from '../server/security.mjs';
import {notifyBookingRequest,sendNotificationChannel,deliveryProviderStatus,validEmail,validE164} from '../server/notification-delivery.mjs';
import {pushBookingRequest} from '../server/push-delivery.mjs';

import {paymentConfigured} from '../server/membership-payments.mjs';
import {defaultSettings,today} from './defaults';
import {validDuration,isCalendarUnit} from './service-terms';
import {validSlotCapacity,serviceCapacityOpen,confirmBooking} from '../server/booking-approvals.mjs';
import {sessionIsFull,SESSION_FULL_MESSAGE} from '../server/session-capacity.mjs';
import {requiresBookingApproval,approvalSettings,bookingRequestDetail} from '../server/booking-review.mjs';
import {hasUsableMembership} from '../server/member-badge-state.mjs';

const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
async function context(req:Request,isPublic=false){const slug=isPublic?new URL(req.url).searchParams.get('slug'):null;const account=isPublic?(slug?await db().prepare("SELECT owner_id AS id FROM businesses WHERE slug=? AND status='active'").bind(slug).first<{id:string}>():await db().prepare("SELECT owner_id AS id FROM businesses WHERE slug='crawford' AND status='active'").first<{id:string}>()):null;const owner=isPublic?account?.id:await requireOwner(req);if(!owner)throw Error('Studio is not configured yet.');if(!isPublic){const business=await db().prepare('SELECT status FROM businesses WHERE owner_id=?').bind(owner).first<{status:string}>();if(!business||business.status!=='active')throw Error('Business awaiting platform approval.');}const row=await db().prepare('SELECT data FROM settings WHERE owner=?').bind(owner).first<{data:string}>();return {owner,config:row?JSON.parse(row.data):structuredClone(defaultSettings)};}
export async function ownerGet(req:Request){
 try{
  const {owner,config}=await context(req);
  // Independent owner metadata is fetched alongside the roster and activity,
  // not serially after those queries finish. Response shape remains unchanged.
  const [a,e,roster,membershipPayments,businessDetails]=await Promise.all([
   db().prepare('SELECT * FROM appointments WHERE owner=? ORDER BY date,start').bind(owner).all(),
   db().prepare("SELECT * FROM events WHERE owner=? AND kind<>'membership_payment' ORDER BY created DESC").bind(owner).all(),
   loadOwnerMemberRoster(getPool(),owner),
   loadMembershipReportPayments(getPool(),owner),
   getPool().query("SELECT name FROM businesses WHERE owner_id=$1 AND status='active'",[owner])
  ]);
  const visits=a.results.map((r:any)=>({...r,...JSON.parse(r.data)}));
  const activityEvents=e.results.map((r:any)=>({...r,...JSON.parse(r.data)}));
  const paidBookingFallback=await reconcileStripeBookingReceipts(getPool(),owner,activityEvents);
  return reply({
   config,reportBusinessName:businessDetails.rows[0]?.name,appointments:decorateOwnerAppointments(visits,roster),
   events:await visibleReportPayments(getPool(),owner,[...reportSaleEvents([...activityEvents,...paidBookingFallback],config.services),...membershipPayments])
  });
 }catch(e){
  return reply({error:(e as Error).message==='AUTH_REQUIRED'?'Please sign in.':'Studio data is unavailable or this business is waiting for approval.'},(e as Error).message==='AUTH_REQUIRED'?401:503);
 }
}
export async function studioPost(req:Request,isPublic=false){try{if(!validOrigin(req))return reply({error:'Invalid origin'},403);const raw=await req.text();if(raw.length>(isPublic?20000:120000))return reply({error:'Request too large.'},413);let b;try{b=JSON.parse(raw);}catch{return reply({error:'Invalid request.'},400);}if(!b||typeof b!=='object')return reply({error:'Invalid request.'},400);if(isPublic&&!['waiver_status','availability','book','calendar','session_calendar','verify_registration','registration_code_request','registration_email_lookup','registration_latest_status'].includes(b.action))return reply({error:'Action not permitted.'},403);const {owner,config}=await context(req,isPublic);if(isPublic){if(b.website)return reply({error:'Unable to process request.'},400);const ip=(req.headers.get('x-forwarded-for')||'unknown').split(',').at(-1)!.trim();if(!await takeLimit('public:'+owner+':'+tokenHash(ip),120))return reply({error:'Too many requests. Please try again in 15 minutes.'},429);if(b.action==='book'){if(b.policyAccepted!==true)return reply({error:'Please accept the booking policy.'},400);if(!await takeLimit('book:'+owner+':'+tokenHash(ip),12))return reply({error:'Booking limit reached. Please contact the studio.'},429);if(typeof b.email==='string'&&!await takeLimit('email:'+owner+':'+tokenHash(b.email.trim().toLowerCase()),6))return reply({error:'Too many booking requests for this email. Please contact the studio.'},429);}}const audit=(kind:string,data:any)=>db().prepare('INSERT OR IGNORE INTO events(id,owner,created,kind,data) VALUES(?,?,?,?,?)').bind(typeof b.key==='string'&&/^[0-9a-f-]{36}$/.test(b.key)?b.key:crypto.randomUUID(),owner,new Date().toISOString(),kind,JSON.stringify(data));
if(b.action==='waiver_status'){
 const first=String(b.firstName||'').trim(),last=String(b.lastName||'').trim(),dob=String(b.dateOfBirth||''),number=String(b.memberNumber||'').trim().toUpperCase();
 if(!first||!last||first.length>100||last.length>100||!/^\d{4}-\d{2}-\d{2}$/.test(dob)||Number.isNaN(Date.parse(dob)))return reply({signed:false});
 const ip=(req.headers.get('x-forwarded-for')||'unknown').split(',').at(-1)!.trim();
 if(!await takeLimit('waiver-lookup:'+owner+':'+tokenHash(ip),30))return reply({error:'Too many waiver checks. Please try again later.'},429);
 const signed=await getPool().query("SELECT w.id FROM participation_waivers w JOIN businesses biz ON biz.id=w.business_id JOIN customer_booking_ids c ON c.id=w.customer_id AND c.business_id=biz.id WHERE biz.owner_id=$1 AND lower(c.first_name)=lower($2) AND lower(c.last_name)=lower($3) AND c.date_of_birth=$4::date AND ($5='' OR c.member_number=$5) AND w.document_version=$6 AND w.deleted_at IS NULL LIMIT 1",[owner,first,last,dob,number,publicWaiverDocument(config).version]);
 return reply({signed:!!signed.rows[0]});
}
if(b.action==='waiver_records'){
 if(isPublic)return reply({error:'Not permitted.'},403);
 const records=await getPool().query('SELECT w.* FROM participation_waivers w JOIN businesses biz ON biz.id=w.business_id WHERE biz.owner_id=$1 AND (w.deleted_at IS NOT NULL)=$2 ORDER BY w.signed_at DESC LIMIT 2000',[owner,b.deleted===true]);
 return reply({waivers:records.rows});
}
if(b.action==='settings'){const c=b.config;if(Array.isArray(c?.services))c.services=c.services.map((s:any)=>({...s,requiresApproval:true}));
 if(c?.waiverLegalReview!=null){const review=c.waiverLegalReview;
  if(typeof review!=='object'||review.version!==publicWaiverDocument(c).version||typeof review.reference!=='string'||review.reference.length>200||typeof review.reviewedAt!=='string'||review.reviewedAt&&!/^\d{4}-\d{2}-\d{2}$/.test(review.reviewedAt)||review.reviewedAt>new Date().toISOString().slice(0,10))throw Error('Enter a valid current waiver legal-review reference and date.');
 }

 if(c?.theme!==undefined&&c.theme!==null){if(!themeIsValid(c.theme))throw Error('Choose valid theme colors and fonts.');c.theme=resolveTheme(c.theme);}
 validateBookingFields(c?.bookingCustomFields||[],c?.bookingPushFields||['customerName','services','date']);
 validateRegistrationQuestions(c);
 validateBlockouts(c);
 validatePageContent(c);
 validateApprovalVisibleFields(c);
 for(const field of ['bookingEyebrow','bookingHeadline','bookingDescription','bookingPolicyTitle','bookingPaymentNote','bookingMembershipTitle','bookingMembershipDescription','bookingMembershipButton','bookingOwnerLoginLabel']){
  if(c?.[field]!==undefined&&(typeof c[field]!=='string'||c[field].length>300))throw Error('Booking page text must be at most 300 characters.');
 }
 if(c?.bookingInterval!==undefined&&![5,10,15,20,30,60].includes(c.bookingInterval))throw Error('Choose a valid booking interval.');
 if(c?.bookingShowMembership!==undefined&&typeof c.bookingShowMembership!=='boolean')throw Error('Invalid membership visibility setting.');
 if(!c||!Array.isArray(c.staff)||!Array.isArray(c.services)||c.staff.length>100||c.services.length>150)throw Error('Check team and service catalog.');
 // Team capacity is enforced inside the same advisory-locked transaction as
 // subscription entitlements and admin-approved per-business extra seats.
 if(new Set(c.staff.map((p:any)=>p.id)).size!==c.staff.length||new Set(c.services.map((p:any)=>p.id)).size!==c.services.length)throw Error('Duplicate service or team IDs.');
 if(!c.staff.every((p:any)=>typeof p.id==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(p.id)&&typeof p.name==='string'&&p.name.trim()&&p.name.length<=100&&typeof p.role==='string'&&p.role.length<=100&&Array.isArray(p.services)&&p.services.every((id:any)=>c.services.some((v:any)=>v.id===id))))throw Error('Check team members and assigned services.');
 if(!c.services.every((p:any)=>typeof p.id==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(p.id)&&typeof p.name==='string'&&p.name.trim()&&p.name.length<=100&&typeof p.category==='string'&&p.category.trim()&&p.category.length<=60))throw Error('Check service types and names.');
 for(const id of (Array.isArray(config.staff)?config.staff:[]).filter((p:any)=>!c.staff.some((q:any)=>q.id===p.id)).map((p:any)=>p.id)){const pending=await db().prepare("SELECT 1 FROM appointments WHERE owner=? AND staff=? AND date>=? AND status NOT IN ('Cancelled','No-show','Completed') LIMIT 1").bind(owner,id,today()).first();if(pending)throw Error('Cancel or complete future bookings before removing this team member.');}
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
 if(c.services.some((service:any)=>service.requiresApproval!==undefined&&typeof service.requiresApproval!=='boolean'))throw Error('Service approval preference must be a checkbox value.');
 if(c.services.some((service:any)=>service.requiresWaiver!==undefined&&typeof service.requiresWaiver!=='boolean'))throw Error('Service waiver preference must be a checkbox value.');
 validateBookableSessions(c);
for(const s of c.services)if(!validSlotCapacity(s.maxSlots??1))throw Error('Service slots must be between 1 and 20.');
 for(const s of c.services)if(!s.name||s.price<0||!Number.isFinite(s.price)||!validDuration(s))throw Error('Enter a valid service duration (minutes, hours, days, weeks, months or years); prices cannot be negative.');const pool=getPool(),client=await pool.connect();
try{
 await client.query('BEGIN');
 await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[owner+':schedule']);
 const persisted=(await client.query('SELECT data FROM settings WHERE owner=$1',[owner])).rows[0];
 const oldConfig=persisted?JSON.parse(persisted.data):config;
 const planRow=(await client.query(
  "SELECT s.plan_code,s.status,(SELECT COUNT(*)::int FROM business_team_seat_requests r WHERE r.business_id=b.id AND r.status='approved') AS approved_seats FROM businesses b LEFT JOIN business_subscriptions s ON s.business_id=b.id WHERE b.owner_id=$1",
  [owner])).rows[0];
 const overrideResult=await client.query("SELECT limits FROM business_entitlement_overrides WHERE business_id=(SELECT id FROM businesses WHERE owner_id=$1)",[owner]);
 const individualLimits=overrideResult.rows[0]?.limits||{};
 const effectiveCap=Number.isInteger(individualLimits.bookableStaff)?individualLimits.bookableStaff:bookableTeamLimit(planRow?.plan_code,planRow?.status,planRow?.approved_seats||0);
 // Enforce paid-tier benefits on the server, using the subscription DB row,
 // never a client-submitted plan label. Existing items remain editable on downgrade.
 if(Object.keys(individualLimits).length){
  const base=planEntitlements(planRow?.plan_code,planRow?.status);
  for(const [field,key] of [['services','services'],['bookingCustomFields','bookingFields'],['bookableSessions','sessionSeries']] as const){
   const limit=Number.isInteger(individualLimits[key])?individualLimits[key]:base.limits[key];
   const oldIds=new Set((oldConfig[field]||[]).map((x:any)=>x.id));
   const newRows=c[field]||[];
   if(newRows.length>limit&&newRows.some((x:any)=>!oldIds.has(x.id)))throw Error('Individual business allowance exceeded for '+key+'.');
  }
 }else checkSubscriptionLimits(planRow,oldConfig,c);
 const oldTeam=Array.isArray(oldConfig.staff)?oldConfig.staff:[];
 if(c.staff.length>effectiveCap&&c.staff.some((member:any)=>!oldTeam.some((previous:any)=>previous.id===member.id)))
  throw Error('Team member limit reached. Submit an ad hoc extra team member request in Settings → Team members and wait for platform administrator approval.');
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
  if(cache.get(key).some((session:any)=>
    ownSessionId!==session.id&&overlaps(
      session.start,session.duration+c.buffer,
      Number(a.start),Number(a.duration)+c.buffer)))
    throw Error('A scheduled or recurring session overlaps an existing confirmed appointment for the selected team member.');
 }
 if(JSON.stringify(oldConfig.waiverLegalReview||null)!==JSON.stringify(c.waiverLegalReview||null))await client.query('INSERT INTO events(id,owner,created,kind,data) VALUES($1,$2,$3,$4,$5)',[crypto.randomUUID(),owner,new Date().toISOString(),'waiver_legal_review',JSON.stringify({review:c.waiverLegalReview||null})]);
 await client.query('INSERT INTO settings(owner,data) VALUES($1,$2) ON CONFLICT(owner) DO UPDATE SET data=excluded.data',[owner,JSON.stringify(c)]);
 await client.query('UPDATE businesses SET name=$1,city=COALESCE($2,city),region=COALESCE($3,region),updated_at=now() WHERE owner_id=$4',
  [c.name,typeof c.city==='string'?c.city:null,typeof c.region==='string'?c.region:null,owner]);
 await client.query('INSERT INTO events(id,owner,created,kind,data) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING',
  [crypto.randomUUID(),owner,new Date().toISOString(),'settings','{}']);
 await client.query('COMMIT');
} catch(error){await client.query('ROLLBACK');throw error;} finally {client.release();}
return reply({ok:true});}
if(b.action==='registration_code_request'){
 const email=String(b.email||'').trim().toLowerCase();
 if(!validEmail(email))return reply({error:'Enter a valid email address.'},400);
 const ip=(req.headers.get('x-forwarded-for')||'unknown').split(',').at(-1)!.trim();
 if(!await takeLimit('registration-code-ip:'+owner+':'+tokenHash(ip),8)||!await takeLimit('registration-code-email:'+owner+':'+tokenHash(email),3))return reply({error:'Too many requests. Try again later.'},429);
 if(!deliveryProviderStatus().emailConfigured)return reply({error:'Email verification is currently unavailable. Please contact the business.'},503);
 const code=String(randomInt(0,1000000)).padStart(6,'0'),hash=tokenHash(owner+':'+email+':'+code);
 const sent=await sendNotificationChannel('email',email,{subject:'SelahFlow registration verification code',text:'Your SelahFlow registration verification code is '+code+'. It expires in 10 minutes. If you did not request this, ignore this message.'});
 if(sent.status!=='submitted')return reply({error:'Unable to send verification email. Please try again later.'},503);
 await db().prepare("INSERT INTO registration_email_codes(owner_id,email_hash,code_hash,expires_at,attempts) VALUES(?,?,?,NOW()+INTERVAL '10 minutes',0) ON CONFLICT(owner_id,email_hash) DO UPDATE SET code_hash=EXCLUDED.code_hash,expires_at=EXCLUDED.expires_at,attempts=0").bind(owner,tokenHash(email),hash).first();
 return reply({ok:true,message:'If this email can receive messages, a verification code has been sent.'});
}
if(b.action==='registration_email_lookup'){
 const email=String(b.email||'').trim().toLowerCase(),code=String(b.code||'').trim();
 if(!validEmail(email)||!/^[0-9]{6}$/.test(code))return reply({error:'Enter your email and six-digit code.'},400);
 const ip=(req.headers.get('x-forwarded-for')||'unknown').split(',').at(-1)!.trim();
 if(!await takeLimit('registration-lookup:'+owner+':'+tokenHash(ip),20))return reply({error:'Too many attempts. Try again later.'},429);
 const row=await db().prepare("SELECT code_hash,attempts FROM registration_email_codes WHERE owner_id=? AND email_hash=? AND expires_at>NOW()").bind(owner,tokenHash(email)).first<any>();
 if(!row||row.attempts>=5||row.code_hash!==tokenHash(owner+':'+email+':'+code)){
  await db().prepare("UPDATE registration_email_codes SET attempts=attempts+1 WHERE owner_id=? AND email_hash=?").bind(owner,tokenHash(email)).first();
  return reply({error:'Invalid or expired verification code.'},403);
 }
 await db().prepare('DELETE FROM registration_email_codes WHERE owner_id=? AND email_hash=?').bind(owner,tokenHash(email)).first();
 const requests=(await db().prepare('SELECT id,status,date,start_minute,details,appointment_id FROM booking_requests WHERE owner_id=? ORDER BY created_at DESC LIMIT 500').bind(owner).all()).results as any[];
 const appointments=(await db().prepare('SELECT id,status,date,start,data FROM appointments WHERE owner=? ORDER BY date DESC LIMIT 500').bind(owner).all()).results as any[];
 const matches:any[]=[],seen=new Set<string>();
 for(const r of requests){
  let d:any={};try{d=JSON.parse(r.details||'{}');}catch{}
  if(String(d.customerEmail||d.email||'').trim().toLowerCase()!==email)continue;
  const a=appointments.find(x=>x.id===r.appointment_id);
  matches.push({reference:r.id,date:a?.date||r.date,start:a?.start??r.start_minute,status:a?.status||({pending:'Awaiting approval',approved:'Confirmed',declined:'Declined',cancelled:'Cancelled'} as any)[r.status]||r.status,service:Array.isArray(d.services)?d.services.join(', '):'Session'});
  if(a)seen.add(a.id);
 }
 for(const a of appointments){
  if(seen.has(a.id))continue;
  let d:any={};try{d=JSON.parse(a.data||'{}');}catch{}
  if(String(d.email||d.customerEmail||'').trim().toLowerCase()!==email)continue;
  matches.push({reference:a.id,date:a.date,start:a.start,status:a.status,service:Array.isArray(d.services)?d.services.join(', '):'Session'});
 }
 return reply({ok:true,registrations:matches.slice(0,100)});
}
if(b.action==='registration_latest_status'){
 const memberNumber=String(b.memberNumber||'').trim().toUpperCase();
 if(!/^[A-Z]{2}([0-9]{4}|[0-9]{6})$/.test(memberNumber))return reply({error:'Enter your eight-character membership ID.'},400);
 const ip=(req.headers.get('x-forwarded-for')||'unknown').split(',').at(-1)!.trim();
 if(!await takeLimit('latest-status-ip:'+owner+':'+tokenHash(ip),8)||!await takeLimit('latest-status-member:'+owner+':'+tokenHash(memberNumber),8))return reply({error:'Too many searches. Try again later.'},429);
 const requests=(await db().prepare('SELECT status,date,details,appointment_id FROM booking_requests WHERE owner_id=? ORDER BY created_at DESC LIMIT 500').bind(owner).all()).results as any[];
 const appointments=(await db().prepare('SELECT id,status,date,data FROM appointments WHERE owner=? ORDER BY date DESC LIMIT 500').bind(owner).all()).results as any[];
 const match=(d:any)=>String(d.memberNumber||'').trim().toUpperCase()===memberNumber;
 const results:{date:string;status:string;appointmentId?:string}[]=[];
 for(const r of requests){
  let d:any={};try{d=JSON.parse(r.details||'{}');}catch{}
  if(!match(d))continue;
  const a=appointments.find(x=>x.id===r.appointment_id);
  results.push({date:a?.date||r.date,status:a?.status||({pending:'Awaiting approval',approved:'Confirmed',accepted:'Confirmed',declined:'Declined',cancelled:'Cancelled'} as Record<string,string>)[r.status]||r.status,appointmentId:a?.id});
 }
 for(const a of appointments){
  let d:any={};try{d=JSON.parse(a.data||'{}');}catch{}
  if(!match(d))continue;
  if(!results.some(x=>x.appointmentId===a.id))results.push({date:a.date,status:a.status,appointmentId:a.id});
 }
 results.sort((a,b)=>b.date.localeCompare(a.date));
 const membership=await memberIdMembershipSummary(getPool(),owner,memberNumber);
 const latest=results[0];
 const payment=latest?(latest.appointmentId?await registrationPaymentSummary(getPool(),owner,latest.appointmentId):{state:latest.status==='Awaiting approval'?'awaiting_approval':'unavailable'}):null;
 return reply({ok:true,latest:latest?{date:latest.date,status:latest.status}:null,membership,payment});
}
if(b.action==='verify_registration'){
 const reference=String(b.reference||'').trim(),email=String(b.email||'').trim().toLowerCase();
 if(!/^[0-9a-f]{8}-[0-9a-f-]{27,36}$/i.test(reference)||!validEmail(email))return reply({error:'Enter a valid booking reference and email address.'},400);
 const ip=(req.headers.get('x-forwarded-for')||'unknown').split(',').at(-1)!.trim();
 if(!await takeLimit('verify:'+owner+':'+tokenHash(ip),12))return reply({error:'Too many verification attempts. Try again later.'},429);
 const request=await db().prepare('SELECT status,date,staff_id,start_minute,details,appointment_id FROM booking_requests WHERE owner_id=? AND id=?').bind(owner,reference).first<any>();
 const appointment=await db().prepare('SELECT id,status,date,staff,start,data FROM appointments WHERE owner=? AND id=?').bind(owner,reference).first<any>();
 let record=appointment,details:any={};
 if(request){
  try{details=JSON.parse(request.details||'{}');}catch{}
  if(!record&&request.appointment_id)record=await db().prepare('SELECT id,status,date,staff,start,data FROM appointments WHERE owner=? AND id=?').bind(owner,request.appointment_id).first<any>();
 }
 if(record){try{const d=JSON.parse(record.data||'{}');if(!request)details=d;}catch{}}
 if(!details.email||String(details.email).trim().toLowerCase()!==email)return reply({error:'No matching registration was found. Check the reference and email.'},404);
 const status=record?String(record.status):request?.status==='approved'?'Confirmed':request?.status==='declined'?'Declined':request?.status==='cancelled'?'Cancelled':'Awaiting approval';
 const date=record?.date||request?.date,start=record?.start??request?.start_minute,staff=record?.staff||request?.staff_id;
 return reply({ok:true,status,date,start,staff,service:Array.isArray(details.services)?details.services.join(', '):'Session',reference});
}
if(b.action==='session_calendar'){
 const dates=bookingDateRange(b.date,b.view);
 const clock=easternClock();
 const lastFuture=new Date(Date.now()+366*86400000).toISOString().slice(0,10);
 const appointments=(await db().prepare("SELECT date,staff,start,duration,status,data FROM appointments WHERE owner=? AND date>=? AND date<=? AND status NOT IN ('Cancelled','No-show')").bind(owner,dates[0],dates[dates.length-1]).all()).results as any[];
 return reply({timezone:'America/New_York',days:dates.map((date:string)=>{
  if(date<clock.date||date>lastFuture)return {date,sessions:[]};
  const entries=sessionsForDate(config,date,undefined).map((session:any)=>{
   const service=config.services.find((item:any)=>item.id===session.service);
   const member=config.staff.find((item:any)=>item.id===session.staff);
   return {id:session.id,start:session.start,service:session.service,staff:session.staff,name:service?.name||'Session',staffName:config.hideTeamNames?'Session team':member?.name||'Team member',capacity:session.capacity,remaining:sessionRemaining(session,appointments.filter((a:any)=>a.date===date)),duration:session.duration};
  }).filter((session:any)=>(date!==clock.date||session.start>clock.minutes)&&!isBlocked(config,date,session.staff,session.start,session.duration+(config.buffer||0)));
  return {date,sessions:entries};
 })});
}
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
async function customerAccess(bookingId:string){const token=randomBytes(32).toString('hex');await getPool().query("INSERT INTO customer_booking_access(token_hash,owner_id,booking_id) VALUES($1,$2,$3)",[tokenHash(token),owner,bookingId]);return token;}
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
if(b.key){
 const prior=await db().prepare('SELECT id,data FROM appointments WHERE owner=? AND id=?').bind(owner,b.key).first<{id:string;data:string}>();
 const pending=prior?null:await db().prepare('SELECT id,status,appointment_id,details FROM booking_requests WHERE owner_id=? AND id=?').bind(owner,b.key).first<{id:string;status:string;appointment_id:string|null;details:string}>();
 if(prior||pending){
  const saved=JSON.parse(prior?.data||pending?.details||'{}');
  if(isPublic&&(String(saved.email).trim().toLowerCase()!==String(b.email).trim().toLowerCase()||saved.dateOfBirth!==b.dateOfBirth||saved.name!==String(b.name).trim()))throw Error('Booking reference does not match your details.');
  return reply({ok:true,id:prior?.id||pending?.id,pending:pending?.status==='pending',status:pending?.status||'confirmed',appointmentId:pending?.appointment_id,chargedPrice:saved.price,membershipCovered:saved.membershipCovered,memberNumber:saved.memberNumber,customerToken:await customerAccess(String(prior?.id||pending?.id))});
 }
}if(b.expectedPrice!==services.reduce((a:number,s:any)=>a+s.price,0)||b.expectedDuration!==duration)return reply({error:'Service prices or durations changed. Refresh the studio and review your booking again.'},409);if(!available.includes(b.start))return reply({error:(availability.sessionAvailability as Record<number,{remaining:number}>)[b.start]?.remaining===0?SESSION_FULL_MESSAGE:'That time is no longer available. Please choose another.'},409);if(typeof b.name!=='string'||typeof b.email!=='string'||b.name.length>100||b.email&&(!/^\S+@\S+\.\S+$/.test(b.email)||b.email.length>200))throw Error('Enter valid contact details.');if(!isPublic&&(!b.name.trim()||!b.email))throw Error('Enter a name and valid email.');let verifiedMembership:any=null;if(isPublic){
 if(b.notMember!==true){
  const number=String(b.memberNumber||'').trim().toUpperCase();
  if(!/^[A-Z]{2}([0-9]{4}|[0-9]{6})$/.test(number))throw Error('Enter your eight-character membership ID or choose N/A.');
  const member=await db().prepare("SELECT m.customer_name,m.date_of_birth,m.status,m.sessions_included,m.sessions_used,m.paid_through,p.credit_eligibility FROM customer_memberships m JOIN membership_plans p ON p.id=m.plan_id AND p.business_id=m.business_id JOIN businesses biz ON biz.id=m.business_id WHERE biz.owner_id=? AND m.member_number=?").bind(owner,number).first() as any;
  const customer=await db().prepare("SELECT c.first_name,c.last_name,c.date_of_birth FROM customer_booking_ids c JOIN businesses biz ON biz.id=c.business_id WHERE biz.owner_id=? AND c.member_number=?").bind(owner,number).first() as any;
  if(!member&&!customer)throw Error('Membership ID was not found for this business.');
  const expectedName=String(member?.customer_name||[customer?.first_name,customer?.last_name].join(' ')).trim().replace(/\s+/g,' ').toLowerCase();
  if(expectedName!==String(b.name||'').trim().replace(/\s+/g,' ').toLowerCase())throw Error('Membership ID does not match the booking name.');
  const storedDob=member?.date_of_birth||customer?.date_of_birth;
  if(storedDob&&new Date(storedDob).toISOString().slice(0,10)!==String(b.dateOfBirth||''))throw Error('Membership ID and birth date do not match.');
  verifiedMembership=member;
 }
 if(b.notMember!==true&&b.notMember!==false)throw Error('Select N/A if you are not a member.');
}
if(isPublic)validateStandardRegistration(config,'booking',b,selectedSession(config,b.date,b.staff,services,b.start)?.id||null,services.map((s:any)=>s.id));
const customAnswers=sanitizeBookingAnswers(registrationQuestions(config,'booking',selectedSession(config,b.date,b.staff,services,b.start)?.id||null,services.map((s:any)=>s.id)).filter((f:any)=>!f.standard),b.customAnswers);
let issuedMemberNumber=String(b.memberNumber||'').trim().toUpperCase();
if(isPublic&&b.firstName&&b.lastName&&b.dateOfBirth){
 const dob=String(b.dateOfBirth||''),firstName=String(b.firstName||'').trim(),lastName=String(b.lastName||'').trim();
 if(!/^\d{4}-\d{2}-\d{2}$/.test(dob)||Number.isNaN(Date.parse(dob))||new Date(dob).toISOString().slice(0,10)!==dob||!firstName||!lastName)throw Error('First name, last name, and valid date of birth are required.');
 const pool=getPool(),client=await pool.connect();
 try{
  await client.query('BEGIN');
  const business=(await client.query("SELECT id,brand_primary,brand_background FROM businesses WHERE owner_id=$1 AND status='active'",[owner])).rows[0];
  if(!business)throw Error('Business not found.');
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1),hashtext($2))',[business.id,(firstName+'|'+lastName+'|'+dob).toLowerCase()]);
  const existing=(await client.query("SELECT member_number FROM customer_booking_ids WHERE business_id=$1 AND lower(first_name)=lower($2) AND lower(last_name)=lower($3) AND date_of_birth=$4::date LIMIT 1",[business.id,firstName,lastName,dob])).rows[0];
  if(existing){if(!/^[A-Z]{2}([0-9]{4}|[0-9]{6})$/.test(existing.member_number))throw Error('This legacy ID requires business review before booking.');issuedMemberNumber=existing.member_number;}
  else{
   const member=(await client.query("SELECT member_number FROM customer_memberships WHERE business_id=$1 AND lower(customer_name)=lower($2) AND date_of_birth=$3::date LIMIT 1",[business.id,firstName+' '+lastName,dob])).rows[0];
   if(member){if(!/^[A-Z]{2}([0-9]{4}|[0-9]{6})$/.test(member.member_number))throw Error('This legacy ID requires business review before booking.');issuedMemberNumber=member.member_number;}
   else{
    issuedMemberNumber=await issueMemberId(client,{businessId:business.id,name:firstName+' '+lastName,firstName,lastName,dateOfBirth:dob});
   }
   await client.query("INSERT INTO customer_booking_ids(business_id,first_name,last_name,email,date_of_birth,phone,member_number) VALUES($1,$2,$3,$4,$5::date,$6,$7)",[business.id,firstName,lastName,String(b.email).toLowerCase(),dob,String(b.phone||''),issuedMemberNumber]);
  }
  // The client directory is not only appointment-derived: persist the first booking
  // as a managed profile, and reuse that profile on all subsequent bookings.
  const normalizedName=(firstName+' '+lastName).trim().replace(/\s+/g,' ').toLowerCase();
  const contactEmail=String(b.email).trim().toLowerCase();
  const contactPhone=String(b.phone||'').trim().slice(0,40);
  const priorProfile=(await client.query(
   "SELECT id FROM business_client_profiles WHERE owner=$1 AND deleted_at IS NULL AND (member_number=$2 OR (member_number IS NULL AND lower(trim(name))=$3 AND (lower(trim(email))=$4 OR (phone<>'' AND phone=$5)) AND (date_of_birth IS NULL OR date_of_birth=$6::date))) ORDER BY CASE WHEN member_number=$2 THEN 0 ELSE 1 END,created_at ASC LIMIT 1 FOR UPDATE",
   [owner,issuedMemberNumber,normalizedName,contactEmail,contactPhone,dob]
  )).rows[0];
  if(priorProfile){
   await client.query("UPDATE business_client_profiles SET member_number=$1,date_of_birth=COALESCE(date_of_birth,$2::date),phone=CASE WHEN trim(phone)='' THEN $3 ELSE phone END,archived=FALSE,updated_at=now() WHERE id=$4",
    [issuedMemberNumber,dob,contactPhone,priorProfile.id]);
  }else{
   await client.query("INSERT INTO business_client_profiles(id,owner,name,email,phone,notes,import_columns,member_number,date_of_birth) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9::date)",
    [crypto.randomUUID(),owner,firstName+' '+lastName,contactEmail,contactPhone,'First online booking',JSON.stringify(customAnswers),issuedMemberNumber,dob]);
  }
  await ensureParticipationWaiver(client,{businessId:business.id,memberNumber:issuedMemberNumber,config,services,input:b.waiver,primary:business.brand_primary,background:business.brand_background,audit:{ip:(req.headers.get('x-forwarded-for')||'').split(',').at(-1)?.trim(),userAgent:req.headers.get('user-agent')||''}});
  await client.query('COMMIT');
 }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
}
const bookedSession=selectedSession(config,b.date,b.staff,services,b.start);const membershipCreditAllowed=(bookedSession?bookedSession.membershipCreditAllowed!==false:services.every((service:any)=>service.membershipCreditAllowed!==false))&&(!verifiedMembership||membershipAllows(verifiedMembership.credit_eligibility,{serviceIds:services.map((s:any)=>s.id),sessionId:bookedSession?.id,seriesId:bookedSession?.seriesId}));const membershipCovered=!!verifiedMembership&&hasUsableMembership(verifiedMembership)&&membershipCreditAllowed&&membershipAllows(verifiedMembership.credit_eligibility,{serviceIds:services.map((s:any)=>s.id),sessionId:bookedSession?.id,seriesId:bookedSession?.seriesId});
const id=typeof b.key==='string'&&/^[0-9a-f-]{36}$/.test(b.key)?b.key:crypto.randomUUID();const data:any={name:b.name.trim()||'Guest',firstName:isPublic?String(b.firstName||'').trim():undefined,lastName:isPublic?String(b.lastName||'').trim():undefined,dateOfBirth:isPublic?String(b.dateOfBirth||''):undefined,email:b.email,phone:String(b.phone||'').slice(0,40),services:services.map((s:any)=>s.name),price:membershipCovered?0:services.reduce((a:number,s:any)=>a+s.price,0),membershipCovered,membershipCreditAllowed,channel:isPublic?'Online booking':b.channel==='Booking portal'?'Booking portal':'Front desk',created:new Date().toISOString()};data.paymentLines=services.map((s:any)=>({id:s.id,name:s.name,type:'service',price:s.price,qty:1}));data.serviceIds=services.map((s:any)=>s.id);data.customAnswers=customAnswers;data.memberNumber=isPublic?issuedMemberNumber:null;data.policyAccepted=isPublic?b.policyAccepted===true:null;data.policyAcceptedAt=isPublic?new Date().toISOString():null;data.customFieldLabels=Object.fromEntries((config.bookingCustomFields||[]).map((field:any)=>[field.id,field.label]));data.customFieldTypes=Object.fromEntries((config.bookingCustomFields||[]).map((field:any)=>[field.id,field.type]));if(bookedSession)data.sessionId=bookedSession.id;
 if(isPublic){
  const approval={reviewer:'owner'};
  const business=await db().prepare("SELECT id FROM businesses WHERE owner_id=? AND status='active'").bind(owner).first<{id:string}>();
  if(!business)return reply({error:'Business is not active.'},403);
  const details={membershipCovered,membershipCreditAllowed,paymentLines:data.paymentLines,memberNumber:issuedMemberNumber,firstName:String(b.firstName||'').trim(),lastName:String(b.lastName||'').trim(),dateOfBirth:String(b.dateOfBirth||''),...bookingRequestDetail({services,staff:b.staff,date:b.date,start:b.start,duration,buffer:config.buffer,name:b.name,email:b.email,phone:String(b.phone||''),price:data.price,reviewer:approval.reviewer}),customAnswers,customFieldLabels:data.customFieldLabels,customFieldTypes:data.customFieldTypes,policyAccepted:true,policyAcceptedAt:data.policyAcceptedAt,sessionId:bookedSession?.id||null};
  let bookingReceipt:any=null;
  const submissionClient=await getPool().connect();
  try{
   await submissionClient.query('BEGIN');
   await submissionClient.query('SELECT pg_advisory_xact_lock(hashtext($1))',[owner+':schedule']);
   const latestSettings=(await submissionClient.query('SELECT data FROM settings WHERE owner=$1',[owner])).rows[0];
   const latestConfig=latestSettings?JSON.parse(latestSettings.data):config;
   await assertBookingWaiver(submissionClient,{owner,config:latestConfig,serviceIds:services.map((s:any)=>s.id),memberNumber:issuedMemberNumber});
   if(await sessionIsFull(submissionClient,{owner,config:latestConfig,date:b.date,staff:b.staff,services,start:b.start})){
    await submissionClient.query('ROLLBACK');return reply({error:SESSION_FULL_MESSAGE},409);
   }
   await submissionClient.query('INSERT INTO booking_requests(id,business_id,owner_id,date,staff_id,start_minute,duration,details,reviewer) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[id,business.id,owner,b.date,b.staff,b.start,duration,JSON.stringify(details),approval.reviewer]);
   bookingReceipt=await queueBookingReceipt(submissionClient,{owner,bookingId:id,date:b.date,start:b.start,duration,staff:b.staff,data,origin:trustedOrigin(req),pending:true});
   await submissionClient.query('COMMIT');
  }catch(error){await submissionClient.query('ROLLBACK');if((error as {code?:string}).code!=='23505')throw error;return reply({ok:true,id,pending:true});}finally{submissionClient.release();}
  try{await pushBookingRequest(id);}catch(e){console.error('Web Push dispatch failed for request',id);}
  let delivery:any={email:'not_requested',sms:'not_requested'};
  try{delivery=await notifyBookingRequest({requestId:id,origin:trustedOrigin(req)});}
  catch(error){console.error('Booking notification dispatch error for request',id);delivery={email:config.bookingNotifyEmail===true?'failed':'not_requested',sms:config.bookingNotifySms===true?'failed':'not_requested'};}
  return reply({ok:true,id,memberNumber:issuedMemberNumber,customerToken:await customerAccess(id),pending:true,status:'pending',chargedPrice:data.price,membershipCovered,bookingReceipt,clientReceiptEmail:'queued',notificationDelivery:delivery,message:'Booking request received, awaiting approval. The appointment is not confirmed until accepted.'});
 }
 let bookingReceipt:any=null;
 try{const confirmed=await confirmBooking({owner,services,staff:b.staff,date:b.date,start:b.start,duration,buffer:config.buffer,id,data,submissionOrigin:isPublic?trustedOrigin(req):null});bookingReceipt=(confirmed as any).bookingReceipt||null;}
 catch(error){return reply({error:(error as Error).message},(error as {status?:number}).status||409);}
 await db().batch([audit('booking',{appointment:id})]);
 return reply({ok:true,id,memberNumber:issuedMemberNumber,customerToken:await customerAccess(id),pending:false,status:'confirmed',chargedPrice:data.price,membershipCovered,bookingReceipt,clientReceiptEmail:bookingReceipt?'queued':null});}
if(b.action==='deleteAppointments'){
 if(isPublic)return reply({error:'Not permitted.'},403);
 const ids=Array.isArray(b.ids)?b.ids:[];
 if(!ids.length||ids.length>2000||!ids.every((id:any)=>typeof id==='string'&&id.length>0&&id.length<120)||new Set(ids).size!==ids.length)return reply({error:'Select valid appointments to delete.'},400);
 const all=b.all===true;
 if(all&&(b.confirmPhrase!=='DELETE ALL APPOINTMENTS'||b.confirmBusiness!==config.name))return reply({error:'For all appointments, enter the exact business name and DELETE ALL APPOINTMENTS.'},400);
 const {getPool}=await import('../server/database.mjs');
 const client=await getPool().connect();
 try{
  await client.query('BEGIN');
  const existing=await client.query('SELECT id FROM appointments WHERE owner=$1 FOR UPDATE',[owner]);
  const available=new Set(existing.rows.map((row:any)=>row.id));
  if(all&&(ids.length!==available.size||ids.some((id:string)=>!available.has(id))))throw Error('Appointment list changed. Refresh and confirm again.');
  if(ids.some((id:string)=>!available.has(id)))throw Error('One or more appointments no longer exist. Refresh the list.');
  await client.query('DELETE FROM slots WHERE owner=$1 AND appointment=ANY($2::text[])',[owner,ids]);
  await client.query('DELETE FROM booking_requests WHERE owner_id=$1 AND appointment_id=ANY($2::text[])',[owner,ids]);
  const removed=await client.query('DELETE FROM appointments WHERE owner=$1 AND id=ANY($2::text[]) RETURNING id',[owner,ids]);
  await client.query('COMMIT');
  return reply({ok:true,deleted:removed.rowCount});
 }catch(error){await client.query('ROLLBACK');return reply({error:(error as Error).message},409);}finally{client.release();}
}
if(b.action==='status'){
 if(!['Checked in','Cancelled','No-show'].includes(b.status))throw Error('Invalid status');
 if(typeof b.id!=='string'||!b.id)throw Error('Invalid appointment.');
 const client=await getPool().connect();
 try{
  await client.query('BEGIN');
  const result=await changeAppointmentStatus(client,{
   owner,appointmentId:b.id,status:b.status,
   ledgerId:crypto.randomUUID(),
   eventId:typeof b.key==='string'&&/^[0-9a-f-]{36}$/.test(b.key)?b.key:crypto.randomUUID(),
   createdAt:new Date().toISOString()
  });
  if(result.notFound){await client.query('ROLLBACK');return reply({error:'Appointment not found'},404);}
  await client.query('COMMIT');
  return reply(result);
 }catch(error){await client.query('ROLLBACK');throw error;}
 finally{client.release();}
}
if(b.action==='sale'){if(!Array.isArray(b.items)||!b.items.length)throw Error('Add items to checkout.');const lines=b.items.map((l:any)=>{const item=[...config.services.map((s:any)=>({...s,type:'service',cost:null})),...config.products.map((p:any)=>({...p,type:'product'}))].find((x:any)=>x.id===l.id);if(!item||!Number.isInteger(l.qty)||l.qty<1||l.qty>50)throw Error('Invalid checkout item.');return {...item,qty:l.qty};});if(b.bookingId!==undefined&&b.bookingId!==''&&(typeof b.bookingId!=='string'||!/^[-a-f0-9]{36}$/i.test(b.bookingId)))throw Error('Invalid booking reference.');return reply(await recordCashSale(getPool(),{owner,eventId:typeof b.key==='string'&&/^[0-9a-f-]{36}$/i.test(b.key)?b.key:crypto.randomUUID(),bookingId:b.bookingId||null,lines,taxRate:config.tax}));}
if(b.action==='handoff'){if(!String(b.message||'').trim())throw Error('Enter a message');await db().batch([audit('handoff',{message:String(b.message).slice(0,2000),status:'Open'})]);return reply({ok:true});}return reply({error:'Unknown action'},400);
}catch(e){return reply({error:(e as Error).message==='AUTH_REQUIRED'?'Please sign in.':((e as {code?:string}).code?'Unable to save right now. Please try again.':(e as Error).message)||'Unable to save. Please try again.'},(e as Error).message==='AUTH_REQUIRED'?401:400);}}

async function takeLimit(key:string,max:number){const row=await db().prepare("INSERT INTO public_limits(key,count,window_start) VALUES(?,1,now()) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN public_limits.window_start<now()-interval '15 minutes' THEN 1 ELSE public_limits.count+1 END,window_start=CASE WHEN public_limits.window_start<now()-interval '15 minutes' THEN now() ELSE public_limits.window_start END RETURNING count").bind(key).first<{count:number}>();return !!row&&row.count<=max;}
export async function publicGet(req:Request){try{const {config,owner}=await context(req,true);const merchant=await getPool().query('SELECT a.charges_enabled,a.onboarding_complete FROM merchant_accounts a JOIN businesses b ON b.id=a.business_id WHERE b.owner_id=$1',[owner]);const canPay=paymentConfigured()&&merchant.rows[0]?.charges_enabled===true&&merchant.rows[0]?.onboarding_complete===true;const brand=await db().prepare('SELECT slug,brand_primary,brand_background,business_model FROM businesses WHERE owner_id=?').bind(owner).first<{slug:string;brand_primary:string;brand_background:string;business_model:string}>();return reply({config:{waiver:publicWaiverDocument(config,brand?.brand_primary,brand?.brand_background),canPay,slug:brand?.slug,brand_primary:brand?.brand_primary,brand_background:brand?.brand_background,business_model:brand?.business_model,theme:config.theme||null,name:config.name,tagline:config.tagline,address:config.address,phone:config.phone,timezone:config.timezone,open:config.open,close:config.close,buffer:config.buffer,bookingInterval:config.bookingInterval||15,policy:config.policy,bookingEyebrow:config.bookingEyebrow,bookingHeadline:config.bookingHeadline,bookingDescription:config.bookingDescription,bookingHeaderNote:config.bookingHeaderNote,bookingPolicyTitle:config.bookingPolicyTitle,bookingPaymentNote:config.bookingPaymentNote,bookingMembershipTitle:config.bookingMembershipTitle,bookingMembershipDescription:config.bookingMembershipDescription,bookingMembershipButton:config.bookingMembershipButton,bookingOwnerLoginLabel:config.bookingOwnerLoginLabel,pageContent:config.pageContent||{},bookingShowMembership:config.bookingShowMembership!==false,bookingApprovalEnabled:true,hideTeamNames:config.hideTeamNames===true,...publicRegistrationSettings(config),bookingCustomFields:(config.bookingCustomFields||[]).map((f:any)=>({id:f.id,label:f.label,type:f.type,required:f.required,forms:f.forms,sessionIds:f.sessionIds,options:f.type==='select'?f.options:[]})),services:config.services.map((s:any)=>({id:s.id,name:s.name,category:s.category,duration:s.duration,durationValue:s.durationValue??s.duration,durationUnit:s.durationUnit||'minutes',maxSlots:s.maxSlots??1,price:s.price,description:s.description,requiresApproval:true,requiresWaiver:s.requiresWaiver===true,membershipCreditAllowed:s.membershipCreditAllowed!==false})),staff:config.staff.map((s:any)=>({id:s.id,name:config.hideTeamNames?'Session team':s.name,role:config.hideTeamNames?'Assigned professional':s.role,initials:config.hideTeamNames?'ST':s.initials,services:s.services}))}});}catch{return reply({error:'Online booking is temporarily unavailable. Please contact the studio.'},503);}}
