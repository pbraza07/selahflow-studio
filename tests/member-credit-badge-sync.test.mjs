import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {hasUsableMembership,membershipDisplayStatus,remainingMembershipSessions} from '../server/member-badge-state.mjs';
import {loadOwnerMemberRoster,ownerAppointmentMember,decorateOwnerAppointments} from '../server/owner-appointment-members.mjs';
import {changeAppointmentStatus} from '../server/appointment-membership-usage.mjs';

async function fixture(){
 const db=new PGlite();
 await db.exec(`
 CREATE TABLE businesses(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL);
 CREATE TABLE membership_groups(id TEXT PRIMARY KEY,business_id TEXT NOT NULL,badge JSONB);
 CREATE TABLE membership_plans(id TEXT PRIMARY KEY,business_id TEXT NOT NULL,name TEXT,group_id TEXT,badge JSONB);
 CREATE TABLE customer_memberships(id TEXT PRIMARY KEY,business_id TEXT NOT NULL REFERENCES businesses(id),plan_id TEXT NOT NULL REFERENCES membership_plans(id),
 member_number TEXT NOT NULL,customer_name TEXT,customer_email TEXT,date_of_birth DATE,status TEXT NOT NULL,
 sessions_included INTEGER NOT NULL,sessions_used INTEGER NOT NULL,updated_at TIMESTAMPTZ DEFAULT now());
 CREATE TABLE customer_booking_ids(id TEXT PRIMARY KEY,business_id TEXT NOT NULL REFERENCES businesses(id),
 first_name TEXT,last_name TEXT,email TEXT,date_of_birth DATE,member_number TEXT NOT NULL);
 CREATE TABLE business_client_profiles(id TEXT PRIMARY KEY,owner TEXT,name TEXT,email TEXT,date_of_birth DATE,member_number TEXT,deleted_at TIMESTAMPTZ);
 CREATE TABLE appointments(id TEXT PRIMARY KEY,owner TEXT,date TEXT,status TEXT,data TEXT);
 CREATE TABLE slots(owner TEXT,date TEXT,staff TEXT,minute INTEGER,appointment TEXT);
 CREATE TABLE events(id TEXT PRIMARY KEY,owner TEXT,created TEXT,kind TEXT,data TEXT);
 `);
 await db.exec(await readFile(new URL('../migrations/024_membership_session_ledger.sql',import.meta.url),'utf8'));
 await db.exec(`
 INSERT INTO businesses VALUES('biz1','owner1'),('biz2','owner2');
 INSERT INTO membership_plans(id,business_id,name) VALUES('plan1','biz1','Membership Gold'),('otherPlan','biz2','Private Club');
 INSERT INTO customer_memberships(id,business_id,plan_id,member_number,customer_name,customer_email,date_of_birth,status,sessions_included,sessions_used)
 VALUES('member1','biz1','plan1','LA1103','Levi Alves','family@example.com','2017-11-03','active',2,0),
 ('other-member','biz2','otherPlan','LA1103','Levi Alves','family@example.com','2017-11-03','active',12,0);
 INSERT INTO customer_booking_ids VALUES('id1','biz1','John','Pereira','john@example.com','2010-02-28','JP0228');
 INSERT INTO business_client_profiles VALUES('profile1','owner1','John Pereira','john@example.com','2010-02-28','JP0228',NULL);
 `);
 await db.query('INSERT INTO appointments VALUES($1,$2,$3,$4,$5)',[
  'appt1','owner1','2026-10-13','Confirmed',JSON.stringify({name:'Levi Alves',email:'family@example.com',dateOfBirth:'2017-11-03',services:['Small Group']})
 ]);
 await db.query('INSERT INTO appointments VALUES($1,$2,$3,$4,$5)',[
  'appt2','owner1','2026-10-14','Confirmed',JSON.stringify({name:'John Pereira',email:'john@example.com',memberNumber:'JP0228'})
 ]);
 return db;
}
let n=0;
async function act(db,id,status){
 await db.exec('BEGIN');
 try{
  n++;
  const value=await changeAppointmentStatus(db,{owner:'owner1',appointmentId:id,status,
   eventId:'ev-'+n,ledgerId:'session-'+n,createdAt:'2026-10-13T12:00:00Z'});
  await db.exec('COMMIT');
  return value;
 }catch(e){await db.exec('ROLLBACK');throw e;}
}
test('overview links legacy appointments by unique full name, email and birth date to correct tenant and package',async()=>{
 const db=await fixture();
 try{
  const roster=await loadOwnerMemberRoster(db,'owner1');
  const appts=(await db.query("SELECT id,data FROM appointments WHERE owner='owner1'")).rows.map(x=>({id:x.id,...JSON.parse(x.data)}));
  const result=decorateOwnerAppointments(appts,roster);
  const gold=result.find(x=>x.id==='appt1');
  assert.equal(gold.memberNumber,'LA1103');
  assert.equal(gold.membershipName,'Membership Gold');
  assert.equal(gold.membershipHasCredits,true);
  assert.equal(gold.membershipSessionsRemaining,2);
  const regular=result.find(x=>x.id==='appt2');
  assert.equal(regular.memberNumber,'JP0228');
  assert.equal(regular.membershipName,null);
  assert.equal(regular.membershipHasCredits,false);
  assert.equal(roster.some(row=>row.membership_name==='Private Club'),false);
 }finally{await db.close();}
});

test('legacy appointment is linked permanently to same player on Check in and debited once',async()=>{
 const db=await fixture();
 try{
  const first=await act(db,'appt1','Checked in');
  assert.equal(first.memberNumber,'LA1103');
  assert.equal(first.membershipDeducted,true);
  assert.equal(first.membershipSessionsRemaining,1);
  const row=(await db.query("SELECT data FROM appointments WHERE id='appt1'")).rows[0];
  assert.equal(JSON.parse(row.data).memberNumber,'LA1103');
  const second=await act(db,'appt1','Completed');
  assert.equal(second.membershipDeducted,false);
  assert.equal(second.alreadyDeducted,false,'legacy completion is not a credit-consuming attendance action');
  assert.equal((await db.query("SELECT sessions_used FROM customer_memberships WHERE id='member1'")).rows[0].sessions_used,1);
  assert.equal((await db.query("SELECT COUNT(*)::int AS cnt FROM membership_session_ledger WHERE membership_id='member1' AND event_type='session_used'")).rows[0].cnt,1);
 }finally{await db.close();}
});

test('exhausted membership uses neutral ID badge and reverts to Gold after renewal, preserving ledger history',async()=>{
 const db=await fixture();
 try{
  const before={status:'active',sessions_included:2,sessions_used:1};
  assert.equal(hasUsableMembership(before),true);
  assert.equal(membershipDisplayStatus(before),'active');
  await db.query("UPDATE customer_memberships SET sessions_used=2 WHERE id='member1'");
  await db.query("INSERT INTO membership_session_ledger(id,business_id,membership_id,appointment_id,event_type,session_delta) VALUES('usage1','biz1','member1','appt1','session_used',-1)");
  let member=(await db.query("SELECT status,sessions_included,sessions_used FROM customer_memberships WHERE id='member1'")).rows[0];
  assert.equal(membershipDisplayStatus(member),'exhausted');
  assert.equal(hasUsableMembership(member),false);
  assert.equal(remainingMembershipSessions(member.sessions_included,member.sessions_used),0);
  let roster=await loadOwnerMemberRoster(db,'owner1');
  let appt=decorateOwnerAppointments([{memberNumber:'LA1103',name:'Levi Alves',email:'family@example.com'}],roster)[0];
  assert.equal(appt.membershipHasCredits,false);
  assert.equal(appt.membershipSessionsRemaining,0);
  // Renewal is additive; the same member ID and all previous usage remain.
  await db.exec("INSERT INTO membership_session_ledger(id,business_id,membership_id,appointment_id,event_type,session_delta) VALUES('renew1','biz1','member1','payment-request-2','payment_confirmed',2)");
  await db.exec("UPDATE customer_memberships SET sessions_included=sessions_included+2,status='active' WHERE id='member1'");
  member=(await db.query("SELECT status,sessions_included,sessions_used FROM customer_memberships WHERE id='member1'")).rows[0];
  assert.equal(member.sessions_included,4);
  assert.equal(member.sessions_used,2);
  assert.equal(membershipDisplayStatus(member),'active');
  roster=await loadOwnerMemberRoster(db,'owner1');
  appt=decorateOwnerAppointments([{memberNumber:'LA1103',name:'Levi Alves',email:'family@example.com'}],roster)[0];
  assert.equal(appt.membershipHasCredits,true);
  assert.equal(appt.membershipSessionsRemaining,2);
  const history=(await db.query("SELECT event_type FROM membership_session_ledger WHERE membership_id='member1' ORDER BY created_at,id")).rows;
  assert.deepEqual(history.map(h=>h.event_type).sort(),['payment_confirmed','session_used']);
 }finally{await db.close();}
});

test('ambiguous legacy name and email cannot be linked to wrong member ID',()=>{
 const rec={name:'Alex Brown',email:'parent@example.com'};
 const same=[{source:'membership',name:'Alex Brown',email:'parent@example.com',member_number:'AB0315'},
  {source:'booking',name:'Alex Brown',email:'parent@example.com',member_number:'AB0615'}];
 assert.equal(ownerAppointmentMember(rec,same).memberNumber,'');
 assert.equal(ownerAppointmentMember({...rec,memberNumber:'AB0615'},same).memberNumber,'AB0615');
});

test('Overview, Clients and Members all render the same badge with live remaining-credit counts',async()=>{
 const [ui,clients,members,api,helper]=await Promise.all([
  readFile(new URL('../app/studio/owner-dashboard.tsx',import.meta.url),'utf8'),
  readFile(new URL('../app/components/owner-client-directory.tsx',import.meta.url),'utf8'),
  readFile(new URL('../app/components/owner-memberships.tsx',import.meta.url),'utf8'),
  readFile(new URL('../app/api/studio/memberships/route.ts',import.meta.url),'utf8'),
  readFile(new URL('../server/appointment-membership-usage.mjs',import.meta.url),'utf8')
 ]);
 assert.match(ui,/<MembershipBadge memberNumber=\{a\.memberNumber\}/);
 assert.match(ui,/sessionsIncluded=\{a\.membershipSessionsIncluded\}/);
 assert.match(ui,/sessionsUsed=\{a\.membershipSessionsUsed\}/);
 assert.match(clients,/sessionsIncluded=\{selected\.membershipDetails\?\.sessionsIncluded\}/);
 assert.match(members,/sessionsIncluded=\{m\.sessions_included\}/);
 assert.match(api,/sessions_included=sessions_included\+\$1/);
 assert.match(api,/COUNT\(\*\)::int AS recorded_sessions/);
 assert.match(helper,/if\(remaining<=0\)return \{deducted:false/);
});
