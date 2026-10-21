import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {monthlyPeriod,refreshMemberPeriod} from '../server/membership-periods.mjs';
import {couponTotal,checkoutCoupon} from '../server/business-coupons.mjs';
import {queueMembershipInvitation,invitationDetails,processMembershipInvitations} from '../server/membership-invitations.mjs';
import {membershipBillingAction} from '../server/membership-billing-actions.mjs';
import {applyMembershipInvoice} from '../server/stripe-checkout.mjs';
import {confirmDirectBookingForPayment,reconcileUncheckedBookings} from '../server/direct-booking-approval.mjs';
import {decorateBookingTimeline} from '../server/booking-timeline.mjs';
async function fixture(){
 const pg=new PGlite();for(const file of (await readdir(new URL('../migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort())await pg.exec(await readFile(new URL('../migrations/'+file,import.meta.url),'utf8'));
 await pg.exec("INSERT INTO users(id,email,password_hash) VALUES('owner','owner@example.test','hash'),('other','other@example.test','hash'); INSERT INTO businesses(id,owner_id,slug,name,status) VALUES('biz','owner','club-one','Club One','active'),('foreign','other','club-two','Other Club','active'); INSERT INTO membership_plans(id,business_id,name,interval_unit,price_cents,sessions_included) VALUES('plan','biz','Training','month',3000,8); INSERT INTO customer_memberships(id,business_id,plan_id,customer_name,customer_email,customer_phone,date_of_birth,status,price_cents,sessions_included,sessions_used,member_number,stripe_account_id) VALUES('11111111-1111-4111-8111-111111111111','biz','plan','Test Parent','parent@example.test','1234567890','1990-01-01','pending_payment',3000,0,0,'TP010190','');");
 const db={query:async(s,p)=>{const r=await pg.query(s,p);return {...r,rowCount:r.rows.length||r.affectedRows||0};},release(){}},pool={...db,connect:async()=>db};return {pg,db,pool};
}
test('monthly anniversary clamps short months and returns to original date; unused sessions never roll over',async()=>{
 assert.equal(monthlyPeriod('2028-01-31T12:00:00Z',new Date('2028-02-29T13:00:00Z')).end.toISOString(),'2028-03-31T12:00:00.000Z');
 const {pg,db}=await fixture();try{
 await pg.exec("UPDATE customer_memberships SET status='active',initial_paid_at='2028-01-31T12:00Z',credit_period_start='2028-01-31T12:00Z',credit_period_end='2028-02-29T12:00Z',paid_through='2029-01-31T12:00Z',monthly_sessions=8,sessions_included=12,sessions_used=3");
 const before=(await pg.query('SELECT * FROM customer_memberships')).rows[0];
 const m=await refreshMemberPeriod(db,before,new Date('2028-02-29T13:00Z'));assert.equal(m.sessions_included,8);assert.equal(m.sessions_used,0);
 assert.equal((await pg.query('SELECT sessions_used FROM membership_credit_periods')).rows[0].sessions_used,3);
 await refreshMemberPeriod(db,m,new Date('2028-03-01T12:00Z'));assert.equal((await pg.query('SELECT count(*)::int n FROM membership_credit_periods')).rows[0].n,1);
 const expired=await refreshMemberPeriod(db,{...m,paid_through:'2028-03-02T12:00Z'},new Date('2028-03-31T13:00Z'));assert.equal(expired.status,'expired');
 }finally{await pg.close();}
});
test('coupons calculate discounts server-side, synchronize to the connected account and cannot cross businesses',async()=>{
 const {pg,db}=await fixture();try{
 const args={business:{id:'biz'},owner:'owner',origin:'https://example.test',input:{action:'saveCoupon',code:'SPRING',description:'First month discount',kind:'percent',value:25,duration:'once'}};
 await membershipBillingAction(db,args);
 let calls=0;const api=async(path,o)=>{calls++;assert.equal(path,'coupons');assert.equal(o.account,'acct_test');assert.equal(o.params.percent_off,25);return {id:'coupon_test'};};
 const c=await checkoutCoupon(db,'biz','spring',3000,'acct_test',api);assert.equal(c.total,2250);assert.equal(couponTotal({kind:'fixed',value:5000},3000),0);
 await checkoutCoupon(db,'biz','SPRING',3000,'acct_test',api);assert.equal(calls,1);
 await assert.rejects(checkoutCoupon(db,'foreign','SPRING',3000,'acct_test',api),/active coupon/);
 }finally{await pg.close();}
});
test('owner payment invitation has exact member and plan details, an expiring private action and no automatic charge',async()=>{
 const {pg,db,pool}=await fixture();try{
 await assert.rejects(queueMembershipInvitation(db,{businessId:'foreign',membershipId:'11111111-1111-4111-8111-111111111111',origin:'https://example.test'}),/Choose/);
 await queueMembershipInvitation(db,{businessId:'biz',membershipId:'11111111-1111-4111-8111-111111111111',origin:'https://example.test'});
 const row=(await pg.query('SELECT * FROM membership_payment_invitations')).rows[0];assert.match(row.message.text,/Test Parent/);assert.match(row.message.text,/Sessions included each month: 8/);assert.match(row.message.text,/no.*roll over/);
 const token=row.message.actions[0].url.split('/').at(-1);assert.equal(token.length,64);assert.notEqual(row.token_hash,token);
 assert.equal((await invitationDetails(db,token)).member_number,'TP010190');
 const sent=[];await processMembershipInvitations(pool,{send:async(...a)=>{sent.push(a);return {status:'submitted',detail:'Synthetic provider acceptance'};}});assert.equal(sent.length,1);
 assert.equal((await pg.query('SELECT status FROM customer_memberships')).rows[0].status,'pending_payment');
 }finally{await pg.close();}
});
test('paid renewal resets allowance once, preserves prior usage and accepts only the stored discounted invoice amount',async()=>{
 const {pg,db}=await fixture();try{
 await pg.exec("UPDATE customer_memberships SET stripe_account_id='acct_test',stripe_sessions_per_period=8,first_invoice_cents=2250,renewal_invoice_cents=3000");
 const sub={id:'sub_test',livemode:false,status:'active',metadata:{membership_id:'11111111-1111-4111-8111-111111111111',selahflow_business_id:'biz'}};
 const invoice={id:'in_first',livemode:false,paid:true,status:'paid',amount_paid:2250,currency:'usd',billing_reason:'subscription_create',subscription:'sub_test',customer:'cus_test',lines:{data:[{period:{start:1896091200,end:1898769600}}]}};
 assert.equal(await applyMembershipInvoice(db,'biz','acct_test',{...invoice,amount_paid:2000},sub),false);
 assert.equal(await applyMembershipInvoice(db,'biz','acct_test',invoice,sub),true);
 await pg.exec("UPDATE customer_memberships SET sessions_used=3");
 const renewal={...invoice,id:'in_renew',billing_reason:'subscription_cycle',amount_paid:3000,lines:{data:[{period:{start:1898769600,end:1901188800}}]}};
 assert.equal(await applyMembershipInvoice(db,'biz','acct_test',renewal,sub),true);
 let m=(await pg.query('SELECT * FROM customer_memberships')).rows[0];assert.equal(m.sessions_included,8);assert.equal(m.sessions_used,0);
 await pg.exec("UPDATE customer_memberships SET sessions_used=1");
 await applyMembershipInvoice(db,'biz','acct_test',renewal,sub);m=(await pg.query('SELECT * FROM customer_memberships')).rows[0];assert.equal(m.sessions_used,1);
 assert.equal((await pg.query('SELECT count(*)::int n FROM stripe_payment_receipts')).rows[0].n,2);
 }finally{await pg.close();}
});
test('public payment cannot auto-approve requests and client booking timeline reflects provider payment',async()=>{
 const noCalls={query:()=>{throw Error('Unexpected database mutation');}};
 assert.equal(await confirmDirectBookingForPayment(noCalls,{}),undefined);
 assert.equal((await reconcileUncheckedBookings(noCalls,{origin:'https://example.test'})).confirmed,0);
 const row={id:'a',data:JSON.stringify({price:30,created:'2030-01-01'})};
 assert.equal(JSON.parse(decorateBookingTimeline([row])[0].data).paymentTracking,'pending');
 const paid=JSON.parse(decorateBookingTimeline([row],[{id:'r',appointment_id:'a',status:'accepted',created_at:'2030-01-01',reviewed_at:'2030-01-02'}],[{booking_id:'a',status:'paid',paid_at:'2030-01-03'}])[0].data);
 assert.equal(paid.paymentTracking,'completed');assert.ok(paid.bookingTimeline.some(v=>v.status==='Accepted'));assert.ok(paid.bookingTimeline.some(v=>v.status==='Payment completed'));
});
