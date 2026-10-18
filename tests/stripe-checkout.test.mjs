import {bookingPaymentPreview} from '../server/booking-payment-preview.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {tokenHash} from '../server/security.mjs';
import {startBookingCheckout,applyBookingPayment,applyMembershipInvoice,assertTestPayment,checkoutUrl} from '../server/stripe-checkout.mjs';
import {startMembershipCheckout} from '../server/membership-checkout.mjs';

test('staging refuses live payment objects and redirects outside Stripe',()=>{
 const old=process.env.APP_ENV;process.env.APP_ENV='staging';try{
  assert.throws(()=>assertTestPayment({livemode:true}),/sandbox/);
  assert.throws(()=>assertTestPayment({}),/sandbox/);assertTestPayment({livemode:false});
  for(const url of ['http://checkout.stripe.com/x','https://checkout.stripe.com.evil/x','javascript:alert(1)'])assert.throws(()=>checkoutUrl({url}),/secure/);
 }finally{if(old===undefined)delete process.env.APP_ENV;else process.env.APP_ENV=old;}
});
test('Checkout uses the supported dynamic payment-method filter in both flows',async()=>{
 for(const file of ['server/stripe-checkout.mjs','server/membership-checkout.mjs']){
  const source=await readFile(new URL('../'+file,import.meta.url),'utf8');
  assert.match(source,/'allowed_payment_method_types\[0\]':'card'/);
  assert.doesNotMatch(source,/'payment_method_types\[0\]'/);
 }
});
test('booking Checkout is server-priced, account-scoped, reusable, and recorded once after verified payment',async()=>{
 const pg=new PGlite(),old=[process.env.STRIPE_SECRET_KEY,process.env.STRIPE_CONNECT_WEBHOOK_SECRET];
 process.env.STRIPE_SECRET_KEY='sk_test_fixture';process.env.STRIPE_CONNECT_WEBHOOK_SECRET='whsec_fixture';
 try{
  for(const f of (await readdir(new URL('../migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort())await pg.exec(await readFile(new URL('../migrations/'+f,import.meta.url),'utf8'));
  const db={query:async(s,v)=>{const r=await pg.query(s,v);return {...r,rowCount:r.rows.length||r.affectedRows||0};},release(){}};
  const pool={...db,connect:async()=>db};
  await pg.exec("INSERT INTO users(id,email,password_hash) VALUES('u1','one@example.com','hash'),('u2','two@example.com','hash'); INSERT INTO businesses(id,owner_id,slug,name,status) VALUES('b1','u1','one','One','active'),('b2','u2','two','Two','active'); INSERT INTO merchant_accounts(business_id,provider,external_account_id,charges_enabled,onboarding_complete) VALUES('b1','stripe','acct_one',true,true),('b2','stripe','acct_two',true,true);");
  const bookingId=randomUUID(),token='a'.repeat(64),lines=[{id:'s',name:'Service',type:'service',price:25,qty:1}];
  await db.query("INSERT INTO appointments(id,owner,date,staff,start,duration,status,data) VALUES($1,'u1','2026-11-01','coach',600,60,'Confirmed',$2)",[bookingId,JSON.stringify({price:25,services:['Service'],serviceIds:['s'],email:'synthetic@example.com',paymentLines:lines})]);
  await db.query("INSERT INTO customer_booking_access(token_hash,owner_id,booking_id) VALUES($1,'u1',$2)",[tokenHash(token),bookingId]);
  let creates=0,session={id:'cs_test_booking012345',livemode:false,status:'open',mode:'payment',payment_status:'unpaid',url:'https://checkout.stripe.com/c/pay/test_fixture'};
  const api=async(path,o)=>{
   if(path.startsWith('accounts/'))return {charges_enabled:true,details_submitted:true};
   assert.equal(o.account,'acct_one');
   if(path==='checkout/sessions'){creates++;assert.equal(o.params['line_items[0][price_data][unit_amount]'],'2500');assert.equal(o.params.client_reference_id,bookingId);return session;}
   return session;
  };
  const args={slug:'one',bookingId,token,origin:'https://staging.example',amountCents:1};
  assert.ok((await startBookingCheckout(pool,args,api)).checkoutUrl);
  assert.ok((await startBookingCheckout(pool,args,api)).checkoutUrl);assert.equal(creates,1);
  await assert.rejects(startBookingCheckout(pool,{...args,slug:'two'},api),/expired/);
  await assert.rejects(startBookingCheckout(pool,{...args,token:'x'+token},api),/Invalid/);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM events')).rows[0].n,0);
  const paid={...session,payment_status:'paid',status:'complete',currency:'usd',payment_intent:'pi_test',amount_total:2500,client_reference_id:bookingId,metadata:{booking_id:bookingId,selahflow_business_id:'b1'}};
  const apply=async(obj,biz='b1',acct='acct_one')=>{await db.query('BEGIN');try{const r=await applyBookingPayment(db,biz,acct,obj);await db.query('COMMIT');return r;}catch(e){await db.query('ROLLBACK');throw e;}};
  assert.equal(await apply({...paid,amount_total:1}),false);assert.equal(await apply(paid,'b2','acct_two'),false);assert.equal(await apply({...paid,payment_status:'unpaid'}),false);
  assert.equal(await apply(paid),true);assert.equal(await apply(paid),true);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM events')).rows[0].n,1);
  assert.equal((await db.query('SELECT status FROM booking_payments')).rows[0].status,'paid');
  assert.equal((await db.query("SELECT count(*)::int AS n FROM booking_client_messages WHERE booking_id=$1 AND event_type='payment_confirmation' AND channel='email'",[bookingId])).rows[0].n,1,'direct payment queues confirmation');
  const flow=(await db.query('SELECT payment_url FROM booking_client_flows WHERE booking_id=$1',[bookingId])).rows[0];const access=new URLSearchParams(new URL(flow.payment_url).hash.slice(1));
  assert.equal((await bookingPaymentPreview(pool,{slug:'one',bookingId,token:access.get('token')})).status,'paid','direct email payment links can be opened');
  assert.equal(JSON.parse((await db.query('SELECT data FROM appointments')).rows[0].data).paymentStatus,'paid');
  assert.equal((await startBookingCheckout(pool,args,api)).paid,true);assert.equal(creates,1);
  // No charge for membership coverage or approval-pending requests.
  const pendingId=randomUUID(),pendingToken='b'.repeat(64);await db.query("INSERT INTO customer_booking_access(token_hash,owner_id,booking_id) VALUES($1,'u1',$2)",[tokenHash(pendingToken),pendingId]);
  await db.query("INSERT INTO booking_requests(id,business_id,owner_id,date,staff_id,start_minute,duration,details) VALUES($1,'b1','u1','2026-11-01','coach',700,60,'{}')",[pendingId]);
  await assert.rejects(startBookingCheckout(pool,{...args,bookingId:pendingId,token:pendingToken},api),/approve/);
  await db.query("UPDATE appointments SET data=$1 WHERE id=$2",[JSON.stringify({price:0,membershipCovered:true}),bookingId]);
  await assert.rejects(startBookingCheckout(pool,args,api),/No payment/);
 }finally{await pg.close();for(const [i,key]of ['STRIPE_SECRET_KEY','STRIPE_CONNECT_WEBHOOK_SECRET'].entries())if(old[i]===undefined)delete process.env[key];else process.env[key]=old[i];}
});
test('membership sandbox checkout reuses enrollment; paid invoices add credits/revenue once, never cross-tenant',async()=>{
 const pg=new PGlite(),old=[process.env.STRIPE_SECRET_KEY,process.env.STRIPE_CONNECT_WEBHOOK_SECRET];process.env.STRIPE_SECRET_KEY='sk_test_fixture';process.env.STRIPE_CONNECT_WEBHOOK_SECRET='whsec_fixture';
 try{
  for(const f of (await readdir(new URL('../migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort())await pg.exec(await readFile(new URL('../migrations/'+f,import.meta.url),'utf8'));
  const db={query:async(s,v)=>{const r=await pg.query(s,v);return {...r,rowCount:r.rows.length||r.affectedRows||0};},release(){}};const pool={...db,connect:async()=>db};
  await pg.exec("INSERT INTO users(id,email,password_hash) VALUES('u1','one@example.com','hash'),('u2','two@example.com','hash'); INSERT INTO businesses(id,owner_id,slug,name,status) VALUES('b1','u1','one','One','active'),('b2','u2','two','Two','active'); INSERT INTO merchant_accounts(business_id,provider,external_account_id,charges_enabled,onboarding_complete) VALUES('b1','stripe','acct_one',true,true); INSERT INTO membership_plans(id,business_id,name,interval_unit,price_cents,sessions_included) VALUES('p1','b1','Three Sessions','month',2000,3);");
  let creates=0;const session={id:'cs_test_member012345',livemode:false,status:'open',url:'https://checkout.stripe.com/c/pay/test_member'};
  const api=async(path,o)=>{if(path.startsWith('accounts/'))return {charges_enabled:true,details_submitted:true};assert.equal(o.account,'acct_one');if(path==='checkout/sessions'){creates++;assert.equal(o.params.mode,'subscription');assert.equal(o.params['line_items[0][price_data][unit_amount]'],'2000');}return session;};
  const body={slug:'one',planId:'p1',requestId:randomUUID(),firstName:'Sandbox',lastName:'Member',email:'sandbox@example.com',dateOfBirth:'2000-01-02',termsAccepted:true,recurringAccepted:true};
  assert.ok((await startMembershipCheckout(pool,body,'https://staging.example',api)).checkoutUrl);
  assert.ok((await startMembershipCheckout(pool,{...body,requestId:randomUUID()},'https://staging.example',api)).checkoutUrl);assert.equal(creates,1);
  await assert.rejects(startMembershipCheckout(pool,{...body,email:'other@example.com'},'https://staging.example',api),/already/);
  const member=(await db.query('SELECT * FROM customer_memberships')).rows[0];assert.equal(member.sessions_included,0);assert.equal(member.status,'pending_payment');
  const sub={id:'sub_member',livemode:false,status:'active',metadata:{membership_id:member.id,selahflow_business_id:'b1'}};
  // Current provider schema has no legacy paid boolean or subscription root field.
  const invoice={id:'in_first',livemode:false,status:'paid',amount_paid:2000,amount_paid_off_stripe:0,currency:'usd',billing_reason:'subscription_create',parent:{subscription_details:{subscription:sub.id}},customer:'cus_one',lines:{data:[{period:{end:Math.floor(Date.now()/1000)+86400*30}}]}};
  const apply=async(obj,biz='b1',acct='acct_one')=>{await db.query('BEGIN');try{const r=await applyMembershipInvoice(db,biz,acct,obj,sub);await db.query('COMMIT');return r;}catch(e){await db.query('ROLLBACK');throw e;}};
  for(const obj of [{...invoice,paid:false},{...invoice,amount_paid:1},{...invoice,paid_out_of_band:true},{...invoice,amount_paid_off_stripe:2000},{...invoice,billing_reason:'manual'}])assert.equal(await apply(obj),false);
  assert.equal(await apply(invoice,'b2','acct_two'),false);assert.equal(await apply(invoice),true);assert.equal(await apply(invoice),true);
  let updated=(await db.query('SELECT * FROM customer_memberships')).rows[0];assert.equal(updated.status,'active');assert.equal(updated.sessions_included,3);assert.equal(updated.member_number,member.member_number);
  await db.query('UPDATE customer_memberships SET sessions_used=1');
  assert.equal(await apply({...invoice,id:'in_renewal',billing_reason:'subscription_cycle'}),true);
  updated=(await db.query('SELECT * FROM customer_memberships')).rows[0];assert.equal(updated.sessions_included,6);assert.equal(updated.sessions_used,1);
  const ledger=(await db.query('SELECT * FROM membership_session_ledger')).rows;assert.equal(ledger.length,2);assert.equal(ledger.reduce((s,r)=>s+r.amount_cents,0),4000);
  await assert.rejects(startMembershipCheckout(pool,body,'https://staging.example',api),/already/);assert.equal(creates,1);
 }finally{await pg.close();for(const [i,key]of ['STRIPE_SECRET_KEY','STRIPE_CONNECT_WEBHOOK_SECRET'].entries())if(old[i]===undefined)delete process.env[key];else process.env[key]=old[i];}
});
