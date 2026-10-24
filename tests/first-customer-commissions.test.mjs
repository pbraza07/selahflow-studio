import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import ts from 'typescript';
import {commissionCents,COMMISSION_TERMS,saveCommissionSettings,setPlatformCommissionEnabled,reserveCommission,attachCommissionSession,settleCommission,refundCommission,expireCommissionCheckout,commissionSettings} from '../server/first-customer-commissions.mjs';
import {startBookingCheckout,applyBookingPayment,applyMembershipInvoice} from '../server/stripe-checkout.mjs';
import {startMembershipCheckout} from '../server/membership-checkout.mjs';
import {completeInitialMembershipCheckout} from '../server/membership-initial-payment.mjs';
import {tokenHash} from '../server/security.mjs';
async function fixture(t){
 const old={...process.env};Object.assign(process.env,{APP_ENV:'staging',STRIPE_SECRET_KEY:'sk_test_fixture',STRIPE_CONNECT_WEBHOOK_SECRET:'whsec_fixture'});
 const pg=new PGlite();t.after(async()=>{await pg.close();for(const k of Object.keys(process.env))if(!(k in old))delete process.env[k];Object.assign(process.env,old);});
 for(const f of(await readdir(new URL('../migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort())await pg.exec(await readFile(new URL('../migrations/'+f,import.meta.url),'utf8'));
 const query=async(s,v)=>{const r=await pg.query(s,v);return {...r,rowCount:r.rows.length||r.affectedRows||0};};const db={query,release(){}},pool={query,connect:async()=>db};
 await pg.exec("INSERT INTO users(id,email,password_hash) VALUES('u1','one@example.test','hash'),('u2','two@example.test','hash'); INSERT INTO businesses(id,owner_id,slug,name,status) VALUES('b1','u1','one','One','active'),('b2','u2','two','Two','active'); INSERT INTO merchant_accounts(business_id,external_account_id,charges_enabled,onboarding_complete) VALUES('b1','acct_one',true,true),('b2','acct_two',true,true); INSERT INTO membership_plans(id,business_id,name,interval_unit,price_cents,sessions_included) VALUES('p1','b1','Monthly','month',10000,4);");
 await query('INSERT INTO settings(owner,data) VALUES($1,$2)',['u1',JSON.stringify({services:[{id:'s',name:'Coaching',price:100}]})]);
 const tx=async fn=>{await query('BEGIN');try{const result=await fn();await query('COMMIT');return result;}catch(e){await query('ROLLBACK');throw e;}};
 const activate=async businessId=>tx(()=>saveCommissionSettings(db,{businessId,actor:'owner-fixture',bookingEnabled:true,membershipEnabled:true,acceptTerms:true}));
 const identity=async(businessId='b1',number='AM010100',key='alex member|2000-01-01')=>query('INSERT INTO business_member_ids(business_id,member_number,identity_key) VALUES($1,$2,$3)',[businessId,number,key]);
 return {pg,db,pool,tx,activate,identity};
}
test('10% calculation is cents-safe with no legacy minimum or maximum',()=>{
 for(const [n,fee]of [[0,0],[100,10],[9999,1000],[7000,700],[40000,4000]])assert.equal(commissionCents(n),fee);
 for(const n of [-1,NaN,Infinity,1.5])assert.throws(()=>commissionCents(n));
});
test('activation is prospective, requires disclosed terms and a ready business account; each condition can be independently paused',async t=>{
 const {db,tx,activate}=await fixture(t);assert.equal((await commissionSettings(db,'b1')).bookingEnabled,false);
 await assert.rejects(tx(()=>saveCommissionSettings(db,{businessId:'b1',actor:'u1',bookingEnabled:true,membershipEnabled:true,acceptTerms:false})),/accept/);
 await db.query("UPDATE merchant_accounts SET charges_enabled=false WHERE business_id='b1'");await assert.rejects(activate('b1'),/Connect and verify/);await db.query("UPDATE merchant_accounts SET charges_enabled=true WHERE business_id='b1'");
 const enabled=await activate('b1');assert.equal(enabled.bookingEnabled,true);assert.ok(enabled.acceptedAt);assert.equal(enabled.termsVersion,COMMISSION_TERMS);
 const paused=await tx(()=>saveCommissionSettings(db,{businessId:'b1',actor:'u1',bookingEnabled:false,membershipEnabled:true,acceptTerms:false}));assert.equal(paused.bookingEnabled,false);assert.equal(paused.membershipEnabled,true);assert.equal((await commissionSettings(db,'b2')).membershipEnabled,false);
});
test('booking and membership claims are independent, same-email siblings are separate, and active competing checkouts cannot both charge a first fee',async t=>{
 const {db,tx,activate,identity}=await fixture(t);await activate('b1');await activate('b2');await identity();await identity('b2');await identity('b1','BM010100','ben member|2000-01-01');
 const args={businessId:'b1',kind:'booking',memberNumber:'AM010100',sourceId:'booking-a',account:'acct_one',grossCents:10000};
 const booking=await tx(()=>reserveCommission(db,args));await tx(()=>attachCommissionSession(db,booking,{id:'cs_test_first'}));
 await assert.rejects(tx(()=>reserveCommission(db,{...args,sourceId:'booking-b'},async()=>({status:'open',payment_status:'unpaid'}))),/Another first-time booking/);
 const member=await tx(()=>reserveCommission(db,{...args,kind:'membership',sourceId:'member-a'}));assert.equal(member.fee_cents,1000);assert.notEqual(member.id,booking.id);
 const sibling=await tx(()=>reserveCommission(db,{...args,memberNumber:'BM010100',sourceId:'booking-sibling'}));assert.notEqual(sibling.id,booking.id);
 const tenant=await tx(()=>reserveCommission(db,{...args,businessId:'b2',account:'acct_two'}));assert.notEqual(tenant.identity_digest,booking.identity_digest);
 const retry=await tx(()=>reserveCommission(db,{...args,sourceId:'booking-b'},async()=>({status:'expired'})));assert.equal(retry.id,booking.id);assert.equal(retry.source_id,'booking-b');
 const row=(await db.query('SELECT * FROM first_customer_commissions WHERE id=$1',[booking.id])).rows[0];assert.equal(row.fee_cents,1000);
});
test('first fee is not charged to legacy booking clients, previously paid memberships or a missing verified identity',async t=>{
 const {db,tx,activate,identity}=await fixture(t);await activate('b1');await identity();
 const args={businessId:'b1',kind:'booking',memberNumber:'AM010100',sourceId:'booking',account:'acct_one',grossCents:10000};
 await db.query("INSERT INTO business_client_profiles(id,owner,name,email,member_number,date_of_birth,created_at) VALUES($1,'u1','Alex Member','family@example.test','AM010100','2000-01-01',now()-interval '1 day')",[randomUUID()]);
 assert.equal(await tx(()=>reserveCommission(db,args)),null);
 const id=randomUUID();await db.query("INSERT INTO customer_memberships(id,business_id,plan_id,customer_name,customer_email,status,stripe_account_id,price_cents,member_number,date_of_birth,initial_paid_at) VALUES($1,'b1','p1','Alex Member','family@example.test','canceled','acct_one',10000,'AM010100','2000-01-01',now())",[id]);
 assert.equal(await tx(()=>reserveCommission(db,{...args,kind:'membership',sourceId:id})),null);
 assert.equal(await tx(()=>reserveCommission(db,{...args,memberNumber:'ZZ010100'})),null);
});
test('provider settlement verifies actual 10%, refunds are proportional/idempotent, and reused IDs do not inherit another identity fee',async t=>{
 const {db,tx,activate,identity}=await fixture(t);await activate('b1');await identity();
 const args={businessId:'b1',kind:'booking',memberNumber:'AM010100',sourceId:'booking',account:'acct_one',grossCents:10000,eligibleCents:8000};
 const claim=await tx(()=>reserveCommission(db,args));assert.equal(claim.fee_cents,800);await tx(()=>attachCommissionSession(db,claim,{id:'cs_test_fee'}));
 const session={id:'cs_test_fee',payment_status:'paid',currency:'usd',amount_total:10000,payment_intent:'pi_fee',metadata:{commission_claim_id:claim.id}};
 await assert.rejects(tx(()=>settleCommission(db,{businessId:'b1',account:'acct_one',session},async()=>({id:'pi_fee',status:'succeeded',currency:'usd',amount_received:10000,application_fee_amount:900}))),/amount does not match/);
 await tx(()=>settleCommission(db,{businessId:'b1',account:'acct_one',session},async()=>({id:'pi_fee',status:'succeeded',currency:'usd',amount_received:10000,application_fee_amount:800,latest_charge:{application_fee:'fee_one'}})));
 let refunded=0,calls=0,amountRefunded=5000;
 const api=async(path,o)=>{if(path==='charges/ch_one')return {currency:'usd',amount:10000,amount_refunded:amountRefunded,payment_intent:'pi_fee'};if(path==='application_fees/fee_one')return {amount_refunded:refunded};assert.equal(path,'application_fees/fee_one/refunds');assert.equal(o.account,undefined);calls++;refunded+=o.params.amount;return {id:'fr_one',amount:o.params.amount};};
 const refund=()=>tx(()=>refundCommission(db,{businessId:'b1',account:'acct_one',charge:{id:'ch_one',payment_intent:'pi_fee'}},api));
 await refund();await refund();assert.equal(calls,1);assert.equal(refunded,400);amountRefunded=10000;await refund();assert.equal(refunded,800);
 assert.equal(await tx(()=>reserveCommission(db,args)),null,'a refund never creates another first fee');
 await db.query("DELETE FROM business_member_ids WHERE business_id='b1'");await identity();assert.equal(await tx(()=>reserveCommission(db,args)),null,'same deleted/re-registered identity keeps its financial history');
 await db.query("DELETE FROM business_member_ids WHERE business_id='b1'");await identity('b1','AM010100','another member|1900-01-01');assert.ok(await tx(()=>reserveCommission(db,{...args,sourceId:'new-person'})),'same ID reused by a different person is independent');
});
test('unpaid checkout expiry requires business scope and Stripe confirmation, and never expires a paid payment',async t=>{
 const {db,tx,activate,identity}=await fixture(t);await activate('b1');await identity();const claim=await tx(()=>reserveCommission(db,{businessId:'b1',kind:'booking',memberNumber:'AM010100',sourceId:'booking',account:'acct_one',grossCents:10000}));await tx(()=>attachCommissionSession(db,claim,{id:'cs_test_expire'}));await db.query("INSERT INTO booking_payments(booking_id,business_id,stripe_account_id,stripe_checkout_session_id,amount_cents,lines) VALUES('booking','b1','acct_one','cs_test_expire',10000,'[]'::jsonb)");
 await assert.rejects(tx(()=>expireCommissionCheckout(db,{businessId:'b2',id:claim.id})),/Choose an unpaid/);
 await assert.rejects(tx(()=>expireCommissionCheckout(db,{businessId:'b1',id:claim.id},async()=>({status:'complete',payment_status:'paid'}))),/paid or processing/);
 let calls=0;await tx(()=>expireCommissionCheckout(db,{businessId:'b1',id:claim.id},async(path,o)=>{assert.equal(o.account,'acct_one');calls++;return {status:path.endsWith('/expire')?'expired':'open',payment_status:'unpaid'};}));assert.equal(calls,2);assert.equal((await db.query('SELECT status FROM first_customer_commissions')).rows[0].status,'expired');assert.equal((await db.query('SELECT status FROM booking_payments')).rows[0].status,'expired');
});
test('actual first booking Checkout sends a direct Connect application fee without increasing the client price; retries and payment replay do not duplicate it',async t=>{
 const {db,pool,tx,activate,identity}=await fixture(t);await activate('b1');await identity();const bookingId=randomUUID(),token='a'.repeat(64);
 await db.query("INSERT INTO appointments(id,owner,date,staff,start,duration,status,data) VALUES($1,'u1','2026-12-01','coach',600,60,'Confirmed',$2)",[bookingId,JSON.stringify({price:80,memberNumber:'AM010100',services:['Coaching'],serviceIds:['s'],email:'synthetic@example.test',paymentLines:[{id:'s',name:'Coaching',type:'service',price:80,qty:1}]})]);await db.query("INSERT INTO customer_booking_access(token_hash,owner_id,booking_id) VALUES($1,'u1',$2)",[tokenHash(token),bookingId]);
 let creates=0,metadata;const session={id:'cs_test_bookingfee',livemode:false,status:'open',mode:'payment',payment_status:'unpaid',url:'https://checkout.stripe.com/c/pay/fixture'};
 const api=async(path,o)=>{if(path.startsWith('accounts/'))return {charges_enabled:true,details_submitted:true};assert.equal(o.account,'acct_one');if(path==='checkout/sessions'){creates++;assert.equal(o.params['payment_intent_data[application_fee_amount]'],800);assert.equal(o.params['line_items[0][price_data][unit_amount]'],'8000');metadata={booking_id:bookingId,selahflow_business_id:'b1',commission_claim_id:o.params['metadata[commission_claim_id]']};}return session;};
 const args={slug:'one',bookingId,token,origin:'https://example.test'};await startBookingCheckout(pool,args,api);await startBookingCheckout(pool,args,api);assert.equal(creates,1);
 const paid={...session,status:'complete',payment_status:'paid',currency:'usd',payment_intent:'pi_bookingfee',amount_total:8000,client_reference_id:bookingId,metadata};
 const verify=async()=>({id:'pi_bookingfee',status:'succeeded',currency:'usd',amount_received:8000,application_fee_amount:800,latest_charge:{application_fee:'fee_booking'}});
 assert.equal(await tx(()=>applyBookingPayment(db,'b1','acct_one',paid,verify)),true);assert.equal(await tx(()=>applyBookingPayment(db,'b1','acct_one',paid,verify)),true);
 assert.equal((await commissionSettings(db,'b1')).totals[0].collected_cents,800);assert.equal((await db.query("SELECT count(*)::int AS n FROM events WHERE kind='cash_sale'")).rows[0].n,1);
});
test('first membership charges the fee once on discounted initial payment, saves recurring authorization, then provisions permanent zero-fee renewals with no immediate extra charge',async t=>{
 const {db,pool,tx,activate}=await fixture(t);await activate('b1');
 await db.query("INSERT INTO business_coupons(business_id,code,description,kind,value,duration) VALUES('b1','SAVE20','Initial discount','percent',20,'once')");
 const body={slug:'one',planId:'p1',requestId:randomUUID(),firstName:'Alex',lastName:'Member',email:'alex@example.test',dateOfBirth:'2000-01-01',termsAccepted:true,recurringAccepted:true,couponCode:'SAVE20'};
 let created=0,paid,memberId,metadata,subscription=null,subCreates=0,piCalls=0;
 const session={id:'cs_test_memberfee',livemode:false,status:'open',mode:'payment',payment_status:'unpaid',url:'https://checkout.stripe.com/c/pay/memberfixture'};
 const api=async(path,o)=>{
  if(path.startsWith('accounts/'))return {charges_enabled:true,details_submitted:true};assert.equal(o.account,'acct_one');
  if(path==='coupons')return {id:'coupon_first'};
  if(path==='products')return {id:'prod_renewal'};
  if(path==='checkout/sessions'){created++;assert.equal(o.params.mode,'payment');assert.equal(o.params['payment_intent_data[application_fee_amount]'],800);assert.equal(o.params['payment_intent_data[setup_future_usage]'],'off_session');assert.equal(o.params.customer_creation,'always');assert.ok(!Object.keys(o.params).some(k=>k.includes('[recurring]')||k.startsWith('subscription_data')));assert.match(o.params['custom_text[submit][message]'],/recurring membership payments of \$100.00/);memberId=o.params.client_reference_id;metadata={membership_initial:'true',membership_id:memberId,selahflow_business_id:'b1',commission_claim_id:o.params['metadata[commission_claim_id]']};return session;}
  if(path.startsWith('checkout/sessions/'))return session;
  if(path.startsWith('payment_intents/')){piCalls++;return {id:'pi_memberfee',livemode:false,status:'succeeded',currency:'usd',amount_received:8000,application_fee_amount:piCalls===2?900:800,customer:'cus_member',payment_method:'pm_member',metadata:{membership_id:memberId,selahflow_business_id:'b1'},latest_charge:{created:Math.floor(Date.now()/1000),application_fee:'fee_member'}};}
  if(path.startsWith('subscriptions?'))return {data:subscription?[subscription]:[],has_more:false};
  if(path==='subscriptions'){subCreates++;assert.equal(o.params.application_fee_percent,0);assert.equal(o.params.proration_behavior,'none');assert.ok(o.params.billing_cycle_anchor>Date.now()/1000);assert.equal(o.params['discounts[0][coupon]'],undefined,'once coupon never reduces renewals');assert.equal(o.params['items[0][price_data][unit_amount]'],'10000');subscription={id:'sub_memberfee',livemode:false,status:'active',customer:'cus_member',application_fee_percent:0,metadata:{membership_id:memberId,selahflow_business_id:'b1',selahflow_initial_checkout:session.id}};return subscription;}
  throw Error('Unexpected '+path);
 };
 await startMembershipCheckout(pool,body,'https://example.test',api);await startMembershipCheckout(pool,{...body,requestId:randomUUID()},'https://example.test',api);assert.equal(created,1);
 const member=(await db.query('SELECT * FROM customer_memberships')).rows[0];assert.ok(member.stripe_recurring_authorized_at);assert.equal(member.first_invoice_cents,8000);assert.equal(member.sessions_included,0);
 paid={...session,status:'complete',payment_status:'paid',currency:'usd',amount_total:8000,payment_intent:'pi_memberfee',customer:'cus_member',client_reference_id:memberId,metadata};
 await assert.rejects(tx(()=>completeInitialMembershipCheckout(db,{businessId:'b1',account:'acct_one',session:paid},api)),/amount does not match/);assert.equal((await db.query('SELECT count(*)::int AS n FROM stripe_payment_receipts')).rows[0].n,0);assert.equal(await tx(()=>completeInitialMembershipCheckout(db,{businessId:'b1',account:'acct_one',session:paid},api)),true);assert.equal(await tx(()=>completeInitialMembershipCheckout(db,{businessId:'b1',account:'acct_one',session:paid},api)),true);assert.equal(subCreates,1);
 let active=(await db.query('SELECT * FROM customer_memberships')).rows[0];assert.equal(active.status,'active');assert.equal(active.sessions_included,4);assert.equal(active.stripe_subscription_id,'sub_memberfee');assert.equal((await commissionSettings(db,'b1')).totals[0].collected_cents,800);
 await db.query('UPDATE customer_memberships SET sessions_used=2,credit_period_end=now()-interval \'1 day\'');
 const now=Math.floor(Date.now()/1000);const invoice={id:'in_renewal',livemode:false,status:'paid',amount_paid:10000,currency:'usd',billing_reason:'subscription_cycle',parent:{subscription_details:{subscription:subscription.id}},customer:'cus_member',lines:{data:[{period:{start:now,end:now+30*86400}}]}};
 assert.equal(await tx(()=>applyMembershipInvoice(db,'b1','acct_one',invoice,subscription)),true);active=(await db.query('SELECT * FROM customer_memberships')).rows[0];assert.equal(active.sessions_used,0);assert.equal((await db.query('SELECT count(*)::int AS n FROM first_customer_commissions')).rows[0].n,1);assert.equal((await db.query('SELECT count(*)::int AS n FROM stripe_payment_receipts')).rows[0].n,2);
 assert.equal(await tx(()=>completeInitialMembershipCheckout(db,{businessId:'b2',account:'acct_one',session:paid},api)),false);
});
test('actual owner commission API enforces authentication, origin, request size, and ignores a forged business ID',async t=>{
 const {db,pool}=await fixture(t);globalThis.__commissionPool=pool;globalThis.__commissionActor=null;t.after(()=>{delete globalThis.__commissionPool;delete globalThis.__commissionActor;});
 let source=ts.transpileModule(await readFile(new URL('../app/api/studio/commissions/route.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
 source=source.replace(/import \{ getPool \}[^\n]+;/,'const getPool=()=>globalThis.__commissionPool;').replace(/import \{ requireOwner \}[^\n]+;/,"const requireOwner=async()=>{if(!globalThis.__commissionActor)throw Error('AUTH_REQUIRED');return globalThis.__commissionActor;};");
 source=source.replace(/import \{ assertCommissionStripeReady, commissionStripeStatus \}[^\n]+;/,'const assertCommissionStripeReady=async()=>({ready:true});const commissionStripeStatus=async()=>({ready:true});');
 for(const name of ['security','first-customer-commissions'])source=source.replaceAll("'../../../../server/"+name+".mjs'",JSON.stringify(new URL('../server/'+name+'.mjs',import.meta.url).href));
 const route=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64')),origin=new URL(process.env.APP_URL||process.env.RENDER_EXTERNAL_URL||'https://example.test').origin;
 const req=(body,from=origin)=>new Request(origin+'/api/studio/commissions',{method:'POST',headers:{'Content-Type':'application/json',Origin:from},body:JSON.stringify(body)});
 assert.equal((await route.GET(new Request(origin))).status,401);globalThis.__commissionActor='u1';assert.equal((await route.POST(req({action:'save'},'https://evil.test'))).status,403);
 const consent=await route.POST(req({action:'save',bookingEnabled:false,membershipEnabled:false,acceptTerms:true}));assert.equal(consent.status,200);const consentData=await consent.json();assert.ok(consentData.acceptedAt);assert.equal(consentData.bookingEnabled,false);assert.equal(consentData.membershipEnabled,false);
 const r=await route.POST(req({action:'save',businessId:'b2',bookingEnabled:true,membershipEnabled:true,acceptTerms:true}));assert.equal(r.status,200);assert.match(r.headers.get('cache-control'),/no-store/);assert.equal((await commissionSettings(db,'b1')).bookingEnabled,true);assert.equal((await commissionSettings(db,'b2')).bookingEnabled,false);
 assert.equal((await route.POST(req({action:'save',text:'x'.repeat(2000)}))).status,400);
});
test('a refund received before checkout reconciliation is applied when the fee settles, with no second first-purchase fee',async t=>{
 const {db,tx,activate,identity}=await fixture(t);await activate('b1');await identity();const args={businessId:'b1',kind:'booking',memberNumber:'AM010100',sourceId:'booking',account:'acct_one',grossCents:10000},claim=await tx(()=>reserveCommission(db,args));await tx(()=>attachCommissionSession(db,claim,{id:'cs_test_race'}));let refunds=0;
 const charge={id:'ch_race',currency:'usd',amount:10000,amount_refunded:10000,payment_intent:'pi_race',application_fee:'fee_race'};
 const api=async(path,o)=>{if(path.startsWith('payment_intents/'))return {id:'pi_race',status:'succeeded',currency:'usd',amount_received:10000,application_fee_amount:1000,latest_charge:charge};if(path==='charges/ch_race')return charge;if(path==='application_fees/fee_race')return {amount_refunded:0};assert.equal(path,'application_fees/fee_race/refunds');assert.equal(o.params.amount,1000);refunds++;return {id:'fr_race',amount:1000};};
 await tx(()=>settleCommission(db,{businessId:'b1',account:'acct_one',session:{id:'cs_test_race',payment_status:'paid',currency:'usd',amount_total:10000,payment_intent:'pi_race',metadata:{commission_claim_id:claim.id}}},api));
 const r=(await db.query('SELECT status,refunded_fee_cents FROM first_customer_commissions')).rows[0];assert.equal(r.status,'refunded');assert.equal(r.refunded_fee_cents,1000);assert.equal(refunds,1);assert.equal(await tx(()=>reserveCommission(db,args)),null);
});
test('actual platform commission setup is restricted to the primary administrator and rejects cross-origin changes',async t=>{
 const {db,pool,tx}=await fixture(t);globalThis.__commissionAdminPool=pool;globalThis.__commissionRole='owner';globalThis.__commissionConfigureCount=0;t.after(()=>{delete globalThis.__commissionAdminPool;delete globalThis.__commissionRole;delete globalThis.__commissionConfigureCount;delete globalThis.__commissionStripeDown;});
 let source=ts.transpileModule(await readFile(new URL('../app/api/platform/commissions/route.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
 source=source.replace(/import \{ getPool \}[^\n]+;/,'const getPool=()=>globalThis.__commissionAdminPool;').replace(/import \{ requireGmailAdmin \}[^\n]+;/,"const requireGmailAdmin=async()=>{if(globalThis.__commissionRole!=='primary')throw Error('FORBIDDEN');return 'primary';};").replace(/import \{ commissionStripeStatus, configureCommissionStripe, assertCommissionStripeReady \}[^\n]+;/,"const assertCommissionStripeReady=async()=>{if(globalThis.__commissionStripeDown)throw Error('Webhook setup required.');};const commissionStripeStatus=async()=>({ready:!globalThis.__commissionStripeDown});const configureCommissionStripe=async()=>{globalThis.__commissionConfigureCount++;return {ready:true};};");
 for(const name of ['security','first-customer-commissions'])source=source.replaceAll("'../../../../server/"+name+".mjs'",JSON.stringify(new URL('../server/'+name+'.mjs',import.meta.url).href));
 const route=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64')),origin=new URL(process.env.APP_URL||process.env.RENDER_EXTERNAL_URL||'https://example.test').origin;
 const request=from=>new Request(origin+'/api/platform/commissions',{method:'POST',headers:{'Content-Type':'application/json',Origin:from},body:JSON.stringify({action:'configureWebhooks'})});
 assert.equal((await route.GET(new Request(origin))).status,403);assert.equal((await route.POST(request(origin))).status,403);assert.equal(globalThis.__commissionConfigureCount,0);
 globalThis.__commissionRole='primary';assert.equal((await route.POST(request('https://evil.test'))).status,403);const response=await route.GET(new Request(origin));assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/no-store/);assert.ok(!JSON.stringify(await response.json()).includes('identity_salt'));assert.equal((await route.POST(request(origin))).status,200);assert.equal(globalThis.__commissionConfigureCount,1);
 const businessId='11111111-1111-4111-8111-111111111111';
 await db.query("INSERT INTO users(id,email,password_hash) VALUES('u3','three@example.test','hash')");
 await db.query("INSERT INTO businesses(id,owner_id,slug,name,status) VALUES($1,'u3','three','Three','active')",[businessId]);
 await db.query("INSERT INTO merchant_accounts(business_id,external_account_id,charges_enabled,onboarding_complete) VALUES($1,'acct_three',true,true)",[businessId]);
 const change=(body,from=origin)=>new Request(origin+'/api/platform/commissions',{method:'POST',headers:{'Content-Type':'application/json',Origin:from},body:JSON.stringify(body)});
 const enable={action:'setEnabled',businessId,kind:'booking',enabled:true,acceptTerms:true};
 globalThis.__commissionRole='owner';assert.equal((await route.POST(change(enable))).status,403);globalThis.__commissionRole='primary';
 assert.equal((await route.POST(change(enable,'https://evil.test'))).status,403);
 let r=await route.POST(change(enable));assert.equal(r.status,400);assert.match((await r.json()).error,/accept/,'admin cannot accept business terms through this endpoint');
 await tx(()=>saveCommissionSettings(db,{businessId,actor:'u3',bookingEnabled:false,membershipEnabled:false,acceptTerms:true}));
 r=await route.POST(change(enable));assert.equal(r.status,200);assert.equal((await r.json()).membershipEnabled,false);
 r=await route.POST(change({...enable,kind:'membership'}));assert.equal(r.status,200);
 r=await route.POST(change({...enable,enabled:false}));assert.equal(r.status,200);let saved=await r.json();assert.equal(saved.bookingEnabled,false);assert.equal(saved.membershipEnabled,true);
 globalThis.__commissionStripeDown=true;
 r=await route.POST(change(enable));assert.equal(r.status,400);assert.match((await r.json()).error,/Webhook/);
 r=await route.POST(change({...enable,kind:'membership',enabled:false}));assert.equal(r.status,200);assert.equal((await r.json()).membershipEnabled,false);
 globalThis.__commissionStripeDown=false;r=await route.POST(change(enable));assert.equal(r.status,200);assert.equal((await r.json()).membershipEnabled,false);
 r=await route.GET(new Request(origin));const listed=(await r.json()).businesses.find(b=>b.id===businessId);assert.equal(listed.paymentReady,true);assert.equal(listed.commissions.bookingEnabled,true);
 for(const invalid of [{...enable,kind:'all'},{...enable,enabled:'false'},{...enable,businessId:'invalid'},{...enable,padding:'x'.repeat(501)}])assert.equal((await route.POST(change(invalid))).status,400);
 r=await route.POST(change({action:'pause',businessId}));assert.equal(r.status,200);assert.equal((await r.json()).bookingEnabled,false);
});

test('platform changes are independently audited and disabling survives lost Stripe readiness without resetting first-purchase history',async t=>{
 const {db,tx,activate,identity}=await fixture(t);await activate('b1');await identity();
 const args={businessId:'b1',kind:'booking',memberNumber:'AM010100',sourceId:'original',account:'acct_one',grossCents:10000};
 const claim=await tx(()=>reserveCommission(db,args));await db.query("UPDATE first_customer_commissions SET status='paid' WHERE id=$1",[claim.id]);
 const before=(await db.query("SELECT * FROM business_commission_policies WHERE business_id='b1'")).rows[0];
 await db.query("UPDATE merchant_accounts SET charges_enabled=false WHERE business_id='b1'");delete process.env.STRIPE_SECRET_KEY;
 let result=await tx(()=>setPlatformCommissionEnabled(db,{businessId:'b1',actor:'primary',kind:'booking',enabled:false}));
 assert.equal(result.bookingEnabled,false);assert.equal(result.membershipEnabled,true);
 await assert.rejects(tx(()=>setPlatformCommissionEnabled(db,{businessId:'b1',actor:'primary',kind:'booking',enabled:true})),/Configure Stripe/);
 await db.query("UPDATE businesses SET status='archived' WHERE id='b1'");
 result=await tx(()=>setPlatformCommissionEnabled(db,{businessId:'b1',actor:'primary',kind:'membership',enabled:false}));assert.equal(result.membershipEnabled,false);
 await assert.rejects(tx(()=>setPlatformCommissionEnabled(db,{businessId:'b1',actor:'primary',kind:'booking',enabled:true})),/active/);
 process.env.STRIPE_SECRET_KEY='sk_test_fixture';await db.query("UPDATE businesses SET status='active' WHERE id='b1';");
 await assert.rejects(tx(()=>setPlatformCommissionEnabled(db,{businessId:'b1',actor:'primary',kind:'membership',enabled:true})),/Connect and verify/);
 await db.query("UPDATE merchant_accounts SET charges_enabled=true WHERE business_id='b1'");
 result=await tx(()=>setPlatformCommissionEnabled(db,{businessId:'b1',actor:'primary',kind:'booking',enabled:true}));assert.equal(result.membershipEnabled,false);
 assert.equal(await tx(()=>reserveCommission(db,{...args,sourceId:'next'})),null);
 const after=(await db.query("SELECT * FROM business_commission_policies WHERE business_id='b1'")).rows[0];
 for(const key of ['identity_salt','terms_version','accepted_by','accepted_at','booking_enabled_at'])assert.equal(String(after[key]),String(before[key]),key);
 assert.equal((await commissionSettings(db,'b2')).bookingEnabled,false);
 const audit=(await db.query("SELECT data FROM events WHERE kind='commission_settings' ORDER BY created DESC")).rows.map(r=>JSON.parse(r.data));assert.ok(audit.some(e=>e.actor==='primary'&&e.bookingEnabled===false&&e.membershipEnabled===true));
 await assert.rejects(tx(()=>setPlatformCommissionEnabled(db,{businessId:'b2',actor:'primary',kind:'membership',enabled:true})),/accept/);
 await assert.rejects(tx(()=>setPlatformCommissionEnabled(db,{businessId:'b1',actor:'primary',kind:'all',enabled:true})),/Choose/);
 await assert.rejects(tx(()=>setPlatformCommissionEnabled(db,{businessId:'b1',actor:'primary',kind:'booking',enabled:'false'})),/Choose/);
});
