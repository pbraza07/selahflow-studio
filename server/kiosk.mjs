import {ATTENDANCE_WINDOW_MS,checkInWindow} from './attendance-window.mjs';
import {randomBytes,randomUUID} from 'node:crypto';
import {tokenHash} from './security.mjs';
import {changeAppointmentStatus} from './appointment-membership-usage.mjs';
import {loadOwnerMemberRoster,ownerAppointmentMember} from './owner-appointment-members.mjs';
import {refreshMemberPeriod} from './membership-periods.mjs';
import {publicWaiverDocument,ensureParticipationWaiver} from './participation-waivers.mjs';
import {waiverMinor} from './waiver-content.mjs';
export const kioskObject=value=>{try{return typeof value==='string'?JSON.parse(value):value||{};}catch{return {};}};
export function kioskTimezone(config){try{new Intl.DateTimeFormat('en',{timeZone:config.timezone||'America/New_York'});return config.timezone||'America/New_York';}catch{return 'America/New_York';}}
export function kioskDay(now,zone){return new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(now);}
export function kioskPhone(value){let digits=String(value||'').trim().replace(/(?:ext\.?|x|#)\s*\d+$/i,'').replace(/\D/g,'');if(digits.startsWith('00'))digits=digits.slice(2);if(digits.length===11&&digits.startsWith('1'))digits=digits.slice(1);return digits.length>=7&&digits.length<=15?digits:'';}
export function kioskIdentity(kind,value){if(typeof value!=='string'||value.length>254)throw Error('Enter your email, phone number or Member ID.');if(kind==='phone'){const phone=kioskPhone(value);if(phone)return phone;}else if(kind==='email'){const email=value.trim().toLowerCase();if(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return email;}else if(kind==='memberNumber'){const id=value.replace(/[\s-]/g,'').toUpperCase();if(/^[A-Z]{2}(?:\d{4}|\d{6})$/.test(id))return id;}throw Error('Check your '+(kind==='memberNumber'?'Member ID':kind)+' and try again.');}
export function kioskCookie(slug,token,maxAge=7776000){return `sf_kiosk_${slug}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${process.env.NODE_ENV==='production'?'; Secure':''}`;}
export function kioskMarker(slug,maxAge=7776000){return `sf_kiosk_slug=${slug}; Path=/; SameSite=Strict; Max-Age=${maxAge}${process.env.NODE_ENV==='production'?'; Secure':''}`;}
export async function kioskContext(db,req,slug){
 if(!/^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$/.test(slug||''))throw Error('KIOSK_REQUIRED');
 const token=(req.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('sf_kiosk_'+slug+'='))?.split('=')[1];
 if(!/^[a-f0-9]{64}$/.test(token||''))throw Error('KIOSK_REQUIRED');
 const row=(await db.query("SELECT d.id AS device_id,b.*,s.data AS config FROM kiosk_devices d JOIN businesses b ON b.id=d.business_id LEFT JOIN settings s ON s.owner=b.owner_id WHERE d.token_hash=$1 AND d.expires_at>now() AND d.revoked_at IS NULL AND b.slug=$2 AND b.status='active'",[tokenHash(token),slug])).rows[0];
 if(!row)throw Error('KIOSK_REQUIRED');row.config={...kioskObject(row.config),name:row.name};return {...row,token};
}
export async function kioskLimit(db,deviceId,action,value=''){
 const key='kiosk:'+deviceId+':'+action+(value?':'+tokenHash(value):'');
 const row=(await db.query("INSERT INTO public_limits(key,count,window_start) VALUES($1,1,now()) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN public_limits.window_start<now()-interval '15 minutes' THEN 1 ELSE public_limits.count+1 END,window_start=CASE WHEN public_limits.window_start<now()-interval '15 minutes' THEN now() ELSE public_limits.window_start END RETURNING count",[key])).rows[0];
 if(row.count>(value?30:300))throw Error('Please ask staff for help or try again in a few minutes.');
}
async function grant(db,ctx,purpose,data){const token=randomBytes(32).toString('hex');await db.query("DELETE FROM kiosk_grants WHERE expires_at<=now() OR device_id=$1",[ctx.device_id]);await db.query("INSERT INTO kiosk_grants(token_hash,device_id,purpose,data,expires_at) VALUES($1,$2,$3,$4::jsonb,now()+interval '5 minutes')",[tokenHash(token),ctx.device_id,purpose,JSON.stringify(data)]);return token;}
async function readGrant(db,ctx,token,purpose){if(!/^[a-f0-9]{64}$/.test(token||''))throw Error('Start again to protect your information.');const row=(await db.query('SELECT data FROM kiosk_grants WHERE token_hash=$1 AND device_id=$2 AND purpose=$3 AND expires_at>now() FOR UPDATE',[tokenHash(token),ctx.device_id,purpose])).rows[0];if(!row)throw Error('This screen expired. Tap Start over.');return row.data;}
const summary=a=>{const d=kioskObject(a.data);return {id:a.id,name:String(d.name||d.customerName||'Client'),date:a.date,start:a.start,duration:a.duration,services:Array.isArray(d.services)?d.services:[],status:a.status};};
export async function kioskLookup(db,ctx,input,now=new Date()){
 const value=kioskIdentity(input.kind,input.value),zone=kioskTimezone(ctx.config),firstDay=kioskDay(new Date(now.getTime()-ATTENDANCE_WINDOW_MS),zone),lastDay=kioskDay(new Date(now.getTime()+ATTENDANCE_WINDOW_MS),zone);
 await kioskLimit(db,ctx.device_id,'lookup',value);
 const appointments=(await db.query("SELECT *,((date::date+start*interval '1 minute') AT TIME ZONE $3) AS starts_at FROM appointments WHERE owner=$1 AND date BETWEEN $2 AND $4 AND status NOT IN ('Cancelled','Completed') ORDER BY date,start,id",[ctx.owner_id,firstDay,zone,lastDay])).rows;
 const roster=await loadOwnerMemberRoster(db,ctx.owner_id);
 const matches=appointments.filter(a=>{const d=kioskObject(a.data);if(d.sample||Math.abs(now.getTime()-new Date(a.starts_at).getTime())>ATTENDANCE_WINDOW_MS)return false;return input.kind==='phone'?kioskPhone(d.phone||d.customerPhone)===value:input.kind==='email'?String(d.email||d.customerEmail||'').trim().toLowerCase()===value:ownerAppointmentMember(d,roster).memberNumber===value;});
 if(!matches.length)return {appointments:[],message:'No sessions found within 24 hours of their start. Check your details or ask staff.'};
 const token=await grant(db,ctx,'checkin',{ids:matches.map(a=>a.id)});
 return {grant:token,appointments:matches.map(a=>{const window=checkInWindow(a.starts_at,now);return {...summary(a),canCheckIn:a.status==='Confirmed'&&window==='open',checkInMessage:a.status==='Checked in'?'Already checked in':window==='early'?'Check-in opens 24 hours before the start':window==='closed'?'Check-in closed — please see our team':'Please see our team'};})};
}
export async function kioskCheckIn(db,ctx,input,now=new Date()){
 const allowed=await readGrant(db,ctx,input.grant,'checkin');if(!allowed.ids.includes(input.id))throw Error('Choose a session from your results.');
 await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',[ctx.owner_id+':schedule']);
 const a=(await db.query("SELECT *,((date::date+start*interval '1 minute') AT TIME ZONE $3) AS starts_at FROM appointments WHERE owner=$1 AND id=$2 FOR UPDATE",[ctx.owner_id,input.id,kioskTimezone(ctx.config)])).rows[0];
 if(!a)throw Error('This session changed. Start again or ask staff.');
 if(a.status==='Checked in')return {ok:true,alreadyProcessed:true,message:'You are already checked in. No additional membership session was used.'};
 if(a.status!=='Confirmed'||checkInWindow(a.starts_at,now)==='closed')throw Error('Please ask staff to update attendance for this session.');
 if(checkInWindow(a.starts_at,now)==='early')throw Error('Check-in opens 24 hours before your session.');
 const result=await changeAppointmentStatus(db,{owner:ctx.owner_id,appointmentId:a.id,status:'Checked in',eventId:randomUUID(),ledgerId:randomUUID(),createdAt:now.toISOString(),source:'kiosk'});
 return {...result,message:result.membershipDeducted?'Checked in! One membership session was used.':result.alreadyDeducted?'Checked in! Your membership session was already recorded.':'Checked in! Your attendance is recorded.'};
}
export async function kioskMemberStatus(db,ctx,input){
 const id=kioskIdentity('memberNumber',input.value);await kioskLimit(db,ctx.device_id,'member',id);
 const roster=await loadOwnerMemberRoster(db,ctx.owner_id);if(!roster.some(r=>r.member_number===id))throw Error('Member ID was not found. Check the ID or ask staff.');
 const members=(await db.query('SELECT m.*,p.name AS plan_name FROM customer_memberships m JOIN membership_plans p ON p.id=m.plan_id WHERE m.business_id=$1 AND m.member_number=$2 FOR UPDATE OF m',[ctx.id,id])).rows;
 const plans=[];for(const member of members){const fresh=await refreshMemberPeriod(db,member);plans.push({name:member.plan_name,status:fresh.status,included:fresh.sessions_included,used:fresh.sessions_used,remaining:Math.max(0,fresh.sessions_included-fresh.sessions_used),paidThrough:fresh.paid_through});}
 const names=roster.filter(r=>r.member_number===id).map(r=>String(r.name).trim().toLowerCase());
 const rows=(await db.query("SELECT id,date,start,duration,status,data FROM appointments WHERE owner=$1 AND (data::jsonb->>'memberNumber'=$2 OR lower(trim(data::jsonb->>'name'))=ANY($3::text[])) ORDER BY date DESC,start DESC LIMIT 5000",[ctx.owner_id,id,names])).rows.filter(a=>!kioskObject(a.data).sample&&ownerAppointmentMember(kioskObject(a.data),roster).memberNumber===id);
 const day=kioskDay(new Date(),kioskTimezone(ctx.config));
 const used=new Set((await db.query("SELECT l.appointment_id FROM membership_session_ledger l JOIN customer_memberships m ON m.id=l.membership_id AND m.business_id=l.business_id WHERE m.business_id=$1 AND m.member_number=$2 AND l.event_type='session_used'",[ctx.id,id])).rows.map(r=>r.appointment_id));
 const item=a=>({...summary(a),membershipSessionUsed:used.has(a.id)});
 return {name:roster.find(r=>r.member_number===id)?.name,plans,upcoming:rows.filter(a=>a.date>=day&&!['Cancelled','No-show','Completed','Checked in'].includes(a.status)).reverse().slice(0,100).map(item),history:rows.filter(a=>a.date<day||['No-show','Completed','Checked in'].includes(a.status)).slice(0,100).map(item)};
}
export async function kioskWaiver(db,ctx,input){
 const id=kioskIdentity('memberNumber',input.value);await kioskLimit(db,ctx.device_id,'waiver',id);
 const identity=(await db.query('SELECT id,first_name,last_name,date_of_birth::text AS dob FROM customer_booking_ids WHERE business_id=$1 AND member_number=$2',[ctx.id,id])).rows[0];
 if(!identity)throw Error('Ask staff to verify your client identity before signing.');
 if(!identity.dob)throw Error('Ask staff to add your birth date before signing the waiver.');
 const document=publicWaiverDocument(ctx.config,ctx.brand_primary,ctx.brand_background);
 return {grant:await grant(db,ctx,'waiver',{memberNumber:id}),document,name:[identity.first_name,identity.last_name].join(' '),minor:waiverMinor(identity.dob)};
}
export async function kioskSignWaiver(db,ctx,input,req){
 const data=await readGrant(db,ctx,input.grant,'waiver');
 const id=await ensureParticipationWaiver(db,{businessId:ctx.id,memberNumber:data.memberNumber,config:ctx.config,services:[{requiresWaiver:true}],input:input.signature,primary:ctx.brand_primary,background:ctx.brand_background,replaceExisting:true,audit:{userAgent:req.headers.get('user-agent')}});
 await db.query('DELETE FROM kiosk_grants WHERE token_hash=$1',[tokenHash(input.grant)]);
 return {ok:true,message:'Your new signature is saved as your current waiver.'};
}
