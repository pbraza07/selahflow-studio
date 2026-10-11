import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {PLAN_CATALOG,PLAN_CODES,planEntitlements,checkSubscriptionLimits,activeMembershipLimit} from '../server/plan-entitlements.mjs';
import {bookableTeamLimit} from '../server/team-seat-policy.mjs';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');

test('single plan catalog defines prices, detailed benefits and limits for all three tiers',()=>{
 assert.deepEqual(PLAN_CODES,['free','professional','business']);
 assert.deepEqual(PLAN_CODES.map(x=>PLAN_CATALOG[x].monthlyCents),[0,2499,6999]);
 assert.deepEqual(PLAN_CODES.map(x=>PLAN_CATALOG[x].bookableStaff),[1,3,10]);
 assert.deepEqual(PLAN_CODES.map(x=>PLAN_CATALOG[x].limits.services),[10,50,150]);
 assert.deepEqual(PLAN_CODES.map(x=>PLAN_CATALOG[x].limits.bookingFields),[5,15,25]);
 assert.deepEqual(PLAN_CODES.map(x=>PLAN_CATALOG[x].limits.sessionSeries),[15,75,200]);
 assert.deepEqual(PLAN_CODES.map(x=>PLAN_CATALOG[x].limits.membershipPlans),[2,10,25]);
 for(const code of PLAN_CODES){
  assert.ok(PLAN_CATALOG[code].included.length>=8);
  assert.ok(PLAN_CATALOG[code].summary.length>20);
  assert.equal(planEntitlements(code,'active').name,PLAN_CATALOG[code].name);
 }
 assert.equal(planEntitlements('business','cancelled').code,'free');
 assert.equal(planEntitlements('invalid','active').code,'free');
 assert.equal(activeMembershipLimit('professional','active'),10);
 assert.equal(activeMembershipLimit('business','inactive'),2);
 assert.equal(bookableTeamLimit('professional','active',2),5,'Previously approved extra seats remain valid');
});
test('database subscription, not client provided plan data, governs service/session/question additions',()=>{
 const oldConfig={services:[{id:'s1'}],bookingCustomFields:[{id:'f1'}],bookableSessions:[{id:'x1'}]};
 const add={services:Array.from({length:11},(_,i)=>({id:'service-'+i})),
  bookingCustomFields:oldConfig.bookingCustomFields,bookableSessions:oldConfig.bookableSessions};
 assert.throws(()=>checkSubscriptionLimits({plan_code:'free',status:'active'},oldConfig,add),/Free plan allows up to 10 service catalog/i);
 assert.doesNotThrow(()=>checkSubscriptionLimits({plan_code:'professional',status:'active'},oldConfig,add));
 assert.throws(()=>checkSubscriptionLimits({plan_code:'business',status:'inactive'},oldConfig,add),/Free plan/);
 const many={services:[{id:'s1'}],bookingCustomFields:Array.from({length:6},(_,i)=>({id:'f'+i})),bookableSessions:oldConfig.bookableSessions};
 assert.throws(()=>checkSubscriptionLimits({plan_code:'free',status:'active'},oldConfig,many),/5 custom booking questions/);
 const sessions={...oldConfig,bookableSessions:Array.from({length:16},(_,i)=>({id:'x'+i}))};
 assert.throws(()=>checkSubscriptionLimits({plan_code:'free',status:'active'},oldConfig,sessions),/15 session templates/);
 assert.doesNotThrow(()=>checkSubscriptionLimits({plan_code:'professional',status:'active'},oldConfig,sessions));
});
test('lower-tier assignments keep all existing business data and allow editing rather than deleting it',()=>{
 const overLimit={services:Array.from({length:15},(_,i)=>({id:'s'+i})),
  bookingCustomFields:Array.from({length:7},(_,i)=>({id:'f'+i})),
  bookableSessions:Array.from({length:18},(_,i)=>({id:'session'+i}))};
 const edited=structuredClone(overLimit);
 edited.services[0].name='Updated existing service';
 edited.bookingCustomFields[0].label='Updated existing answer';
 edited.bookableSessions[0].time=900;
 assert.doesNotThrow(()=>checkSubscriptionLimits({plan_code:'free',status:'active'},overLimit,edited));
 assert.throws(()=>checkSubscriptionLimits({plan_code:'free',status:'active'},overLimit,{
  ...edited,services:[...edited.services,{id:'new-service'}]
 }),/Free plan allows/);
 assert.doesNotThrow(()=>checkSubscriptionLimits({plan_code:'business',status:'active'},overLimit,{
  ...edited,services:[...edited.services,{id:'new-service'}]
 }));
});
test('manual assignment audit records change, retains existing owner, subscription and clients without payment',async()=>{
 const db=new PGlite();
 try{
  for(const p of ['001_initial.sql','003_platform_foundation.sql','014_platform_business_management.sql',
   '015_platform_owner_password_reset.sql','017_owner_login_and_archive_preservation.sql','018_subscription_entitlement_audit.sql'])
   await db.exec(await read('migrations/'+p));
  await db.query("INSERT INTO users(id,email,password_hash) VALUES ('admin','admin@selah.test','hash'),('owner','owner@selah.test','hash'),('other','other@selah.test','hash')");
  await db.query("INSERT INTO businesses(id,owner_id,slug,name,industry) VALUES ('b1','owner','business-one','Business One','fitness'),('b2','other','business-two','Business Two','fitness')");
  await db.query("INSERT INTO business_subscriptions(business_id,plan_code,status) VALUES ('b1','free','active'),('b2','free','active')");
  await db.query("INSERT INTO settings(owner,data) VALUES('owner','{\"services\":[{\"id\":\"s1\"}]}')");
  await db.query("INSERT INTO appointments(id,owner,date,staff,start,duration,data,status) VALUES('a1','owner','2026-11-09','coach',600,60,'{\"customerName\":\"Client\"}','Confirmed')");
  await db.query("UPDATE business_subscriptions SET plan_code='professional' WHERE business_id='b1'");
  await db.query("INSERT INTO business_plan_entitlement_audit(id,business_id,actor_id,previous_plan,new_plan,reason) VALUES('change-1','b1','admin','free','professional','Externally verified arrangement')");
  assert.equal((await db.query("SELECT plan_code FROM business_subscriptions WHERE business_id='b1'")).rows[0].plan_code,'professional');
  assert.equal((await db.query("SELECT plan_code FROM business_subscriptions WHERE business_id='b2'")).rows[0].plan_code,'free','No cross-business change');
  assert.equal((await db.query("SELECT owner_id FROM businesses WHERE id='b1'")).rows[0].owner_id,'owner');
  assert.equal((await db.query("SELECT COUNT(*)::int AS n FROM appointments WHERE owner='owner'")).rows[0].n,1);
  const audit=(await db.query("SELECT previous_plan,new_plan,payment_collected,change_source FROM business_plan_entitlement_audit WHERE business_id='b1'")).rows[0];
  assert.equal(audit.previous_plan,'free');assert.equal(audit.new_plan,'professional');
  assert.equal(audit.payment_collected,false);assert.equal(audit.change_source,'manual_admin');
  await assert.rejects(db.query("INSERT INTO business_plan_entitlement_audit(id,business_id,actor_id,previous_plan,new_plan,reason,payment_collected) VALUES('change-bad','b1','admin','free','business','Invalid payment assertion',TRUE)"));
  assert.equal((await db.query("SELECT stripe_subscription_id FROM business_subscriptions WHERE business_id='b1'")).rows[0].stripe_subscription_id,null);
 }finally{await db.close();}
});
test('homepage no longer promotes one studio; both public pages use the same interactive plan catalog',async()=>{
 const [home,pricing,cards,css]=await Promise.all([
  read('app/page.tsx'),read('app/pricing/page.tsx'),read('app/components/plan-benefit-cards.tsx'),read('app/site.module.css')
 ]);
 assert.doesNotMatch(home,/Meet Crawford|Book Crawford|ORIGINAL BUSINESS|\/book\/crawford/);
 assert.match(home,/PlanBenefitCards placement="home"/);
 assert.match(pricing,/PlanBenefitCards placement="pricing"/);
 assert.match(cards,/aria-expanded=\{opened\}/);
 assert.match(cards,/See all /);
 assert.match(cards,/plan\.included\.map/);
 assert.match(cards,/paid checkout not yet available/i);
 assert.match(css,/\.planGrid\{/);
 assert.match(css,/@media\(max-width:650px\)/);
});
test('owner, membership and admin APIs apply database-backed plan benefits rather than a submitted tier',async()=>{
 const [studio,business,memberships,admin,owner,adminView]=await Promise.all([
  read('lib/studio-handler.ts'),read('app/api/business/route.ts'),
  read('app/api/studio/memberships/route.ts'),read('app/api/platform/plans/route.ts'),
  read('app/studio/owner-dashboard.tsx'),read('app/components/platform-plan-entitlements.tsx')
 ]);
 assert.match(studio,/checkSubscriptionLimits\(planRow,oldConfig,c\)/);
 assert.match(business,/planBenefits:planEntitlements\(row\.plan_code,row\.subscription_status\)/);
 assert.match(memberships,/activeMembershipLimit\(record\?\.plan_code,record\?\.status\)/);
 assert.match(memberships,/pg_advisory_xact_lock/);
 assert.match(owner,/sf-settings-plan-summary/);
 assert.match(owner,/planBenefits\.limits\.bookingFields/);
 assert.match(owner,/planBenefits\.limits\.services/);
 assert.match(owner,/planBenefits\.limits\.sessionSeries/);
 assert.match(admin,/role!=='primary'/);
 assert.match(admin,/payload\.acknowledgeNoPayment!==true/);
 assert.match(admin,/sub\.stripe_subscription_id/);
 assert.match(admin,/business_plan_entitlement_audit/);
 assert.doesNotMatch(admin,/INSERT INTO (customer_memberships|payments)|stripeApi\(/);
 assert.match(adminView,/Apply verified plan benefits/);
});
