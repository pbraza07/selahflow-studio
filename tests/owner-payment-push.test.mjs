import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {deliverOwnerPaymentPush} from '../server/owner-payment-push.mjs';
import {pushBookingRequest} from '../server/push-delivery.mjs';

async function fixture(t,{installPaymentMigration=true}={}){
 const db=new PGlite();t.after(()=>db.close());
 for(const f of(await readdir(new URL('../migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')&&(installPaymentMigration||!f.startsWith('090_'))).sort())await db.exec(await readFile(new URL('../migrations/'+f,import.meta.url),'utf8'));
 await db.exec(`INSERT INTO users(id,email,password_hash) VALUES('owner','owner@example.test','x'),('other','other@example.test','x');
  INSERT INTO businesses(id,owner_id,slug,name,status) VALUES('biz','owner','one','Business One','active'),('otherbiz','other','two','Business Two','active');
  INSERT INTO settings VALUES('owner','{"staff":[{"id":"staff"}],"bookingApprovalEnabled":false,"bookingApprovalReviewer":"staff"}'),('other','{}');
  INSERT INTO business_push_subscriptions(id,business_id,reviewer,endpoint,p256dh,auth) VALUES('owner-a','biz','owner','device-a','x','x'),('owner-b','biz','owner','device-b','x','x'),('staff','biz','staff','staff-device','x','x'),('other-owner','otherbiz','owner','other-device','x','x');
  INSERT INTO membership_plans(id,business_id,name,interval_unit,price_cents,sessions_included,billing_type) VALUES('plan','biz','Monthly','month',10000,10,'membership'),('package','biz','Package','month',5000,5,'package');
  INSERT INTO customer_memberships(id,business_id,plan_id,customer_name,customer_email,member_number,status,price_cents,sessions_included,billing_type,stripe_account_id) VALUES('member','biz','plan','Private Client','private@example.test','PC1001','active',10000,10,'membership','manual'),('pack','biz','package','Private Client','private@example.test','PC1002','active',5000,5,'package','manual');`);
 return db;
}
async function booking(db,id='visit'){
 await db.query("INSERT INTO appointments(id,owner,date,staff,start,duration,data,status) VALUES($1,'owner','2030-01-02','staff',600,30,$2,'Confirmed')",[id,JSON.stringify({name:'Private Client',price:32,services:['Session'],serviceIds:['session']})]);
 await db.query("INSERT INTO booking_payments(booking_id,business_id,stripe_account_id,amount_cents,lines,stripe_checkout_session_id) VALUES($1,'biz','acct_one',3200,'[]',$2)",[id,'cs_'+id]);
}
async function confirm(db,id='visit'){
 await db.query("INSERT INTO stripe_payment_receipts(stripe_account_id,provider_reference,business_id,booking_id,amount_cents) VALUES('acct_one',$1,'biz',$2,3200) ON CONFLICT DO NOTHING",['pi_'+id,id]);
 await db.query("UPDATE booking_payments SET status='paid',stripe_payment_intent_id=$2 WHERE booking_id=$1",[id,'pi_'+id]);
}
test('payment push outbox is atomic, verified, deduplicated and scoped to devices opted in at payment',async t=>{
 const db=await fixture(t);await booking(db);
 assert.equal((await db.query('SELECT * FROM owner_payment_push_events')).rows.length,0,'unpaid booking does not enqueue');
 await db.exec('BEGIN');await confirm(db);assert.equal((await db.query('SELECT * FROM owner_payment_push_deliveries')).rows.length,2);await db.exec('ROLLBACK');
 assert.equal((await db.query('SELECT * FROM owner_payment_push_events')).rows.length,0,'rollback removes alert with payment');
 await confirm(db);await confirm(db);
 assert.equal((await db.query('SELECT * FROM owner_payment_push_events')).rows.length,1,'repeat successful event does not duplicate');
 assert.deepEqual((await db.query('SELECT subscription_id FROM owner_payment_push_deliveries ORDER BY subscription_id')).rows.map(r=>r.subscription_id),['owner-a','owner-b']);
 await db.exec("INSERT INTO business_push_subscriptions(id,business_id,reviewer,endpoint,p256dh,auth) VALUES('later','biz','owner','later-device','x','x')");
 let sent=[];const send=async(s,p)=>{sent.push({s,p});return {status:'submitted'};};
 assert.equal((await deliverOwnerPaymentPush(db,{enabled:false,send})).processed,0);
 await Promise.all([deliverOwnerPaymentPush(db,{enabled:true,send}),deliverOwnerPaymentPush(db,{enabled:true,send})]);await deliverOwnerPaymentPush(db,{enabled:true,send});
 assert.deepEqual(sent.map(x=>x.s.endpoint).sort(),['device-a','device-b']);
 assert.match(sent[0].p.body,/Session payment completed · \$32.00/);assert.equal(sent[0].p.url,'/studio/one#reports');
 assert.doesNotMatch(JSON.stringify(sent),/Private Client|private@example|staff-device|other-device|pi_visit/);
 await booking(db,'unverified');await db.exec("UPDATE booking_payments SET status='paid',stripe_payment_intent_id='pi_unknown' WHERE booking_id='unverified'");
 assert.equal((await db.query('SELECT * FROM owner_payment_push_events')).rows.length,1,'no provider receipt means no card-payment notification');
});
test('membership initial, renewal, one-time package and recorded cash session payments enqueue, while free/credit entries do not',async t=>{
 const db=await fixture(t);
 await db.exec(`INSERT INTO membership_session_ledger(id,business_id,membership_id,appointment_id,event_type,session_delta,amount_cents) VALUES
  ('initial','biz','member','stripe:pi_initial','payment_confirmed',10,10000),
  ('renewal','biz','member','stripe:in_renewal','payment_confirmed',10,10000),
  ('package-payment','biz','pack','stripe:pi_pack','payment_confirmed',5,5000),
  ('manual-payment','biz','member','manual','payment_confirmed',10,10000),
  ('used','biz','member','used','session_used',-1,0),('free','biz','member','free','payment_confirmed',10,0);`);
 await booking(db,'cash');
 await db.exec(`INSERT INTO events(id,owner,created,kind,data) VALUES('cash-receipt','owner','2030-01-01','cash_sale','{"bookingId":"cash","payment":"Cash recorded manually","total":32,"lines":[]}');
  UPDATE appointments SET data=(data::jsonb||'{"paymentStatus":"paid","paymentProvider":"cash","paymentReference":"cash-receipt"}'::jsonb)::text WHERE id='cash';`);
 assert.equal((await db.query('SELECT * FROM owner_payment_push_events')).rows.length,5);
 const sent=[];await deliverOwnerPaymentPush(db,{enabled:true,send:async(s,p)=>{sent.push({s,p});return {status:'submitted'};}});
 assert.equal(sent.length,10);assert.equal(sent.filter(x=>x.p.body.startsWith('Membership')).length,6);assert.equal(sent.filter(x=>x.p.body.startsWith('Service package')).length,2);assert.equal(sent.filter(x=>x.p.body.startsWith('Session')).length,2);
});
test('owner payment delivery retries only rejected devices, handles uncertain results, expiration, unsubscribe and inactive business',async t=>{
 const db=await fixture(t);await booking(db);await confirm(db);
 let sent=[];await deliverOwnerPaymentPush(db,{enabled:true,send:async(s)=>{sent.push(s.endpoint);return s.endpoint==='device-a'?{status:'submitted'}:{status:'failed',httpStatus:503};}});
 await db.exec("UPDATE owner_payment_push_deliveries SET next_attempt_at=now() WHERE status='failed'");
 await deliverOwnerPaymentPush(db,{enabled:true,send:async(s)=>{sent.push(s.endpoint);return {status:'submitted'};}});
 assert.deepEqual(sent,['device-a','device-b','device-b']);
 await booking(db,'uncertain');await confirm(db,'uncertain');
 await deliverOwnerPaymentPush(db,{enabled:true,send:async()=>({status:'failed'})});
 assert.equal((await db.query("SELECT count(*)::int AS n FROM owner_payment_push_deliveries WHERE status='unknown'")).rows[0].n,2);
 await booking(db,'gone');await confirm(db,'gone');
 await db.exec("DELETE FROM business_push_subscriptions WHERE id='owner-b'");
 let calls=0;await deliverOwnerPaymentPush(db,{enabled:true,send:async()=>{calls++;return {status:'gone'};}});assert.equal(calls,1);
 assert.equal((await db.query("SELECT * FROM business_push_subscriptions WHERE business_id='biz' AND reviewer='owner'")).rows.length,0);
 await db.exec("INSERT INTO business_push_subscriptions(id,business_id,reviewer,endpoint,p256dh,auth) VALUES('new','biz','owner','new-device','x','x')");
 await booking(db,'expired');await confirm(db,'expired');await db.exec("UPDATE owner_payment_push_events SET created_at=now()-interval '25 hours' WHERE source_id='expired'");
 await deliverOwnerPaymentPush(db,{enabled:true,send:async()=>{throw Error('Expired events must not send');}});
 assert.equal((await db.query("SELECT status FROM owner_payment_push_deliveries d JOIN owner_payment_push_events e ON e.id=d.event_id WHERE e.source_id='expired'")).rows[0].status,'skipped');
 await booking(db,'inactive');await confirm(db,'inactive');await db.exec("UPDATE businesses SET status='suspended' WHERE id='biz'");
 await deliverOwnerPaymentPush(db,{enabled:true,send:async()=>{throw Error('Inactive businesses must not send');}});
 assert.equal((await db.query("SELECT status FROM owner_payment_push_deliveries d JOIN owner_payment_push_events e ON e.id=d.event_id WHERE e.source_id='inactive'")).rows[0].status,'skipped');
});
test('owner booking request device alerts remain active when delegated reviewer notifications are disabled',async t=>{
 const db=await fixture(t);
 await db.exec("INSERT INTO booking_requests(id,business_id,owner_id,date,staff_id,start_minute,duration,details,reviewer) VALUES('request','biz','owner','2030-01-01','staff',600,30,'{}','staff')");
 const sent=[];const send=async(s)=>{sent.push(s.endpoint);return {status:'submitted'};};
 await pushBookingRequest('request',{pool:db,enabled:true,send});
 assert.deepEqual(sent.sort(),['device-a','device-b']);
 await db.exec("UPDATE settings SET data='{\"staff\":[{\"id\":\"staff\"}],\"bookingApprovalEnabled\":true,\"bookingApprovalReviewer\":\"staff\"}' WHERE owner='owner'");
 sent.length=0;await pushBookingRequest('request',{pool:db,enabled:true,send});
 assert.deepEqual(sent.sort(),['device-a','device-b','staff-device']);
});
test('adding payment alerts does not backfill prior payments or fail cash recording for unusable price metadata',async t=>{
 const db=await fixture(t,{installPaymentMigration:false});await booking(db);await confirm(db);
 await db.exec("INSERT INTO membership_session_ledger(id,business_id,membership_id,appointment_id,event_type,session_delta,amount_cents) VALUES('old-payment','biz','member','old-ref','payment_confirmed',10,10000)");
 await db.exec(await readFile(new URL('../migrations/090_owner_payment_push.sql',import.meta.url),'utf8'));
 assert.equal((await db.query('SELECT * FROM owner_payment_push_events')).rows.length,0);
 await confirm(db);assert.equal((await db.query('SELECT * FROM owner_payment_push_events')).rows.length,0,'same paid state does not backfill');
 for(const [i,price] of ['invalid','9999999999999999999999999999999999',0].entries()){
  await db.query("INSERT INTO appointments(id,owner,date,staff,start,duration,data,status) VALUES($1,'owner','2030-01-02','staff',600,30,$2,'Confirmed')",['metadata-'+i,JSON.stringify({price})]);
  await db.query("INSERT INTO events(id,owner,created,kind,data) VALUES($1,'owner','2030-01-01','cash_sale',$2)",['metadata-receipt-'+i,JSON.stringify({bookingId:'metadata-'+i,payment:'Cash recorded manually',lines:[]})]);
 }
 assert.equal((await db.query('SELECT * FROM owner_payment_push_events')).rows.length,0,'invalid/zero cash metadata produces no false alert');
});
