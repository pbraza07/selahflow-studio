import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {PLAN_CATALOG,planEntitlements,checkSubscriptionLimits,activeMembershipLimit,normalizePlanCode} from '../server/plan-entitlements.mjs';
import {bookableTeamLimit} from '../server/team-seat-policy.mjs';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const items=(n,prefix)=>Array.from({length:n},(_,i)=>({id:prefix+i}));
test('three plan tiers offer progressively larger enforced limits and share base team limit',()=>{
 assert.deepEqual(Object.keys(PLAN_CATALOG),['free','professional','business']);
 assert.equal(PLAN_CATALOG.free.monthlyCents,0);
 assert.equal(PLAN_CATALOG.professional.monthlyCents,2499);
 assert.equal(PLAN_CATALOG.business.monthlyCents,6999);
 for(const [code,staff] of [['free',1],['professional',3],['business',10]]){
  assert.equal(planEntitlements(code).bookableStaff,staff);
  assert.equal(bookableTeamLimit(code,'active'),staff);
  assert.ok(PLAN_CATALOG[code].included.length>=5);
 }
 assert.equal(bookableTeamLimit('professional','active',2),5,'Business-specific admin extra seats remain additive');
 assert.equal(normalizePlanCode('business','past_due'),'free');
 assert.equal(normalizePlanCode('hacked','active'),'free');
 assert.equal(activeMembershipLimit('free'),2);
 assert.equal(activeMembershipLimit('professional'),10);
 assert.equal(activeMembershipLimit('business'),25);
});
test('business service, question and session quotas enforce database tier and keep existing items on downgrade',()=>{
 const original={services:items(10,'service'),bookingCustomFields:items(5,'field'),bookableSessions:items(15,'session')};
 const free={plan_code:'free',status:'active'},pro={plan_code:'professional',status:'active'},biz={plan_code:'business',status:'active'};
 assert.doesNotThrow(()=>checkSubscriptionLimits(free,original,structuredClone(original)));
 for(const [key,kind] of [['services','service'],['bookingCustomFields','booking'],['bookableSessions','session']]){
  const proposed={...original,[key]:[...original[key],{id:'new'}]};
  assert.throws(()=>checkSubscriptionLimits(free,original,proposed),/Free plan allows up to/);
  assert.doesNotThrow(()=>checkSubscriptionLimits(pro,original,proposed));
 }
 const downgraded={...original,services:items(53,'service')};
 assert.doesNotThrow(()=>checkSubscriptionLimits(free,downgraded,{...downgraded,services:downgraded.services.slice(0,52)}));
 assert.throws(()=>checkSubscriptionLimits(free,downgraded,{...downgraded,services:[...downgraded.services,{id:'extra'}]}),/Free plan/);
 assert.doesNotThrow(()=>checkSubscriptionLimits(biz,original,{
  services:items(150,'service'),bookingCustomFields:items(25,'field'),bookableSessions:items(200,'session')
 }));
});
test('public home removes original Crawford feature and shows expandable plan details; pricing and owner UI share limits',async()=>{
 const [home,pricing,component,owner,businessApi,studio,admin,membership]=await Promise.all([
  read('app/page.tsx'),read('app/pricing/page.tsx'),read('app/components/plan-benefit-cards.tsx'),
  read('app/studio/owner-dashboard.tsx'),read('app/api/business/route.ts'),
  read('lib/studio-handler.ts'),read('app/admin/platform/platform-dashboard.tsx'),
  read('app/api/studio/memberships/route.ts')
 ]);
 assert.doesNotMatch(home,/Meet Crawford|Book Crawford|ORIGINAL BUSINESS|Crawford's business page/);
 assert.match(home,/PlanBenefitCards placement="home"/);
 assert.match(pricing,/PlanBenefitCards placement="pricing"/);
 assert.match(component,/Object\.entries\(PLANS\)/);
 assert.match(component,/See all /);
 assert.match(component,/plan\.included\.map/);
 assert.match(component,/checkout not yet available/i);
 assert.match(businessApi,/planBenefits:planEntitlements\(row\.plan_code,row\.subscription_status\)/);
 assert.match(studio,/checkSubscriptionLimits\(planRow,oldConfig,c\)/);
 assert.match(studio,/bookableTeamLimit\(planRow\?\.plan_code,planRow\?\.status/);
 assert.match(membership,/activeMembershipLimit\(record\?\.plan_code,record\?\.status\)/);
 assert.match(membership,/pg_advisory_xact_lock/);
 assert.match(admin,/PlatformPlanEntitlements onChanged=\{refresh\}/);
 assert.match(owner,/sf-settings-plan-summary/);
});
test('manual assignments change only stored entitlement, audit primary admin and never pretend payments are collected',async()=>{
 const db=new PGlite();
 try{
  for(const file of ['001_initial.sql','003_platform_foundation.sql','014_platform_business_management.sql',
   '017_owner_login_and_archive_preservation.sql','018_subscription_entitlement_audit.sql']){
   await db.exec(await read('migrations/'+file));
  }
  await db.query("INSERT INTO users(id,email,password_hash) VALUES('primary','a@example.com','x'),('owner','owner@example.com','x')");
  await db.query("INSERT INTO businesses(id,owner_id,slug,name,status) VALUES('tenant-1','owner','tenant-1','Tenant One','active')");
  await db.query("INSERT INTO business_subscriptions(business_id,plan_code,status) VALUES('tenant-1','free','active')");
  await db.query("INSERT INTO appointments(id,owner,date,staff,start,duration,data,status) VALUES('book-1','owner','2026-11-13','coach',840,60,'{\"name\":\"Client\"}','Confirmed')");
  await db.query("UPDATE business_subscriptions SET plan_code='professional' WHERE business_id='tenant-1'");
  await db.query("INSERT INTO business_plan_entitlement_audit(id,business_id,actor_id,previous_plan,new_plan,reason) VALUES('event-1','tenant-1','primary','free','professional','Verified manual grant')");
  assert.equal((await db.query("SELECT plan_code FROM business_subscriptions WHERE business_id='tenant-1'")).rows[0].plan_code,'professional');
  assert.equal((await db.query("SELECT count(*)::int n FROM appointments WHERE owner='owner'")).rows[0].n,1);
  const event=(await db.query("SELECT payment_collected,change_source FROM business_plan_entitlement_audit WHERE id='event-1'")).rows[0];
  assert.equal(event.payment_collected,false);
  assert.equal(event.change_source,'manual_admin');
  await assert.rejects(db.query("INSERT INTO business_plan_entitlement_audit(id,business_id,actor_id,previous_plan,new_plan,reason,payment_collected) VALUES('bad','tenant-1','primary','free','business','Unpaid manual grant',TRUE)"));
 }finally{await db.close();}
 const api=await read('app/api/platform/plans/route.ts');
 assert.match(api,/role!=='primary'/);
 assert.match(api,/validOrigin\(req\)/);
 assert.match(api,/payload\.acknowledgeNoPayment!==true/);
 assert.match(api,/if\(sub\.stripe_subscription_id\)/);
 assert.match(api,/FROM business_subscriptions WHERE business_id=\$1 FOR UPDATE/);
});
