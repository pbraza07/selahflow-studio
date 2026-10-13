import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {changeAppointmentStatus,debitAppointmentMembershipSession,CREDIT_CONSUMING_STATUSES} from '../server/appointment-membership-usage.mjs';

async function fixture(){
 const db=new PGlite();
 await db.exec(`
  CREATE TABLE businesses(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL);
  CREATE TABLE customer_memberships(
   id TEXT PRIMARY KEY,business_id TEXT NOT NULL REFERENCES businesses(id),
   member_number TEXT,status TEXT NOT NULL,sessions_included INTEGER NOT NULL DEFAULT 0,
   sessions_used INTEGER NOT NULL DEFAULT 0,updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE TABLE appointments(id TEXT PRIMARY KEY,owner TEXT NOT NULL,date TEXT NOT NULL,status TEXT NOT NULL,data TEXT NOT NULL);
  CREATE TABLE slots(owner TEXT NOT NULL,date TEXT NOT NULL,staff TEXT NOT NULL,minute INTEGER NOT NULL,appointment TEXT NOT NULL,
   PRIMARY KEY(owner,date,staff,minute));
  CREATE TABLE events(id TEXT PRIMARY KEY,owner TEXT NOT NULL,created TEXT NOT NULL,kind TEXT NOT NULL,data TEXT NOT NULL);
 `);
 await db.exec(await readFile(new URL('../migrations/024_membership_session_ledger.sql',import.meta.url),'utf8'));
 await db.query("INSERT INTO businesses(id,owner_id) VALUES('b1','owner1'),('b2','owner2')");
 await db.query("INSERT INTO customer_memberships(id,business_id,member_number,status,sessions_included,sessions_used) VALUES('m1','b1','TA0315','active',2,0),('m2','b2','TA0315','active',2,0),('m3','b1','IN0101','pending_payment',2,0)");
 const visits=[
  ['a1','owner1','TA0315'],['a2','owner1','TA0315'],['a3','owner1','TA0315'],
  ['a4','owner1',''],['a5','owner1','IN0101'],['foreign','owner2','TA0315'],
  ['unmatched','owner1','BB0404']
 ];
 for(const [id,owner,memberNumber] of visits)
  await db.query('INSERT INTO appointments(id,owner,date,status,data) VALUES($1,$2,$3,$4,$5)',
   [id,owner,'2026-10-13','Confirmed',JSON.stringify({memberNumber,name:id})]);
 await db.query("INSERT INTO slots(owner,date,staff,minute,appointment) VALUES('owner1','2026-10-13','coach',540,'a1'),('owner1','2026-10-13','coach',600,'a2')");
 return db;
}
let sequence=0;
async function apply(db,appointmentId,status,owner='owner1'){
 ++sequence;
 await db.exec('BEGIN');
 try{
  const result=await changeAppointmentStatus(db,{
   appointmentId,owner,status,eventId:'event-'+sequence,
   ledgerId:'ledger-'+sequence,createdAt:new Date('2026-10-13T10:00:00Z').toISOString()
  });
  await db.exec('COMMIT');
  return result;
 }catch(e){await db.exec('ROLLBACK');throw e;}
}
async function used(db,id='m1'){
 return Number((await db.query('SELECT sessions_used FROM customer_memberships WHERE id=$1',[id])).rows[0].sessions_used);
}
async function ledger(db,id='m1'){
 return Number((await db.query("SELECT COUNT(*)::int AS n FROM membership_session_ledger WHERE membership_id=$1 AND event_type='session_used'",[id])).rows[0].n);
}

test('check-in immediately consumes one active membership session, and completion does not charge again',async()=>{
 const db=await fixture();
 try{
  const checked=await apply(db,'a1','Checked in');
  assert.equal(checked.membershipDeducted,true);
  assert.equal(checked.membershipSessionsRemaining,1);
  assert.equal(await used(db),1);
  assert.equal(await ledger(db),1);
  const completed=await apply(db,'a1','Completed');
  assert.equal(completed.membershipDeducted,false);
  assert.equal(completed.alreadyDeducted,true);
  assert.equal(await used(db),1);
  assert.equal(await ledger(db),1);
  const again=await apply(db,'a1','Completed');
  assert.equal(again.alreadyProcessed,true);
  assert.equal(await used(db),1);
  assert.equal(await ledger(db),1);
  const audit=(await db.query("SELECT data FROM events WHERE id='event-1'")).rows[0];
  assert.equal(JSON.parse(audit.data).membershipDeducted,true);
 }finally{await db.close();}
});

test('no-show directly deducts one session, releases slot, and repeat no-show is idempotent',async()=>{
 const db=await fixture();
 try{
  const result=await apply(db,'a2','No-show');
  assert.equal(result.membershipDeducted,true);
  assert.equal(result.membershipSessionsRemaining,1);
  assert.equal(await used(db),1);
  assert.equal(await ledger(db),1);
  assert.equal((await db.query("SELECT COUNT(*)::int AS n FROM slots WHERE appointment='a2'")).rows[0].n,0);
  assert.equal((await db.query("SELECT status FROM appointments WHERE id='a2'")).rows[0].status,'No-show');
  const second=await apply(db,'a2','No-show');
  assert.equal(second.alreadyProcessed,true);
  assert.equal(await used(db),1);
  assert.equal(await ledger(db),1);
  const corrected=await apply(db,'a2','Checked in');
  assert.equal(corrected.alreadyDeducted,true);
  assert.equal(await used(db),1);
  assert.equal(await ledger(db),1);
 }finally{await db.close();}
});

test('check-in followed by no-show is a single session deduction',async()=>{
 const db=await fixture();
 try{
  await apply(db,'a1','Checked in');
  const result=await apply(db,'a1','No-show');
  assert.equal(result.alreadyDeducted,true);
  assert.equal(result.membershipDeducted,false);
  assert.equal(await used(db),1);
  assert.equal(await ledger(db),1);
  assert.equal((await db.query("SELECT COUNT(*)::int AS n FROM slots WHERE appointment='a1'")).rows[0].n,0);
 }finally{await db.close();}
});

test('exhausted members become regular attendees and do not use additional prepaid credits',async()=>{
 const db=await fixture();
 try{
  await apply(db,'a1','Checked in');
  await apply(db,'a2','No-show');
  assert.equal(await used(db),2);
  assert.equal(await ledger(db),2);
  const result=await apply(db,'a3','Checked in');
  assert.equal(result.membershipExhausted,true);
  assert.equal(result.membershipDeducted,false);
  assert.equal(result.membershipSessionsRemaining,0);
  assert.equal((await db.query("SELECT status FROM appointments WHERE id='a3'")).rows[0].status,'Checked in');
  assert.equal(await used(db),2);
  assert.equal(await ledger(db),2);
  const noShow=await apply(db,'a3','No-show');
  assert.equal(noShow.membershipExhausted,true);
  assert.equal(noShow.membershipDeducted,false);
  assert.equal(await used(db),2);
  assert.equal(await ledger(db),2);
 }finally{await db.close();}
});

test('no plan, pending plan, and other business memberships do not consume sessions',async()=>{
 const db=await fixture();
 try{
  const ordinary=await apply(db,'a4','No-show');
  assert.equal(ordinary.membershipDeducted,false);
  const pending=await apply(db,'a5','Checked in');
  assert.equal(pending.memberFound,true);
  assert.equal(pending.membershipDeducted,false);
  const unmatched=await apply(db,'unmatched','No-show');
  assert.equal(unmatched.memberFound,false);
  assert.equal(await used(db,'m1'),0);
  assert.equal(await used(db,'m3'),0);
  assert.equal(await ledger(db,'m1'),0);
  const tenant=await apply(db,'foreign','No-show','owner2');
  assert.equal(tenant.membershipDeducted,true);
  assert.equal(await used(db,'m2'),1);
  assert.equal(await used(db,'m1'),0);
  const impossible=await apply(db,'foreign','No-show','owner1');
  assert.equal(impossible.notFound,true);
 }finally{await db.close();}
});

test('cancellations do not deduct credits; completing without check-in still charges once',async()=>{
 const db=await fixture();
 try{
  const cancelled=await apply(db,'a1','Cancelled');
  assert.equal(cancelled.membershipDeducted,false);
  assert.equal(await used(db),0);
  const completed=await apply(db,'a2','Completed');
  assert.equal(completed.membershipDeducted,true);
  assert.equal(await used(db),1);
 }finally{await db.close();}
});

test('overview exposes Check in, Complete and No-show; status handler uses the atomic helper',async()=>{
 assert.deepEqual([...CREDIT_CONSUMING_STATUSES].sort(),['Checked in','Completed','No-show'].sort());
 const [ui,api]=await Promise.all([
  readFile(new URL('../app/studio/owner-dashboard.tsx',import.meta.url),'utf8'),
  readFile(new URL('../lib/studio-handler.ts',import.meta.url),'utf8')
 ]);
 assert.match(ui,/<AttendanceActions/);
 assert.match(ui,/as a no-show/);
 assert.match(ui,/1 membership session deducted/);
 assert.match(api,/await changeAppointmentStatus\(client/);
 assert.match(api,/await client\.query\('COMMIT'\)/);
 assert.match(api,/await client\.query\('ROLLBACK'\)/);
});

test('correcting a no-show restores ordinary capacity and rejects a rebooked time atomically',async()=>{
 const db=await fixture();try{
  await db.exec("ALTER TABLE appointments ADD COLUMN staff TEXT; ALTER TABLE appointments ADD COLUMN start INTEGER; ALTER TABLE appointments ADD COLUMN duration INTEGER; CREATE TABLE settings(owner TEXT PRIMARY KEY,data TEXT);");
  await db.query('INSERT INTO settings VALUES($1,$2)',['owner1',JSON.stringify({buffer:0,services:[],bookableSessions:[]})]);
  await db.query("UPDATE appointments SET staff='coach',start=600,duration=30 WHERE id='a2'");
  await apply(db,'a2','No-show');await apply(db,'a2','Checked in');
  assert.deepEqual((await db.query("SELECT minute FROM slots WHERE appointment='a2' ORDER BY minute")).rows.map(r=>r.minute),[600,615]);
  assert.equal(await used(db),1);
  await apply(db,'a2','No-show');
  await db.query("UPDATE appointments SET staff='coach',start=600,duration=30 WHERE id='a3'");
  await assert.rejects(apply(db,'a2','Checked in'),/rebooked/);
  assert.equal((await db.query("SELECT status FROM appointments WHERE id='a2'")).rows[0].status,'No-show');
  assert.equal(await ledger(db),1);
 }finally{await db.close();}
});
