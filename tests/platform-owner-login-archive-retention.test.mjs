import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {validateOwnerLoginEmail,validateEmailChangeConfirmation} from '../server/platform-business-management.mjs';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const files=[
 '001_initial.sql','002_public_booking.sql','003_platform_foundation.sql',
 '004_business_customization.sql','005_business_approval_terms.sql',
 '007_booking_approval_requests.sql','011_business_client_profiles.sql',
 '012_memberships_google_listing.sql','014_platform_business_management.sql',
 '015_platform_owner_password_reset.sql','016_ad_hoc_team_seat_requests.sql',
 '017_owner_login_and_archive_preservation.sql'
];

test('login email changes require exact business and existing address confirmation',()=>{
 assert.equal(validateOwnerLoginEmail(' OWNER@Example.COM '),'owner@example.com');
 assert.deepEqual(validateEmailChangeConfirmation({
  confirmName:'My Business',expectedEmail:'OWNER@example.COM',newEmail:'New.Owner@EXAMPLE.com'
 },'My Business','owner@example.com'),{
  oldEmail:'owner@example.com',newEmail:'new.owner@example.com'
 });
 assert.throws(()=>validateOwnerLoginEmail('not-a-mail'),/valid owner login email/i);
 assert.throws(()=>validateOwnerLoginEmail('a@b.com\nz'),/valid owner login email/i);
 assert.throws(()=>validateOwnerLoginEmail('<bad>@test.com'),/valid owner login email/i);
 assert.throws(()=>validateEmailChangeConfirmation({
  confirmName:'Other Business',expectedEmail:'owner@example.com',newEmail:'new@example.com'
 },'My Business','owner@example.com'),/exact business name/i);
 assert.throws(()=>validateEmailChangeConfirmation({
  confirmName:'My Business',expectedEmail:'stale@example.com',newEmail:'new@example.com'
 },'My Business','owner@example.com'),/changed/i);
 assert.throws(()=>validateEmailChangeConfirmation({
  confirmName:'My Business',expectedEmail:'owner@example.com',newEmail:'Owner@Example.com'
 },'My Business','owner@example.com'),/differ/i);
});
test('archiving and restoring retains the SAME business ID, owner ID, bookings, clients, settings, payments and historical events',async()=>{
 const db=new PGlite();
 try{
  for(const file of files)await db.exec(await read('migrations/'+file));
  await db.query("INSERT INTO users(id,email,password_hash) VALUES('admin','admin@example.com','x'),('owner','old@example.com','x'),('second','second@example.com','x')");
  await db.query("INSERT INTO businesses(id,owner_id,slug,name,industry,status,is_listed) VALUES('business1','owner','training-club','Training Club','sports-coaching','active',TRUE),('business2','second','other-club','Other Club','sports-coaching','active',TRUE)");
  await db.query("INSERT INTO settings(owner,data) VALUES('owner',$1),('second','{}')",
    [JSON.stringify({name:'Training Club',services:[{id:'s',name:'Private training'}],staff:[{id:'coach',name:'Coach X'}],
     brandColor:'#225522',bookableSessions:[{id:'session1',date:'2026-11-01',service:'s',staff:'coach',start:540,capacity:10}]})]);
  await db.query("INSERT INTO appointments(id,owner,date,staff,start,duration,data,status) VALUES('appointment1','owner','2026-11-01','coach',540,60,'{\"name\":\"Alex\"}','Confirmed')");
  await db.query("INSERT INTO slots(owner,date,staff,minute,appointment) VALUES('owner','2026-11-01','coach',540,'appointment1')");
  await db.query("INSERT INTO events(id,owner,created,kind,data) VALUES('event1','owner','2026-10-10','booking','{}')");
  await db.query("INSERT INTO business_subscriptions(business_id,plan_code,status) VALUES('business1','free','active'),('business2','professional','active')");
  await db.query("INSERT INTO business_client_profiles(id,owner,name,email,notes) VALUES('client1','owner','Alex','alex@example.com','Attendance recorded')");
  await db.query("INSERT INTO booking_requests(id,business_id,owner_id,date,staff_id,start_minute,duration,details) VALUES('booking1','business1','owner','2026-11-02','coach',600,60,'{\"customerName\":\"Alex\"}')");
  await db.query("INSERT INTO membership_plans(id,business_id,name,interval_unit,price_cents) VALUES('plan1','business1','Monthly','month',4900)");
  await db.query("INSERT INTO customer_memberships(id,business_id,plan_id,price_cents,customer_name,customer_email,stripe_account_id,status) VALUES('member1','business1','plan1',4900,'Alex','alex@example.com','acct_connected','canceled')");
  await db.query("INSERT INTO business_team_seat_requests(id,business_id,requested_by,team_member_name,reason,status) VALUES('request1','business1','owner','Coach Y','Busy season','approved')");
  await db.query("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES('session-token','owner',now()+interval '1 hour')");
  await db.query("INSERT INTO platform_business_audit(id,business_id,actor_id,action,before_record,after_record) VALUES('audit1','business1','admin','archive','{}'::jsonb,'{}'::jsonb)");

  const ownerBefore=(await db.query("SELECT owner_id,slug FROM businesses WHERE id='business1'")).rows[0];
  await db.query("UPDATE businesses SET status='archived',is_listed=FALSE,archived_at=now(),restored_at=NULL WHERE id='business1'");
  const archived=(await db.query("SELECT id,owner_id,slug,status,is_listed,archived_at FROM businesses WHERE id='business1'")).rows[0];
  assert.equal(archived.owner_id,ownerBefore.owner_id);
  assert.equal(archived.slug,ownerBefore.slug);
  assert.equal(archived.status,'archived');
  assert.equal(archived.is_listed,false);
  assert.ok(archived.archived_at);
  assert.equal((await db.query("SELECT COUNT(*)::int AS n FROM businesses WHERE status='active' AND is_listed=TRUE")).rows[0].n,1);
  await assert.rejects(db.query("INSERT INTO businesses(id,owner_id,slug,name) VALUES('another','admin','training-club','Duplicate')"));

  const count=(sql)=>db.query(sql).then(r=>r.rows[0].n);
  assert.equal(await count("SELECT count(*)::int n FROM appointments WHERE owner='owner'"),1);
  assert.equal(await count("SELECT count(*)::int n FROM slots WHERE owner='owner'"),1);
  assert.equal(await count("SELECT count(*)::int n FROM events WHERE owner='owner'"),1);
  assert.equal(await count("SELECT count(*)::int n FROM business_client_profiles WHERE owner='owner'"),1);
  assert.equal(await count("SELECT count(*)::int n FROM booking_requests WHERE business_id='business1'"),1);
  assert.equal(await count("SELECT count(*)::int n FROM membership_plans WHERE business_id='business1'"),1);
  assert.equal(await count("SELECT count(*)::int n FROM customer_memberships WHERE business_id='business1'"),1);
  assert.equal(await count("SELECT count(*)::int n FROM business_team_seat_requests WHERE business_id='business1'"),1);
  assert.equal((await db.query("SELECT plan_code FROM business_subscriptions WHERE business_id='business1'")).rows[0].plan_code,'free');
  assert.equal((await db.query("SELECT data FROM settings WHERE owner='owner'")).rows[0].data.includes('bookableSessions'),true);

  await db.query("UPDATE businesses SET status='suspended',is_listed=FALSE,archived_at=NULL,restored_at=now() WHERE id='business1'");
  let restored=(await db.query("SELECT id,owner_id,slug,status,is_listed,restored_at FROM businesses WHERE id='business1'")).rows[0];
  assert.deepEqual([restored.id,restored.owner_id,restored.slug],['business1','owner','training-club']);
  assert.equal(restored.status,'suspended');
  assert.equal(restored.is_listed,false,'Restoration must not silently republish an archived business');
  assert.ok(restored.restored_at);
  await db.query("UPDATE businesses SET status='active',is_listed=TRUE WHERE id='business1'");
  assert.equal(await count("SELECT count(*)::int n FROM appointments WHERE owner='owner'"),1);
  assert.equal((await db.query("SELECT name,notes FROM business_client_profiles WHERE id='client1'")).rows[0].notes,'Attendance recorded');

  // Login email is a user property, not an owner identity. Updating it and
  // revoking sessions cannot orphan ANY of the preserved tenant data.
  await db.query("UPDATE users SET email='new@example.com' WHERE id='owner'");
  await db.query("DELETE FROM sessions WHERE user_id='owner'");
  await db.query("INSERT INTO platform_business_audit(id,business_id,actor_id,action,before_record,after_record) VALUES('audit2','business1','admin','change_owner_email','{\"email\":\"old@example.com\"}'::jsonb,'{\"email\":\"new@example.com\"}'::jsonb)");
  assert.equal((await db.query("SELECT email FROM users WHERE id='owner'")).rows[0].email,'new@example.com');
  assert.equal(await count("SELECT COUNT(*)::int n FROM sessions WHERE user_id='owner'"),0);
  assert.equal((await db.query("SELECT owner_id FROM businesses WHERE id='business1'")).rows[0].owner_id,'owner');
  assert.equal(await count("SELECT count(*)::int n FROM appointments WHERE owner='owner'"),1);
  assert.equal((await db.query("SELECT COUNT(*)::int AS n FROM platform_business_audit WHERE business_id='business1'")).rows[0].n,2);
  assert.equal((await db.query("SELECT email FROM users WHERE id='second'")).rows[0].email,'second@example.com');
  await assert.rejects(db.query("UPDATE users SET email='second@example.com' WHERE id='owner'"));
 }finally{await db.close();}
});
test('protected admin endpoint audits email/credential changes and never deletes tenant business records',async()=>{
 const route=await read('app/api/platform/businesses/manage/route.ts');
 const overview=await read('app/api/platform/overview/route.ts');
 const ui=await read('app/components/platform-business-manager.tsx');
 const policy=await read('server/platform-business-management.mjs');
 const archive=route.slice(route.indexOf("}else if(action==='archive')"),route.indexOf("}else if(action==='restore')"));
 const restore=route.slice(route.indexOf("}else if(action==='restore')"));
 assert.match(route,/getPlatformRole\(pool,actor\)/);
 assert.match(route,/if\(!role\)throw Error\('FORBIDDEN'\)/);
 assert.match(route,/if\(!validOrigin\(req\)\)/);
 assert.match(route,/changeOwnerEmail/);
 assert.match(route,/validateEmailChangeConfirmation/);
 assert.match(route,/SELECT 1 FROM platform_admins WHERE user_id=\$1/);
 assert.match(route,/UPDATE users SET email=\$1 WHERE id=\$2/);
 assert.match(route,/DELETE FROM sessions WHERE user_id=\$1/);
 assert.match(route,/\bchange_owner_email\b/);
 assert.match(route,/\breset_password\b/);
 assert.match(route,/hashPassword\(tempPassword\)/);
 assert.match(route,/must_change_password=TRUE/);
 assert.doesNotMatch(route,/DELETE FROM (businesses|appointments|business_client_profiles|customer_memberships)/);
 assert.match(archive,/status='archived'/);
 assert.match(archive,/archived_at=now\(\)/);
 assert.match(archive,/retained_record_counts|archive_record_counts/);
 assert.doesNotMatch(archive,/DELETE FROM/);
 assert.match(restore,/status='suspended'/);
 assert.match(restore,/restored_at=now\(\)/);
 assert.match(overview,/b\.archived_at::text/);
 assert.match(ui,/Update login email/);
 assert.match(ui,/Update owner login email/);
 assert.match(ui,/Reset password/);
 assert.match(ui,/Archive business \(keep history\)/);
 assert.match(ui,/historical business data retained for restoration/);
 assert.match(policy,/validateEmailChangeConfirmation/);
});
