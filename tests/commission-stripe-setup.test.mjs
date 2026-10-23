import test from 'node:test';
import assert from 'node:assert/strict';
import {commissionStripeStatus,assertCommissionStripeReady,configureCommissionStripe,COMMISSION_EVENTS} from '../server/commission-stripe-setup.mjs';
function environment(t){const old={...process.env};Object.assign(process.env,{APP_ENV:'staging',STRIPE_SECRET_KEY:'sk_test_fixture',STRIPE_CONNECT_WEBHOOK_SECRET:'whsec_fixture'});t.after(()=>{for(const k of Object.keys(process.env))if(!(k in old))delete process.env[k];Object.assign(process.env,old);});}
test('commission Stripe readiness requires the existing environment-specific webhook and every payment/refund event',async t=>{
 environment(t);let rows=[{id:'we_stage',url:'https://stage.example/api/stripe/webhook',livemode:false,status:'enabled',enabled_events:['checkout.session.completed']}];const api=async()=>({data:rows});
 let status=await commissionStripeStatus('https://stage.example',api);assert.equal(status.ready,false);assert.ok(status.missingEvents.includes('charge.refunded'));await assert.rejects(assertCommissionStripeReady('https://stage.example',api),/missing commission/);
 rows[0].enabled_events=['*'];assert.equal((await commissionStripeStatus('https://stage.example',api)).ready,true);
 rows[0].livemode=true;assert.equal((await commissionStripeStatus('https://stage.example',api)).ready,false);
 rows[0].livemode=false;rows.push({...rows[0],id:'we_duplicate'});assert.equal((await commissionStripeStatus('https://stage.example',api)).ready,false);
});
test('setup adds only missing events on the exact existing endpoint, preserves existing events, and is idempotent',async t=>{
 environment(t);const target={id:'we_stage',url:'https://stage.example/api/stripe/webhook',livemode:false,status:'enabled',enabled_events:['charge.succeeded','invoice.paid']},other={id:'we_other',url:'https://other.example/api/stripe/webhook',livemode:false,status:'enabled',enabled_events:['charge.succeeded']};let writes=0;
 const api=async(path,o)=>{if(path==='webhook_endpoints?limit=100')return {data:[target,other]};assert.equal(path,'webhook_endpoints/we_stage');writes++;assert.ok(Object.keys(o.params).every(k=>k.startsWith('enabled_events[')));target.enabled_events=Object.values(o.params);return target;};
 assert.equal((await configureCommissionStripe('https://stage.example',api)).ready,true);assert.equal(writes,1);assert.ok(target.enabled_events.includes('charge.succeeded'));assert.ok(COMMISSION_EVENTS.every(type=>target.enabled_events.includes(type)));assert.deepEqual(other.enabled_events,['charge.succeeded']);assert.equal((await configureCommissionStripe('https://stage.example',api)).ready,true);assert.equal(writes,1);
});
test('commission setup cannot create a new endpoint, rotate signing secrets, change URLs or enable an ambiguous endpoint',async t=>{
 environment(t);let writes=0;const api=async(path,o)=>{if(o.method!=='GET')writes++;return {data:[]};};await assert.rejects(configureCommissionStripe('https://stage.example',api),/Exactly one/);assert.equal(writes,0);delete process.env.STRIPE_CONNECT_WEBHOOK_SECRET;assert.equal((await commissionStripeStatus('https://stage.example',api)).ready,false);
});
