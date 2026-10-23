import test from 'node:test';
import assert from 'node:assert/strict';
import {createStripeMerchantAccount,createStripeOnboardingLink} from '../server/membership-payments.mjs';

test('Connect creates a v2 merchant with Stripe-owned risk, then uses v2 merchant onboarding',async(t)=>{
 const previous=process.env; process.env={...previous,APP_ENV:'staging',STRIPE_SECRET_KEY:'sk_test_fixture'}; t.after(()=>{process.env=previous;});
 const calls=[];
 t.mock.method(globalThis,'fetch',async(url,options)=>{
  calls.push({url,...options});
  return {ok:true,json:async()=>url.endsWith('/account_links')?{url:'https://connect.stripe.com/setup/test'}:{id:'acct_sandbox123'}};
 });
 const business={id:'tenant-123',name:'Synthetic Studio'};
 const account=await createStripeMerchantAccount(business,'owner@example.com');
 await createStripeOnboardingLink(account.id,'https://selahflow-staging.onrender.com/studio/test?stripe=connected','https://selahflow-staging.onrender.com/studio/test?stripe=retry');
 assert.equal(calls[0].url,'https://api.stripe.com/v2/core/accounts');
 assert.equal(calls[0].headers['Content-Type'],'application/json');
 assert.equal(calls[0].headers['Stripe-Version'],'2026-09-30.endive');
 assert.equal(calls[0].headers['Idempotency-Key'],'selahflow-connect-managed-v2-tenant-123');
 const body=JSON.parse(calls[0].body);
 assert.deepEqual(body.defaults.responsibilities,{fees_collector:'stripe',losses_collector:'stripe'});
 assert.equal(body.dashboard,'full');
 assert.equal(body.configuration.merchant.capabilities.card_payments.requested,true);
 assert.equal(body.metadata.selahflow_business_id,business.id);
 assert.equal(body.contact_email,'owner@example.com');
 assert.equal(body.type,undefined);
 assert.equal(body.configuration.recipient,undefined);
 assert.equal(calls[1].url,'https://api.stripe.com/v2/core/account_links');
 assert.equal(calls[1].headers['Content-Type'],'application/json');
 assert.equal(calls[1].headers['Stripe-Version'],'2026-09-30.endive');
 assert.deepEqual(JSON.parse(calls[1].body),{account:account.id,use_case:{type:'account_onboarding',account_onboarding:{configurations:['merchant'],return_url:'https://selahflow-staging.onrender.com/studio/test?stripe=connected',refresh_url:'https://selahflow-staging.onrender.com/studio/test?stripe=retry'}}});
});

test('Connect retries use the same account key, omit absent email and propagate provider failures',async(t)=>{
 const previous=process.env; process.env={...previous,APP_ENV:'staging',STRIPE_SECRET_KEY:'sk_test_fixture'}; t.after(()=>{process.env=previous;});
 const keys=[];
 t.mock.method(globalThis,'fetch',async(url,options)=>{
  keys.push(options.headers['Idempotency-Key']);
  assert.equal('contact_email' in JSON.parse(options.body),false);
  return {ok:false,json:async()=>({error:{message:'Sandbox onboarding must be enabled.'}})};
 });
 for(let i=0;i<2;i++)await assert.rejects(createStripeMerchantAccount({id:'tenant-a',name:'Test'}),/Sandbox onboarding/);
 assert.equal(keys[0],keys[1]);
});

test('v2 Connect cannot send live credentials from staging',async(t)=>{
 const previous=process.env; process.env={...previous,APP_ENV:'staging',STRIPE_SECRET_KEY:'sk_live_forbidden'}; t.after(()=>{process.env=previous;});
 const mock=t.mock.method(globalThis,'fetch',async()=>{throw Error('Network must not be called');});
 await assert.rejects(createStripeMerchantAccount({id:'tenant-a',name:'Test'}),/Live Stripe credentials/);
 assert.equal(mock.mock.callCount(),0);
});

test('resuming onboarding uses the existing account, generates fresh links and rejects unsafe provider URLs',async()=>{
 const calls=[];const api=async(path,options)=>{calls.push({path,options});return {url:'https://accounts.stripe.com/r/acct_existing#single-use-'+calls.length};};
 const args=['acct_existing','https://example.com/studio/test?stripe=connected','https://example.com/studio/test?stripe=retry'];
 const first=await createStripeOnboardingLink(...args,api),second=await createStripeOnboardingLink(...args,api);
 assert.notEqual(first.url,second.url);
 assert.equal(calls.length,2);
 assert.ok(calls.every(c=>c.path==='core/account_links'&&c.options.params.account==='acct_existing'));
 assert.ok(calls.every(c=>!c.options.idempotencyKey),'single-use link creation must not reuse cached links');
 for(const url of [undefined,'javascript:alert(1)','https://stripe.com.evil.test/','https://connect.stripe.com:444/','https://user:pass@connect.stripe.com/'])
  await assert.rejects(createStripeOnboardingLink(...args,async()=>({url})),/onboarding/);
 let reached=false;
 await assert.rejects(createStripeOnboardingLink('bad',args[1],args[2],async()=>{reached=true;}),/Invalid connected/);
 assert.equal(reached,false);
 await assert.rejects(createStripeOnboardingLink(...args,async()=>{throw Error('Provider requirements need attention.');}),/Provider requirements/);
});
