import {accountAppointments} from './team-portal.mjs';
import {sessionTeamDefaults} from './team-booking-policy.mjs';
import {isBlocked} from './booking-blockouts.mjs';
import {randomUUID} from 'node:crypto';
import {easternClock,validateBookableSessions,sessionsForDate,overlaps} from './session-scheduling.mjs';
import {recurrenceDates} from './session-recurrence.mjs';
import {planEntitlements} from './plan-entitlements.mjs';
import {assertWorkspace} from './team-workspace-state.mjs';
export async function createTeamSession(pool,a,input){
 const db=await pool.connect();try{await db.query('BEGIN');await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',[a.owner_id+':schedule']);
 const current=(await db.query("SELECT a.* FROM team_accounts a JOIN businesses b ON b.id=a.business_id WHERE a.id=$1 AND a.business_id=$2 AND a.staff_id=$3 AND a.active=true AND a.must_change_password=false AND b.owner_id=$4 AND b.status='active' FOR SHARE OF a",[a.id,a.business_id,a.staff_id,a.owner_id])).rows[0];
 if(!current)throw Error('Team access changed. Sign in again.');assertWorkspace(current);if(current.can_create_sessions===false)throw Error('Your owner has disabled session creation for this workspace.');
 const c=JSON.parse((await db.query('SELECT data FROM settings WHERE owner=$1',[a.owner_id])).rows[0].data);
 if(input.staff&&input.staff!==a.staff_id)throw Error('You can only create sessions under your own name.');
 const session={id:randomUUID(),staff:a.staff_id,service:input.service,date:input.date,start:input.start,capacity:input.capacity,onlyScheduledTime:true,...(input.repeat?{repeat:{frequency:input.repeat.frequency,every:input.repeat.every,until:input.repeat.until}}:{})};
 const clock=easternClock();if(typeof session.date!=='string'||session.date<clock.date||session.date>new Date(Date.now()+366*86400000).toISOString().slice(0,10)||(session.date===clock.date&&session.start<=clock.minutes))throw Error('Choose a future date and time within the next year.');
 const next={...c,teamSessionRevision:Number(c.teamSessionRevision||0)+1,bookableSessions:[...(c.bookableSessions||[]),session]};validateBookableSessions(next);
 const plan=(await db.query('SELECT plan_code,status FROM business_subscriptions WHERE business_id=$1',[a.business_id])).rows[0];
 const overrides=(await db.query('SELECT limits FROM business_entitlement_overrides WHERE business_id=$1',[a.business_id])).rows[0]?.limits||{};
 const limit=Number.isInteger(overrides.sessionSeries)?overrides.sessionSeries:planEntitlements(plan?.plan_code,plan?.status).limits.sessionSeries;
 if(next.bookableSessions.length>limit)throw Error('The business package session allowance is full. Ask the owner to remove an unused template or change the package.');
 const service=c.services.find(s=>s.id===session.service);
 const visits=(await accountAppointments(db,a)).filter(v=>!['Cancelled','No-show'].includes(v.status));
 const assignments=(await db.query('SELECT * FROM session_team_assignments WHERE business_id=$1',[a.business_id])).rows;
 const occurrences=(await db.query('SELECT * FROM session_team_occurrences WHERE business_id=$1',[a.business_id])).rows;
 for(const date of recurrenceDates(session)){
  if(isBlocked(c,date,a.staff_id,session.start,service.duration+c.buffer))throw Error('This session overlaps your time off or business time restrictions.');
  if(sessionsForDate(c,date).some(s=>s.staff!==a.staff_id&&(occurrences.find(x=>x.session_id===s.id&&x.session_date===date&&x.start_minute===s.start)?.staff_ids||assignments.find(x=>x.session_id===(s.seriesId||s.id))?.staff_ids||sessionTeamDefaults(c,s)).includes(a.staff_id)&&overlaps(session.start,service.duration+c.buffer,s.start,s.duration+c.buffer)))throw Error('This session overlaps another session assigned to you.');
  if(visits.some(v=>v.date===date&&overlaps(session.start,service.duration+c.buffer,v.start,v.duration+c.buffer)))throw Error('This session overlaps an existing appointment.');
 }
 await db.query('UPDATE settings SET data=$2 WHERE owner=$1',[a.owner_id,JSON.stringify(next)]);
 await db.query('INSERT INTO events(id,owner,created,kind,data) VALUES($1,$2,$3,$4,$5)',[randomUUID(),a.owner_id,new Date().toISOString(),'team_session_created',JSON.stringify({sessionId:session.id,staff:a.staff_id,actor:a.id})]);
 await db.query('COMMIT');return {ok:true,id:session.id,used:next.bookableSessions.length,limit};
 }catch(e){await db.query('ROLLBACK');if(!e.code)e.status=e.status||400;throw e;}finally{db.release();}
}
