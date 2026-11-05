import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {enqueueDailyPaymentReminders,processDailyPaymentReminders,reminderClock,reminderDue,paymentReminderMessage} from '../server/daily-payment-reminders.mjs';
import {stagingNotificationAllowed} from '../server/staging-safety.mjs';
import {sendNotificationChannel} from '../server/notification-delivery.mjs';

const morning=new Date('2030-01-02T14:00:00Z'),tomorrow=new Date('2030-01-03T14:00:00Z');
const obligation=(businessId,sourceId,kind='booking',destination='client@example.test')=>({businessId,sourceId,kind,destination,businessName:businessId,clientName:'Client',label:kind==='booking'?'Session':'Monthly plan',amountCents:2500,eligibleSince:'2029-12-30T14:00:00Z',lastNoticeAt:'2029-12-31T14:00:00Z',url:'https://example.test/payment/'+sourceId,actionLabel:'Review payment'});
async function fixture(t){
 const pg=new PGlite();t.after(()=>pg.close());
 for(const f of(await readdir(new URL('../migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort())await pg.exec(await readFile(new URL('../migrations/'+f,import.meta.url),'utf8'));
 await pg.exec("INSERT INTO users(id,email,password_hash) VALUES('u1','one@example.test','x'),('u2','two@example.test','x');INSERT INTO businesses(id,owner_id,slug,name,status) VALUES('b1','u1','one','Business One','active'),('b2','u2','two','Business Two','active');INSERT INTO settings VALUES('u1','{}'),('u2','{}');");
 const state=[obligation('b1','one'),obligation('b1','two','membership'),obligation('b2','three')];
 const select=kind=>async(_,{businessId,destination})=>state.filter(x=>(x.kind==='booking')===kind&&x.businessId===businessId&&(!destination||x.destination.toLowerCase()===destination));
 const prepare=async(_,{businessId,sourceId,destination})=>state.find(x=>x.businessId===businessId&&x.sourceId===sourceId&&x.destination===destination)||null;
 const sent=[];const send=async(channel,destination,message,_env,_fetch,context)=>{sent.push({channel,destination,message,context});return {status:'submitted',provider:'Fixture',providerMessageId:'msg-'+sent.length};};
 const opts={now:morning,origin:'https://example.test',listBookings:select(true),listMemberships:select(false),prepareBooking:prepare,prepareMembership:prepare,send};
 return {pg,state,sent,opts};
}
test('daily reminder clock handles Eastern time and DST; only mature obligations qualify; staging historical contacts remain blocked',async()=>{
 assert.deepEqual(reminderClock(new Date('2030-01-02T13:59:00Z')),{day:'2030-01-02',open:false});
 assert.deepEqual(reminderClock(morning),{day:'2030-01-02',open:true});
 assert.deepEqual(reminderClock(new Date('2030-07-02T13:00:00Z')),{day:'2030-07-02',open:true});
 assert.deepEqual(reminderClock(new Date('2030-01-03T02:00:00Z')),{day:'2030-01-02',open:true});
 assert.equal(reminderDue(obligation('b1','one'),morning),true);
 assert.equal(reminderDue({...obligation('b1','one'),lastNoticeAt:'2030-01-01T14:01:00Z'},morning),false);
 assert.equal(reminderDue({...obligation('b1','one'),eligibleSince:null},morning),false);
 const env={APP_ENV:'staging',STAGING_NOTIFICATIONS_ENABLED:'true',STAGING_CLIENT_EMAIL_AFTER:'2020-01-01'};
 assert.equal(stagingNotificationAllowed('email','historical@example.test',env,{kind:'payment-reminder',clientEmail:true,queuedAt:new Date().toISOString()}),false);
 let network=0;const result=await sendNotificationChannel('email','historical@example.test',{subject:'Test'},env,async()=>{network++;},{kind:'payment-reminder',clientEmail:true});
 assert.equal(result.status,'not_configured');assert.equal(network,0);
 assert.equal(stagingNotificationAllowed('email','allowed@example.test',{...env,STAGING_NOTIFICATION_EMAILS:'allowed@example.test'},{kind:'payment-reminder'}),true);
 const message=paymentReminderMessage([obligation('b1','one'),obligation('b1','two','membership')],'Business One');
 assert.match(message.text,/Total pending: \$50\.00/);assert.equal(message.actions.length,2);assert.match(message.text,/stop when payment is recorded/);
});
test('concurrent scans and workers send one consolidated digest per business/client/day, repeat next day and retain provider audit',async t=>{
 const {pg,state,sent,opts}=await fixture(t);
 assert.equal((await enqueueDailyPaymentReminders(pg,{...opts,now:new Date('2030-01-02T13:59:00Z')})).queued,0);
 await Promise.all([enqueueDailyPaymentReminders(pg,opts),enqueueDailyPaymentReminders(pg,opts)]);
 assert.equal((await pg.query('SELECT * FROM daily_payment_reminders')).rows.length,2);
 await Promise.all([processDailyPaymentReminders(pg,opts),processDailyPaymentReminders(pg,opts)]);
 assert.equal(sent.length,2);assert.match(sent.find(x=>x.context.businessId==='b1').message.text,/Total pending: \$50\.00/);
 assert.doesNotMatch(sent.find(x=>x.context.businessId==='b1').message.text,/payment\/three/);
 assert.equal(sent[0].context.kind,'payment-reminder');assert.equal(sent[0].context.clientEmail,true);assert.equal(sent[0].message.trackAmbiguous,true);
 assert.ok((await pg.query('SELECT provider_message_id FROM daily_payment_reminders')).rows.every(x=>x.provider_message_id));
 await enqueueDailyPaymentReminders(pg,opts);await processDailyPaymentReminders(pg,opts);assert.equal(sent.length,2);
 state.splice(0,2);await enqueueDailyPaymentReminders(pg,{...opts,now:tomorrow});await processDailyPaymentReminders(pg,{...opts,now:tomorrow});assert.equal(sent.length,3,'only still-unpaid second business is reminded tomorrow');
 assert.equal((await pg.query('SELECT count(*)::int AS n FROM membership_payment_invitations')).rows[0].n,0,'automated scan does not create manual invitations');
});
test('paid, changed-email and paused obligations are suppressed after queueing, including a payment during preparation',async t=>{
 const {pg,state,sent,opts}=await fixture(t);await enqueueDailyPaymentReminders(pg,opts);
 await pg.exec("UPDATE settings SET data='{\"dailyPaymentReminders\":false}' WHERE owner='u2'");
 const prepare=async(_,{sourceId})=>{const old={...state.find(x=>x.sourceId===sourceId)};state.splice(state.findIndex(x=>x.sourceId===sourceId),1);return old;};
 await processDailyPaymentReminders(pg,{...opts,prepareBooking:prepare,prepareMembership:prepare});assert.equal(sent.length,0);
 assert.equal((await pg.query("SELECT status FROM daily_payment_reminders WHERE business_id='b1'")).rows[0].status,'superseded');
 await pg.exec("UPDATE settings SET data='{}' WHERE owner='u2'");state[0].destination='changed@example.test';
 await processDailyPaymentReminders(pg,opts);assert.equal(sent.length,0);assert.equal((await pg.query("SELECT status FROM daily_payment_reminders WHERE business_id='b2'")).rows[0].status,'superseded');
});
test('unknown sends are never replayed that day; provider reconnect expires previous days rather than sending a backlog',async t=>{
 const {pg,opts}=await fixture(t);await enqueueDailyPaymentReminders(pg,opts);let count=0;
 await processDailyPaymentReminders(pg,{...opts,send:async()=>{count++;return {status:'unknown',detail:'Timeout'};}});assert.equal(count,2);
 await processDailyPaymentReminders(pg,{...opts,now:new Date('2030-01-02T15:00:00Z'),send:async()=>{count++;}});assert.equal(count,2);
 await enqueueDailyPaymentReminders(pg,{...opts,now:tomorrow});await processDailyPaymentReminders(pg,{...opts,now:tomorrow,send:async()=>({status:'not_configured',detail:'Disconnected'})});
 const later=new Date('2030-01-04T14:00:00Z');await enqueueDailyPaymentReminders(pg,{...opts,now:later});
 await processDailyPaymentReminders(pg,{...opts,now:later,send:async()=>{count++;return {status:'submitted'};}});assert.equal(count,4);
 assert.equal((await pg.query("SELECT count(*)::int AS n FROM daily_payment_reminders WHERE reminder_day='2030-01-03' AND status='superseded'")).rows[0].n,2);
 assert.equal((await pg.query("SELECT count(*)::int AS n FROM daily_payment_reminders WHERE reminder_day='2030-01-02' AND status='unknown'")).rows[0].n,2);
});
test('a lost claim during preparation never dispatches an email',async t=>{
 const {pg,opts,sent}=await fixture(t);await enqueueDailyPaymentReminders(pg,opts);
 const prepare=async(db,input)=>{
  await db.query("UPDATE daily_payment_reminders SET status='unknown' WHERE business_id=$1 AND status='processing'",[input.businessId]);
  return opts.prepareBooking(db,input);
 };
 await processDailyPaymentReminders(pg,{...opts,prepareBooking:prepare,prepareMembership:prepare});
 assert.equal(sent.length,0);
 assert.ok((await pg.query('SELECT status FROM daily_payment_reminders')).rows.every(x=>x.status==='unknown'));
});
