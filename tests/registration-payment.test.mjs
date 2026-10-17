import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {registrationPaymentSummary,startRegistrationPayment} from '../server/registration-payment.mjs';
import {startBookingCheckout} from '../server/stripe-checkout.mjs';
test('registration payment stays tenant-scoped, verifies DOB, respects approval/coverage and reuses existing Stripe checkout',async()=>{
 const pg=new PGlite(),keys=['STRIPE_SECRET_KEY','STRIPE_CONNECT_WEBHOOK_SECRET'],old=keys.map(k=>process.env[k]);
 Object.assign(process.env,{STRIPE_SECRET_KEY:'sk_test_fixture',STRIPE_CONNECT_WEBHOOK_SECRET:'whsec_fixture'});
 try{
  for(const f of (await readdir(new URL('../migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort())await pg.exec(await readFile(new URL('../migrations/'+f,import.meta.url),'utf8'));
  const db={query:async(s,v)=>{const r=await pg.query(s,v);return {...r,rowCount:r.rows.length||r.affectedRows||0};},release(){}};const pool={...db,connect:async()=>db};
  await pg.exec("INSERT INTO users(id,email,password_hash) VALUES('u1','one@example.com','hash'),('u2','two@example.com','hash'); INSERT INTO businesses(id,owner_id,slug,name,status) VALUES('b1','u1','one','One','active'),('b2','u2','two','Two','active'); INSERT INTO merchant_accounts(business_id,provider,external_account_id,charges_enabled,onboarding_complete) VALUES('b1','stripe','acct_one',true,true);");
  const id=randomUUID(),request=randomUUID(),data={price:25,services:['Service'],serviceIds:['s'],memberNumber:'AB0101',dateOfBirth:'2000-01-01',email:'private@example.com'};
  await db.query("INSERT INTO appointments(id,owner,date,staff,start,duration,status,data) VALUES($1,'u1','2030-11-01','coach',600,30,'Confirmed',$2)",[id,JSON.stringify(data)]);
  await db.query("INSERT INTO booking_requests(id,business_id,owner_id,date,staff_id,start_minute,duration,details,status,appointment_id) VALUES($1,'b1','u1','2030-11-01','coach',600,30,'{}','accepted',$2)",[request,id]);
  const summary=await registrationPaymentSummary(pool,'u1',id);assert.deepEqual(summary,{state:'due',amountCents:2500,slug:'one',bookingId:request});assert.doesNotMatch(JSON.stringify(summary),/private@example|2000-01-01|token/);
  assert.equal((await registrationPaymentSummary(pool,'u2',id)).state,'unavailable');assert.equal((await registrationPaymentSummary(pool,'u1',null)).state,'awaiting_approval');
  const args={slug:'one',bookingId:request,memberNumber:'AB0101',dateOfBirth:'2000-01-01',origin:'https://staging.example'};
  const accessCount=async()=>Number((await db.query('SELECT count(*) AS n FROM customer_booking_access')).rows[0].n);
  for(const mismatch of [{dateOfBirth:'2001-01-01'},{memberNumber:'CD0101'},{slug:'two'}])await assert.rejects(startRegistrationPayment(pool,{...args,...mismatch}),/do not match/);
  assert.equal(await accessCount(),0,'incorrect identity cannot mint payment access');
  let creates=0;const session={id:'cs_test_registration12345',livemode:false,status:'open',payment_status:'unpaid',url:'https://checkout.stripe.com/c/pay/test_fixture'};
  const api=async(path,o)=>{if(path.startsWith('accounts/'))return {charges_enabled:true,details_submitted:true};assert.equal(o.account,'acct_one');if(path==='checkout/sessions'){creates++;assert.equal(o.params['line_items[0][price_data][unit_amount]'],'2500');}return session;};
  const checkout=(p,a)=>startBookingCheckout(p,a,api);
  assert.equal((await startRegistrationPayment(pool,args,checkout)).checkoutUrl,session.url);assert.equal((await startRegistrationPayment(pool,args,checkout)).checkoutUrl,session.url);assert.equal(creates,1);assert.equal(await accessCount(),0,'temporary access is removed after checkout');
  await db.query("UPDATE booking_requests SET status='pending' WHERE id=$1",[request]);assert.equal((await registrationPaymentSummary(pool,'u1',id)).state,'unavailable');await assert.rejects(startRegistrationPayment(pool,args,checkout),/approve/);assert.equal(await accessCount(),0);
  await db.query("UPDATE booking_requests SET status='accepted' WHERE id=$1",[request]);
  await db.query("UPDATE appointments SET data=$1 WHERE id=$2",[JSON.stringify({...data,price:0,membershipCovered:true}),id]);assert.equal((await registrationPaymentSummary(pool,'u1',id)).state,'covered');await assert.rejects(startRegistrationPayment(pool,args,checkout),/No payment/);
  await db.query("UPDATE appointments SET data=$1,status='Cancelled' WHERE id=$2",[JSON.stringify(data),id]);assert.equal((await registrationPaymentSummary(pool,'u1',id)).state,'unavailable');
  await db.query("UPDATE appointments SET status='Confirmed' WHERE id=$1",[id]);await db.query("UPDATE merchant_accounts SET charges_enabled=false");assert.equal((await registrationPaymentSummary(pool,'u1',id)).state,'contact_business');
  await db.query("UPDATE booking_payments SET status='paid'");assert.equal((await registrationPaymentSummary(pool,'u1',id)).state,'paid');
 }finally{await pg.close();keys.forEach((k,i)=>old[i]===undefined?delete process.env[k]:process.env[k]=old[i]);}
});
