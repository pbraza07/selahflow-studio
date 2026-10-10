import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {validateManagedBusiness,canChangeManagedStatus,canArchiveBusiness} from '../server/platform-business-management.mjs';
const base=new URL('../',import.meta.url);
const read=async path=>readFile(new URL(path,base),'utf8');
const industries=['sports-coaching','barber','other'];
test('admin business profile fields are validated and protected from invalid categories/slugs',()=>{
 const valid=validateManagedBusiness({name:'My Training Club',slug:'my-training-club',industry:'sports-coaching',city:'Tampa',region:'Florida',description:'Coaching'},industries);
 assert.equal(valid.name,'My Training Club');
 assert.equal(valid.slug,'my-training-club');
 assert.throws(()=>validateManagedBusiness({...valid,slug:'../admin'},industries),/slug/i);
 assert.throws(()=>validateManagedBusiness({...valid,industry:'fake-category'},industries),/category/i);
 assert.throws(()=>validateManagedBusiness({...valid,name:'<script>alert(1)</script>'},industries),/name/i);
 assert.throws(()=>validateManagedBusiness({...valid,description:'x'.repeat(610)},industries),/description/i);
});
test('non-primary admins cannot bypass primary business approvals',()=>{
 assert.equal(canChangeManagedStatus('admin','pending','active'),false);
 assert.equal(canChangeManagedStatus('primary','pending','active'),true);
 assert.equal(canChangeManagedStatus('admin','active','suspended'),true);
 assert.equal(canChangeManagedStatus('admin','archived','active'),true);
 assert.equal(canChangeManagedStatus('primary','archived','pending'),false);
 assert.equal(canChangeManagedStatus('admin','active','archived'),false);
});
test('archive is blocked for any active or pending recurring customer charges',()=>{
 assert.equal(canArchiveBusiness({members:0,subscribed:false}),true);
 assert.equal(canArchiveBusiness({members:1,subscribed:false}),false);
 assert.equal(canArchiveBusiness({members:0,subscribed:true}),false);
});
test('business archive migration is reversible and preserves clients, appointments and payment records',async()=>{
 const db=new PGlite();
 try{
  for(const file of ['001_initial.sql','002_public_booking.sql','003_platform_foundation.sql','004_business_customization.sql','005_business_approval_terms.sql',
   '006_marketplace_active_businesses.sql','012_memberships_google_listing.sql','014_platform_business_management.sql']){
   await db.exec(await read('migrations/'+file));
  }
  await db.query("INSERT INTO users(id,email,password_hash) VALUES('admin','admin@example.com','x'),('owner','owner@example.com','x')");
  await db.query("INSERT INTO businesses(id,owner_id,slug,name,status,is_listed) VALUES('business1','owner','sample-business','Sample Business','active',TRUE)");
  await db.query("INSERT INTO appointments(id,owner,date,staff,start,duration,data,status) VALUES('appointment1','owner','2026-10-12','coach',540,60,'{}','Confirmed')");
  await db.query("INSERT INTO business_subscriptions(business_id,plan_code,status) VALUES('business1','free','active')");
  await db.query("INSERT INTO platform_business_audit(id,business_id,actor_id,action,before_record,after_record) VALUES('log1','business1','admin','archive','{}'::jsonb,'{}'::jsonb)");
  await db.query("UPDATE businesses SET status='archived',is_listed=FALSE WHERE id='business1'");
  assert.equal((await db.query("SELECT status,is_listed FROM businesses WHERE id='business1'")).rows[0].status,'archived');
  assert.equal((await db.query("SELECT COUNT(*)::int AS n FROM appointments WHERE owner='owner'")).rows[0].n,1);
  assert.equal((await db.query("SELECT COUNT(*)::int AS n FROM business_subscriptions WHERE business_id='business1'")).rows[0].n,1);
  await db.query("UPDATE businesses SET status='suspended',is_listed=FALSE WHERE id='business1'");
  assert.equal((await db.query("SELECT status FROM businesses WHERE id='business1'")).rows[0].status,'suspended');
 }finally{await db.close();}
});
test('platform business CRUD endpoints are authenticated, origin checked, audited and archive safely',async()=>{
 const route=await read('app/api/platform/businesses/manage/route.ts');
 const overview=await read('app/api/platform/overview/route.ts');
 const dashboard=await read('app/admin/platform/platform-dashboard.tsx');
 const ui=await read('app/components/platform-business-manager.tsx');
 assert.match(route,/getPlatformRole\(pool,actor\)/);
 assert.match(route,/if\(!validOrigin\(req\)\)/);
 assert.match(route,/INSERT INTO businesses/);
 assert.match(route,/UPDATE businesses/);
 assert.match(route,/status='archived'/);
 assert.match(route,/confirmName!==before\.name/);
 assert.match(route,/INSERT INTO platform_business_audit/);
 assert.match(route,/active or pending paid memberships/i);
 assert.doesNotMatch(route,/DELETE FROM businesses/i);
 assert.doesNotMatch(route,/DELETE FROM appointments/i);
 assert.match(overview,/b\.description/);
 assert.match(dashboard,/PlatformBusinessManager/);
 assert.match(ui,/Add business/);
 assert.match(ui,/Save business changes/);
 assert.match(ui,/Archive business/);
 assert.match(ui,/Restore/);
});
