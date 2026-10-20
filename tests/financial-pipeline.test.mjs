import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {financialPipeline,financialStageTotals,financialRowsForRange,loadFinancialPipeline,bookingQuote} from '../server/financial-pipeline.mjs';
import {randomUUID} from 'node:crypto';
import {tokenHash} from '../server/security.mjs';
import {startBookingCheckout} from '../server/stripe-checkout.mjs';
import {bookingPaymentPreview} from '../server/booking-payment-preview.mjs';
import {recordCashSale} from '../server/record-cash-sale.mjs';
import {registrationPaymentSummary} from '../server/registration-payment.mjs';
const services=[{id:'service',name:'Training',price:25}],quote={name:'Client',services:['Training'],serviceIds:['service'],price:25,paymentLines:[{id:'service',type:'service',price:25,qty:1}]};
test('submitted, approved, awaiting-payment and paid evidence classify once without losing pending memberships',()=>{
 const rows=financialPipeline({services,appointments:[
  {id:'approved',date:'2026-10-19',status:'Confirmed',data:quote},
  {id:'pending',date:'2026-10-19',status:'Checked in',data:quote,payment_requested:true},
  {id:'paid',status:'Completed',data:quote,verified_paid:true},
  {id:'cash',status:'Confirmed',data:quote},
  {id:'covered',status:'Confirmed',data:{...quote,membershipCovered:true}},
  {id:'cancelled',status:'Cancelled',data:quote}],
 requests:[{id:'submitted',status:'pending',date:'2026-10-19',details:quote},{id:'converted',status:'accepted',appointment_id:'approved',details:quote},{id:'declined',status:'declined',details:quote}],
 memberships:[{id:'unpaid-member',status:'pending_payment',price_cents:12000,created_at:'2026-10-19',plan_name:'Academy'},{id:'active',status:'active',price_cents:99000}],
 membershipRequests:[{id:'signup',status:'pending',created_at:'2026-10-19',price_cents:20000,details:{name:'New Client',quotedPriceCents:15000}},{id:'converted-signup',status:'approved',membership_id:'unpaid-member',price_cents:12000,details:{}}],
 sales:[{kind:'cash_sale',bookingId:'cash'}]});
 assert.equal(rows.length,6);const totals=financialStageTotals(rows);
 assert.equal(totals.submitted.amountCents,17500);assert.equal(totals.approved.amountCents,2500);assert.equal(totals.pending_payment.amountCents,14500);assert.equal(totals.paid.count,0);
 assert.equal(rows.find(r=>r.reference==='covered').amountCents,0);
 assert.equal(rows.find(r=>r.reference==='signup').basis,'Submitted package quote');
 assert.ok(!rows.some(r=>['paid','cash','active','converted','declined'].includes(r.reference)));
});
test('unknown quotes remain visible as unpriced; removed service lines and Eastern date boundaries are handled',()=>{
 assert.equal(bookingQuote({price:null},services).amountCents,null);
 assert.equal(bookingQuote({paymentLines:[{id:'deleted',type:'service',price:999,qty:1}]},services),null);
 assert.equal(bookingQuote({paymentLines:[{id:'deleted',type:'service',price:999,qty:1},{id:'service',type:'service',price:12.34,qty:2}]},services).amountCents,2468);
 const totals=financialStageTotals([{category:'submitted',amountCents:null},{category:'submitted',amountCents:1234}]);
 assert.deepEqual(totals.submitted,{amountCents:1234,count:2,unpriced:1});
 const rows=[{date:'2026-10-20T01:00:00Z'},{date:'2026-10-20T05:00:00Z'},{date:'2026-10-19'}];
 assert.equal(financialRowsForRange(rows,'Today','2026-10-19').length,2);
 assert.equal(financialRowsForRange(rows,'This month','2026-10-01').length,3);
});
async function fixture(){const pg=new PGlite();for(const f of (await readdir(new URL('../migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort())await pg.exec(await readFile(new URL('../migrations/'+f,import.meta.url),'utf8'));
 for(const [owner,business,amount] of [['owner','business',25],['other','other-business',999]]){
  await pg.query('INSERT INTO users(id,email,password_hash) VALUES($1,$2,$3)',[owner,owner+'@example.test','hash']);
  await pg.query("INSERT INTO businesses(id,owner_id,slug,name,status) VALUES($1,$2,$1,$1,'active')",[business,owner]);
  await pg.query('INSERT INTO settings(owner,data) VALUES($1,$2)',[owner,JSON.stringify({services})]);
  await pg.query("INSERT INTO appointments(id,owner,date,staff,start,duration,data,status) VALUES($1,$2,'2026-10-19','coach',600,60,$3,'Confirmed')",[business,owner,JSON.stringify({...quote,price:amount})]);
 }
 const client={query:async(s,p)=>{const r=await pg.query(s,p);return {...r,rowCount:r.rows.length||r.affectedRows||0};},release(){}};
 return {pg,pool:{...client,connect:async()=>client}};
}
test('database loader isolates owners and excludes cash-paid bookings even after a revenue reset hides the payment',async()=>{
 const {pg,pool}=await fixture();try{
  assert.equal((await loadFinancialPipeline(pg,'owner')).length,1);assert.equal((await loadFinancialPipeline(pg,'owner'))[0].reference,'business');
  await recordCashSale(pool,{owner:'owner',eventId:'cash-one',bookingId:'business',lines:[{id:'service',name:'Training',type:'service',price:25,qty:1}],taxRate:0});
  const event=JSON.parse((await pg.query("SELECT data FROM events WHERE id='cash-one'")).rows[0].data);
  assert.equal(event.bookingId,'business');assert.equal(event.total,25);
  assert.equal((await registrationPaymentSummary(pg,'owner','business')).state,'paid');
  await pg.exec("INSERT INTO owner_report_hidden_payments(owner,payment_key) VALUES('owner','cash_sale:cash-one')");
  assert.equal((await loadFinancialPipeline(pg,'owner')).length,0);
  assert.equal((await loadFinancialPipeline(pg,'other')).length,1);
  await assert.rejects(recordCashSale(pool,{owner:'owner',eventId:'duplicate',bookingId:'business',lines:[{id:'service',name:'Training',type:'service',price:25,qty:1}],taxRate:0}),/already paid/);
  assert.equal((await pg.query("SELECT count(*)::int AS n FROM events WHERE kind='cash_sale'")).rows[0].n,1);
 }finally{await pg.close();}
});
test('cash linking rejects another tenant, a mismatched amount and an existing Stripe checkout without creating a sale',async()=>{
 const {pg,pool}=await fixture();const sale={owner:'owner',eventId:'rejected',bookingId:'business',lines:[{id:'service',name:'Training',type:'service',price:25,qty:1}],taxRate:0};
 try{
  await assert.rejects(recordCashSale(pool,{...sale,bookingId:'other-business'}),/this business/);
  await assert.rejects(recordCashSale(pool,{...sale,lines:[{...sale.lines[0],price:20}]}),/full quoted amount/);
  await pg.exec("INSERT INTO booking_payments(booking_id,business_id,stripe_account_id,amount_cents,lines,stripe_checkout_session_id) VALUES('business','business','acct_fixture',2500,'[]','cs_existing')");
  await assert.rejects(recordCashSale(pool,sale),/card checkout/);
  assert.equal((await pg.query('SELECT count(*)::int AS n FROM events')).rows[0].n,0);
 }finally{await pg.close();}
});

test('a cash-settled booking previews as paid and cannot create a new Stripe checkout',async()=>{
 const {pg,pool}=await fixture();try{
  const id=randomUUID(),token='a'.repeat(64);
  await pg.query("INSERT INTO appointments(id,owner,date,staff,start,duration,data,status) VALUES($1,'owner','2026-10-19','coach',700,60,$2,'Confirmed')",[id,JSON.stringify(quote)]);
  await pg.query("INSERT INTO customer_booking_access(token_hash,owner_id,booking_id) VALUES($1,'owner',$2)",[tokenHash(token),id]);
  await recordCashSale(pool,{owner:'owner',eventId:'settled-cash',bookingId:id,lines:[{id:'service',name:'Training',type:'service',price:25,qty:1}],taxRate:0});
  const args={slug:'business',bookingId:id,token,origin:'https://example.test'};
  assert.equal((await bookingPaymentPreview(pool,args)).status,'paid');
  let providerCalls=0;assert.equal((await startBookingCheckout(pool,args,async()=>{providerCalls++;throw Error('No provider call expected');})).paid,true);
  assert.equal(providerCalls,0);assert.equal((await pg.query('SELECT count(*)::int AS n FROM booking_payments')).rows[0].n,0);
 }finally{await pg.close();}
});
