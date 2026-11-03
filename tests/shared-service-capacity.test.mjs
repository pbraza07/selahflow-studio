import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {computeDayAvailability} from '../server/session-scheduling.mjs';
import {confirmBooking,serviceCapacityOpen} from '../server/booking-approvals.mjs';
const service={id:'private',name:'Private Session',duration:60,price:90,maxSlots:6,shareTeamSlots:true};
const config={open:9,close:18,buffer:15,services:[service],staff:[{id:'coach',services:['private']}],bookableSessions:[]};
const date='2026-11-10';
const booking=i=>({id:'b'+i,staff:'coach',start:600,duration:60,status:'Confirmed',data:JSON.stringify({serviceIds:['private']})});
const day=(appointments,services=[service],reservedSlots=[])=>computeDayAvailability({config:{...config,services},date,staff:'coach',services,appointments,reservedSlots,today:'2026-11-01',nowMinutes:0,capacityOpen:serviceCapacityOpen});
test('opted-in private time remains available until six bookings; legacy reservations, cancellation and other services are safe',()=>{
 for(let n=0;n<6;n++){const rows=Array.from({length:n},(_,i)=>booking(i));const result=day(rows,[service],n?[{minute:600,appointment:'b0'}]:[]);assert.ok(result.slots.includes(600));assert.equal(result.sessionAvailability[600].remaining,6-n);}
 const full=Array.from({length:6},(_,i)=>booking(i));assert.ok(!day(full).slots.includes(600));
 assert.ok(day(full.map((a,i)=>i===0?{...a,status:'Cancelled'}:a)).slots.includes(600));
 assert.ok(!day([booking(0)],[{...service,shareTeamSlots:false}]).slots.includes(600));
 assert.ok(!day([booking(0)]).slots.includes(615),'staggered starts remain exclusive');
 assert.ok(!day([{...booking(0),data:JSON.stringify({serviceIds:['other']})}]).slots.includes(600));
 assert.ok(!day([{...booking(0),data:JSON.stringify({serviceIds:['private'],sessionId:'group'})}]).slots.includes(600));
 assert.ok(!day([],[service],[600]).slots.includes(600),'unidentified slot locks remain exclusive');
 assert.ok(!day([{...booking(0),duration:90}]).slots.includes(600));
 assert.ok(!day([booking(0)],[{...service,maxSlots:1}]).slots.includes(600));
});
test('atomic confirmations enforce six seats with legacy slot locks, current policy and competing requests',async()=>{
 const db=new PGlite();try{
 await db.exec(await readFile(new URL('../migrations/001_initial.sql',import.meta.url),'utf8'));
 await db.query("INSERT INTO users(id,email,password_hash) VALUES('owner','owner@example.test','x')");
 await db.query('INSERT INTO settings(owner,data) VALUES($1,$2)',['owner',JSON.stringify(config)]);
 let queue=Promise.resolve();const pool={async connect(){const prior=queue;let release;queue=new Promise(r=>release=r);await prior;return {query:(sql,args)=>sql.includes('pg_advisory_xact_lock')?Promise.resolve({rows:[]}):db.query(sql,args),release};}};
 const options=id=>({pool,owner:'owner',services:[service],staff:'coach',date,start:600,duration:60,buffer:15,id,data:{serviceIds:['private'],services:['Private Session']}});
 await db.query("INSERT INTO appointments(id,owner,date,staff,start,duration,status,data) VALUES('legacy','owner',$1,'coach',600,60,'Confirmed',$2)",[date,JSON.stringify({serviceIds:['private']})]);
 for(let minute=600;minute<675;minute+=15)await db.query("INSERT INTO slots(owner,date,staff,minute,appointment) VALUES('owner',$1,'coach',$2,'legacy')",[date,minute]);
 const results=await Promise.allSettled(Array.from({length:6},(_,i)=>confirmBooking(options('new'+i))));
 assert.equal(results.filter(r=>r.status==='fulfilled').length,5);assert.equal(results.filter(r=>r.status==='rejected'&&r.reason.status===409).length,1);
 assert.equal((await db.query('SELECT count(*)::int AS n FROM appointments')).rows[0].n,6);
 await db.query("UPDATE appointments SET status='Cancelled' WHERE id='new0'");await confirmBooking(options('replacement'));
 await db.query("UPDATE appointments SET status='Cancelled' WHERE id='new1'");
 await db.query('UPDATE settings SET data=$1',[JSON.stringify({...config,services:[{...service,shareTeamSlots:false}]})]);
 await assert.rejects(confirmBooking(options('stale-policy')),/already has another appointment/);
 await db.query('UPDATE settings SET data=$1',[JSON.stringify(config)]);
 await assert.rejects(confirmBooking({...options('staggered'),start:615}),/already has another appointment/);
 }finally{await db.close();}
});

test('Arcila migration enables only its exact private service, preserves six slots and is replay-safe',async()=>{
 const db=new PGlite();try{
 for(const f of ['001_initial.sql','002_public_booking.sql','003_platform_foundation.sql','004_business_customization.sql','005_business_approval_terms.sql','006_marketplace_active_businesses.sql'])await db.exec(await readFile(new URL('../migrations/'+f,import.meta.url),'utf8'));
 const privateService={...service,id:'1e0d1116-96e5-4a43-ad5c-8ea3e451c734'};delete privateService.shareTeamSlots;
 const saved={...config,services:[privateService,{...service,id:'group',shareTeamSlots:false}],teamSessionRevision:4};
 for(const [owner,slug] of [['owner','arcillatrng'],['other','another-business']]){
 await db.query('INSERT INTO users(id,email,password_hash) VALUES($1,$2,$3)',[owner,owner+'@example.test','x']);
 await db.query("INSERT INTO businesses(id,owner_id,slug,name,industry,status,is_listed) VALUES($1,$1,$2,'Business','fitness','active',true)",[owner,slug]);
 await db.query('INSERT INTO settings(owner,data) VALUES($1,$2)',[owner,JSON.stringify(saved)]);
 }
 const migration=await readFile(new URL('../migrations/088_arcila_private_shared_slots.sql',import.meta.url),'utf8');await db.exec(migration);await db.exec(migration);
 const rows=(await db.query('SELECT owner,data FROM settings')).rows;
 const arcila=JSON.parse(rows.find(r=>r.owner==='owner').data);assert.deepEqual(arcila,{...saved,services:[{...privateService,shareTeamSlots:true},saved.services[1]],teamSessionRevision:5});
 assert.deepEqual(JSON.parse(rows.find(r=>r.owner==='other').data),saved);
 assert.equal((await db.query('SELECT count(*)::int AS n FROM events')).rows[0].n,1);
 }finally{await db.close();}
});
test('restoring a no-show cannot overfill shared private service capacity',async()=>{
 const {changeAppointmentStatus}=await import('../server/appointment-membership-usage.mjs');
 const writes=[];const client={async query(sql){
  if(sql.includes('pg_advisory_xact_lock'))return {rows:[]};
  if(sql.includes('FOR UPDATE'))return {rows:[{...booking('restore'),owner:'owner',date,status:'No-show'}]};
  if(sql.includes('SELECT data FROM settings'))return {rows:[{data:JSON.stringify(config)}]};
  if(sql.includes('SELECT * FROM appointments'))return {rows:Array.from({length:6},(_,i)=>booking(i))};
  writes.push(sql);throw Error('Unexpected write');
 }};
 await assert.rejects(changeAppointmentStatus(client,{owner:'owner',appointmentId:'restore',status:'Checked in'}),/Service capacity has been reached/);
 assert.deepEqual(writes,[]);
});
