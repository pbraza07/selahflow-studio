import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {requiresBookingApproval} from '../server/booking-review.mjs';
import {bookingPaymentPreview} from '../server/booking-payment-preview.mjs';
import {startBookingCheckout,applyBookingPayment} from '../server/stripe-checkout.mjs';
import {tokenHash} from '../server/security.mjs';
import {confirmDirectBookingForPayment} from '../server/direct-booking-approval.mjs';
test('catalog checkbox controls approval, independently of business notification settings',()=>{
 assert.equal(requiresBookingApproval([{requiresApproval:false}]),false);
 assert.equal(requiresBookingApproval([{}]),false);
 assert.equal(requiresBookingApproval([{requiresApproval:false},{requiresApproval:true}]),true);
});
test('an authenticated old pending request can pay directly when catalog approval is unchecked, with atomic capacity and verified-payment email',async()=>{
 const pg=new PGlite(),keys=['STRIPE_SECRET_KEY','STRIPE_CONNECT_WEBHOOK_SECRET'],old=keys.map(k=>process.env[k]);process.env.STRIPE_SECRET_KEY='sk_test_fixture';process.env.STRIPE_CONNECT_WEBHOOK_SECRET='whsec_fixture';
 try{
  for(const f of (await readdir(new URL('../migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort())await pg.exec(await readFile(new URL('../migrations/'+f,import.meta.url),'utf8'));
  const query=async(s,v)=>{const r=await pg.query(s,v);return {...r,rowCount:r.rows.length||r.affectedRows||0};},db={query,release(){}},pool={query,connect:async()=>db};
  await pg.exec("INSERT INTO users(id,email,password_hash) VALUES('u1','owner@example.test','x'),('u2','other@example.test','x'); INSERT INTO businesses(id,owner_id,slug,name,status) VALUES('b1','u1','club-one','Club One','active'),('b2','u2','club-two','Club Two','active'); INSERT INTO merchant_accounts(business_id,provider,external_account_id,charges_enabled,onboarding_complete) VALUES('b1','stripe','acct_fixture',true,true)");
  const service={id:'s',name:'Pickup Soccer',duration:60,price:15,requiresApproval:false,maxSlots:1},config={open:8,close:23,buffer:0,bookingApprovalEnabled:true,services:[service],staff:[{id:'coach',services:['s']}]};
  const save=()=>query("INSERT INTO settings(owner,data) VALUES('u1',$1) ON CONFLICT(owner) DO UPDATE SET data=excluded.data",[JSON.stringify(config)]);await save();
  const id=randomUUID(),token=tokenHash(id),details={serviceIds:['s'],services:['Pickup Soccer'],customerName:'Client Test',customerEmail:'client@example.test',customerPhone:'',quotedPrice:15,memberNumber:'CT0101',dateOfBirth:'2000-01-01',policyAccepted:true};
  const add=async(id,start=1200,date='2030-11-01')=>{await query("INSERT INTO booking_requests(id,business_id,owner_id,date,staff_id,start_minute,duration,details,reviewer) VALUES($1,'b1','u1',$4,'coach',$2,60,$3,'owner')",[id,start,JSON.stringify(details),date]);await query("INSERT INTO customer_booking_access(token_hash,owner_id,booking_id) VALUES($1,'u1',$2)",[tokenHash(tokenHash(id)),id]);};await add(id);
  const args={slug:'club-one',bookingId:id,token,origin:'https://staging.example'};
  const preview=await bookingPaymentPreview(pool,args);assert.equal(preview.status,'ready');assert.equal(preview.pendingReservation,true);
  assert.equal((await query('SELECT count(*)::int AS n FROM appointments')).rows[0].n,0,'preview never confirms a booking');
  let creates=0;const session={id:'cs_test_fixture12345',livemode:false,mode:'payment',status:'open',payment_status:'unpaid',url:'https://checkout.stripe.com/c/pay/test_fixture'};
  const api=async(path,o)=>{if(path.startsWith('accounts/'))return {charges_enabled:true,details_submitted:true};if(path==='checkout/sessions'){creates++;assert.equal(o.params['line_items[0][price_data][unit_amount]'],'1500');}return session;};
  await assert.rejects(startBookingCheckout(pool,{...args,token:'b'.repeat(64)},api),/expired/);await assert.rejects(startBookingCheckout(pool,{...args,slug:'club-two'},api),/expired/);
  assert.equal((await query('SELECT count(*)::int AS n FROM appointments')).rows[0].n,0,'wrong token and business cannot auto-confirm');
  assert.equal((await startBookingCheckout(pool,args,api)).checkoutUrl,session.url);assert.equal((await startBookingCheckout(pool,args,api)).checkoutUrl,session.url);assert.equal(creates,1);
  const request=(await query('SELECT status,appointment_id,reviewed_by FROM booking_requests WHERE id=$1',[id])).rows[0];assert.equal(request.status,'accepted');assert.equal(request.appointment_id,id);assert.match(request.reviewed_by,/automatic/);
  assert.equal((await query('SELECT count(*)::int AS n FROM appointments')).rows[0].n,1);
  const duplicate=randomUUID();await add(duplicate);await assert.rejects(startBookingCheckout(pool,{...args,bookingId:duplicate,token:tokenHash(duplicate)},api),/another appointment|no longer available|capacity/);assert.equal((await query('SELECT status FROM booking_requests WHERE id=$1',[duplicate])).rows[0].status,'pending','full times stay pending and never charge');assert.equal(creates,1);
  const checked=randomUUID();await add(checked,600);config.services[0].requiresApproval=true;await save();await assert.rejects(startBookingCheckout(pool,{...args,bookingId:checked,token:tokenHash(checked)},api),/must approve/);assert.equal(creates,1);
  config.services[0].requiresApproval=false;config.services[0].price=20;await save();await assert.rejects(startBookingCheckout(pool,{...args,bookingId:checked,token:tokenHash(checked)},api),/Service details changed/);assert.equal(creates,1);
  config.services[0].price=15;await save();await query("UPDATE booking_requests SET status='declined' WHERE id=$1",[checked]);await assert.rejects(startBookingCheckout(pool,{...args,bookingId:checked,token:tokenHash(checked)},api),/must approve/);
  const paid={...session,payment_status:'paid',currency:'usd',amount_total:1500,payment_intent:'pi_fixture',client_reference_id:id,metadata:{booking_id:id,selahflow_business_id:'b1'}};
  await query('BEGIN');assert.equal(await applyBookingPayment(db,'b1','acct_fixture',paid),true);await query('COMMIT');
  const message=(await query("SELECT destination,message FROM booking_client_messages WHERE booking_id=$1 AND event_type='payment_confirmation' AND channel='email'",[id])).rows[0];assert.equal(message.destination,'client@example.test');assert.match(message.message.text,/Payment received/);
  config.bookableSessions=[{id:'group',service:'s',staff:'coach',date:'2030-11-02',start:1200,capacity:1}];details.sessionId='group';await save();
  const groupOne=randomUUID(),groupTwo=randomUUID();await add(groupOne,1200,'2030-11-02');await add(groupTwo,1200,'2030-11-02');
  await confirmDirectBookingForPayment(pool,{...args,bookingId:groupOne,token:tokenHash(groupOne)});await assert.rejects(confirmDirectBookingForPayment(pool,{...args,bookingId:groupTwo,token:tokenHash(groupTwo)}),/full/);
  assert.equal((await query('SELECT status FROM booking_requests WHERE id=$1',[groupTwo])).rows[0].status,'pending','group capacity is never bypassed');
 }finally{await pg.close();keys.forEach((k,i)=>old[i]===undefined?delete process.env[k]:process.env[k]=old[i]);}
});
