import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {confirmBooking} from '../server/booking-approvals.mjs';
import {queueApprovedBooking,processClientMessages,listClientMessages,retryClientMessages,clientSmsPhone} from '../server/booking-client-notifications.mjs';
import {bookingPaymentPreview} from '../server/booking-payment-preview.mjs';
import {startBookingCheckout,applyBookingPayment} from '../server/stripe-checkout.mjs';
import {sendNotificationChannel} from '../server/notification-delivery.mjs';

test('approval commits private payment links; verified payment commits confirmations once, scoped to registration and business',async()=>{
 const pg=new PGlite(),old=[process.env.STRIPE_SECRET_KEY,process.env.STRIPE_CONNECT_WEBHOOK_SECRET];
 process.env.STRIPE_SECRET_KEY='sk_test_fixture';process.env.STRIPE_CONNECT_WEBHOOK_SECRET='whsec_fixture';
 try{
  for(const f of (await readdir(new URL('../migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort())await pg.exec(await readFile(new URL('../migrations/'+f,import.meta.url),'utf8'));
  const db={query:async(s,v)=>{const r=await pg.query(s,v);return {...r,rowCount:r.rows.length||r.affectedRows||0};},release(){}};
  const pool={...db,connect:async()=>db};
  await pg.exec("INSERT INTO users(id,email,password_hash) VALUES('u1','one@example.com','hash'),('u2','two@example.com','hash'); INSERT INTO businesses(id,owner_id,slug,name,status) VALUES('b1','u1','one','One','active'),('b2','u2','two','Two','active'); INSERT INTO merchant_accounts(business_id,provider,external_account_id,charges_enabled,onboarding_complete) VALUES('b1','stripe','acct_one',true,true);");
  const config={open:8,close:20,buffer:0,services:[{id:'s',name:'Session',price:25,duration:30,maxSlots:1}],staff:[{id:'coach',services:['s']}]};
  await db.query("INSERT INTO settings(owner,data) VALUES('u1',$1)",[JSON.stringify(config)]);
  const requestId=randomUUID(),bookingId=randomUUID(),data={name:'Test Client',email:'registered@example.com',phone:'+14155552671',services:['Session'],serviceIds:['s'],price:25,reviewedBy:'owner'};
  await db.query("INSERT INTO booking_requests(id,business_id,owner_id,date,staff_id,start_minute,duration,details,reviewer) VALUES($1,'b1','u1','2030-11-01','coach',600,30,'{}','owner')",[requestId]);
  await confirmBooking({pool,owner:'u1',services:config.services,staff:'coach',date:'2030-11-01',start:600,duration:30,buffer:0,id:bookingId,data,pendingId:requestId,expectedReviewer:'owner',notificationOrigin:'https://staging.example'});
  await assert.rejects(confirmBooking({pool,owner:'u1',services:config.services,staff:'coach',date:'2030-11-01',start:600,duration:30,id:randomUUID(),data,pendingId:requestId,notificationOrigin:'https://staging.example'}),/reviewed/);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM booking_client_messages')).rows[0].n,2);
  const link=(await db.query('SELECT payment_url FROM booking_client_flows')).rows[0].payment_url,params=new URLSearchParams(new URL(link).hash.slice(1));
  assert.equal(new URL(link).search,'');assert.ok(!link.includes(data.email));
  const args={slug:'one',bookingId:requestId,token:params.get('token'),origin:'https://staging.example'};
  assert.equal((await bookingPaymentPreview(pool,args)).status,'ready');
  await assert.rejects(bookingPaymentPreview(pool,{...args,slug:'two'}),/unavailable/);
  await assert.rejects(bookingPaymentPreview(pool,{...args,token:'b'.repeat(64)}),/unavailable/);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM booking_payments')).rows[0].n,0,'preview never creates checkout');
  assert.equal((await listClientMessages(pool,'u2')).length,0);
  assert.ok(!(await listClientMessages(pool,'u1')).some(x=>'payment_url'in x||'destination'in x||'message'in x));
  const sends=[],send=async(channel,destination,message,env,fetcher,context)=>{sends.push({channel,destination,message,context});return {status:'submitted',detail:'Accepted by test provider'};};
  await processClientMessages(pool,{send});await processClientMessages(pool,{send});
  assert.equal(sends[0].context.kind,'transactional-client');assert.equal(sends[0].context.businessId,'b1');assert.ok(sends[0].context.queuedAt);
  assert.equal(sends.length,2);assert.equal(sends.find(x=>x.channel==='email').destination,data.email);assert.equal(sends.find(x=>x.channel==='sms').destination,data.phone);assert.match(sends[0].message.text,/payment requested/);
  assert.equal((await retryClientMessages(pool,'u2',bookingId)).queued,0);assert.equal((await retryClientMessages(pool,'u1',bookingId)).queued,0);
  let creates=0;
  const session={id:'cs_test_notification12345',livemode:false,status:'open',mode:'payment',payment_status:'unpaid',url:'https://checkout.stripe.com/c/pay/test_fixture'};
  const api=async(path,options)=>{if(path.startsWith('accounts/'))return {charges_enabled:true,details_submitted:true};assert.equal(options.account,'acct_one');if(path==='checkout/sessions')creates++;return session;};
  assert.ok((await startBookingCheckout(pool,args,api)).checkoutUrl);assert.ok((await startBookingCheckout(pool,args,api)).checkoutUrl);assert.equal(creates,1);
  const paid={...session,status:'complete',payment_status:'paid',currency:'usd',payment_intent:'pi_client',amount_total:2500,client_reference_id:bookingId,metadata:{booking_id:bookingId,selahflow_business_id:'b1'}};
  const apply=async obj=>{await db.query('BEGIN');try{const r=await applyBookingPayment(db,'b1','acct_one',obj);await db.query('COMMIT');return r;}catch(e){await db.query('ROLLBACK');throw e;}};
  assert.equal(await apply({...paid,amount_total:1}),false);assert.equal(sends.length,2);
  assert.equal(await apply(paid),true);assert.equal(await apply(paid),true);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM booking_client_messages')).rows[0].n,4);
  await processClientMessages(pool,{send});await processClientMessages(pool,{send});
  assert.equal(sends.length,4);assert.match(sends[2].message.text,/Payment received/);assert.equal((await bookingPaymentPreview(pool,args)).status,'paid');
  assert.equal((await db.query("SELECT count(*)::int AS n FROM events WHERE kind='cash_sale'")).rows[0].n,1);
  // Unknown provider outcomes must not duplicate SMS on later worker runs.
  await db.query("UPDATE booking_client_messages SET status='queued',next_attempt_at=now() WHERE event_type='payment_confirmation' AND channel='sms'");
  let unknown=0;await processClientMessages(pool,{send:async()=>{unknown++;return {status:'unknown',detail:'Timeout'};}});await processClientMessages(pool,{send});assert.equal(unknown,1);assert.equal(sends.length,4);
  // Covered/free appointments never acquire payment links, including old zero-price requests.
  for(const [price,membershipCovered] of [[0,false],[25,true]]){
   const id=randomUUID();await db.query("INSERT INTO appointments(id,owner,date,staff,start,duration,status,data) VALUES($1,'u1','2030-11-02','coach',600,30,'Confirmed',$2)",[id,JSON.stringify({...data,price,membershipCovered})]);
   await queueApprovedBooking(db,{bookingId:id,requestId:randomUUID(),origin:'https://staging.example'});
  }
  assert.equal((await db.query('SELECT count(*)::int AS n FROM booking_client_flows')).rows[0].n,1);
  const extraRequest=randomUUID(),extraBooking=randomUUID();
  await db.query("INSERT INTO booking_requests(id,business_id,owner_id,date,staff_id,start_minute,duration,details,reviewer) VALUES($1,'b1','u1','2030-11-02','coach',660,30,'{}','owner')",[extraRequest]);
  await db.query("INSERT INTO appointments(id,owner,date,staff,start,duration,status,data) VALUES($1,'u1','2030-11-02','coach',660,30,'Confirmed',$2)",[extraBooking,JSON.stringify({...data,phone:''})]);
  await db.query('BEGIN');await queueApprovedBooking(db,{bookingId:extraBooking,requestId:extraRequest,origin:'https://staging.example'});await db.query('ROLLBACK');
  assert.equal((await db.query('SELECT count(*)::int AS n FROM booking_client_flows')).rows[0].n,1,'rolled-back approval leaves no message or token');
  await queueApprovedBooking(db,{bookingId:extraBooking,requestId:extraRequest,origin:'https://staging.example'});
  await processClientMessages(pool,{send:async()=>({status:'not_configured',detail:'Provider not configured'})});
  let extra=(await listClientMessages(pool,'u1')).filter(x=>x.booking_id===extraBooking);
  assert.equal(extra.find(x=>x.channel==='sms').status,'invalid_destination');assert.equal(extra.find(x=>x.channel==='email').status,'not_configured');
  await db.query("UPDATE booking_client_messages SET updated_at=now()-interval '2 minutes' WHERE booking_id=$1",[extraBooking]);
  assert.equal((await retryClientMessages(pool,'u2',extraBooking)).queued,0);assert.equal((await retryClientMessages(pool,'u1',extraBooking)).queued,1);
  assert.ok((await db.query("SELECT client_delivery_authorized_at FROM booking_client_messages WHERE booking_id=$1 AND channel='email'",[extraBooking])).rows[0].client_delivery_authorized_at);
  await db.query("UPDATE appointments SET status='Cancelled' WHERE id=$1",[extraBooking]);
  await processClientMessages(pool,{send});assert.equal(sends.length,4,'cancelled booking never sends a payment request');
  extra=(await listClientMessages(pool,'u1')).filter(x=>x.booking_id===extraBooking);assert.equal(extra.find(x=>x.channel==='email').status,'superseded');
  // Preserve the existing appointment deletion order without orphaned messages.
  await db.query('DELETE FROM booking_requests WHERE id=$1',[extraRequest]);await db.query('DELETE FROM appointments WHERE id=$1',[extraBooking]);
  assert.equal((await listClientMessages(pool,'u1')).filter(x=>x.booking_id===extraBooking).length,0);
  await db.query("UPDATE customer_booking_access SET expires_at=now()-interval '1 second'");await assert.rejects(bookingPaymentPreview(pool,args),/expired/);
 }finally{await pg.close();for(const [i,key]of ['STRIPE_SECRET_KEY','STRIPE_CONNECT_WEBHOOK_SECRET'].entries())if(old[i]===undefined)delete process.env[key];else process.env[key]=old[i];}
});

test('transactional transports preserve staging allowlists, email idempotency and ambiguous SMS outcomes',async()=>{
 assert.equal(clientSmsPhone('+1 (415) 555-2671'),'+14155552671');assert.equal(clientSmsPhone('415-555-2671'),'+14155552671');
 assert.equal(clientSmsPhone('1 415 555 2671'),'+14155552671');assert.equal(clientSmsPhone('+55 11 99999-9999'),'+5511999999999');
 const message={subject:'Booking',text:'Payment received',sms:'Payment received',idempotencyKey:'client-message-test',trackAmbiguous:true};
 const env={RESEND_API_KEY:'fixture',RESEND_FROM_EMAIL:'sender@example.com',TWILIO_ACCOUNT_SID:'ACfixture',TWILIO_AUTH_TOKEN:'fixture',TWILIO_FROM_NUMBER:'+14155550000'};
 let calls=0;const fetcher=async(url,options)=>{calls++;if(url.includes('resend'))assert.equal(options.headers['Idempotency-Key'],message.idempotencyKey);return {ok:true};};
 assert.equal((await sendNotificationChannel('email','client@example.com',message,env,fetcher)).status,'submitted');
 assert.equal((await sendNotificationChannel('sms','+14155552671',message,env,async()=>{throw Error('timeout');})).status,'unknown');
 assert.equal((await sendNotificationChannel('sms','+14155552671',message,env,async()=>({ok:false,status:503}))).status,'unknown');
 assert.equal((await sendNotificationChannel('sms','4155552671',message,env,fetcher)).status,'invalid_destination');
 assert.equal((await sendNotificationChannel('email','client@example.com',message,{...env,APP_ENV:'staging'},fetcher)).status,'not_configured');
 assert.equal(calls,1);
});
