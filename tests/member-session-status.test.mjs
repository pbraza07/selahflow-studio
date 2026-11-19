import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {memberSessionStatus} from '../server/member-session-status.mjs';

test('limits each side of the Eastern start time, scopes IDs, and includes pending requests once',async t=>{
 const db=new PGlite();t.after(()=>db.close());
 await db.exec(`CREATE TABLE appointments(id text,owner text,date text,start int,duration int,status text,data text);
 CREATE TABLE booking_requests(id text,owner_id text,date text,start_minute int,duration int,status text,details text,appointment_id text);
 INSERT INTO appointments SELECT i::text,'business','2026-11-19',i*60,45,'Confirmed','{"memberNumber":"AB1001","services":["Training"]}' FROM generate_series(1,20) i;
 INSERT INTO appointments VALUES ('x','other','2026-11-19',601,45,'Confirmed','{"memberNumber":"AB1001"}'),('y','business','2026-11-19',602,45,'Confirmed','{"memberNumber":"XY1001"}'),('z','business','2026-11-19',603,45,'Cancelled','{"memberNumber":"AB1001"}');
 INSERT INTO booking_requests VALUES ('p','business','2026-11-19',604,30,'pending','{"memberNumber":"AB1001"}',null),('a','business','2026-11-19',605,30,'accepted','{"memberNumber":"AB1001"}','11');`);
 const {past,upcoming}=await memberSessionStatus(db,'business','AB1001',{services:[{name:'Training',category:'Soccer'}]},new Date('2026-11-19T15:00:00Z'));
 assert.deepEqual(past.map(s=>s.start),[600,540,480,420,360]);
 assert.deepEqual(upcoming.map(s=>s.start),[604,660,720,780,840]);
 assert.equal(upcoming[0].status,'Awaiting approval');assert.equal(past[0].serviceType,'Soccer');
});
