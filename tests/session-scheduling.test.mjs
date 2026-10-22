import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {
 validateBookableSessions,validateExistingSessionReservations,bookedSessionCount,
 sessionRemaining,bookingDateRange,computeDayAvailability,easternClock,nextQuarterHour
} from '../server/session-scheduling.mjs';
import {confirmBooking,serviceCapacityOpen} from '../server/booking-approvals.mjs';

const date='2026-11-02';
const training={id:'training',name:'Group training',duration:60,price:35,maxSlots:1};
const coach={id:'coach',name:'Coach',services:['training']};
const session={id:'group-1',date,staff:'coach',service:'training',start:720,capacity:10};
const config={open:9,close:18,buffer:15,staff:[coach],services:[training],bookableSessions:[session]};
const customer=(id)=>({
 id,staff:'coach',start:720,duration:60,status:'Confirmed',
 data:JSON.stringify({sessionId:session.id,serviceIds:['training']})
});
const windowFor=(appointments=[])=>computeDayAvailability({
 config,date,staff:'coach',services:[training],appointments,reservedSlots:[],
 today:'2026-11-01',nowMinutes:700,capacityOpen:serviceCapacityOpen
});

test('session settings validate business hours, capacity and nonoverlapping coach schedules',()=>{
 assert.equal(validateBookableSessions(config).length,1);
 assert.throws(()=>validateBookableSessions({...config,bookableSessions:[session,{...session,id:'group-2',start:750}]}),/overlap/i);
 assert.throws(()=>validateBookableSessions({...config,bookableSessions:[{...session,capacity:101}]}),/capacity/i);
 assert.throws(()=>validateBookableSessions({...config,bookableSessions:[{...session,start:1065}]}),/hours/i);
 assert.throws(()=>validateBookableSessions({...config,bookableSessions:[{...session,date:'2026-02-30'}]}),/date/i);
});
test('remaining seat counts and normal capacity are independent',()=>{
 const appointments=Array.from({length:7},(_,i)=>customer('booking-'+i));
 assert.equal(bookedSessionCount(appointments,session.id),7);
 assert.equal(sessionRemaining(session,appointments),3);
 const day=windowFor(appointments);
 assert.equal(day.sessionAvailability[720].remaining,3);
 assert.equal(day.sessionAvailability[720].capacity,10);
 assert.equal(day.sessions[0].remaining,3);
 assert.ok(day.slots.includes(720));
 assert.ok(!day.slots.includes(735),'overlapping standard bookings must be blocked');
 assert.ok(serviceCapacityOpen(appointments,[training],600,60),'group members do not consume standard service limit');
 assert.ok(!windowFor([...appointments,...Array.from({length:3},(_,i)=>customer('more-'+i))]).slots.includes(720));
});
test('a confirmed seat prevents destructive session edits',()=>{
 const appointments=[customer('one'),customer('two')];
 assert.doesNotThrow(()=>validateExistingSessionReservations([session],[],appointments),'Removing the definition preserves its reservations as retained bookings');
 assert.throws(()=>validateExistingSessionReservations([session],[{...session,capacity:1}],appointments),/capacity/i);
 assert.throws(()=>validateExistingSessionReservations([session],[{...session,start:735}],appointments),/schedule/i);
 assert.doesNotThrow(()=>validateExistingSessionReservations([session],[{...session,capacity:3}],appointments));
});
test('customer calendar covers day, Sunday-start week and complete month',()=>{
 assert.deepEqual(bookingDateRange('2026-11-04','day'),['2026-11-04']);
 assert.equal(bookingDateRange('2026-11-04','week')[0],'2026-11-01');
 assert.equal(bookingDateRange('2026-11-04','week')[6],'2026-11-07');
 assert.equal(bookingDateRange('2026-11-04','month').length,30);
 assert.equal(bookingDateRange('2028-02-05','month').length,29);
});
test('atomic confirmation serializes concurrent customers and cannot oversell session',async()=>{
 const db=new PGlite();
 try{
  await db.exec(await readFile(new URL('../migrations/001_initial.sql',import.meta.url),'utf8'));
  await db.query("INSERT INTO users(id,email,password_hash) VALUES('owner','owner@example.com','hash')");
  await db.query('INSERT INTO settings(owner,data) VALUES($1,$2)',['owner',JSON.stringify(config)]);
  // PGlite uses one embedded database connection. This pool emulates the
  // transaction-wide advisory lock serialization provided by PostgreSQL.
  let queue=Promise.resolve();
  const pool={async connect(){
   const prior=queue;let release;
   queue=new Promise(resolve=>{release=resolve;});
   await prior;
   return {
    async query(sql,args){if(sql.includes('pg_advisory_xact_lock'))return {rows:[],rowCount:1};return db.query(sql,args);},
    release(){release();}
   };
  }};
  const options=id=>({pool,owner:'owner',services:[training],staff:'coach',
   date,start:720,duration:60,buffer:15,id,data:{sessionId:'group-1',serviceIds:['training'],services:['Group training']}});
  const results=await Promise.allSettled(Array.from({length:11},(_,i)=>confirmBooking(options('customer-'+i))));
  assert.equal(results.filter(x=>x.status==='fulfilled').length,10);
  assert.equal(results.filter(x=>x.status==='rejected'&&x.reason.status===409).length,1);
  assert.equal((await db.query('SELECT COUNT(*)::int AS count FROM appointments')).rows[0].count,10);
  assert.equal((await db.query('SELECT COUNT(*)::int AS count FROM slots')).rows[0].count,0,
   'shared session attendees must not create exclusive staff slot locks');
  await db.query("UPDATE appointments SET status='Cancelled' WHERE id='customer-0'");
  await confirmBooking(options('customer-12'));
  assert.equal((await db.query("SELECT COUNT(*)::int AS count FROM appointments WHERE status='Confirmed'")).rows[0].count,10);
 }finally{await db.close();}
});

test('today availability starts at the next 15-minute mark, never an arbitrary hour away',()=>{
 const empty={...config,bookableSessions:[]};
 for(const [now,expected] of [[700,705],[704,705],[705,720],[719,720],[720,735]]){
  const day=computeDayAvailability({config:empty,date,staff:'coach',services:[training],
    appointments:[],reservedSlots:[],today:date,nowMinutes:now,capacityOpen:serviceCapacityOpen});
  assert.equal(day.earliestStart,expected);
  assert.equal(day.firstAvailable,expected);
  assert.equal(day.slots[0],expected);
  assert.ok(expected>now&&expected-now<=15);
 }
 assert.equal(nextQuarterHour(700),705);
 assert.equal(nextQuarterHour(719),720);
 assert.equal(nextQuarterHour(1439),1440);
});
test('Eastern Time is correct in daylight time and standard time regardless of server timezone',()=>{
 assert.deepEqual(easternClock(new Date('2026-10-10T15:40:00.000Z')),{date:'2026-10-10',minutes:700});
 assert.deepEqual(easternClock(new Date('2026-01-10T16:40:00.000Z')),{date:'2026-01-10',minutes:700});
 assert.deepEqual(easternClock(new Date('2026-10-11T03:40:00.000Z')),{date:'2026-10-10',minutes:1420});
});
test('existing appointments may delay the first genuinely free slot without changing the 15-minute booking rule',()=>{
 const empty={...config,bookableSessions:[]};
 const occupied={staff:'coach',start:690,duration:60,status:'Confirmed',data:JSON.stringify({serviceIds:['training']})};
 const result=computeDayAvailability({config:empty,date,staff:'coach',services:[training],
  appointments:[occupied],reservedSlots:[690,705,720,735,750],today:date,nowMinutes:700,capacityOpen:serviceCapacityOpen});
 assert.equal(result.earliestStart,705);
 assert.ok(result.firstAvailable>result.earliestStart);
 assert.ok(!result.slots.includes(705));
});
test('settings categories stay separated and offer an always-available Save control',async()=>{
 const root=new URL('../',import.meta.url);
 const owner=await readFile(new URL('app/studio/owner-dashboard.tsx',root),'utf8');
 const css=await readFile(new URL('app/globals.css',root),'utf8');
 for(const category of ['business','availability','sessions','notifications','questions','catalog','team']){
  assert.match(owner,new RegExp('data-sf-settings-group="'+category+'"'));
  assert.match(css,new RegExp('data-settings-tab="'+category+'"'));
 }
 assert.match(owner,/sf-settings-save/);
 assert.match(owner,/Next possible 15-minute mark/);
 const customer=await readFile(new URL('app/book/page.tsx',root),'utf8');
 assert.match(customer,/First available:/);
 assert.match(customer,/void availability\(date\)/);
});
