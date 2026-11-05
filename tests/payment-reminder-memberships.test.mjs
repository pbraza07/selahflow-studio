import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {listMembershipReminderCandidates,prepareMembershipReminder,membershipInvoicePaymentUrl,membershipCheckoutPaymentUrl} from '../server/payment-reminder-memberships.mjs';
import {invitationDetails,membershipInvitationSummary} from '../server/membership-invitations.mjs';

const memberId='11111111-1111-4111-8111-111111111111',now=new Date('2030-02-02T14:00:00Z');
async function fixture(t){
 const pg=new PGlite();t.after(()=>pg.close());
 for(const f of (await readdir(new URL('../migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort())await pg.exec(await readFile(new URL('../migrations/'+f,import.meta.url),'utf8'));
 await pg.exec(`INSERT INTO users(id,email,password_hash) VALUES('owner','owner@example.test','hash'),('other','other@example.test','hash');
 INSERT INTO businesses(id,owner_id,slug,name,status) VALUES('biz','owner','one','Business One','active'),('foreign','other','two','Business Two','active');
 INSERT INTO settings(owner,data) VALUES('owner','{}');
 INSERT INTO merchant_accounts(business_id,external_account_id,charges_enabled,onboarding_complete) VALUES('biz','acct_one',true,true);
 INSERT INTO membership_plans(id,business_id,name,interval_unit,price_cents,sessions_included) VALUES('plan','biz','Monthly sessions','month',3000,8);
 INSERT INTO customer_memberships(id,business_id,plan_id,customer_name,customer_email,status,price_cents,member_number,stripe_account_id,created_at) VALUES('${memberId}','biz','plan','Test Parent','Parent@Example.test','pending_payment',3000,'TP010190','','2030-01-01');`);
 const db={query:async(sql,p)=>{const r=await pg.query(sql,p);return {...r,rowCount:r.rows.length||r.affectedRows||0};}};
 return {pg,db,args:{businessId:'biz',sourceId:memberId,origin:'https://example.test',now,configured:true}};
}

test('initial membership reminders use separate scoped expiring links, stop on payment and preserve manual counters',async t=>{
 const {pg,db,args}=await fixture(t);
 const candidates=await listMembershipReminderCandidates(db,{businessId:'biz',now});assert.equal(candidates.length,1);assert.equal(candidates[0].destination,'parent@example.test');
 assert.equal((await listMembershipReminderCandidates(db,{businessId:'foreign',now})).length,0);
 assert.equal(await prepareMembershipReminder(db,{...args,businessId:'foreign'}),null);
 assert.equal(await prepareMembershipReminder(db,{...args,destination:'wrong@example.test'}),null);
 const item=await prepareMembershipReminder(db,args);assert.equal(item.kind,'membership');assert.equal(item.amountCents,3000);assert.match(item.url,/^https:\/\/example.test\/membership-pay\/[a-f0-9]{64}$/);
 assert.deepEqual(await membershipInvitationSummary(db,'biz'),[],'automatic reminders are not manual Send for Payment requests');
 const token=item.url.split('/').at(-1),details=await invitationDetails(db,token);assert.equal(details.id,memberId);assert.equal(details.business_id,'biz');
 assert.equal((await prepareMembershipReminder(db,args)).url,item.url,'valid private link is reused');
 await pg.exec("UPDATE membership_payment_reminder_links SET expires_at='2000-01-01'");await assert.rejects(invitationDetails(db,token),/expired/);
 const renewed=await prepareMembershipReminder(db,args);assert.notEqual(renewed.url,item.url);assert.deepEqual(await membershipInvitationSummary(db,'biz'),[]);
 await pg.exec("UPDATE customer_memberships SET customer_email='new@example.test'");await assert.rejects(invitationDetails(db,renewed.url.split('/').at(-1)),/expired/);const changedEmail=await prepareMembershipReminder(db,args);assert.notEqual(changedEmail.url,renewed.url);assert.equal(changedEmail.destination,'new@example.test');
 await pg.exec("UPDATE settings SET data='{\"dailyPaymentReminders\":false}'");assert.equal(await prepareMembershipReminder(db,args),null);
 await pg.exec("UPDATE settings SET data='{}'; UPDATE customer_memberships SET status='canceled'");assert.equal(await prepareMembershipReminder(db,args),null);
 await pg.exec("UPDATE customer_memberships SET status='pending_payment'; INSERT INTO membership_session_ledger(id,business_id,membership_id,event_type,amount_cents) VALUES('paid','biz','"+memberId+"','payment_confirmed',3000)");
 assert.equal(await prepareMembershipReminder(db,args),null,'a recorded cash/Stripe payment suppresses stale pending status');
 assert.equal((await listMembershipReminderCandidates(db,{businessId:'biz',now})).length,0);
});

test('one-time package and offline membership reminders never enroll or charge automatically',async t=>{
 const {pg,db,args}=await fixture(t);
 await pg.exec("INSERT INTO membership_plans(id,business_id,name,interval_unit,price_cents,sessions_included,billing_type) VALUES('package','biz','Ten visits','month',3000,10,'package'); INSERT INTO customer_memberships(id,business_id,plan_id,customer_name,customer_email,status,price_cents,member_number,stripe_account_id,created_at) VALUES('22222222-2222-4222-8222-222222222222','biz','package','Test Parent','parent@example.test','pending_payment',3000,'TP1001','','2030-01-01')");
 const packageItem=await prepareMembershipReminder(db,{...args,sourceId:'22222222-2222-4222-8222-222222222222'});assert.equal(packageItem.kind,'package');assert.equal(packageItem.actionLabel,'Pay for package');
 const offline=await prepareMembershipReminder(db,{...args,configured:false});assert.equal(offline.amountCents,3000);assert.equal(offline.url,undefined);
 await pg.exec("UPDATE customer_memberships SET status='expired' WHERE id='"+memberId+"'");assert.equal(await prepareMembershipReminder(db,args),null,'expired manual memberships are not invented renewal debts');
 assert.equal((await db.query('SELECT count(*)::int n FROM stripe_payment_receipts')).rows[0].n,0);
});

function stripeFixture(){
 const invoices=[{id:'in_one',object:'invoice',livemode:false,subscription:'sub_one',customer:'cus_one',status:'open',paid:false,currency:'usd',amount_remaining:3000,billing_reason:'subscription_cycle',created:1893499200,due_date:1893585600,attempted:true,hosted_invoice_url:'https://invoice.stripe.com/i/one',payments:{data:[{status:'open',payment:{payment_intent:{id:'pi_one',status:'requires_payment_method',customer:'cus_one',livemode:false}}}],has_more:false}},
 {id:'in_two',object:'invoice',livemode:false,parent:{subscription_details:{subscription:'sub_one'}},customer:'cus_one',status:'open',currency:'usd',amount_remaining:1200,billing_reason:'subscription_cycle',created:1893585600,attempted:true,hosted_invoice_url:'https://invoice.stripe.com/i/two',payments:{data:[{status:'paid',payment:{payment_intent:{id:'pi_old',status:'succeeded',customer:'cus_one',livemode:false}}}],has_more:false}}];
 const subscription={id:'sub_one',customer:'cus_one',status:'past_due',livemode:false,metadata:{membership_id:memberId,selahflow_business_id:'biz'}};
 const calls=[];const api=async(path,options)=>{calls.push({path,...options});assert.equal(options.method,'GET');assert.equal(options.account,'acct_one');if(path==='subscriptions/sub_one')return subscription;if(path.startsWith('invoices?'))return {data:invoices,has_more:false};if(path.startsWith('invoices/'))return invoices.find(i=>path.startsWith('invoices/'+i.id+'?'));throw Error('Unexpected provider mutation or path '+path);};
 return {invoices,subscription,calls,api};
}
test('recurring reminders verify all current open invoices, remaining amounts and provider ownership without changing financial records',async t=>{
 const {pg,db,args}=await fixture(t),provider=stripeFixture();
 await pg.exec("UPDATE customer_memberships SET stripe_account_id='acct_one',stripe_subscription_id='sub_one',stripe_customer_id='cus_one',status='past_due',initial_paid_at='2030-01-01',last_paid_at='2030-01-01'");
 let items=await prepareMembershipReminder(db,{...args,api:provider.api});assert.equal(items.length,2);assert.deepEqual(items.map(i=>i.amountCents),[3000,1200]);assert.equal(items[0].kind,'membership_invoice');assert.match(items[0].date,/^\d{4}-\d{2}-\d{2}$/);assert.equal(items[1].invoiceId,'in_two');assert.equal(items[1].amountCents,1200,'a prior partial payment does not suppress the actual remaining balance');
 provider.invoices[0].status='paid';provider.invoices[0].amount_remaining=0;items=await prepareMembershipReminder(db,{...args,api:provider.api});assert.equal(items.length,1,'fresh provider-paid state suppresses stale local past_due');
 provider.invoices[1].hosted_invoice_url='https://invoice.stripe.com.attacker.test/pay';assert.deepEqual(await prepareMembershipReminder(db,{...args,api:provider.api}),[]);
 provider.invoices[1].hosted_invoice_url='https://invoice.stripe.com/i/two';provider.invoices[1].customer='cus_other';assert.deepEqual(await prepareMembershipReminder(db,{...args,api:provider.api}),[]);
 provider.invoices[1].customer='cus_one';provider.subscription.metadata.selahflow_business_id='foreign';assert.deepEqual(await prepareMembershipReminder(db,{...args,api:provider.api}),[]);
 provider.subscription.metadata.selahflow_business_id='biz';const changedRecipient=async(path,o)=>{const result=await provider.api(path,o);if(path.startsWith('invoices/in_two?'))await pg.exec("UPDATE customer_memberships SET customer_email='replacement@example.test'");return result;};assert.deepEqual(await prepareMembershipReminder(db,{...args,api:changedRecipient}),[],'recipient changes during provider reads suppress the stale message');
 assert.equal((await db.query('SELECT count(*)::int n FROM membership_session_ledger')).rows[0].n,0);
 assert.equal((await db.query('SELECT count(*)::int n FROM membership_payment_invitations')).rows[0].n,0);
 for(const unsafe of ['http://invoice.stripe.com/i/a','https://invoice.stripe.com:8443/i/a','https://name:secret@invoice.stripe.com/i/a','https://evil.test'])assert.equal(membershipInvoicePaymentUrl(unsafe),null);
});

test('processing, future-due, void and cancelled subscription states never request another payment',async t=>{
 const {pg,db,args}=await fixture(t),provider=stripeFixture();
 await pg.exec("UPDATE customer_memberships SET stripe_account_id='acct_one',stripe_subscription_id='sub_one',stripe_customer_id='cus_one',status='past_due'");provider.invoices.splice(1);
 provider.invoices[0].payments.data[0].payment.payment_intent.status='processing';assert.deepEqual(await prepareMembershipReminder(db,{...args,api:provider.api}),[]);
 provider.invoices[0].payments.data[0].payment.payment_intent.status='requires_action';provider.invoices[0].due_date=Math.floor(now.getTime()/1000)+86400;assert.deepEqual(await prepareMembershipReminder(db,{...args,api:provider.api}),[]);
 provider.invoices[0].due_date=1893585600;provider.invoices[0].status='void';assert.deepEqual(await prepareMembershipReminder(db,{...args,api:provider.api}),[]);
 provider.invoices[0].status='open';provider.subscription.status='canceled';assert.deepEqual(await prepareMembershipReminder(db,{...args,api:provider.api}),[]);
});

test('initial checkout provider completion and identity mismatch suppress stale local reminders',async t=>{
 const {pg,db,args}=await fixture(t);await pg.exec("UPDATE customer_memberships SET stripe_account_id='acct_one',stripe_checkout_session_id='cs_one',stripe_customer_id='cus_one',first_invoice_cents=2250");
 const session={id:'cs_one',client_reference_id:memberId,metadata:{membership_id:memberId,selahflow_business_id:'biz'},currency:'usd',status:'complete',payment_status:'paid',livemode:false,amount_total:2250,customer:'cus_one',customer_email:'Parent@Example.test',url:'https://checkout.stripe.com/c/pay/cs_one',payment_intent:'pi_one'},intent={id:'pi_one',customer:'cus_one',status:'requires_payment_method',livemode:false};
 const api=async(path,o)=>{assert.equal(o.method,'GET');assert.equal(o.account,'acct_one');if(path==='checkout/sessions/cs_one')return session;if(path==='payment_intents/pi_one')return intent;throw Error(path);};
 assert.equal(await prepareMembershipReminder(db,{...args,api}),null);
 session.status='open';session.payment_status='unpaid';intent.status='processing';assert.equal(await prepareMembershipReminder(db,{...args,api}),null);
 intent.status='requires_payment_method';intent.id='pi_other';assert.equal(await prepareMembershipReminder(db,{...args,api}),null);
 intent.id='pi_one';intent.customer='cus_other';assert.equal(await prepareMembershipReminder(db,{...args,api}),null);
 intent.customer='cus_one';const open=await prepareMembershipReminder(db,{...args,api});assert.equal(open.url,session.url);assert.equal(open.amountCents,2250);assert.equal(open.sourceAmountCents,3000);assert.equal((await db.query('SELECT count(*)::int n FROM membership_payment_reminder_links')).rows[0].n,0,'existing discounted checkout is reused without a new invitation');
 session.amount_total=3000;assert.equal(await prepareMembershipReminder(db,{...args,api}),null,'provider amount must match the recorded first invoice');session.amount_total=2250;
 for(const bad of ['https://checkout.stripe.com.attacker.test/c/pay/x','https://user:secret@checkout.stripe.com/c/pay/x','http://checkout.stripe.com/c/pay/x'])assert.equal(membershipCheckoutPaymentUrl(bad),null);
 session.customer_email='other@example.test';assert.equal(await prepareMembershipReminder(db,{...args,api}),null);session.customer_email='parent@example.test';
 session.status='expired';await pg.exec("UPDATE customer_memberships SET first_invoice_cents=2250,stripe_signup_fingerprint='existing-coupon-fingerprint'");const expired=await prepareMembershipReminder(db,{...args,api});assert.equal(expired.url,undefined);assert.equal(expired.amountCents,2250);assert.equal((await db.query('SELECT count(*)::int n FROM membership_payment_reminder_links')).rows[0].n,0);
 session.status='open';const replacement=async(path,o)=>{const result=await api(path,o);if(path==='checkout/sessions/cs_one')await pg.exec("UPDATE customer_memberships SET stripe_checkout_session_id='cs_replacement'");return result;};assert.equal(await prepareMembershipReminder(db,{...args,api:replacement}),null,'a replaced checkout invalidates the prepared reminder');
 await pg.exec("UPDATE customer_memberships SET stripe_checkout_session_id='cs_one'");const changedCustomer=async(path,o)=>{const result=await api(path,o);if(path==='checkout/sessions/cs_one')await pg.exec("UPDATE customer_memberships SET stripe_customer_id='cus_replacement'");return result;};assert.equal(await prepareMembershipReminder(db,{...args,api:changedCustomer}),null,'customer reassignment during provider reads invalidates the reminder');
 await pg.exec("UPDATE customer_memberships SET stripe_customer_id='cus_one'");const changedMerchant=async(path,o)=>{const result=await api(path,o);if(path==='checkout/sessions/cs_one')await pg.exec("UPDATE merchant_accounts SET external_account_id='acct_replacement'");return result;};assert.equal(await prepareMembershipReminder(db,{...args,api:changedMerchant}),null,'merchant reassignment during provider reads invalidates the reminder');
});
