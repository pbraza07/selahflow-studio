import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {setSessionFullForOwner} from '../server/session-full.mjs';
import {sessionInstances} from '../server/session-recurrence.mjs';
import {sessionRemaining,computeDayAvailability} from '../server/session-scheduling.mjs';
import {sessionRosterForOwner} from '../server/session-roster.mjs';
import {sessionIsFull} from '../server/session-capacity.mjs';
import {confirmBooking} from '../server/booking-approvals.mjs';
const service={id:'training',name:'Training',duration:60,price:40};
const config={open:9,close:20,buffer:0,services:[service],staff:[{id:'coach',services:['training']}],bookableSessions:[{id:'group',date:'2026-11-02',start:600,staff:'coach',service:'training',capacity:10,repeat:{frequency:'weekly',every:1,until:'2026-11-30'}}]};
const id='group__20261109',date='2026-11-09';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('manual full status preserves visible recurring sessions and roster; reopening restores actual seats',()=>{
 const closed={...config,fullSessionIds:[id]};
 const [session]=sessionInstances(closed,date);
 const appointments=[{id:'existing',sessionId:id,date,status:'Confirmed',name:'Existing customer'}];
 assert.equal(session.capacity,10);
 assert.equal(sessionRemaining(session,appointments),0);
 assert.equal(sessionRemaining(sessionInstances(closed,'2026-11-16')[0],[]),10);
 const roster=sessionRosterForOwner(session,appointments);
 assert.equal(roster.booked,1);assert.equal(roster.clients.length,1);assert.equal(roster.remaining,0);
 const availability=computeDayAvailability({config:closed,date,staff:'coach',services:[service],appointments,reservedSlots:[],today:'2026-11-01',nowMinutes:0,capacityOpen:()=>true});
 assert.equal(availability.sessions.length,1);assert.equal(availability.sessions[0].remaining,0);
 assert.equal(availability.slots.includes(600),false);
 assert.equal(sessionRemaining(sessionInstances(config,date)[0],appointments),9);
 const moved={...closed,sessionOverrides:[{...session,date:'2026-11-10',seriesId:'group',originalDate:date}]};
 assert.equal(sessionInstances(moved,'2026-11-10')[0].manuallyFull,true);
});

test('owner closure persists under schedule lock, isolates tenants, blocks stale booking and pending approval, and reopens safely',async()=>{
 const db=new PGlite();
 try{
  for(const file of ['001_initial.sql','003_platform_foundation.sql','007_booking_approval_requests.sql'])await db.exec(await read('migrations/'+file));
  await db.query("INSERT INTO users(id,email,password_hash) VALUES('owner','owner@example.com','x'),('other','other@example.com','x')");
  await db.query("INSERT INTO businesses(id,owner_id,slug,name,status) VALUES('b','owner','studio','Studio','active'),('b2','other','other','Other','active')");
  await db.query('INSERT INTO settings(owner,data) VALUES($1,$2),($3,$4)',['owner',JSON.stringify(config),'other',JSON.stringify({...config,bookableSessions:[]})]);
  const data={sessionId:id,name:'Existing',services:['Training'],serviceIds:['training'],price:40};
  await db.query("INSERT INTO appointments(id,owner,date,staff,start,duration,data,status) VALUES('existing','owner',$1,'coach',600,60,$2,'Confirmed')",[date,JSON.stringify(data)]);
  await db.query("INSERT INTO booking_requests(id,business_id,owner_id,date,staff_id,start_minute,duration,details,reviewer) VALUES('pending','b','owner',$1,'coach',600,60,$2,'owner')",[date,JSON.stringify(data)]);
  const calls=[];
  const pool={async connect(){return {async query(sql,args){calls.push([sql,args]);if(sql.includes('pg_advisory_xact_lock'))return {rows:[]};return db.query(sql,args);},release(){}};}};
  const input={sessionId:id,date,full:true};
  const result=await setSessionFullForOwner({owner:'owner',input,pool});
  assert.deepEqual(result.fullSessionIds,[id]);
  assert.ok(calls.some(([sql,args])=>sql.includes('pg_advisory_xact_lock')&&args[0]==='owner:schedule'));
  const saved=JSON.parse((await db.query("SELECT data FROM settings WHERE owner='owner'")).rows[0].data);
  assert.equal(await sessionIsFull(db,{owner:'owner',config:saved,date,staff:'coach',services:[service],start:600}),true);
  for(const pendingId of [null,'pending'])await assert.rejects(confirmBooking({pool,owner:'owner',services:[service],staff:'coach',date,start:600,duration:60,buffer:0,id:'new',data:{...data},pendingId}),/Session is now full/);
  assert.equal((await db.query("SELECT count(*)::int AS n FROM appointments")).rows[0].n,1);
  assert.equal((await db.query("SELECT status FROM booking_requests WHERE id='pending'")).rows[0].status,'pending');
  await assert.rejects(setSessionFullForOwner({owner:'other',input,pool}),/changed or was removed/);
  await assert.rejects(setSessionFullForOwner({owner:'owner',input:{...input,date:'2026-11-10'},pool}),/changed or was removed/);
  await assert.rejects(setSessionFullForOwner({owner:'owner',input:{...input,full:'true'},pool}),/valid session/);
  await setSessionFullForOwner({owner:'owner',input:{...input,full:false},pool});
  const reopened=JSON.parse((await db.query("SELECT data FROM settings WHERE owner='owner'")).rows[0].data);
  assert.equal(sessionRemaining(sessionInstances(reopened,date)[0],[{...data,status:'Confirmed'}]),9);
  assert.deepEqual(reopened.bookableSessions,config.bookableSessions);
  assert.deepEqual(JSON.parse((await db.query("SELECT data FROM appointments WHERE id='existing'")).rows[0].data),data);
 }finally{await db.close();}
});

test('owner control saves independently of settings and public/team actions cannot set closure',async()=>{
 const handler=await read('lib/studio-handler.ts');
 assert.match(handler,/if\(b.action==='session_full'\)\{\s*if\(isPublic\|\|isTeam\)/);
 assert.match(handler,/fullSessionIds:oldConfig.fullSessionIds\|\|\[\]/);
 const ui=await read('app/studio/owner-dashboard.tsx');
 assert.match(ui,/checked=\{selectedRosterSession.manuallyFull===true\}/);
 assert.match(ui,/action:'session_full',sessionId:selectedRosterSession.id/);
});
