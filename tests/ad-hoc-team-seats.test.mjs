import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {
 teamSeatRequestInput,teamSeatReviewInput,bookableTeamLimit,approvedTeamSeatCount,MAX_AD_HOC_TEAM_SEATS
} from '../server/team-seat-policy.mjs';
const source=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('ad hoc requests require valid proposed name and reason and may never select billing or grant count',()=>{
 assert.deepEqual(teamSeatRequestInput({teamMemberName:'  Coach Anna ',reason:' Peak season training coverage ',
  grant:500,plan_code:'business'}),{teamMemberName:'Coach Anna',reason:'Peak season training coverage'});
 assert.throws(()=>teamSeatRequestInput({teamMemberName:'A',reason:'Need help'}),/name/i);
 assert.throws(()=>teamSeatRequestInput({teamMemberName:'Coach Anna',reason:'no'}),/reason/i);
 assert.throws(()=>teamSeatRequestInput({teamMemberName:'<script>',reason:'Need help'}),/name/i);
 assert.throws(()=>teamSeatReviewInput({id:'invalid',action:'approve'}),/valid/i);
 assert.deepEqual(teamSeatReviewInput({
  id:'ce7b2913-81e8-4fe5-851e-d541735a87f9',action:'approve',note:' One seat authorized '
 }),{id:'ce7b2913-81e8-4fe5-851e-d541735a87f9',action:'approve',note:'One seat authorized'});
 assert.throws(()=>teamSeatReviewInput({id:'ce7b2913-81e8-4fe5-851e-d541735a87f9',
  action:'approve',note:'A'.repeat(1001)}),/note/i);
});
test('subscription allowances remain unchanged with explicitly approved ad hoc seats',()=>{
 assert.equal(bookableTeamLimit('free','active',0),1);
 assert.equal(bookableTeamLimit('free','active',1),2);
 assert.equal(bookableTeamLimit('professional','active',2),5);
 assert.equal(bookableTeamLimit('business','active',1),11);
 assert.equal(bookableTeamLimit('business','inactive',1),2);
 assert.equal(bookableTeamLimit('invalid','active',0),1);
 assert.throws(()=>bookableTeamLimit('free','active',MAX_AD_HOC_TEAM_SEATS+1),/count/i);
});
test('database isolates requests and approvals by business, with only one pending request each',async()=>{
 const db=new PGlite();
 try{
  for(const file of ['001_initial.sql','003_platform_foundation.sql','016_ad_hoc_team_seat_requests.sql'])
   await db.exec(await source('migrations/'+file));
  await db.query("INSERT INTO users(id,email,password_hash) VALUES('o1','one@example.com','hash'),('o2','two@example.com','hash'),('admin','admin@example.com','hash')");
  await db.query("INSERT INTO businesses(id,owner_id,slug,name) VALUES('b1','o1','example-one','Example One'),('b2','o2','example-two','Example Two')");
  await db.query("INSERT INTO business_subscriptions(business_id,plan_code,status) VALUES('b1','free','active'),('b2','free','active')");
  await db.query("INSERT INTO business_team_seat_requests(id,business_id,requested_by,team_member_name,reason) VALUES('r1','b1','o1','Coach Ana','Peak group demand')");
  await assert.rejects(db.query("INSERT INTO business_team_seat_requests(id,business_id,requested_by,team_member_name,reason) VALUES('r2','b1','o1','Coach Ben','Extra weekend games')"));
  await db.query("INSERT INTO business_team_seat_requests(id,business_id,requested_by,team_member_name,reason) VALUES('r3','b2','o2','Coach D','Need weekend help')");
  assert.equal(await approvedTeamSeatCount(db,'b1'),0);
  assert.equal(await approvedTeamSeatCount(db,'b2'),0);
  await db.query("UPDATE business_team_seat_requests SET status='approved',reviewed_by='admin',reviewed_at=now() WHERE id='r1'");
  assert.equal(await approvedTeamSeatCount(db,'b1'),1);
  assert.equal(await approvedTeamSeatCount(db,'b2'),0);
  assert.equal((await db.query("SELECT plan_code FROM business_subscriptions WHERE business_id='b1'")).rows[0].plan_code,'free');
  await db.query("INSERT INTO business_team_seat_requests(id,business_id,requested_by,team_member_name,reason) VALUES('r4','b1','o1','Coach Emi','Summer holiday schedule')");
  await db.query("UPDATE business_team_seat_requests SET status='declined',reviewed_by='admin' WHERE id='r4'");
  assert.equal(await approvedTeamSeatCount(db,'b1'),1);
  await db.query("UPDATE business_team_seat_requests SET status='revoked',reviewed_by='admin' WHERE id='r1'");
  assert.equal(await approvedTeamSeatCount(db,'b1'),0);
  assert.equal((await db.query("SELECT COUNT(*)::int AS n FROM business_team_seat_requests WHERE business_id='b1'")).rows[0].n,2);
 }finally{await db.close();}
});
test('owner cannot self-approve, review requires platform admin and no subscription changes',async()=>{
 const owner=await source('app/api/studio/team-seat-request/route.ts');
 const review=await source('app/api/platform/team-seat-requests/route.ts');
 assert.match(owner,/requireOwner\(req\)/);
 assert.match(owner,/validOrigin\(req\)/);
 assert.match(owner,/action==='withdraw'/);
 assert.match(owner,/status='pending'/);
 assert.doesNotMatch(owner,/\bstatus='approved'/);
 assert.doesNotMatch(owner,/UPDATE business_subscriptions/i);
 assert.match(review,/getPlatformRole\(pool,user\)/);
 assert.match(review,/if\(!role\)throw Error\('FORBIDDEN'\)/);
 assert.match(review,/validOrigin\(req\)/);
 assert.match(review,/FOR UPDATE/);
 assert.match(review,/pg_advisory_xact_lock/);
 assert.match(review,/request\.status!==expected/);
 assert.doesNotMatch(review,/UPDATE business_subscriptions/i);
 assert.doesNotMatch(review,/INSERT INTO business_subscriptions/i);
 assert.match(review,/source\.business_status!=='active'/);
});
test('owner team setting uses the approved extra capacity and admin UI manages requests',async()=>{
 const [studio,business,ownerUI,ownerComponent,platformPage,platformUI,overview]=await Promise.all([
  'lib/studio-handler.ts','app/api/business/route.ts','app/studio/owner-dashboard.tsx',
  'app/components/owner-extra-team-seat-request.tsx','app/admin/platform/platform-dashboard.tsx',
  'app/components/platform-team-seat-requests.tsx','app/api/platform/overview/route.ts'
 ].map(source));
 assert.match(studio,/bookableTeamLimit/);
 assert.match(studio,/business_team_seat_requests/);
 assert.match(studio,/team member request/i);
 assert.match(business,/approved_extra_team_seats/);
 assert.match(business,/teamLimit:bookableTeamLimit/);
 assert.match(ownerUI,/OwnerExtraTeamSeatRequest/);
 assert.match(ownerUI,/refreshTeamAllowance/);
 assert.match(ownerComponent,/Send request to platform administrator/);
 assert.match(ownerComponent,/Withdraw request/);
 assert.match(platformPage,/PlatformTeamSeatRequests/);
 assert.match(platformUI,/Approve \+1 seat/);
 assert.match(platformUI,/Decline request/);
 assert.match(platformUI,/Revoke extra seat/);
 assert.match(overview,/pendingTeamSeatRequests/);
});
