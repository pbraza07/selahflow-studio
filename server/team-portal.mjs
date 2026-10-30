import {resolveTheme} from './themes.mjs';
import {randomBytes,randomUUID} from 'node:crypto';
import {tokenHash,hashPassword,verifyPassword} from './security.mjs';
import {sessionTeamDefaults} from './team-booking-policy.mjs';
import {sessionsForDate,overlaps} from './session-scheduling.mjs';
export const teamCookie=(token,age=43200)=>`selahflow_team=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${process.env.NODE_ENV==='production'?'; Secure':''}`;
export const teamToken=req=>(req.headers.get('cookie')||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('selahflow_team='))?.slice(15)||'';
export function portalError(message,status=400){return Object.assign(new Error(message),{status});}
export async function teamIdentity(pool,req,allowPasswordChange=false){
 const token=teamToken(req);if(!/^[a-f0-9]{64}$/.test(token))throw portalError('Please sign in to your team workspace.',401);
 const a=(await pool.query(`SELECT a.*,b.owner_id,b.slug,b.name AS business_name,b.brand_primary,b.brand_background,s.data AS config FROM team_sessions t JOIN team_accounts a ON a.id=t.account_id JOIN businesses b ON b.id=a.business_id JOIN settings s ON s.owner=b.owner_id WHERE t.token_hash=$1 AND t.expires_at>now() AND a.active=true AND b.status='active'`,[tokenHash(token)])).rows[0];
 if(!a||!JSON.parse(a.config).staff?.some(s=>s.id===a.staff_id))throw portalError('Your team access is unavailable. Contact the business owner.',401);
 if(a.must_change_password&&!allowPasswordChange)throw portalError('Set your own password before continuing.',428);
 return a;
}
export async function teamLogin(pool,input){
 const {email,password,accountId}=input;
 if(typeof email!=='string'||email.length>254||typeof password!=='string'||password.length<6||password.length>256)throw portalError('Enter your email and password.');
 const key=tokenHash('team:'+email.trim().toLowerCase());
 const rate=(await pool.query("INSERT INTO login_attempts(key,count,window_start) VALUES($1,1,now()) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN login_attempts.window_start<now()-interval '15 minutes' THEN 1 ELSE login_attempts.count+1 END,window_start=CASE WHEN login_attempts.window_start<now()-interval '15 minutes' THEN now() ELSE login_attempts.window_start END RETURNING count",[key])).rows[0];
 if(rate.count>10)throw portalError('Too many attempts. Try again in 15 minutes.',429);
 const candidates=(await pool.query("SELECT a.*,b.name AS business_name,s.data AS config FROM team_accounts a JOIN businesses b ON b.id=a.business_id JOIN settings s ON s.owner=b.owner_id WHERE b.status='active' AND a.email=$1 AND a.active=true",[email.trim().toLowerCase()])).rows;
 const matches=candidates.filter(a=>verifyPassword(password,a.password_hash)&&JSON.parse(a.config).staff?.some(s=>s.id===a.staff_id));
 if(!candidates.length)verifyPassword(password,hashPassword('unmatched-account'));
 if(!matches.length)throw portalError('Email or password is incorrect.',401);
 if(matches.length>1&&!accountId)return {choices:matches.map(a=>({id:a.id,business:a.business_name}))};
 const a=accountId?matches.find(a=>a.id===accountId):matches[0];if(!a)throw portalError('Email or password is incorrect.',401);
 const token=randomBytes(32).toString('hex');await pool.query("INSERT INTO team_sessions VALUES($1,$2,now()+interval '12 hours')",[tokenHash(token),a.id]);await pool.query('DELETE FROM login_attempts WHERE key=$1',[key]);
 return {token,mustChangePassword:a.must_change_password};
}
export function cleanProfile(input){
 const p={};for(const [key,max] of [['name',100],['phone',40],['email',254],['description',2000]]){if(typeof input[key]!=='string'||input[key].length>max||(key==='description'?/[<>\u0000-\u0008\u000b\u000c\u000e-\u001f]/:/[<>\u0000-\u001f]/).test(input[key]))throw portalError('Check your profile fields.');p[key]=input[key].trim();}
 if(!p.name||p.email&&!/^\S+@\S+\.\S+$/.test(p.email))throw portalError('Enter your name and a valid public email.');
 if(!Array.isArray(input.socials)||input.socials.length>6)throw portalError('Add up to six social links.');
 p.socials=input.socials.filter(value=>typeof value==='string'&&value.trim()).map(value=>{try{const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.href.length>500)throw Error();return u.href;}catch{throw portalError('Social links must be complete https:// addresses.');}});return p;
}
export async function accountAppointments(pool,a){
 return (await pool.query(`SELECT ap.* FROM appointments ap LEFT JOIN appointment_team_assignments ta ON ta.appointment_id=ap.id AND ta.business_id=$3 LEFT JOIN session_team_occurrences occurrence ON occurrence.business_id=$3 AND occurrence.session_id=ap.data::jsonb->>'sessionId' AND occurrence.session_date=ap.date AND occurrence.start_minute=ap.start LEFT JOIN session_team_assignments series ON series.business_id=$3 AND series.session_id=regexp_replace(ap.data::jsonb->>'sessionId','__[0-9]{8}$','') WHERE ap.owner=$1 AND (ap.staff=$2 OR COALESCE(ta.staff_ids,'[]'::jsonb) ? $2 OR COALESCE(occurrence.staff_ids,series.staff_ids,'[]'::jsonb) ? $2 OR COALESCE(ap.data::jsonb->'hostTeamIds','[]'::jsonb) ? $2) ORDER BY ap.date DESC,ap.start`,[a.owner_id,a.staff_id,a.business_id])).rows;
}
export async function assertClientAppointment(pool,a,id){
 const ap=(await accountAppointments(pool,a)).find(x=>x.id===id&&!['Cancelled','No-show'].includes(x.status));if(!ap)throw portalError('Choose a client appointment assigned to you.',403);return ap;
}
export function privateAppointment(row){const d=JSON.parse(row.data);return {id:row.id,date:row.date,start:row.start,duration:row.duration,status:row.status,name:d.name||'Client',email:d.email||'',phone:d.phone||'',services:d.services||[]};}
export async function publicTeam(pool,id){
 const a=(await pool.query("SELECT a.id,a.staff_id,a.profile,b.slug,b.name,b.brand_primary,b.brand_background,s.data AS config FROM team_accounts a JOIN businesses b ON b.id=a.business_id JOIN settings s ON s.owner=b.owner_id WHERE a.id=$1 AND a.active=true AND b.status='active'",[id])).rows[0];
 if(!a)throw portalError('Team page not found.',404);const c=JSON.parse(a.config),staff=c.staff?.find(x=>x.id===a.staff_id&&x.bookingVisible!==false);if(!staff)throw portalError('Team page not found.',404);
 const portrait=(await pool.query("SELECT id FROM team_media WHERE account_id=$1 AND kind='portrait'",[id])).rows[0];
 return {branding:teamBranding(a,c),id:a.id,staffId:a.staff_id,business:a.name,slug:a.slug,profile:{name:a.profile.name||staff.name,phone:a.profile.phone||'',email:a.profile.email||'',description:a.profile.description||'',socials:a.profile.socials||[]},portrait:portrait?.id||null,services:(c.services||[]).filter(s=>staff.services.includes(s.id)&&(!s.durationUnit||['minutes','hours'].includes(s.durationUnit))).map(s=>({id:s.id,name:s.name,price:s.price,duration:s.duration}))};
}
export async function saveTimeOff(pool,{owner,staff,input,actor}){
 const db=await pool.connect();try{await db.query('BEGIN');await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',[owner+':schedule']);
 const row=(await db.query('SELECT data FROM settings WHERE owner=$1',[owner])).rows[0];const c=JSON.parse(row.data);
 if(actor!==owner){const current=(await db.query("SELECT id FROM team_accounts WHERE id=$1 AND staff_id=$2 AND business_id=(SELECT id FROM businesses WHERE owner_id=$3 AND status='active') AND active=true AND must_change_password=false",[actor,staff,owner])).rows[0];if(!current)throw portalError('Your team access changed. Sign in again.',401);}
 if(!c.staff.some(s=>s.id===staff))throw portalError('Choose a current team member.');
 const blocks=c.teamTimeOff||[],old=input.id?blocks.find(b=>b.id===input.id):null;
 if(input.id&&(!old||old.staff!==staff))throw portalError('Time off not found.',404);
 if(input.remove){c.teamTimeOff=blocks.filter(b=>b.id!==input.id);}else{
 const {from,to,start,end}=input;const valid=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d))&&new Date(d).toISOString().slice(0,10)===d;
 if(!valid(from)||!valid(to)||to<from||(Date.parse(to)-Date.parse(from))/86400000>366||!Number.isInteger(start)||!Number.isInteger(end)||start<0||end>1440||start>=end||start%15||end%15||typeof input.reason!=='string'||input.reason.length>100)throw portalError('Choose valid dates and 15-minute times (up to one year).');
 const appointments=(await db.query("SELECT * FROM appointments WHERE owner=$1 AND date>=$2 AND date<=$3 AND status NOT IN ('Cancelled','No-show')",[owner,from,to])).rows;
 const assignments=(await db.query('SELECT appointment_id,staff_ids FROM appointment_team_assignments WHERE business_id=(SELECT id FROM businesses WHERE owner_id=$1)',[owner])).rows;
 if(appointments.some(a=>(a.staff===staff||JSON.parse(a.data).hostTeamIds?.includes(staff)||assignments.some(x=>x.appointment_id===a.id&&x.staff_ids.includes(staff)))&&overlaps(start,end-start,a.start,a.duration+(c.buffer||0))))throw portalError('This time overlaps a client appointment. Reschedule or cancel that appointment first.',409);
 const occurrenceAssignments=(await db.query('SELECT * FROM session_team_occurrences WHERE business_id=(SELECT id FROM businesses WHERE owner_id=$1)',[owner])).rows;const seriesAssignments=(await db.query('SELECT * FROM session_team_assignments WHERE business_id=(SELECT id FROM businesses WHERE owner_id=$1)',[owner])).rows;
 for(let d=Date.parse(from);d<=Date.parse(to);d+=86400000){const date=new Date(d).toISOString().slice(0,10);if(sessionsForDate(c,date).some(s=>(s.staff===staff||(occurrenceAssignments.find(a=>a.session_id===s.id&&a.session_date===date&&a.start_minute===s.start)?.staff_ids||seriesAssignments.find(a=>a.session_id===(s.seriesId||s.id))?.staff_ids||sessionTeamDefaults(c,s)).includes(staff))&&overlaps(start,end-start,s.start,s.duration+(c.buffer||0))))throw portalError('This time overlaps a published session. Ask the owner to move or remove the session first.',409);}
 if(blocks.filter(b=>b.id!==input.id).length>=500)throw portalError('Remove past time off before adding more.');
 c.teamTimeOff=[...blocks.filter(b=>b.id!==input.id),{id:old?.id||randomUUID(),staff,from,to,start,end,reason:input.reason.trim()}];
 }
 await db.query('UPDATE settings SET data=$2 WHERE owner=$1',[owner,JSON.stringify(c)]);await db.query('INSERT INTO events(id,owner,created,kind,data) VALUES($1,$2,$3,$4,$5)',[randomUUID(),owner,new Date().toISOString(),'team_time_off',JSON.stringify({staff,actor,removed:!!input.remove})]);await db.query('COMMIT');return {ok:true};
 }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
}
/** Keep source templates needed to resolve transfers, while stripping private tracking metadata. */
export function teamCalendarConfig(config,staff){
 const overrides=config.sessionOverrides||[];
 const bases=(config.bookableSessions||[]).filter(s=>s.staff===staff||overrides.some(o=>(o.seriesId||o.id)===s.id&&o.staff===staff));
 const ids=new Set(bases.map(s=>s.id));
 const project=s=>Object.fromEntries(['id','seriesId','originalDate','date','start','staff','service','capacity','repeat','cancelled','onlyScheduledTime','duration'].filter(k=>s[k]!==undefined).map(k=>[k,s[k]]));
 return {bookableSessions:bases.map(project),sessionOverrides:overrides.filter(o=>ids.has(o.seriesId||o.id)).map(project)};
}

export function teamBranding(account,config){return {name:account.business_name||account.name,slug:account.slug,theme:resolveTheme(config.theme,account.brand_primary,account.brand_background)};}
