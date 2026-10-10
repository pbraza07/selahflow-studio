import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {recurringSessionForDate,sessionInstances,recurrenceDates,recurrenceOccursOn,expandAllSessions,validateRecurrence} from '../server/session-recurrence.mjs';
import {validateBookableSessions,validateExistingSessionReservations,computeDayAvailability,selectedSession,sessionRemaining} from '../server/session-scheduling.mjs';
import {confirmBooking,serviceCapacityOpen} from '../server/booking-approvals.mjs';

const service={id:'training',name:'Group Training',duration:60,durationUnit:'minutes',price:35,maxSlots:1};
const team={id:'coach',name:'Coach',services:['training']};
const base={id:'repeat-group',date:'2026-11-02',staff:'coach',service:'training',start:720,capacity:3};
const rule={frequency:'weekly',every:1,until:'2026-12-07'};
const config={open:9,close:18,buffer:15,staff:[team],services:[service],bookableSessions:[{...base,repeat:rule}]};
const occurrence='repeat-group__20261109';

test('weekly repetition and custom 2-week interval end on inclusive end date',()=>{
 const weekly=config.bookableSessions[0];
 assert.deepEqual(recurrenceDates(weekly),['2026-11-02','2026-11-09','2026-11-16','2026-11-23','2026-11-30','2026-12-07']);
 assert.equal(sessionInstances(config,'2026-11-09').length,1);
 assert.equal(sessionInstances(config,'2026-11-10').length,0);
 assert.equal(sessionInstances(config,'2026-12-14').length,0);
 assert.equal(sessionInstances(config,'2026-11-02')[0].id,'repeat-group','Original date retains prior booking ID');
 assert.equal(sessionInstances(config,'2026-11-09')[0].id,occurrence);
 const biweekly={...base,repeat:{frequency:'weekly',every:2,until:'2026-12-07'}};
 assert.deepEqual(recurrenceDates(biweekly),['2026-11-02','2026-11-16','2026-11-30']);
 assert.equal(validateBookableSessions({...config,bookableSessions:[biweekly]}).length,1);
});

test('daily repetition and monthly recurrence skip nonexistent dates without UTC/DST drift',()=>{
 const daily={...base,repeat:{frequency:'daily',every:2,until:'2026-11-08'}};
 assert.deepEqual(recurrenceDates(daily),['2026-11-02','2026-11-04','2026-11-06','2026-11-08']);
 const monthly={...base,date:'2027-01-31',repeat:{frequency:'monthly',every:1,until:'2027-06-30'}};
 assert.deepEqual(recurrenceDates(monthly),['2027-01-31','2027-03-31','2027-05-31']);
 const leap={...base,date:'2028-01-29',repeat:{frequency:'monthly',every:1,until:'2028-04-30'}};
 assert.deepEqual(recurrenceDates(leap),['2028-01-29','2028-02-29','2028-03-29','2028-04-29']);
 assert.equal(recurrenceOccursOn(monthly,'2027-03-31'),true);
 assert.equal(recurrenceOccursOn(monthly,'2027-02-28'),false);
 assert.equal(recurringSessionForDate(monthly,'2027-03-31').id,'repeat-group__20270331');
});

test('validates recurrence end date, frequency, interval and bounded horizon',()=>{
 assert.equal(validateRecurrence(base),null);
 assert.throws(()=>validateRecurrence({...base,repeat:{frequency:'yearly',every:1,until:'2027-01-02'}}),/recurrence/i);
 assert.throws(()=>validateRecurrence({...base,repeat:{frequency:'weekly',every:0,until:'2027-01-02'}}),/recurrence/i);
 assert.throws(()=>validateRecurrence({...base,repeat:{frequency:'weekly',every:1,until:'2026-10-30'}}),/end date/i);
 assert.throws(()=>validateRecurrence({...base,repeat:{frequency:'daily',every:1,until:'2030-11-02'}}),/two years/i);
 assert.throws(()=>validateRecurrence({...base,repeat:{frequency:'daily',every:1,until:'2026-02-30'}}),/end date/i);
 const large={...base,repeat:{frequency:'daily',every:1,until:'2028-10-31'}};
 assert.throws(()=>expandAllSessions({...config,bookableSessions:[large]},10),/Too many/i);
});

test('overlaps check repeats versus one-time sessions and versus another recurrence',()=>{
 assert.doesNotThrow(()=>validateBookableSessions(config));
 const conflicting={...base,id:'single-conflict',date:'2026-11-16',start:750};
 assert.throws(()=>validateBookableSessions({...config,bookableSessions:[...config.bookableSessions,conflicting]}),/overlap/i);
 const parallel={...base,id:'other-repeat',date:'2026-11-09',start:720,
  repeat:{frequency:'weekly',every:1,until:'2026-11-30'}};
 assert.throws(()=>validateBookableSessions({...config,bookableSessions:[...config.bookableSessions,parallel]}),/overlap/i);
 const otherCoach={...team,id:'coach-two'};
 assert.doesNotThrow(()=>validateBookableSessions({...config,staff:[team,otherCoach],
  bookableSessions:[...config.bookableSessions,{...parallel,staff:'coach-two'}]}));
});

test('each recurrence date has independent seat counts and displays in calendars',()=>{
 const monday=sessionInstances(config,'2026-11-02')[0];
 const other=sessionInstances(config,'2026-11-09')[0];
 const customers=[{date:monday.date,staff:'coach',start:720,duration:60,status:'Confirmed',
  data:JSON.stringify({sessionId:monday.id})}];
 assert.equal(monday.id,base.id);
 assert.equal(other.id,occurrence);
 assert.equal(sessionRemaining(monday,customers),2);
 assert.equal(sessionRemaining(other,customers),3);
 const av=(date,appts)=>computeDayAvailability({
  config,date,staff:'coach',services:[service],appointments:appts,
  reservedSlots:[],today:'2026-10-30',nowMinutes:530,capacityOpen:serviceCapacityOpen
 });
 assert.equal(av('2026-11-02',customers).sessionAvailability[720].remaining,2);
 assert.equal(av('2026-11-09',customers).sessionAvailability[720].remaining,3);
 assert.equal(av('2026-11-09',customers).sessions[0].capacity,3);
 assert.equal(selectedSession(config,'2026-11-09','coach',[service],720).id,occurrence);
 assert.equal(av('2026-11-10',[]).sessions.length,0);
});

test('confirmed future recurring bookings cannot lose their occurrence, move, or be overbooked',()=>{
 const booked=[{date:'2026-11-09',staff:'coach',status:'Confirmed',start:720,duration:60,
  data:JSON.stringify({sessionId:occurrence})},
 {date:'2026-11-09',staff:'coach',status:'Confirmed',start:720,duration:60,
  data:JSON.stringify({sessionId:occurrence})}];
 assert.doesNotThrow(()=>validateExistingSessionReservations(config,config,booked));
 const endingEarly={...config,bookableSessions:[{...base,repeat:{...rule,until:'2026-11-02'}}]};
 assert.throws(()=>validateExistingSessionReservations(config,endingEarly,booked),/confirmed customers/i);
 const moved={...config,bookableSessions:[{...base,start:735,repeat:rule}]};
 assert.throws(()=>validateExistingSessionReservations(config,moved,booked),/schedule/i);
 const reduced={...config,bookableSessions:[{...base,capacity:1,repeat:rule}]};
 assert.throws(()=>validateExistingSessionReservations(config,reduced,booked),/capacity/i);
 assert.doesNotThrow(()=>validateExistingSessionReservations(config,
  {...config,bookableSessions:[{...base,capacity:2,repeat:rule}]},booked));
 const durationChanged={...config,services:[{...service,duration:75}]};
 assert.throws(()=>validateExistingSessionReservations(config,durationChanged,booked),/duration/i);
});

test('atomic booking confirmation prevents overselling a repeating occurrence across concurrent requests',async()=>{
 const db=new PGlite();
 try{
  await db.exec(await readFile(new URL('../migrations/001_initial.sql',import.meta.url),'utf8'));
  await db.query("INSERT INTO users(id,email,password_hash) VALUES('owner','owner@example.com','hash')");
  await db.query('INSERT INTO settings(owner,data) VALUES($1,$2)',['owner',JSON.stringify(config)]);
  let queue=Promise.resolve();
  const pool={async connect(){
   const prior=queue;let release;queue=new Promise(done=>{release=done;});await prior;
   return {async query(sql,args){if(sql.includes('pg_advisory_xact_lock'))return {rows:[],rowCount:1};return db.query(sql,args);},
    release(){release();}};
  }};
  const book=(id,date,sessionId)=>confirmBooking({pool,owner:'owner',
   services:[service],staff:'coach',date,start:720,duration:60,buffer:15,id,
   data:{sessionId,serviceIds:['training'],services:['Group Training']}});
  const results=await Promise.allSettled(Array.from({length:4},(_,i)=>book('booking-'+i,'2026-11-09',occurrence)));
  assert.equal(results.filter(x=>x.status==='fulfilled').length,3);
  assert.equal(results.filter(x=>x.status==='rejected').length,1);
  assert.equal((await db.query('SELECT count(*)::int as n FROM appointments')).rows[0].n,3);
  await book('first-date','2026-11-02','repeat-group');
  assert.equal((await db.query('SELECT count(*)::int as n FROM appointments')).rows[0].n,4);
 }finally{await db.close();}
});

test('owner displays repeat frequency, every N days/weeks/months and inclusive end date, with all calendars using expanded occurrences',async()=>{
 const root=new URL('../',import.meta.url);
 const owner=await readFile(new URL('app/studio/owner-dashboard.tsx',root),'utf8');
 const api=await readFile(new URL('lib/studio-handler.ts',root),'utf8');
 assert.match(owner,/Repeat this session/);
 assert.match(owner,/Repeat frequency/);
 assert.match(owner,/Repeat every/);
 assert.match(owner,/End date \(inclusive\)/);
 assert.match(owner,/sf-session-recurrence-fields/);
 assert.match(owner,/sessionInstances\(config,d,staffId\)/);
 assert.match(api,/validateExistingSessionReservations\(oldConfig,c,reservationRows\)/);
 assert.match(api,/sessionsForDate\(c,a.date,a.staff\)/);
 assert.match(api,/computeDayAvailability\(\{config/);
 assert.match(api,/selectedSession\(config/);
});
