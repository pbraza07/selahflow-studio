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
 for(const key of ['firstName','lastName','dateOfBirth'])assert.doesNotThrow(()=>membershipRequestDetails(config,{...full,[key]:''}));
 assert.throws(()=>membershipRequestDetails({}, {...full,firstName:''}),/required/);
 assert.doesNotThrow(()=>membershipRequestDetails(config,{...full,email:''}));
 assert.throws(()=>membershipRequestDetails(config,{...full,email:'invalid'}),/email/);
 assert.throws(()=>membershipRequestDetails(config,{...full,dateOfBirth:'2026-02-30'}),/birth date/);
 assert.throws(()=>membershipRequestDetails(config,{requestId:'invalid'}),/registration reference/);
});
test('required identity and optional email can reach secure checkout, with idempotent retries and no fabricated email',async()=>{
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
  const body={firstName:'Test',lastName:'Person',dateOfBirth:'2000-01-02',slug:'club',planId:'plan',requestId:randomUUID(),termsAccepted:true,recurringAccepted:true};
  assert.equal((await startMembershipCheckout(pool,body,'https://staging.example',api)).checkoutUrl,checkout.url);
  assert.equal((await startMembershipCheckout(pool,body,'https://staging.example',api)).checkoutUrl,checkout.url);assert.equal(creates,1);
  const member=(await db.query('SELECT * FROM customer_memberships')).rows[0];assert.equal(member.customer_email,'');assert.ok(member.date_of_birth);assert.equal(member.member_number,'TP010200');assert.equal(member.sessions_included,0);
 }finally{await db.close();if(oldKey===undefined)delete process.env.STRIPE_SECRET_KEY;else process.env.STRIPE_SECRET_KEY=oldKey;if(oldHook===undefined)delete process.env.STRIPE_CONNECT_WEBHOOK_SECRET;else process.env.STRIPE_CONNECT_WEBHOOK_SECRET=oldHook;}
});
