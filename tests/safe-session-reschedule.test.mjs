import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {rescheduleSessionForOwner,validateSessionMoveInput,rescheduledConfig} from '../server/safe-session-reschedule.mjs';
import {sessionInstances,seriesOccurrences} from '../server/session-recurrence.mjs';
import {sessionsForDate,validateExistingSessionReservations,computeDayAvailability,selectedSession} from '../server/session-scheduling.mjs';
import {confirmBooking,serviceCapacityOpen} from '../server/booking-approvals.mjs';

const training={id:'training',name:'Small Group Training',duration:60,durationUnit:'minutes',price:40,maxSlots:1};
const evaluation={id:'evaluation',name:'Evaluation',duration:90,durationUnit:'minutes',price:65,maxSlots:1};
const staff=[{id:'coach-a',name:'Coach A',services:['training','evaluation']},
 {id:'coach-b',name:'Coach B',services:['training','evaluation']}];
const base={id:'soccer-group',date:'2026-11-02',staff:'coach-a',service:'training',start:720,capacity:3,
 repeat:{frequency:'weekly',every:1,until:'2026-12-07'}};
const config={name:'Training Studio',open:9,close:21,buffer:15,staff,services:[training,evaluation],bookableSessions:[base]};
const recurringId='soccer-group__20261109';
const recurringMove={
 sessionId:recurringId,sourceDate:'2026-11-09',expectedStart:720,
 expectedStaff:'coach-a',expectedService:'training',date:'2026-11-10',
 start:900,staff:'coach-b',service:'evaluation',capacity:4
};
async function setup(){
 const db=new PGlite();
 for(const file of ['001_initial.sql','003_platform_foundation.sql','007_booking_approval_requests.sql'])
  await db.exec(await readFile(new URL('../migrations/'+file,import.meta.url),'utf8'));
 await db.query("INSERT INTO users(id,email,password_hash) VALUES('owner','owner@example.com','x'),('other','other@example.com','x')");
 await db.query("INSERT INTO businesses(id,owner_id,slug,name,status) VALUES('b1','owner','owner-studio','Training Studio','active'),('b2','other','other-studio','Other Studio','active')");
 await db.query('INSERT INTO settings(owner,data) VALUES($1,$2),($3,$4)',[
  'owner',JSON.stringify(config),'other',JSON.stringify({...config,bookableSessions:[{...base,id:'other-group'}]})]);
 for(let i=1;i<=2;i++){
  const payload={name:'Customer '+i,email:'customer'+i+'@example.com',phone:'+1813555000'+i,
   sessionId:recurringId,serviceIds:['training'],services:['Small Group Training'],
   price:40,customAnswers:{level:'advanced'},originalSubmission:{customerName:'Customer '+i},
   externalPaymentId:'payment-'+i};
  await db.query("INSERT INTO appointments(id,owner,date,staff,start,duration,data,status) VALUES($1,'owner','2026-11-09','coach-a',720,60,$2,'Confirmed')",['customer-'+i,JSON.stringify(payload)]);
 }
 await db.query("INSERT INTO appointments(id,owner,date,staff,start,duration,data,status) VALUES('other-confirmed','other','2026-11-09','coach-a',720,60,'{\"sessionId\":\"other-group\"}','Confirmed')");
 const pending={sessionId:recurringId,customerName:'Pending Client',customerEmail:'pending@example.com',
  customerPhone:'123',staffId:'coach-a',date:'2026-11-09',start:720,duration:60,
  serviceIds:['training'],services:['Small Group Training'],customAnswers:{level:'beginner'},
  originalSubmission:{customerName:'Pending Client'},quotedPrice:40};
 await db.query("INSERT INTO booking_requests(id,business_id,owner_id,date,staff_id,start_minute,duration,details,reviewer) VALUES('pending-1','b1','owner','2026-11-09','coach-a',720,60,$1,'owner')",[JSON.stringify(pending)]);
 let queue=Promise.resolve();
 const pool={async connect(){
  const prior=queue;let release;queue=new Promise(resolve=>{release=resolve;});await prior;
  return {async query(sql,args){
    if(sql.includes('pg_advisory_xact_lock'))return {rows:[],rowCount:1};
    return db.query(sql,args);
   },release(){release();}};
 }};
 return {db,pool};
}
const rows=async(db,query,args=[])=> (await db.query(query,args)).rows;
test('session rescheduling request validates stable occurrence, quarter-hours and capacity',()=>{
 assert.deepEqual(validateSessionMoveInput(recurringMove),recurringMove);
 assert.throws(()=>validateSessionMoveInput({...recurringMove,start:901}),/valid session/i);
 assert.throws(()=>validateSessionMoveInput({...recurringMove,capacity:0}),/valid session/i);
 assert.throws(()=>validateSessionMoveInput({...recurringMove,date:'2026-11-31'}),/valid session/i);
 assert.throws(()=>validateSessionMoveInput({...recurringMove,sessionId:'../../b2'}),/valid session/i);
});
test('recurring occurrence override moves only one date, retains ID and preserves all other dates',()=>{
 const current=sessionInstances(config,'2026-11-09')[0];
 const next=rescheduledConfig(config,current,recurringMove);
 assert.equal(next.bookableSessions[0].date,'2026-11-02');
 assert.equal(next.bookableSessions[0].repeat.until,'2026-12-07');
 assert.equal(sessionInstances(next,'2026-11-09').length,0);
 assert.equal(sessionInstances(next,'2026-11-10')[0].id,recurringId);
 assert.equal(sessionInstances(next,'2026-11-10')[0].service,'evaluation');
 assert.equal(sessionInstances(next,'2026-11-16')[0].id,'soccer-group__20261116');
 assert.equal(seriesOccurrences(next,'soccer-group').length,6);
 assert.equal(selectedSession(next,'2026-11-10','coach-b',[evaluation],900).id,recurringId);
 assert.equal(next.sessionOverrides[0].originalDate,'2026-11-09');
 assert.equal(next.sessionOverrides[0].seriesId,'soccer-group');
 const newer=rescheduledConfig(next,sessionInstances(next,'2026-11-10')[0],{
  ...recurringMove,sourceDate:'2026-11-10',date:'2026-11-12',start:1020
 });
 assert.equal(newer.sessionOverrides.length,1,'Subsequent moves update the same occurrence');
 assert.equal(newer.sessionOverrides[0].originalDate,'2026-11-09');
 assert.equal(sessionInstances(newer,'2026-11-10').length,0);
 assert.equal(sessionInstances(newer,'2026-11-12')[0].id,recurringId);
});
test('atomic move carries existing confirmed customers and pending approvals, retaining client data, prices, records, and other tenants',async()=>{
 const {db,pool}=await setup();
 try{
  const outcome=await rescheduleSessionForOwner({owner:'owner',input:recurringMove,pool});
  assert.equal(outcome.ok,true);
  assert.equal(outcome.confirmedCustomersRetained,2);
  assert.equal(outcome.pendingRequestsRetained,1);
  assert.equal(outcome.sessionId,recurringId);
  const moved=await rows(db,"SELECT id,date,start,duration,staff,data,status FROM appointments WHERE owner='owner' ORDER BY id");
  assert.equal(moved.length,2);
  for(const booking of moved){
   assert.equal(booking.date,'2026-11-10');assert.equal(booking.start,900);
   assert.equal(booking.staff,'coach-b');assert.equal(booking.duration,90);
   assert.equal(booking.status,'Confirmed');
   const data=JSON.parse(booking.data);
   assert.equal(data.sessionId,recurringId);
   assert.equal(data.services[0],'Evaluation');
   assert.equal(data.serviceIds[0],'evaluation');
   assert.equal(data.price,40,'Original financial quote is preserved and no payment recreated');
   assert.equal(data.externalPaymentId,'payment-'+booking.id.slice(-1));
   assert.deepEqual(data.customAnswers,{level:'advanced'});
   assert.equal(data.sessionMoveHistory[0].from.date,'2026-11-09');
   assert.equal(data.sessionMoveHistory[0].to.date,'2026-11-10');
  }
  const pending=(await rows(db,"SELECT date,staff_id,start_minute,duration,status,details FROM booking_requests WHERE id='pending-1'"))[0];
  assert.equal(pending.date,'2026-11-10');assert.equal(pending.staff_id,'coach-b');
  assert.equal(pending.start_minute,900);assert.equal(pending.duration,90);
  assert.equal(pending.status,'pending');
  const details=JSON.parse(pending.details);
  assert.equal(details.sessionId,recurringId);
  assert.equal(details.customerEmail,'pending@example.com');
  assert.equal(details.customAnswers.level,'beginner');
  assert.equal(details.quotedPrice,40);
  assert.equal(details.serviceIds[0],'evaluation');
  const stored=JSON.parse((await rows(db,"SELECT data FROM settings WHERE owner='owner'"))[0].data);
  assert.equal(sessionInstances(stored,'2026-11-09').length,0);
  assert.equal(sessionInstances(stored,'2026-11-10')[0].id,recurringId);
  assert.equal(sessionInstances(stored,'2026-11-16')[0].start,720);
  assert.equal((await rows(db,"SELECT date,staff,start FROM appointments WHERE id='other-confirmed'"))[0].date,'2026-11-09');
  assert.equal((await rows(db,"SELECT data FROM settings WHERE owner='other'"))[0].data.includes('sessionOverrides'),false);
  const change=(await rows(db,"SELECT kind,data FROM events WHERE owner='owner'"))[0];
  assert.equal(change.kind,'session_rescheduled');
  assert.equal(JSON.parse(change.data).confirmedCustomersRetained,2);
  const availability=computeDayAvailability({config:stored,date:'2026-11-10',staff:'coach-b',
   services:[evaluation],appointments:moved,reservedSlots:[],today:'2026-11-01',
   nowMinutes:540,capacityOpen:serviceCapacityOpen});
  assert.equal(availability.sessionAvailability[900].remaining,2);
  assert.equal(availability.sessionAvailability[900].capacity,4);
  assert.doesNotThrow(()=>validateExistingSessionReservations(stored,stored,moved));
  // A new customer can still reserve remaining seats by the same immutable session ID.
  await confirmBooking({pool,owner:'owner',staff:'coach-b',services:[evaluation],date:'2026-11-10',
   start:900,duration:90,buffer:15,id:'after-move-booking',
   data:{name:'Later client',email:'new@example.com',sessionId:recurringId,serviceIds:['evaluation'],services:['Evaluation']}});
  assert.equal((await rows(db,"SELECT count(*)::int AS n FROM appointments WHERE owner='owner' AND date='2026-11-10'"))[0].n,3);
 }finally{await db.close();}
});
test('capacity reductions, overlapping normal appointments and same-series collisions reject atomically without moving anyone',async()=>{
 const {db,pool}=await setup();
 try{
  await assert.rejects(rescheduleSessionForOwner({owner:'owner',pool,input:{...recurringMove,capacity:1}}),/at least 2/i);
  assert.equal((await rows(db,"SELECT date FROM appointments WHERE id='customer-1'"))[0].date,'2026-11-09');
  await db.query("INSERT INTO appointments(id,owner,date,staff,start,duration,data,status) VALUES('busy','owner','2026-11-10','coach-b',900,60,'{\"name\":\"Different booking\"}','Confirmed')");
  await assert.rejects(rescheduleSessionForOwner({owner:'owner',pool,input:recurringMove}),/already has another customer/i);
  await assert.rejects(rescheduleSessionForOwner({owner:'owner',pool,input:{...recurringMove,date:'2026-11-16',staff:'coach-a',start:720,service:'training'}}),/overlap/i);
  assert.equal((await rows(db,"SELECT date FROM appointments WHERE id='customer-2'"))[0].date,'2026-11-09');
  assert.equal((await rows(db,"SELECT date FROM booking_requests WHERE id='pending-1'"))[0].date,'2026-11-09');
  assert.equal((await rows(db,"SELECT count(*)::int AS n FROM events WHERE owner='owner'"))[0].n,0);
  assert.equal((await rows(db,"SELECT data FROM settings WHERE owner='owner'"))[0].data.includes('sessionOverrides'),false);
 }finally{await db.close();}
});
test('other business owner cannot move this session; checked-in or completed attendance cannot be rewritten',async()=>{
 const {db,pool}=await setup();
 try{
  await assert.rejects(rescheduleSessionForOwner({owner:'other',pool,input:recurringMove}),/no longer on that date/i);
  await db.query("UPDATE appointments SET status='Checked in' WHERE id='customer-1'");
  await assert.rejects(rescheduleSessionForOwner({owner:'owner',pool,input:recurringMove}),/already checked in/i);
  assert.equal((await rows(db,"SELECT date FROM appointments WHERE id='customer-1'"))[0].date,'2026-11-09');
 }finally{await db.close();}
});
test('one-off session date, time, service, staff and capacity are updated in original config while keeping booking IDs',async()=>{
 const {db,pool}=await setup();
 try{
  const oneoff={id:'single-lesson',date:'2026-11-20',staff:'coach-a',service:'training',start:660,capacity:2};
  const changed={...config,bookableSessions:[...config.bookableSessions,oneoff]};
  await db.query("UPDATE settings SET data=$1 WHERE owner='owner'",[JSON.stringify(changed)]);
  await db.query("INSERT INTO appointments(id,owner,date,staff,start,duration,data,status) VALUES('oneoff-client','owner','2026-11-20','coach-a',660,60,$1,'Confirmed')",
   [JSON.stringify({name:'Private customer',email:'private@example.com',sessionId:'single-lesson',serviceIds:['training'],services:['Small Group Training'],customAnswers:{injuries:'None'}})]);
  const payload={sessionId:'single-lesson',sourceDate:'2026-11-20',expectedStart:660,
   expectedStaff:'coach-a',expectedService:'training',date:'2026-11-21',start:840,
   staff:'coach-b',service:'evaluation',capacity:2};
  const result=await rescheduleSessionForOwner({owner:'owner',pool,input:payload});
  assert.equal(result.confirmedCustomersRetained,1);
  const updated=JSON.parse((await rows(db,"SELECT data FROM settings WHERE owner='owner'"))[0].data);
  assert.equal(updated.bookableSessions.find(s=>s.id==='single-lesson').date,'2026-11-21');
  assert.equal(updated.sessionOverrides,undefined);
  const appointment=(await rows(db,"SELECT id,date,staff,start,duration,data FROM appointments WHERE id='oneoff-client'"))[0];
  assert.equal(appointment.id,'oneoff-client');
  assert.equal(appointment.date,'2026-11-21');
  assert.equal(appointment.staff,'coach-b');
  assert.equal(appointment.start,840);
  assert.equal(appointment.duration,90);
  assert.equal(JSON.parse(appointment.data).customAnswers.injuries,'None');
 }finally{await db.close();}
});
test('owner UI offers date/service/staff/time editor with an occurrence selector, and all calendars read overridable sessions',async()=>{
 const owner=await readFile(new URL('../app/studio/owner-dashboard.tsx',import.meta.url),'utf8');
 const route=await readFile(new URL('../app/api/studio/sessions/reschedule/route.ts',import.meta.url),'utf8');
 const renderer=await readFile(new URL('../server/session-recurrence.mjs',import.meta.url),'utf8');
 assert.match(owner,/Reschedule · keep customers/);
 assert.match(owner,/Which recurring session should change/);
 assert.match(owner,/Save new session schedule · keep customers/);
 assert.match(owner,/\/api\/studio\/sessions\/reschedule/);
 assert.match(owner,/sessionInstances\(config,d,staffId\)/);
 assert.match(owner,/openSessionReschedule\(session,true\)/);
 assert.match(route,/requireOwner\(req\)/);
 assert.match(route,/validOrigin\(req\)/);
 assert.match(renderer,/sessionOverrides/);
});
