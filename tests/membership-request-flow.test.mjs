import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {membershipRequestDetails,reviewMembershipRequest} from '../server/membership-requests.mjs';
const input={firstName:'Levi',lastName:'Alves',email:'family@example.com',dateOfBirth:'2017-11-03',phone:'8135550000',customAnswers:{goal:'Training'}};
const config={bookingCustomFields:[{id:'goal',label:'Training goal',type:'text',required:true,showInNotification:false,forms:['membership']},{id:'bookingOnly',label:'Booking note',type:'text',required:true,showInNotification:false,forms:['booking']}]};
test('membership request requires membership answers only and snapshots labels',()=>{const d=membershipRequestDetails(config,input);assert.deepEqual(d.customAnswers,{goal:'Training'});assert.deepEqual(d.fieldLabels,{goal:'Training goal'});assert.throws(()=>membershipRequestDetails(config,{...input,customAnswers:{}}),/Training goal/);assert.throws(()=>membershipRequestDetails(config,{...input,dateOfBirth:'2026-02-31'}),/birth date/);});
test('owner approval creates one stable member and directory profile; retries and other tenants preserve isolation and credits',async()=>{
 const db=new PGlite();try{
 for(const file of (await readdir(new URL('../migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile(new URL('../migrations/'+file,import.meta.url),'utf8'));
 await db.exec("INSERT INTO users(id,email,password_hash) VALUES('owner1','one@example.com','hash'),('owner2','two@example.com','hash'); INSERT INTO businesses(id,owner_id,slug,name,industry,status) VALUES('biz1','owner1','club-one','Club One','other','active'),('biz2','owner2','club-two','Club Two','other','active'); INSERT INTO membership_plans(id,business_id,name,interval_unit,price_cents,sessions_included,active) VALUES('plan1','biz1','Gold','month',10000,8,true);");
 const details=membershipRequestDetails(config,input);
 await db.query('INSERT INTO membership_requests(id,business_id,plan_id,details) VALUES($1,$2,$3,$4::jsonb)',['request1','biz1','plan1',JSON.stringify(details)]);
 async function review(owner,id,approve=true){await db.exec('BEGIN');try{const result=await reviewMembershipRequest(db,{owner,id,approve});await db.exec('COMMIT');return result;}catch(e){await db.exec('ROLLBACK');throw e;}}
 await assert.rejects(review('owner2','request1'),/not found/);
 const first=await review('owner1','request1');assert.equal(first.memberNumber,'LA1103');
 const member=(await db.query('SELECT * FROM customer_memberships')).rows[0];assert.equal(member.status,'pending_payment');assert.equal(member.sessions_included,0);assert.equal(member.sessions_used,0);assert.deepEqual(member.registration_answers,{goal:'Training'});
 const profile=(await db.query('SELECT * FROM business_client_profiles')).rows[0];assert.equal(profile.member_number,'LA1103');assert.equal(profile.owner,'owner1');
 assert.equal((await review('owner1','request1')).alreadyReviewed,true);
 await db.query('INSERT INTO membership_requests(id,business_id,plan_id,details) VALUES($1,$2,$3,$4::jsonb)',['request2','biz1','plan1',JSON.stringify(details)]);
 const second=await review('owner1','request2');assert.equal(second.membershipId,first.membershipId);assert.equal(second.existingMember,true);
 assert.equal((await db.query('SELECT count(*)::int AS n FROM customer_memberships')).rows[0].n,1);
 assert.equal((await db.query('SELECT count(*)::int AS n FROM business_client_profiles')).rows[0].n,1);
 // A deletion keeps the approved request as audit history while detaching its
 // foreign-key reference, so it can never block removal of the member.
 await db.query('UPDATE membership_requests SET membership_id=NULL WHERE business_id=$1 AND membership_id=$2',['biz1',first.membershipId]);
 await db.query('DELETE FROM customer_memberships WHERE business_id=$1 AND id=$2',['biz1',first.membershipId]);
 assert.equal((await db.query('SELECT count(*)::int AS n FROM customer_memberships')).rows[0].n,0);
 assert.equal((await db.query('SELECT count(*)::int AS n FROM membership_requests WHERE membership_id IS NOT NULL')).rows[0].n,0);
 }finally{await db.close();}
});
