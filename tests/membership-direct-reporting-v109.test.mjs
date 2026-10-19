import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {membershipRequestDetails,registerMembershipWithoutApproval} from '../server/membership-requests.mjs';
import {startMembershipCheckout} from '../server/membership-checkout.mjs';
import {appointmentActivity,unpaidAppointmentForecast} from '../server/report-activity.mjs';
import {reconcileStripeBookingReceipts,reportSaleEvents} from '../server/report-payments.mjs';

async function setup(){
 const pg=new PGlite();
 for(const file of (await readdir(new URL('../migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort())
  await pg.exec(await readFile(new URL('../migrations/'+file,import.meta.url),'utf8'));
 const db={query:async(sql,vars)=>{const r=await pg.query(sql,vars);return {...r,rowCount:r.rowCount??r.rows.length};},release(){}};
 return {pg,pool:{...db,connect:async()=>db}};
}
test('immediate membership registration requires no owner action, adds no credits and reuses member identity',async()=>{
 const {pg,pool}=await setup();
 const priorEnv=[process.env.STRIPE_SECRET_KEY,process.env.STRIPE_CONNECT_WEBHOOK_SECRET];
 process.env.STRIPE_SECRET_KEY='sk_test_fixture';process.env.STRIPE_CONNECT_WEBHOOK_SECRET='whsec_fixture';
 try{
  await pg.exec("INSERT INTO users(id,email,password_hash) VALUES('u1','one@example.com','hash'),('u2','two@example.com','hash'); INSERT INTO businesses(id,owner_id,slug,name,status) VALUES('b1','u1','one','One','active'),('b2','u2','two','Two','active'); INSERT INTO membership_plans(id,business_id,name,interval_unit,price_cents,sessions_included) VALUES('p1','b1','Training','month',2000,3); INSERT INTO merchant_accounts(business_id,provider,external_account_id,charges_enabled,onboarding_complete) VALUES('b1','stripe','acct_one',true,true);");
  const config={bookingCustomFields:[{id:'training',label:'Training goal',type:'text',forms:['membership'],required:true}]};
  const body={slug:'one',planId:'p1',requestId:randomUUID(),firstName:'Client',lastName:'One',email:'client@example.com',dateOfBirth:'2000-04-03',termsAccepted:true,recurringAccepted:true,customAnswers:{training:'Goal'}};
  const details=membershipRequestDetails(config,body);
  const options={businessId:'b1',ownerId:'u1',planId:'p1',requestId:body.requestId,details};
  const direct=await registerMembershipWithoutApproval(pool,options);
  assert.equal(direct.registered,true);assert.equal(direct.paymentPending,true);
  assert.equal(direct.memberNumber,'CO0403');
  assert.equal((await pg.query("SELECT status FROM membership_requests WHERE id=$1",[body.requestId])).rows[0].status,'approved','registration never appears in owner approval queue');
  const member=(await pg.query('SELECT * FROM customer_memberships WHERE id=$1',[direct.membershipId])).rows[0];
  assert.equal(member.status,'pending_payment');assert.equal(member.sessions_included,0);assert.equal(member.sessions_used,0);
  assert.equal(member.stripe_account_id,'');assert.deepEqual(member.registration_answers,{training:'Goal'});
  assert.equal((await registerMembershipWithoutApproval(pool,options)).membershipId,direct.membershipId);
  await assert.rejects(registerMembershipWithoutApproval(pool,{...options,businessId:'b2',ownerId:'u2'}),/another enrollment/);
  let created=0;const session={id:'cs_test_direct123456',livemode:false,status:'open',url:'https://checkout.stripe.com/c/pay/direct'};
  const api=async(path,options)=>{
   if(path.startsWith('accounts/'))return {charges_enabled:true,details_submitted:true};
   assert.equal(options.account,'acct_one');
   if(path==='checkout/sessions'){
    created++;assert.equal(options.params.mode,'subscription');
    assert.equal(options.params['line_items[0][price_data][unit_amount]'],'2000');
    return session;
   }
   return session;
  };
  const checkout=await startMembershipCheckout(pool,{...body,requestId:randomUUID()},'https://staging.example',api);
  assert.equal(checkout.checkoutUrl,session.url);
  assert.equal((await pg.query("SELECT status FROM customer_memberships WHERE id=$1",[direct.membershipId])).rows[0].status,'pending_payment','checkout alone cannot activate membership');
  const retry=await startMembershipCheckout(pool,{...body,requestId:randomUUID()},'https://staging.example',api);
  assert.equal(retry.checkoutUrl,session.url);assert.equal(created,1,'retry reuses Stripe session');
  assert.equal((await pg.query('SELECT COUNT(*)::int AS n FROM customer_memberships WHERE business_id=$1',['b1'])).rows[0].n,1);
  await assert.rejects(startMembershipCheckout(pool,{...body,email:'different@example.com',requestId:randomUUID()},'https://staging.example',api),/another enrollment/);
  assert.equal((await pg.query("SELECT COUNT(*)::int AS n FROM membership_session_ledger WHERE business_id=$1",['b1'])).rows[0].n,0,'unpaid registration has no paid revenue or credits');
 }finally{
  await pg.close();
  for(const [i,key] of ['STRIPE_SECRET_KEY','STRIPE_CONNECT_WEBHOOK_SECRET'].entries())if(priorEnv[i]===undefined)delete process.env[key];else process.env[key]=priorEnv[i];
 }
});

test('report buckets are exclusive, paid appointments are excluded from projections, and payment receipts are reconciled once',async()=>{
 const appointments=[
  {id:'a1',status:'Confirmed',date:'2026-10-22',price:30},
  {id:'a2',status:'Scheduled',date:'2026-10-22',price:30},
  {id:'a3',status:'Checked in',date:'2026-10-22',price:30},
  {id:'a4',status:'Completed',date:'2026-10-22',price:30,paymentStatus:'paid'},
  {id:'a5',status:'Cancelled',date:'2026-10-22',price:30},
  {id:'a6',status:'No-show',date:'2026-10-22',price:30},
  {id:'a7',status:'Confirmed',date:'2026-10-22',price:30,membershipCovered:true}
 ];
 const a=appointmentActivity(appointments);
 assert.deepEqual([a.all.length,a.booked.length,a.checkedIn.length,a.completed.length,a.canceled.length,a.noShows.length,a.paid.length],[7,3,1,1,1,1,1]);
 const forecast=unpaidAppointmentForecast(appointments,x=>x.price);
 assert.deepEqual(forecast.map(x=>x.id),['a1','a2','a3']);
 assert.equal(forecast.reduce((n,x)=>n+x.estimatedAmount,0),90);
 const {pg,pool}=await setup();
 try{
  await pg.exec("INSERT INTO users(id,email,password_hash) VALUES('u1','one@example.com','hash'); INSERT INTO businesses(id,owner_id,slug,name,status) VALUES('b1','u1','one','One','active'); INSERT INTO appointments(id,owner,date,staff,start,duration,status,data) VALUES('booking-one','u1','2026-10-22','staff',600,30,'Confirmed','{\"name\":\"Client One\",\"price\":25}');");
  await pool.query("INSERT INTO booking_payments(booking_id,business_id,stripe_account_id,amount_cents,lines,stripe_payment_intent_id,status,paid_at) VALUES('booking-one','b1','acct_one',2500,$1::jsonb,'pi_paid','paid',now())",[JSON.stringify([{id:'svc-one',type:'service',name:'Training',price:25,qty:1}])]);
  const fallback=await reconcileStripeBookingReceipts(pool,'u1',[]);
  assert.equal(fallback.length,1);assert.equal(fallback[0].total,25);
  assert.match(fallback[0].id,/stripe-booking-acct_one-pi_paid/);
  assert.equal((await reconcileStripeBookingReceipts(pool,'u1',fallback)).length,0,'audit and receipt do not double count');
  assert.equal((await reconcileStripeBookingReceipts(pool,'u2',[])).length,0,'no cross-business reporting');
  assert.equal(reportSaleEvents(fallback,[{id:'svc-one'}])[0].total,25);
  assert.equal(reportSaleEvents(fallback,[]).length,0,'deleted service does not contribute to paid reporting');
  await pool.query("UPDATE booking_payments SET status='pending' WHERE booking_id='booking-one'");
  assert.equal((await reconcileStripeBookingReceipts(pool,'u1',[])).length,0,'unpaid checkout never enters paid revenue');
 }finally{await pg.close();}
});
