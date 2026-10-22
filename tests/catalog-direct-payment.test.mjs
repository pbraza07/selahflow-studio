import {confirmBooking} from '../server/booking-approvals.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {requiresBookingApproval} from '../server/booking-review.mjs';
import {bookingPaymentPreview} from '../server/booking-payment-preview.mjs';
import {startBookingCheckout,applyBookingPayment} from '../server/stripe-checkout.mjs';
import {tokenHash} from '../server/security.mjs';
import {confirmDirectBookingForPayment,reconcileUncheckedBookings} from '../server/direct-booking-approval.mjs';
import {processClientMessages} from '../server/booking-client-notifications.mjs';
import {sessionIsFull,SESSION_FULL_MESSAGE} from '../server/session-capacity.mjs';
import {computeDayAvailability} from '../server/session-scheduling.mjs';
test('explicit owner catalog choices control new approval; legacy unset stays protected',()=>{
 assert.equal(requiresBookingApproval([{requiresApproval:false}]),false);
 assert.equal(requiresBookingApproval([{}]),true);
 assert.equal(requiresBookingApproval([{requiresApproval:false},{requiresApproval:true}]),true);
});
test('all pending bookings require explicit owner approval before Stripe checkout; capacity and payment receipts remain atomic',async()=>{
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
 let creates=0;const session={id:'cs_test_fixture12345',livemode:false,mode:'payment',status:'open',payment_status:'unpaid',url:'https://checkout.stripe.com/c/pay/test_fixture'};
 const api=async(path,o)=>{if(path.startsWith('accounts/'))return {charges_enabled:true,details_submitted:true};if(path==='checkout/sessions')creates++;return session;};
 await assert.rejects(bookingPaymentPreview(pool,args),/unavailable/);
 await assert.rejects(startBookingCheckout(pool,args,api),/must approve/);assert.equal(creates,0);
 await confirmDirectBookingForPayment(pool,args);assert.equal((await query('SELECT count(*)::int n FROM appointments')).rows[0].n,0);
 assert.equal((await reconcileUncheckedBookings(pool,{origin:args.origin})).confirmed,0);
 const approve=(bookingId,date='2030-11-01',start=1200,sessionId=null)=>confirmBooking({pool,owner:'u1',services:[service],staff:'coach',date,start,duration:60,buffer:0,id:bookingId,pendingId:bookingId,expectedReviewer:'owner',data:{name:details.customerName,email:details.customerEmail,memberNumber:details.memberNumber,serviceIds:['s'],services:['Pickup Soccer'],price:15,membershipCovered:false,membershipCreditAllowed:true,sessionId,reviewedBy:'owner'}});
 await approve(id);
 assert.equal((await query('SELECT status FROM booking_requests WHERE id=$1',[id])).rows[0].status,'accepted');
 assert.equal((await bookingPaymentPreview(pool,args)).status,'ready');
 await assert.rejects(startBookingCheckout(pool,{...args,token:'b'.repeat(64)},api),/expired/);
 await startBookingCheckout(pool,args,api);await startBookingCheckout(pool,args,api);assert.equal(creates,1);
 const paid={...session,payment_status:'paid',currency:'usd',amount_total:1500,payment_intent:'pi_fixture',client_reference_id:id,metadata:{booking_id:id,selahflow_business_id:'b1'}};
 await query('BEGIN');assert.equal(await applyBookingPayment(db,'b1','acct_fixture',paid),true);await query('COMMIT');
 assert.equal((await bookingPaymentPreview(pool,args)).status,'paid');
 const message=(await query("SELECT id,destination,message FROM booking_client_messages WHERE booking_id=$1 AND event_type='payment_confirmation' AND channel='email'",[id])).rows[0];assert.equal(message.destination,'client@example.test');
 let sends=0;await processClientMessages(pool,{messageIds:[message.id],send:async()=>{sends++;return {status:'submitted',detail:'Synthetic provider acceptance'};}});
 await processClientMessages(pool,{messageIds:[message.id],send:async()=>{throw Error('Must not resend');}});assert.equal(sends,1);
 config.bookableSessions=[{id:'group',service:'s',staff:'coach',date:'2030-11-02',start:1200,capacity:1}];details.sessionId='group';await save();
 const first=randomUUID(),second=randomUUID();await add(first,1200,'2030-11-02');await add(second,1200,'2030-11-02');
 await approve(first,'2030-11-02',1200,'group');await assert.rejects(approve(second,'2030-11-02',1200,'group'),/full/);
 assert.equal((await query('SELECT status FROM booking_requests WHERE id=$1',[second])).rows[0].status,'pending');
 await assert.rejects(startBookingCheckout(pool,{...args,bookingId:second,token:tokenHash(second)},api),/must approve/);
 const input={owner:'u1',config,date:'2030-11-02',staff:'coach',services:[service],start:1200};assert.equal(await sessionIsFull(pool,input),true);assert.equal(await sessionIsFull(pool,{...input,owner:'u2'}),false);
 const reserved={...args,bookingId:first,token:tokenHash(first)};assert.equal((await bookingPaymentPreview(pool,reserved)).status,'ready');await startBookingCheckout(pool,reserved,async(path,o)=>path==='checkout/sessions'?{...session,id:'cs_test_reserved_seat12345'}:api(path,o));
 await query("UPDATE appointments SET status='Cancelled' WHERE id=$1",[first]);assert.equal(await sessionIsFull(pool,input),false);
 }finally{await pg.close();keys.forEach((k,i)=>old[i]===undefined?delete process.env[k]:process.env[k]=old[i]);}
});
