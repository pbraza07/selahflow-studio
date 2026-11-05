import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {listBookingReminderCandidates,prepareBookingReminder} from '../server/payment-reminder-bookings.mjs';
import {bookingPaymentPreview} from '../server/booking-payment-preview.mjs';

async function setup(t){
 const pg=new PGlite();t.after(()=>pg.close());
 for(const f of(await readdir(new URL('../migrations/',import.meta.url))).filter(x=>x.endsWith('.sql')).sort())await pg.exec(await readFile(new URL('../migrations/'+f,import.meta.url),'utf8'));
 const db={query:async(sql,params)=>{const r=await pg.query(sql,params);return {...r,rowCount:r.rows.length||r.affectedRows||0};},release(){}};
 const pool={query:db.query,connect:async()=>db};
 await pg.exec("INSERT INTO users(id,email,password_hash) VALUES('rem-o1','one@example.test','unused'),('rem-o2','two@example.test','unused');INSERT INTO businesses(id,owner_id,slug,name,status) VALUES('rem-b1','rem-o1','rem-one','First business','active'),('rem-b2','rem-o2','rem-two','Second business','active')");
 const config={services:[{id:'s',name:'Session',price:25,duration:30,paymentOptions:'both'}]};
 for(const owner of ['rem-o1','rem-o2'])await db.query('INSERT INTO settings(owner,data) VALUES($1,$2)',[owner,JSON.stringify(config)]);
 const id=randomUUID(),otherId=randomUUID(),data={name:'Synthetic Client',email:'Client@EXAMPLE.test',services:['Session'],serviceIds:['s'],price:25,created:'2026-11-01T12:00:00Z'};
 for(const [key,owner] of [[id,'rem-o1'],[otherId,'rem-o2']])await db.query("INSERT INTO appointments VALUES($1,$2,'2030-01-02','coach',600,30,$3,'Confirmed')",[key,owner,JSON.stringify(data)]);
 const patch=values=>db.query('UPDATE appointments SET data=$1 WHERE id=$2',[JSON.stringify({...data,...values}),id]);
 const list=()=>listBookingReminderCandidates(pool,{businessId:'rem-b1',now:new Date('2026-11-05T14:00:00Z')});
 const prepare=extra=>prepareBookingReminder(pool,{businessId:'rem-b1',sourceId:id,origin:'https://example.test',destination:'client@example.test',...extra});
 return {pg,pool,db,id,otherId,data,config,patch,list,prepare};
}

test('daily session obligations preserve tenant scope and stop for every nonpayable financial state',async t=>{
 const s=await setup(t);
 let rows=await s.list();assert.equal(rows.length,1);assert.equal(rows[0].sourceId,s.id);assert.equal(rows[0].destination,'client@example.test');assert.equal(rows[0].amountCents,2500);assert.equal(rows[0].eligibleSince,new Date(s.data.created).toISOString());assert.equal(rows[0].lastNoticeAt,null);assert.equal(rows[0].url,undefined);
 assert.deepEqual(await listBookingReminderCandidates(s.pool,{businessId:'missing'}),[]);
 assert.equal(await s.prepare({businessId:'rem-b2'}),null);assert.equal(await s.prepare({destination:'different@example.test'}),null);
 assert.equal((await s.db.query('SELECT count(*)::int AS n FROM booking_client_flows')).rows[0].n,0);
 for(const change of [{price:0},{price:-2},{price:'invalid'},{membershipCovered:true},{paymentStatus:'paid'},{email:''},{serviceIds:['removed']},{serviceIds:['s','removed']},{paymentLines:[{type:'service',id:'s',price:30,qty:1}]}]){await s.patch(change);assert.deepEqual(await s.list(),[],JSON.stringify(change));assert.equal(await s.prepare(),null);}
 await s.patch({});
 for(const status of ['Cancelled','No-show','Declined','Submitted']){await s.db.query('UPDATE appointments SET status=$1 WHERE id=$2',[status,s.id]);assert.deepEqual(await s.list(),[],status);}
 await s.db.query("UPDATE appointments SET status='Completed' WHERE id=$1",[s.id]);assert.equal((await s.list()).length,1);await s.db.query("UPDATE appointments SET status='Confirmed' WHERE id=$1",[s.id]);
 await s.db.query('UPDATE settings SET data=$1 WHERE owner=$2',[JSON.stringify({...s.config,dailyPaymentReminders:false}),'rem-o1']);assert.deepEqual(await s.list(),[]);await s.db.query('UPDATE settings SET data=$1 WHERE owner=$2',[JSON.stringify(s.config),'rem-o1']);
 const rid=randomUUID();await s.db.query("INSERT INTO booking_requests(id,business_id,owner_id,date,staff_id,start_minute,duration,details,reviewer,appointment_id) VALUES($1,'rem-b1','rem-o1','2030-01-02','coach',600,30,'{}','owner',$2)",[rid,s.id]);
 assert.deepEqual(await s.list(),[]);await s.db.query("UPDATE booking_requests SET status='accepted',reviewed_at='2026-11-03T12:00:00Z' WHERE id=$1",[rid]);await s.patch({bookingRequestId:rid});rows=await s.list();assert.equal(rows[0].eligibleSince,'2026-11-03T12:00:00.000Z');
 await s.patch({bookingRequestId:'missing'});assert.deepEqual(await s.list(),[]);await s.patch({bookingRequestId:rid});
 await s.db.query("INSERT INTO booking_payments(booking_id,business_id,stripe_account_id,amount_cents,lines,terminal_payment_intent_id) VALUES($1,'rem-b1','acct_fixture',2500,'[]','pi_fixture')",[s.id]);assert.deepEqual(await s.list(),[]);
 await s.db.query("UPDATE booking_payments SET status='expired'");assert.equal((await s.list()).length,1,'confirmed terminal cancellation retains its id but must not suppress reminders forever');
 await s.db.query("UPDATE booking_payments SET terminal_payment_intent_id=NULL,status='paid'");assert.deepEqual(await s.list(),[]);await s.db.query("UPDATE booking_payments SET status='expired',amount_cents=2600");assert.deepEqual(await s.list(),[]);await s.db.query('DELETE FROM booking_payments');
 await s.db.query("INSERT INTO events(id,owner,created,kind,data) VALUES('rem-other-cash','rem-o2','2026-11-04','cash_sale',$1)",[JSON.stringify({bookingId:s.id,total:25})]);assert.equal((await s.list()).length,1);
 await s.db.query("INSERT INTO events(id,owner,created,kind,data) VALUES('rem-cash','rem-o1','2026-11-04','cash_sale',$1)",[JSON.stringify({bookingId:s.id,total:25})]);assert.deepEqual(await s.list(),[]);assert.equal(await s.prepare(),null);
 await s.db.query("DELETE FROM events WHERE id='rem-cash'");await s.db.query("UPDATE businesses SET status='archived' WHERE id='rem-b1'");assert.deepEqual(await s.list(),[]);
});

test('reminder preparation rechecks payment/email and rotates private links without sending messages or changing onsite policy',async t=>{
 const s=await setup(t),rid=randomUUID();
 await s.db.query("INSERT INTO booking_requests(id,business_id,owner_id,date,staff_id,start_minute,duration,details,reviewer,appointment_id,status,reviewed_at) VALUES($1,'rem-b1','rem-o1','2030-01-02','coach',600,30,'{}','owner',$2,'accepted','2026-11-03T12:00:00Z')",[rid,s.id]);
 await s.patch({bookingRequestId:rid,paymentPolicy:'onsite_only'});
 const before=(await s.db.query('SELECT data FROM appointments WHERE id=$1',[s.id])).rows[0].data;
 const first=await s.prepare();assert.equal(first.actionLabel,'View session payment details');assert.equal(first.paymentOptions.online,false);assert.match(first.note,/due at the business/);
 const url=new URL(first.url),hash=new URLSearchParams(url.hash.slice(1));assert.equal(url.pathname,'/payment/rem-one');assert.equal(url.search,'');assert.equal(hash.get('booking_id'),rid);assert.match(hash.get('token'),/^[a-f0-9]{64}$/);
 assert.equal((await bookingPaymentPreview(s.pool,{slug:'rem-one',bookingId:rid,token:hash.get('token')})).status,'onsite');
 assert.equal((await s.db.query('SELECT data FROM appointments WHERE id=$1',[s.id])).rows[0].data,before);
 assert.equal((await s.db.query('SELECT count(*)::int AS n FROM booking_client_messages')).rows[0].n,0);assert.equal((await s.db.query('SELECT count(*)::int AS n FROM booking_receipt_emails')).rows[0].n,0);assert.equal((await s.db.query('SELECT count(*)::int AS n FROM booking_payments')).rows[0].n,0);
 assert.equal((await s.prepare()).url,first.url,'valid scoped link is reused');
 await s.db.query("INSERT INTO booking_receipt_emails(booking_key,event_type,business_id,destination,destination_masked,message,created_at) VALUES($1,'approval','rem-b1','client@example.test','c***@example.test','{}','2026-11-04T10:00:00Z')",[rid]);
 assert.equal((await s.list())[0].lastNoticeAt,'2026-11-04T10:00:00.000Z');
 await s.db.query("UPDATE booking_client_flows SET expires_at=now()-interval '1 second' WHERE booking_id=$1",[s.id]);
 const refreshed=await s.prepare();assert.notEqual(refreshed.url,first.url);assert.equal(refreshed.eligibleSince,first.eligibleSince);assert.equal(refreshed.lastNoticeAt,'2026-11-04T10:00:00.000Z');
 assert.equal(new URLSearchParams(new URL(refreshed.url).hash.slice(1)).get('booking_id'),rid);assert.equal((await s.db.query('SELECT count(*)::int AS n FROM customer_booking_access')).rows[0].n,2);
 await s.patch({bookingRequestId:rid,paymentPolicy:'onsite_only',ownerEmailPaymentAllowed:true});assert.equal((await s.prepare()).actionLabel,'Pay for session');
 await s.patch({bookingRequestId:rid,email:'changed@example.test'});assert.equal(await s.prepare(),null,'recipient change is rechecked before composing');
 await s.patch({bookingRequestId:rid,paymentStatus:'paid'});assert.equal(await s.prepare(),null,'payment completed after candidate scan is skipped');
 await s.patch({bookingRequestId:rid});await s.db.query('DELETE FROM customer_booking_access');
 const repaired=await s.prepare();assert.notEqual(repaired.url,refreshed.url,'missing access token is repaired');
 await s.db.query("UPDATE booking_client_flows SET expires_at=now()-interval '1 second' WHERE booking_id=$1",[s.id]);
 const failDb={...s.db,query:async(sql,args)=>{if(sql.startsWith('INSERT INTO customer_booking_access'))throw Error('Fixture token insert failure');return s.db.query(sql,args);}};
 const failPool={query:failDb.query,connect:async()=>failDb};await assert.rejects(prepareBookingReminder(failPool,{businessId:'rem-b1',sourceId:s.id,origin:'https://example.test'}),/Fixture/);
 assert.equal((await s.db.query('SELECT payment_url FROM booking_client_flows WHERE booking_id=$1',[s.id])).rows[0].payment_url,repaired.url,'failed link refresh rolls back as one transaction');
});

test('existing booking checkouts are checked read-only so delayed webhooks and in-flight payments stop reminders',async t=>{
 const s=await setup(t);
 await s.db.query("INSERT INTO booking_payments(booking_id,business_id,stripe_account_id,amount_cents,lines,stripe_checkout_session_id) VALUES($1,'rem-b1','acct_fixture',2500,'[]','cs_fixture')",[s.id]);
 const session={id:'cs_fixture',mode:'payment',client_reference_id:s.id,metadata:{booking_id:s.id,selahflow_business_id:'rem-b1'},currency:'usd',amount_total:2500,payment_status:'paid',status:'complete',payment_intent:'pi_fixture',livemode:false};
 const intent={id:'pi_fixture',currency:'usd',amount:2500,metadata:{booking_id:s.id},status:'requires_payment_method',livemode:false};
 const calls=[],api=async(path,options)=>{calls.push(path);assert.deepEqual(options,{method:'GET',account:'acct_fixture'});if(path==='checkout/sessions/cs_fixture')return session;if(path==='payment_intents/pi_fixture')return intent;throw Error('Unexpected provider mutation or reference: '+path);};
 const prepare=extra=>s.prepare({api,configured:true,...extra});
 const before=(await s.db.query('SELECT * FROM booking_payments')).rows[0];
 assert.equal(await prepare(),null,'provider-paid checkout suppresses a stale local pending balance');
 assert.equal(calls.length,1);
 session.payment_status='unpaid';assert.equal(await prepare(),null,'completed checkout is not requested again while reconciliation is pending');
 session.status='open';
 for(const status of ['processing','succeeded','requires_capture']){intent.status=status;assert.equal(await prepare(),null,status);}
 assert.equal((await s.db.query('SELECT count(*)::int AS n FROM booking_client_flows')).rows[0].n,0,'suppressed reminders never create payment access');
 intent.status='unknown';await assert.rejects(prepare(),/status is unavailable/);
 intent.status='requires_payment_method';
 session.metadata.selahflow_business_id='rem-b2';await assert.rejects(prepare(),/checkout details/);session.metadata.selahflow_business_id='rem-b1';
 session.amount_total=2400;await assert.rejects(prepare(),/checkout details/);session.amount_total=2500;
 intent.metadata.booking_id=s.otherId;await assert.rejects(prepare(),/payment details/);intent.metadata.booking_id=s.id;
 await assert.rejects(prepare({configured:false}),/status is unavailable/);
 await assert.rejects(prepare({api:async()=>{throw Error('Provider temporarily unavailable');}}),/temporarily unavailable/,'uncertain provider failures reach the worker retry path');
 const ready=await prepare();assert.equal(ready.amountCents,2500);assert.match(ready.url,/https:\/\/example.test\/payment\/rem-one#/);
 assert.deepEqual((await s.db.query('SELECT * FROM booking_payments')).rows[0],before,'read-only verification never reconciles, charges, or creates checkout');
 assert.equal((await s.db.query('SELECT count(*)::int AS n FROM stripe_payment_receipts')).rows[0].n,0);assert.equal((await s.db.query('SELECT count(*)::int AS n FROM booking_client_messages')).rows[0].n,0);
 const changed=async(path,options)=>{const value=await api(path,options);if(path.startsWith('checkout/'))await s.db.query("UPDATE booking_payments SET stripe_checkout_session_id='cs_replacement' WHERE booking_id=$1",[s.id]);return value;};
 await assert.rejects(prepare({api:changed}),/changed while preparing/,'replacement references are retried instead of sending stale payment proof');
 const settled=async(path,options)=>{const value=await api(path,options);if(path.startsWith('checkout/'))await s.db.query("UPDATE booking_payments SET status='paid' WHERE booking_id=$1",[s.id]);return value;};
 assert.equal(await prepare({api:settled}),null,'a local settlement during provider reads suppresses the prepared reminder');
 await s.db.query("UPDATE booking_payments SET status='expired',stripe_checkout_session_id=NULL,terminal_payment_intent_id='pi_fixture' WHERE booking_id=$1",[s.id]);
 intent.metadata.selahflow_business_id='rem-b1';intent.status='processing';assert.equal(await prepare(),null,'an existing intent is verified even without a checkout session');
 intent.status='canceled';assert.equal((await prepare()).url,ready.url,'confirmed terminal cancellation remains eligible with its retained reference');
 await s.db.query('DELETE FROM booking_payments WHERE booking_id=$1',[s.id]);
 assert.equal((await prepare({configured:false,api:async()=>{throw Error('Bookings without provider references must not call Stripe');}})).url,ready.url);
});
