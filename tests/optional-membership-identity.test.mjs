import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {membershipRequestDetails,reviewMembershipRequest} from '../server/membership-requests.mjs';
import {deleteClientPermanently} from '../server/delete-client.mjs';
const config={membershipStandardFields:Object.fromEntries(['firstName','lastName','dateOfBirth','email','phone','memberNumber'].map(k=>[k,{required:false}]))};
test('membership Required flags independently allow omissions but validate supplied answers',()=>{
 const full={firstName:'Test',lastName:'Person',dateOfBirth:'2000-01-02',email:'test@example.com',requestId:randomUUID()};
 for(const key of ['firstName','lastName','dateOfBirth','email']){
  const input={...full,[key]:''};assert.doesNotThrow(()=>membershipRequestDetails(config,input));
  assert.throws(()=>membershipRequestDetails({...config,membershipStandardFields:{...config.membershipStandardFields,[key]:{required:true}}},input),/required/);
 }
 assert.throws(()=>membershipRequestDetails(config,{...full,email:'invalid'}),/email/);
 assert.throws(()=>membershipRequestDetails(config,{...full,dateOfBirth:'2026-02-30'}),/birth date/);
 assert.throws(()=>membershipRequestDetails(config,{requestId:'invalid'}),/reference/);
});
test('incomplete enrollments get distinct six-character identities, stable retries, tenant isolation and safe reuse',async()=>{
 const db=new PGlite();try{
  for(const f of (await readdir(new URL('../migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile(new URL('../migrations/'+f,import.meta.url),'utf8'));
  await db.exec("INSERT INTO users(id,email,password_hash) VALUES('o1','o1@example.com','hash'),('o2','o2@example.com','hash'); INSERT INTO businesses(id,owner_id,slug,name,industry,status) VALUES('b1','o1','biz-one','One','other','active'),('b2','o2','biz-two','Two','other','active'); INSERT INTO membership_plans(id,business_id,name,interval_unit,price_cents,sessions_included,active) VALUES('p1','b1','Gold','month',100,2,true),('p2','b2','Gold','month',100,2,true)");
  async function enroll(businessId='b1',owner='o1',planId='p1',requestId=randomUUID()){
   const details=membershipRequestDetails(config,{requestId});
   await db.exec('BEGIN');try{
    await db.query('INSERT INTO membership_requests(id,business_id,plan_id,details) VALUES($1,$2,$3,$4::jsonb) ON CONFLICT DO NOTHING',[requestId,businessId,planId,JSON.stringify(details)]);
    const result=await reviewMembershipRequest(db,{owner,id:requestId,approve:true});await db.exec('COMMIT');return {...result,requestId};
   }catch(e){await db.exec('ROLLBACK');throw e;}
  }
  const a=await enroll(),b=await enroll(),other=await enroll('b2','o2','p2');
  assert.match(a.memberNumber,/^[A-Z]{2}[0-9]{4}$/);assert.notEqual(a.memberNumber,b.memberNumber);assert.equal(a.memberNumber,other.memberNumber);
  assert.equal((await enroll('b1','o1','p1',a.requestId)).membershipId,a.membershipId);
  const profiles=(await db.query("SELECT * FROM business_client_profiles WHERE owner='o1' ORDER BY member_number")).rows;
  assert.equal(profiles.length,2);assert.equal(profiles[0].date_of_birth,null);assert.equal(profiles[0].name,'');
  await assert.rejects(db.query('UPDATE business_client_profiles SET registration_identity=$1 WHERE id=$2',[randomUUID(),profiles[0].id]),/immutable/);
  await assert.rejects(db.query('INSERT INTO customer_booking_ids(business_id,first_name,last_name,email,date_of_birth,member_number,registration_identity) VALUES($1,$2,$3,$4,$5,$6,$7)', ['b1','','','',null,a.memberNumber,randomUUID()]),/another active client/);
  await db.exec('BEGIN');await deleteClientPermanently(db,{owner:'o1',businessId:'b1',client:{id:profiles[0].id,memberNumber:a.memberNumber,name:'',dateOfBirth:null,history:[]}});await db.exec('COMMIT');
  const fresh=await enroll();assert.equal(fresh.memberNumber,a.memberNumber);
  await assert.rejects(enroll('b1','o1','p1',a.requestId),/cannot be restored/);
  assert.equal((await db.query("SELECT count(*)::int n FROM customer_memberships WHERE business_id='b2'")).rows[0].n,1);
 }finally{await db.close();}
});
test('optional identity and email can reach secure checkout, with idempotent retries and no fabricated email',async()=>{
 const {startMembershipCheckout}=await import('../server/membership-checkout.mjs');
 const db=new PGlite(),oldKey=process.env.STRIPE_SECRET_KEY,oldHook=process.env.STRIPE_CONNECT_WEBHOOK_SECRET;
 process.env.STRIPE_SECRET_KEY='sk_test_fixture';process.env.STRIPE_CONNECT_WEBHOOK_SECRET='whsec_fixture';
 try{
  for(const f of (await readdir(new URL('../migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile(new URL('../migrations/'+f,import.meta.url),'utf8'));
  await db.exec("INSERT INTO users(id,email,password_hash) VALUES('owner','owner@example.com','hash'); INSERT INTO businesses(id,owner_id,slug,name,status) VALUES('biz','owner','club','Club','active'); INSERT INTO membership_plans(id,business_id,name,interval_unit,price_cents,sessions_included) VALUES('plan','biz','Gold','month',100,2); INSERT INTO merchant_accounts(business_id,provider,external_account_id,charges_enabled,onboarding_complete) VALUES('biz','stripe','acct_fixture',true,true)");
  await db.query('INSERT INTO settings(owner,data) VALUES($1,$2)',['owner',JSON.stringify(config)]);
  const conn={query:async(sql,args)=>{const r=await db.query(sql,args);return {...r,rowCount:r.rowCount??r.rows.length}},release(){}};
  const pool={...conn,connect:async()=>conn};let creates=0;
  const checkout={id:'cs_test_optional',livemode:false,status:'open',url:'https://checkout.stripe.com/c/pay/fixture'};
  const api=async(path,opts)=>{if(path.startsWith('accounts/'))return {charges_enabled:true,details_submitted:true};if(path==='checkout/sessions'){creates++;assert.equal('customer_email' in opts.params,false)}return checkout};
  const body={slug:'club',planId:'plan',requestId:randomUUID(),termsAccepted:true,recurringAccepted:true};
  assert.equal((await startMembershipCheckout(pool,body,'https://staging.example',api)).checkoutUrl,checkout.url);
  assert.equal((await startMembershipCheckout(pool,body,'https://staging.example',api)).checkoutUrl,checkout.url);assert.equal(creates,1);
  const member=(await db.query('SELECT * FROM customer_memberships')).rows[0];assert.equal(member.customer_email,'');assert.equal(member.date_of_birth,null);assert.equal(member.sessions_included,0);
 }finally{await db.close();if(oldKey===undefined)delete process.env.STRIPE_SECRET_KEY;else process.env.STRIPE_SECRET_KEY=oldKey;if(oldHook===undefined)delete process.env.STRIPE_CONNECT_WEBHOOK_SECRET;else process.env.STRIPE_CONNECT_WEBHOOK_SECRET=oldHook;}
});
