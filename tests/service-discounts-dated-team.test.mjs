import {assertRequestReviewer} from '../server/booking-review-access.mjs';
import {createRequire} from 'node:module';
import {tokenHash} from '../server/security.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import ts from 'typescript';
import {PGlite} from '@electric-sql/pglite';
import {bookingDiscount} from '../server/booking-discounts.mjs';
import {saveTeamOccurrence} from '../server/team-occurrence-assignments.mjs';
import {queueBookingReceipt,processBookingReceipts} from '../server/booking-receipts.mjs';
import {confirmBooking} from '../server/booking-approvals.mjs';
import {processClientMessages} from '../server/booking-client-notifications.mjs';
import {startBookingCheckout,applyBookingPayment} from '../server/stripe-checkout.mjs';
async function fixture(){
 const pg=new PGlite();for(const f of (await readdir(new URL('../migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort())await pg.exec(await readFile(new URL('../migrations/'+f,import.meta.url),'utf8'));
 await pg.exec("INSERT INTO users(id,email,password_hash) VALUES('owner','owner@example.test','hash'),('other','other@example.test','hash'); INSERT INTO businesses(id,owner_id,slug,name,status) VALUES('biz','owner','training-one','Training One','active'),('foreign','other','other-training','Other','active'); INSERT INTO merchant_accounts(business_id,provider,external_account_id,charges_enabled,onboarding_complete) VALUES('biz','stripe','acct_test',true,true); INSERT INTO business_coupons(business_id,code,description,kind,value) VALUES('biz','SAVE503','Service discount','fixed',503),('biz','TEN','Ten percent','percent',10),('biz','FREE','Complimentary','percent',100)");
 const db={query:async(s,p)=>{const r=await pg.query(s,p);return {...r,rowCount:r.rows.length||r.affectedRows||0};},release(){}},pool={...db,connect:async()=>db};
 const config={name:'Training One',address:'1 Training Way',open:8,close:20,buffer:0,services:[{id:'s1',name:'Training',price:10.01,duration:30,maxSlots:5},{id:'s2',name:'Indoor soccer',price:20.02,duration:30,maxSlots:5}],staff:[{id:'coach',name:'Test Coach',services:['s1','s2']}],bookableSessions:[]};
 await db.query('INSERT INTO settings(owner,data) VALUES($1,$2)',['owner',JSON.stringify(config)]);return {pg,db,pool,config};
}
test('service coupons use business prices, distribute every cent and reject inactive or cross-business codes',async()=>{
 const {pg,db,config}=await fixture();try{
  const input={businessId:'biz',services:config.services,code:'save503'};const q=await bookingDiscount(db,input);assert.equal(q.price,25);assert.equal(q.coupon.originalCents,3003);assert.equal(q.paymentLines.reduce((sum,l)=>sum+Math.round(l.price*100),0),2500);
  assert.equal((await bookingDiscount(db,{...input,code:'TEN'})).price,27.03);assert.equal((await bookingDiscount(db,{...input,code:'FREE'})).price,0);
  assert.equal((await bookingDiscount(db,{...input,membershipCovered:true})).coupon,null);
  await assert.rejects(bookingDiscount(db,{...input,businessId:'foreign'}),/active coupon/);
  await pg.exec("UPDATE business_coupons SET expires_at=now()-interval '1 day' WHERE code='TEN'; UPDATE business_coupons SET active=false WHERE code='FREE'");
  for(const code of ['TEN','FREE','MISSING'])await assert.rejects(bookingDiscount(db,{...input,code}),/active coupon/);
 }finally{await pg.close();}
});
test('submission and actual owner approval email exact appointment details and carry the discount into Stripe once',async()=>{
 const {pg,db,pool,config}=await fixture(),old=[process.env.STRIPE_SECRET_KEY,process.env.STRIPE_CONNECT_WEBHOOK_SECRET];process.env.STRIPE_SECRET_KEY='sk_test_fixture';process.env.STRIPE_CONNECT_WEBHOOK_SECRET='whsec_fixture';
 try{
  const origin='https://app.example.test',id=randomUUID(),discount=await bookingDiscount(db,{businessId:'biz',services:config.services,code:'SAVE503'});
  const details={customerName:'Test Parent',customerEmail:'parent@example.test',customerPhone:'+14155552671',services:config.services.map(s=>s.name),serviceIds:['s1','s2'],quotedPrice:discount.price,paymentLines:discount.paymentLines,coupon:discount.coupon};
  await db.query("INSERT INTO booking_requests(id,business_id,owner_id,date,staff_id,start_minute,duration,details,reviewer) VALUES($1,'biz','owner','2030-11-01','coach',600,60,$2,'owner')",[id,JSON.stringify(details)]);
  await queueBookingReceipt(db,{owner:'owner',bookingId:id,date:'2030-11-01',start:600,duration:60,staff:'coach',data:details,origin,pending:true});
  const sent=[];const send=async(channel,destination,message)=>{sent.push({channel,destination,message});return {status:'submitted',detail:'Synthetic provider acceptance'};};
  await processBookingReceipts(pool,{send});assert.equal(sent.length,1);assert.equal(sent[0].destination,details.customerEmail);assert.match(sent[0].message.text,/Booking request received/);assert.match(sent[0].message.text,/SAVE503/);assert.equal(sent[0].message.actions.some(a=>a.label==='Make Payment'),true);assert.equal(sent[0].message.actions.some(a=>a.label==='Pay on Site'),true);assert.match(sent[0].message.text,/after approval/);
  globalThis.__serviceReview123={assertRequestReviewer,getPool:()=>pool,confirmBooking:o=>confirmBooking({...o,pool}),randomUUID,today:()=>new Date().toISOString().slice(0,10),notifyCustomerBooking:async()=>{}};
  let source=(await readFile(new URL('../lib/booking-review-actions.ts',import.meta.url),'utf8')).replace(/^import .*;$/gm,'');source='const {assertRequestReviewer,getPool,confirmBooking,randomUUID,today,notifyCustomerBooking}=globalThis.__serviceReview123;\n'+source;
  const review=await import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64'));
  const reviewToken='a'.repeat(64);await db.query("INSERT INTO booking_action_tokens(id,request_id,reviewer,token_hash,expires_at) VALUES($1,$2,'owner',$3,now()+interval '1 day')",[randomUUID(),id,tokenHash(reviewToken)]);
  const routeURL=new URL('../app/api/booking/respond/route.ts',import.meta.url),exports={},nativeRequire=createRequire(routeURL);const routeCode=ts.transpileModule(await readFile(routeURL,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  new Function('require','exports',routeCode)(path=>path.endsWith('/server/database.mjs')?{getPool:()=>pool}:path.endsWith('/lib/booking-review-actions')?review:nativeRequire(path),exports);
  const reviewResponse=await exports.GET(new Request(origin+'/api/booking/respond',{headers:{authorization:'Bearer '+reviewToken}}));assert.equal(reviewResponse.status,200,'Mandatory owner review works when legacy optional approval flag is disabled');assert.equal((await reviewResponse.json()).status,'pending');assert.equal((await exports.GET(new Request(origin+'/api/booking/respond',{headers:{authorization:'Bearer '+'b'.repeat(64)}}))).status,403);
  const accepted=await review.reviewPendingRequest('owner',id,'owner',true,origin);await assert.rejects(review.reviewPendingRequest('owner',id,'owner',true,origin),/reviewed/);
  const appointment=JSON.parse((await db.query('SELECT data FROM appointments WHERE id=$1',[accepted.appointmentId])).rows[0].data);assert.equal(appointment.price,25);assert.equal(appointment.coupon.code,'SAVE503');
  await processClientMessages(pool,{send});await processClientMessages(pool,{send});const email=sent.find(s=>s.channel==='email'&&/Booking confirmed/.test(s.message.subject)&&s.message.actions.some(a=>a.label==='Make Payment'));assert.ok(email);assert.equal(email.destination,details.customerEmail);
  for(const text of ['Training','Indoor soccer','2030-11-01','10:00 AM Eastern','60 minutes','Test Coach','1 Training Way','SAVE503','$25.00 due'])assert.ok(email.message.text.includes(text),text);
  const action=email.message.actions.find(a=>a.label==='Make Payment'),params=new URLSearchParams(new URL(action.url).hash.slice(1));const args={slug:'training-one',bookingId:id,token:params.get('token'),origin};
  // A later coupon expiry never changes an accepted booking's quoted payment.
  await pg.exec('UPDATE business_coupons SET active=false');let creates=0;const session={id:'cs_service_coupon',mode:'payment',livemode:false,status:'open',payment_status:'unpaid',url:'https://checkout.stripe.com/c/pay/test_fixture'};
  const api=async(path,o)=>{if(path.startsWith('accounts/'))return {charges_enabled:true,details_submitted:true};if(path==='checkout/sessions'){creates++;assert.equal(o.params['line_items[0][price_data][unit_amount]'],'2500');assert.match(o.params['line_items[0][price_data][product_data][description]'],/SAVE503/);}return session;};
  await startBookingCheckout(pool,args,api);await startBookingCheckout(pool,args,api);assert.equal(creates,1);
  const paid={...session,status:'complete',payment_status:'paid',currency:'usd',payment_intent:'pi_service_coupon',amount_total:2500,client_reference_id:accepted.appointmentId,metadata:{booking_id:accepted.appointmentId,selahflow_business_id:'biz'}};
  assert.equal(await applyBookingPayment(db,'biz','acct_test',{...paid,amount_total:3003}),false);assert.equal(await applyBookingPayment(db,'biz','acct_test',paid),true);assert.equal(await applyBookingPayment(db,'biz','acct_test',paid),true);assert.equal((await db.query('SELECT count(*)::int n FROM stripe_payment_receipts')).rows[0].n,1);
 }finally{await pg.close();for(const [i,k] of ['STRIPE_SECRET_KEY','STRIPE_CONNECT_WEBHOOK_SECRET'].entries())if(old[i]===undefined)delete process.env[k];else process.env[k]=old[i];delete globalThis.__serviceReview123;}
});
test('dated accountability assignments validate recurring occurrence date/time and remain independent and private',async()=>{
 const {pg,db,config}=await fixture();try{
  config.bookableSessions=[{id:'series',date:'2030-11-01',start:600,staff:'coach',service:'s1',capacity:5,repeat:{frequency:'weekly',every:1,until:'2030-11-15'}}];
  const input={sessionId:'series__20301108',date:'2030-11-08',start:600,staffIds:['coach'],note:'Private duty'};
  await saveTeamOccurrence(db,{businessId:'biz',config,input});await saveTeamOccurrence(db,{businessId:'biz',config,input:{...input,note:'Updated duty'}});
  await saveTeamOccurrence(db,{businessId:'biz',config,input:{...input,sessionId:'series',date:'2030-11-01',staffIds:[]}});
  assert.equal((await db.query('SELECT count(*)::int n FROM session_team_occurrences')).rows[0].n,2);
  assert.equal((await db.query("SELECT note FROM session_team_occurrences WHERE session_date='2030-11-08'")).rows[0].note,'Updated duty');
  for(const change of [{date:'2030-11-09'},{start:615},{staffIds:['foreign-staff']},{date:'2030-02-30'}])await assert.rejects(saveTeamOccurrence(db,{businessId:'biz',config,input:{...input,...change}}),/Choose/);
  assert.equal((await db.query("SELECT count(*)::int n FROM session_team_occurrences WHERE business_id='foreign'")).rows[0].n,0);
 }finally{await pg.close();}
});
