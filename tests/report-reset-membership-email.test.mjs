import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {queueMembershipPaymentEmail,processMembershipPaymentEmails} from '../server/membership-payment-emails.mjs';
import {loadMembershipReportPayments} from '../server/report-payments.mjs';
import {resetPaidRevenue,visibleReportPayments} from '../server/report-reset.mjs';
import {loadOwnerHistory} from '../server/owner-history.mjs';
test('membership receipts follow paid ledger transactions, preserve purchased plan snapshots and survive a business-scoped revenue reset',async()=>{
 const pg=new PGlite();try{
  for(const f of (await readdir(new URL('../migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort())await pg.exec(await readFile(new URL('../migrations/'+f,import.meta.url),'utf8'));
  await pg.exec("INSERT INTO users(id,email,password_hash) VALUES('u1','owner@example.test','x'),('u2','other@example.test','x'); INSERT INTO businesses(id,owner_id,slug,name,status) VALUES('b1','u1','club-one','Club One','active'),('b2','u2','club-two','Club Two','active'); INSERT INTO membership_plans(id,business_id,name,description,interval_unit,price_cents,sessions_included) VALUES('p1','b1','Academy','Training package','month',12000,12),('p2','b2','Other plan','','month',9000,9); INSERT INTO customer_memberships(id,business_id,plan_id,customer_name,customer_email,member_number,status,price_cents,stripe_account_id,sessions_included,sessions_used) VALUES('m1','b1','p1','Alice Person','alice@example.test','AP0101','active',12000,'manual',12,2),('m2','b2','p2','Other Person','other@example.test','OP0101','active',9000,'manual',9,0);");
  const input={businessId:'b1',paymentId:'paid-one',origin:'https://staging.example'};
  await queueMembershipPaymentEmail(pg,{...input,paymentId:'unpaid'});assert.equal((await pg.query('SELECT * FROM membership_payment_emails')).rows.length,0,'signup without payment never claims purchase');
  await pg.exec("BEGIN; INSERT INTO membership_session_ledger(id,business_id,membership_id,appointment_id,event_type,session_delta,amount_cents) VALUES('rollback','b1','m1','rollback','payment_confirmed',12,12000)");
  await queueMembershipPaymentEmail(pg,{...input,paymentId:'rollback'});await pg.exec('ROLLBACK');assert.equal((await pg.query('SELECT * FROM membership_payment_emails')).rows.length,0,'receipt and financial transaction roll back together');
  await pg.exec("INSERT INTO membership_session_ledger(id,business_id,membership_id,appointment_id,event_type,session_delta,amount_cents) VALUES('paid-one','b1','m1','reference-one','payment_confirmed',12,12000),('other-paid','b2','m2','reference-other','payment_confirmed',9,9000); INSERT INTO events(id,owner,created,kind,data) VALUES('sale','u1','2026-10-18T12:00:00Z','cash_sale','{\"total\":15,\"lines\":[{\"id\":\"s\",\"name\":\"Session\",\"price\":15,\"qty\":1,\"type\":\"service\"}]}')");
  await queueMembershipPaymentEmail(pg,{...input,businessId:'b2'});assert.equal((await pg.query('SELECT * FROM membership_payment_emails')).rows.length,0,'business mismatch cannot expose a member');
  assert.match((await loadMembershipReportPayments(pg,'u1'))[0].planName,/current plan/,'legacy payments without a purchase snapshot identify the current-plan fallback');
  await queueMembershipPaymentEmail(pg,input);await queueMembershipPaymentEmail(pg,input);
  const email=(await pg.query('SELECT * FROM membership_payment_emails')).rows[0];assert.equal(email.destination,'alice@example.test');assert.equal(email.snapshot.planName,'Academy');assert.equal(email.snapshot.sessionsAdded,12);assert.equal(email.snapshot.sessionsLeft,10);assert.equal(email.snapshot.sessionsUsed,2);assert.match(email.message.text,/\$120.00/);assert.match(email.message.text,/AP0101/);assert.match(email.message.text,/Training package/);assert.equal(email.message.actions.length,3);assert.ok(email.message.actions.every(a=>a.url.startsWith('https://staging.example/')));
  await pg.exec("UPDATE membership_plans SET name='Gold' WHERE id='p1'");assert.equal((await loadMembershipReportPayments(pg,'u1'))[0].planName,'Academy','later plan changes do not rewrite purchased plan details');
  let sends=0;const send=async(channel,to,message,_a,_b,context)=>{sends++;assert.equal(channel,'email');assert.equal(to,'alice@example.test');assert.equal(context.kind,'transactional-client');assert.equal(context.businessId,'b1');assert.match(message.subject,/Membership payment confirmed/);return {status:'submitted',detail:'Fixture provider acceptance'};};
  await processMembershipPaymentEmails(pg,{send});await processMembershipPaymentEmails(pg,{send});assert.equal(sends,1,'submitted emails are not duplicated');
  const payments=await loadMembershipReportPayments(pg,'u1');assert.equal(payments[0].confirmationEmail,'submitted');
  const history=await loadOwnerHistory(pg,'u1',{category:'messages'});assert.match(JSON.stringify(history),/Membership payment confirmation email/);assert.doesNotMatch(JSON.stringify(history),/alice@example.test|Training package/,'history avoids recipient and email body disclosure');
  const sales=[{id:'sale',kind:'cash_sale',total:15}];assert.equal((await visibleReportPayments(pg,'u1',[...sales,...payments])).length,2);
  const confirmation={businessName:'Club One',confirmPhrase:'RESET PAID REVENUE'};
  await assert.rejects(resetPaidRevenue(pg,'u1',{...confirmation,businessName:'Club Two'}),/confirm/);await assert.rejects(resetPaidRevenue(pg,'u1',{...confirmation,confirmPhrase:''}),/confirm/);await assert.rejects(resetPaidRevenue(pg,'missing',confirmation),/unavailable/);
  await pg.exec('BEGIN');assert.equal((await resetPaidRevenue(pg,'u1',confirmation)).cleared,2);await pg.exec('COMMIT');
  assert.equal((await visibleReportPayments(pg,'u1',[...sales,...await loadMembershipReportPayments(pg,'u1')])).length,0,'all dates and membership payments reset to zero');
  assert.equal((await visibleReportPayments(pg,'u2',await loadMembershipReportPayments(pg,'u2'))).length,1,'other business revenue is untouched');
  assert.equal((await pg.query("SELECT sessions_included,sessions_used FROM customer_memberships WHERE id='m1'")).rows[0].sessions_used,2);
  assert.equal((await pg.query('SELECT count(*)::int AS n FROM membership_session_ledger')).rows[0].n,2);assert.equal((await pg.query('SELECT status FROM membership_payment_emails')).rows[0].status,'submitted');
  await pg.exec("INSERT INTO membership_session_ledger(id,business_id,membership_id,appointment_id,event_type,session_delta,amount_cents,created_at) VALUES('new-paid','b1','m1','new-reference','payment_confirmed',12,12000,'2020-01-01T12:00:00Z'); UPDATE customer_memberships SET sessions_included=sessions_included+12 WHERE id='m1'");
  await queueMembershipPaymentEmail(pg,{...input,paymentId:'new-paid',renewal:true});const after=await visibleReportPayments(pg,'u1',await loadMembershipReportPayments(pg,'u1'));assert.equal(after.length,1,'new recorded payment appears even with a backdated payment date');assert.equal(after[0].total,120);assert.equal(after[0].planName,'Gold');assert.equal(after[0].renewal,true);assert.equal(after[0].sessionsLeft,22);
  await pg.exec("UPDATE membership_payment_emails SET status='processing',updated_at=now()-interval '3 minutes' WHERE payment_id='new-paid'");await processMembershipPaymentEmails(pg,{send});assert.equal(sends,1,'ambiguous sends are never blindly retried');assert.equal((await pg.query("SELECT status FROM membership_payment_emails WHERE payment_id='new-paid'")).rows[0].status,'unknown');
 }finally{await pg.close();}
});
