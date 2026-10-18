import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {replaceLegacyMemberId} from '../server/replace-legacy-member-id.mjs';
import {issueMemberId} from '../server/member-id-policy.mjs';
import {loadOwnerHistory} from '../server/owner-history.mjs';
test('legacy registration replacement preserves reservations and history, is tenant scoped and reused on registration',async()=>{
 const pg=new PGlite();try{
  const files=(await readdir(new URL('../migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort();
  for(const f of files.filter(f=>f<'030'))await pg.exec(await readFile(new URL('../migrations/'+f,import.meta.url),'utf8'));
  await pg.exec("INSERT INTO users(id,email,password_hash) VALUES('u1','one@example.test','x'),('u2','two@example.test','x'); INSERT INTO businesses(id,owner_id,slug,name,status) VALUES('b1','u1','one','One','active'),('b2','u2','two','Two','active'); INSERT INTO customer_booking_ids(business_id,first_name,last_name,email,date_of_birth,member_number) VALUES('b1','Legacy','Client','client@example.test','2015-12-29','LC122900'),('b2','Legacy','Client','other@example.test','2015-12-29','LC122900'); INSERT INTO business_client_profiles(id,owner,name,email,phone,member_number,date_of_birth) VALUES('c1','u1','Legacy Client','client@example.test','','LC122900','2015-12-29'); INSERT INTO appointments(id,owner,date,start,duration,staff,status,data) VALUES('a1','u1','2026-10-17',600,60,'coach','Checked in','{\"memberNumber\":\"LC122900\"}');");
  for(const f of files.filter(f=>f>='030'&&f<'042'))await pg.exec(await readFile(new URL('../migrations/'+f,import.meta.url),'utf8'));
  await pg.exec("INSERT INTO booking_receipt_emails(booking_key,event_type,business_id,destination,destination_masked,message) VALUES('a1','submission','b1','client@example.test','cl***@example.test','{}')");
  for(const f of files.filter(f=>f>='042'))await pg.exec(await readFile(new URL('../migrations/'+f,import.meta.url),'utf8'));
  assert.equal(new Date((await pg.query("SELECT created_at FROM booking_receipt_emails WHERE booking_key='a1'")).rows[0].created_at).getTime(),0,'old receipt must not enter prospective rollout');
  await pg.exec("INSERT INTO booking_receipt_emails(booking_key,event_type,business_id,destination,destination_masked,message) VALUES('new','submission','b1','client@example.test','cl***@example.test','{}')");
  assert.ok(new Date((await pg.query("SELECT created_at FROM booking_receipt_emails WHERE booking_key='new'")).rows[0].created_at).getTime()>Date.now()-60000);
  const client={name:'Legacy Client',dateOfBirth:'2015-12-29',memberNumber:'LC122900'};
  await pg.exec("INSERT INTO booking_requests(id,business_id,owner_id,date,staff_id,start_minute,duration,details,reviewer) VALUES('pending','b1','u1','2026-10-19','coach',600,60,'{\"memberNumber\":\"LC122900\"}','owner')");
  await pg.exec("INSERT INTO booking_receipt_emails(booking_key,event_type,business_id,destination,destination_masked,message) VALUES('pending','submission','b1','client@example.test','cl***@example.test','{\"text\":\"Membership ID: LC122900\"}')");
  await pg.exec('BEGIN');const result=await replaceLegacyMemberId(pg,{owner:'u1',businessId:'b1',client});await pg.exec('COMMIT');
  assert.equal(result.memberNumber,'LC1229');
  assert.equal((await pg.query("SELECT member_number FROM business_client_profiles WHERE id='c1'")).rows[0].member_number,'LC1229');
  assert.equal((await pg.query("SELECT member_number FROM customer_booking_ids WHERE business_id='b2'")).rows[0].member_number,'LC122900');
  assert.equal((await pg.query("SELECT data FROM appointments WHERE id='a1'")).rows[0].data.includes('LC122900'),true);
  assert.equal((await pg.query("SELECT count(*)::int AS n FROM business_member_ids WHERE business_id='b1'")).rows[0].n,2);
  assert.equal((await pg.query("SELECT details::jsonb->>'memberNumber' AS n FROM booking_requests WHERE id='pending'")).rows[0].n,'LC1229');
  assert.equal((await pg.query("SELECT message->>'text' AS text FROM booking_receipt_emails WHERE booking_key='pending'")).rows[0].text,'Membership ID: LC1229');
  assert.ok((await loadOwnerHistory(pg,'u1',{member:'LC1229'})).items.some(r=>r.reference==='a1'),'old booking stays visible through same-identity reservation aliases');
  await pg.exec('BEGIN');assert.equal(await issueMemberId(pg,{businessId:'b1',name:client.name,dateOfBirth:client.dateOfBirth}),'LC1229');await pg.exec('COMMIT');
  await assert.rejects(replaceLegacyMemberId(pg,{owner:'u1',businessId:'b1',client:{...client,name:'Wrong Client'}}),/identity changed/);
  await assert.rejects(replaceLegacyMemberId(pg,{owner:'u2',businessId:'b1',client}),/workspace unavailable/);
  await assert.rejects(replaceLegacyMemberId(pg,{owner:'u1',businessId:'b1',client:{...client,memberNumber:'LC1229'}}),/already has/);
 }finally{await pg.close();}
});
