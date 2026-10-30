import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {randomUUID,createHash} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {tokenHash} from '../server/security.mjs';
import {authorizeNativePayment,exchangeNativePayment,requireNativePayment} from '../server/native-payment-auth.mjs';
import {chooseBookingOnsite} from '../server/booking-payment-choice.mjs';
import {bookingPaymentPreview} from '../server/booking-payment-preview.mjs';
import {startTerminalPayment,checkTerminalPayment,applyTerminalPayment,saveTerminalLocation,nativeConnectionToken} from '../server/terminal-payments.mjs';
import {startBookingCheckout} from '../server/stripe-checkout.mjs';
import {bookingReceiptMessage} from '../server/booking-receipts.mjs';
import {saveCommissionSettings} from '../server/first-customer-commissions.mjs';
async function fixture(t){
 const old={...process.env};Object.assign(process.env,{APP_ENV:'staging',STRIPE_SECRET_KEY:'sk_test_fixture',STRIPE_CONNECT_WEBHOOK_SECRET:'whsec_fixture'});
 const pg=new PGlite();t.after(async()=>{await pg.close();for(const k of Object.keys(process.env))if(!(k in old))delete process.env[k];Object.assign(process.env,old);});
 for(const f of(await readdir(new URL('../migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort())await pg.exec(await readFile(new URL('../migrations/'+f,import.meta.url),'utf8'));
 const query=async(s,v)=>{const r=await pg.query(s,v);return {...r,rowCount:r.rows.length||r.affectedRows||0};},db={query,release(){}},pool={query,connect:async()=>db};
 await pg.exec("INSERT INTO users(id,email,password_hash) VALUES('u1','one@example.test','hash'),('u2','two@example.test','hash'); INSERT INTO businesses(id,owner_id,slug,name,status) VALUES('b1','u1','one','One','active'),('b2','u2','two','Two','active'); INSERT INTO merchant_accounts(business_id,external_account_id,charges_enabled,onboarding_complete) VALUES('b1','acct_one',true,true),('b2','acct_two',true,true);");
 const bookingId=randomUUID(),token='a'.repeat(64),sessionHash=tokenHash('b'.repeat(64)),scope={business_id:'b1',booking_id:bookingId};
 await query("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,'u1',now()+interval '2 hours')",[sessionHash]);
 await query('INSERT INTO settings(owner,data) VALUES($1,$2)',['u1',JSON.stringify({services:[{id:'s',name:'Coaching',price:100,paymentOptions:'both'}]})]);
 await query("INSERT INTO appointments(id,owner,date,staff,start,duration,status,data) VALUES($1,'u1','2026-11-01','coach',600,60,'Confirmed',$2)",[bookingId,JSON.stringify({name:'Synthetic Client',email:'synthetic@example.test',memberNumber:'SC1001',price:100,services:['Coaching'],serviceIds:['s']})]);
 await query("INSERT INTO customer_booking_access(token_hash,owner_id,booking_id) VALUES($1,'u1',$2)",[tokenHash(token),bookingId]);
 let creates=0;let pi=null;const calls=[];
 const api=async(path,o={})=>{
  calls.push([path,o]);if(path.startsWith('core/accounts/')){assert.equal(o.namespace,'v2');return {id:'acct_one',configuration:{merchant:{capabilities:{card_payments:{status:'active'}}}}};}if(path.startsWith('accounts/'))return {id:'acct_one',charges_enabled:true,details_submitted:true};assert.equal(o.account,'acct_one');
  if(path.startsWith('terminal/locations/'))return {id:'tml_one'};
  if(path==='terminal/connection_tokens'){assert.equal(o.params.location,'tml_one');return {secret:'pst_fixture'};}
  if(path==='payment_intents'){creates++;pi={id:'pi_onsite'+creates,client_secret:'pi_onsite_secret',livemode:false,status:'requires_payment_method',amount:10000,amount_received:0,currency:'usd',payment_method_types:['card_present'],application_fee_amount:o.params.application_fee_amount||null,metadata:{booking_id:bookingId,selahflow_business_id:'b1',selahflow_channel:'terminal',commission_claim_id:o.params['metadata[commission_claim_id]']}};return pi;}
  if(path.startsWith('payment_intents/')){if(path.endsWith('/cancel'))pi={...pi,status:'canceled'};return pi;}
  throw Error('Unexpected Stripe call '+path);
 };
 const tx=async fn=>{await query('BEGIN');try{const result=await fn();await query('COMMIT');return result;}catch(e){await query('ROLLBACK');throw e;}};
 return {pg,query,db,pool,bookingId,token,sessionHash,scope,api,calls,tx,get pi(){return pi;},set pi(v){pi=v;},get creates(){return creates;}};
}
test('phone authorization is PKCE-bound, one-use, tenant/session scoped and revocable',async t=>{
 const f=await fixture(t),verifier='v'.repeat(64),challenge=createHash('sha256').update(verifier).digest('base64url'),state='s'.repeat(48),args={owner:'u1',sessionHash:f.sessionHash,bookingId:f.bookingId,challenge,state};
 await assert.rejects(authorizeNativePayment(f.db,{...args,owner:'u2'}),/owner/);
 const {code}=await authorizeNativePayment(f.db,args);
 await assert.rejects(exchangeNativePayment(f.db,{code,verifier:'x'.repeat(64),state}),/expired/);
 await assert.rejects(exchangeNativePayment(f.db,{code,verifier,state:'z'.repeat(48)}),/expired/);
 const grant=await exchangeNativePayment(f.db,{code,verifier,state});assert.equal(grant.bookingId,f.bookingId);
 await assert.rejects(exchangeNativePayment(f.db,{code,verifier,state}),/already used/);
 assert.equal((await requireNativePayment(f.db,grant.token)).business_id,'b1');
 await f.query('DELETE FROM sessions WHERE token_hash=$1',[f.sessionHash]);await assert.rejects(requireNativePayment(f.db,grant.token),/AUTH_REQUIRED/);
});
test('Pay on Site persists private-link preference for pending/approved bookings without recording money',async t=>{
 const f=await fixture(t),args={slug:'one',bookingId:f.bookingId,token:f.token};
 assert.equal((await chooseBookingOnsite(f.pool,args)).paid,false);
 assert.equal(JSON.parse((await f.query('SELECT data FROM appointments')).rows[0].data).paymentChoice,'onsite');
 assert.equal((await f.query('SELECT count(*)::int AS n FROM events')).rows[0].n,0);
 await assert.rejects(chooseBookingOnsite(f.pool,{...args,slug:'two'}),/unavailable/);
 await f.query("UPDATE settings SET data=$1 WHERE owner='u1'",[JSON.stringify({services:[{id:'s',name:'Coaching',paymentOptions:'online'}]})]);await assert.rejects(chooseBookingOnsite(f.pool,args),/not enabled/);
 const id=randomUUID();await f.query("INSERT INTO booking_requests(id,business_id,owner_id,date,staff_id,start_minute,duration,details) VALUES($1,'b1','u1','2026-11-01','coach',700,60,$2)",[id,JSON.stringify({quotedPrice:25,serviceIds:['other']})]);await f.query("INSERT INTO customer_booking_access(token_hash,owner_id,booking_id) VALUES($1,'u1',$2)",[tokenHash('c'.repeat(64)),id]);
 const pending={slug:'one',bookingId:id,token:'c'.repeat(64)};assert.equal((await chooseBookingOnsite(f.pool,pending)).pending,true);assert.equal((await bookingPaymentPreview(f.pool,pending)).status,'awaiting_approval');
});
test('Terminal is server-priced, preserves commissions, verifies account/amount/card-present and records one sale/receipt/email',async t=>{
 const f=await fixture(t);await saveTerminalLocation(f.db,'u1','tml_one',f.api);assert.equal((await nativeConnectionToken(f.db,f.scope,f.api)).secret,'pst_fixture');
 await f.tx(()=>saveCommissionSettings(f.db,{businessId:'b1',actor:'u1',bookingEnabled:true,membershipEnabled:false,acceptTerms:true}));
 await f.query("INSERT INTO business_member_ids(business_id,member_number,identity_key) VALUES('b1','SC1001','registration:'||$1)",[randomUUID()]);
 const start=()=>startTerminalPayment(f.pool,f.scope,'https://staging.example',f.api);
 assert.ok((await start()).clientSecret);assert.ok((await start()).clientSecret);assert.equal(f.creates,1);
 assert.equal(f.pi.application_fee_amount,1000);assert.equal((await f.query('SELECT count(*)::int AS n FROM events WHERE kind=\'cash_sale\'')).rows[0].n,0);
 await assert.rejects(startBookingCheckout(f.pool,{slug:'one',bookingId:f.bookingId,token:f.token,origin:'https://staging.example'},f.api),/Onsite card collection/);
 const paid={...f.pi,status:'succeeded',amount_received:10000,latest_charge:{id:'ch_one',paid:true,payment_method_details:{type:'card_present'},application_fee:'fee_one'}};
 assert.equal(await f.tx(()=>applyTerminalPayment(f.db,'b2','acct_two',paid,f.api)),false);
 assert.equal(await f.tx(()=>applyTerminalPayment(f.db,'b1','acct_one',{...paid,amount_received:1},f.api)),false);
 f.pi={...paid,latest_charge:{...paid.latest_charge,payment_method_details:{type:'card'}}};await assert.rejects(f.tx(()=>applyTerminalPayment(f.db,'b1','acct_one',paid,f.api)),/card-present/);
 f.pi=paid;assert.equal((await checkTerminalPayment(f.pool,f.scope,{},f.api)).paid,true);assert.equal((await checkTerminalPayment(f.pool,f.scope,{},f.api)).paid,true);
 assert.equal((await f.query("SELECT count(*)::int AS n FROM events WHERE kind='cash_sale'")).rows[0].n,1);
 assert.equal((await f.query('SELECT count(*)::int AS n FROM stripe_payment_receipts')).rows[0].n,1);
 assert.equal((await f.query("SELECT count(*)::int AS n FROM booking_client_messages WHERE event_type='payment_confirmation' AND channel='email'")).rows[0].n,1);
 assert.equal((await f.query('SELECT status FROM first_customer_commissions')).rows[0].status,'paid');
 assert.equal(JSON.parse((await f.query('SELECT data FROM appointments')).rows[0].data).paymentMethod,'tap_to_pay');
 assert.equal((await start()).paid,true);assert.equal(f.creates,1);
 await f.query('UPDATE stripe_payment_receipts SET booking_id=NULL WHERE provider_reference=$1',[paid.id]);await f.query('DELETE FROM booking_payments WHERE booking_id=$1',[f.bookingId]);
 assert.equal(await f.tx(()=>applyTerminalPayment(f.db,'b1','acct_one',paid,f.api)),true,'deleted client receipts acknowledge replay without restoring client/payment rows');
 assert.equal((await f.query('SELECT count(*)::int AS n FROM booking_payments')).rows[0].n,0);
});
test('cancelled collection can retry; processing payment cannot be cancelled or replaced',async t=>{
 const f=await fixture(t);await saveTerminalLocation(f.db,'u1','tml_one',f.api);const start=()=>startTerminalPayment(f.pool,f.scope,'https://staging.example',f.api);
 await start();f.pi={...f.pi,status:'processing'};await assert.rejects(checkTerminalPayment(f.pool,f.scope,{cancel:true},f.api),/processing/);await assert.rejects(start(),/processing/);assert.equal(f.creates,1);
 f.pi={...f.pi,status:'requires_payment_method'};assert.equal((await checkTerminalPayment(f.pool,f.scope,{cancel:true},f.api)).status,'canceled');await start();assert.equal(f.creates,2);
 await assert.rejects(startTerminalPayment(f.pool,{...f.scope,business_id:'b2'},'https://staging.example',f.api),/unavailable/);
});
test('emails offer both enabled choices, keep pending approval and remove payment actions after receipt',()=>{
 const r={business:'One',name:'Client',price:100,start:600,date:'2026-11-01',services:['Coaching'],answers:[],links:{status:'https://x.test/status',membership:'https://x.test/member',booking:'https://x.test/book'},pending:true,paymentOptions:{online:true,onsite:true}},paymentLink='https://x.test/payment/one#token=private&booking_id=booking';
 const m=bookingReceiptMessage(r,{paymentLink});assert.ok(m.actions.some(a=>a.label==='Make Payment'));assert.ok(m.actions.some(a=>a.label==='Pay on Site'&&a.url.endsWith('&choice=onsite')));assert.match(m.text,/after approval/);assert.match(m.text,/still|remains due/);
 const paid=bookingReceiptMessage(r,{paymentLink,event:'payment_confirmation'});assert.ok(!paid.actions.some(a=>['Make Payment','Pay on Site'].includes(a.label)));
 const onsite=bookingReceiptMessage({...r,paymentOptions:{online:false,onsite:true}},{paymentLink});assert.ok(!onsite.actions.some(a=>a.label==='Make Payment'));assert.ok(onsite.actions.some(a=>a.label==='Pay on Site'));
});
test('native handoff expires online checkout before issuing a card-present intent and refuses ambiguous provider state',async t=>{
 const f=await fixture(t);await saveTerminalLocation(f.db,'u1','tml_one',f.api);
 await f.query("INSERT INTO booking_payments(booking_id,business_id,stripe_account_id,amount_cents,lines,stripe_checkout_session_id) VALUES($1,'b1','acct_one',10000,$2::jsonb,'cs_test_open')",[f.bookingId,JSON.stringify([{id:'s',name:'Coaching',type:'service',price:100,qty:1}])]);
 let state='complete',expired=0;
 const api=async(path,o)=>{if(path.startsWith('checkout/sessions/')){if(path.endsWith('/expire')){expired++;return {livemode:false,status:'expired'};}return {livemode:false,status:state,payment_status:'unpaid'};}return f.api(path,o);};
 await assert.rejects(startTerminalPayment(f.pool,f.scope,'https://staging.example',api),/processing/);assert.equal(f.creates,0);
 state='open';await startTerminalPayment(f.pool,f.scope,'https://staging.example',api);assert.equal(expired,1);assert.equal(f.creates,1);
 assert.equal((await f.query('SELECT stripe_checkout_session_id FROM booking_payments')).rows[0].stripe_checkout_session_id,null);
 await f.query("UPDATE settings SET data=$1 WHERE owner='u1'",[JSON.stringify({services:[{id:'s',name:'Coaching',paymentOptions:'online'}]})]);
 await assert.rejects(startTerminalPayment(f.pool,f.scope,'https://staging.example',api),/not enabled/);
});
test('native API rejects browser origins and unauthenticated calls without exposing a connection token',async()=>{
 const ts=await import('typescript');let source=await readFile(new URL('../app/api/native/payments/route.ts',import.meta.url),'utf8');
 source=source.replace(/^import .*;$/gm,'');
 source="const getPool=()=>({query:async()=>({rows:[{count:1}]})});const tokenHash=()=>'';const requireNativePayment=async()=>{throw Error('AUTH_REQUIRED')};\n"+source;
 const route=await import('data:text/javascript;base64,'+Buffer.from(ts.default.transpileModule(source,{compilerOptions:{module:ts.default.ModuleKind.ESNext,target:ts.default.ScriptTarget.ES2022}}).outputText).toString('base64'));
 const req=origin=>new Request('https://selahflow.onrender.com/api/native/payments',{method:'POST',headers:{'Content-Type':'application/json',...(origin?{Origin:origin}:{})},body:JSON.stringify({action:'connection-token'})});
 assert.equal((await route.POST(req('https://evil.example'))).status,403);const r=await route.POST(req());assert.equal(r.status,401);assert.ok(!JSON.stringify(await r.json()).includes('secret'));
});
test('client confirmation buttons call the private onsite POST and retain approval gating',async()=>{
 const ts=await import('typescript');let source=await readFile(new URL('../app/components/booking-payment.tsx',import.meta.url),'utf8');
 const changes=[];globalThis.__onsiteUiChanges=changes;const oldFetch=globalThis.fetch;let body;
 globalThis.fetch=async(url,options)=>{body=JSON.parse(options.body);return {ok:true,json:async()=>({onsite:true,paid:false})};};
 try{
  source=source.replace("import {useEffect,useState} from 'react';","const useEffect=()=>{};const useState=v=>[v==='checking'?'awaiting_approval':v,x=>globalThis.__onsiteUiChanges.push(x)];");
  let code=ts.default.transpileModule(source,{compilerOptions:{module:ts.default.ModuleKind.ESNext,target:ts.default.ScriptTarget.ES2022,jsx:ts.default.JsxEmit.ReactJSX}}).outputText.replaceAll('"react/jsx-runtime"',JSON.stringify(import.meta.resolve('react/jsx-runtime')));
  const Component=(await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'))).default;
  const root=Component({slug:'one',id:'private-id',token:'a'.repeat(64),pending:true,onsiteAllowed:true,onlineAllowed:true}),nodes=[];
  const walk=x=>{if(!x||typeof x!=='object')return;if(Array.isArray(x)){x.forEach(walk);return;}if(x.type==='button')nodes.push(x);walk(x.props?.children);};walk(root);
  const onsite=nodes.find(n=>n.props.children==='Pay on Site'),online=nodes.find(n=>n.props.children==='Make Payment');assert.ok(onsite);assert.equal(online.props.disabled,true);assert.equal(onsite.props.disabled,false);
  await onsite.props.onClick();await new Promise(resolve=>setTimeout(resolve,0));assert.equal(body.action,'onsite');assert.equal(body.slug,'one');assert.equal(body.token,'a'.repeat(64));assert.ok(changes.includes(true));
 }finally{globalThis.fetch=oldFetch;delete globalThis.__onsiteUiChanges;}
});
test('onsite collection rejects covered/free bookings and live objects on staging without recording payment',async t=>{
 const f=await fixture(t);await saveTerminalLocation(f.db,'u1','tml_one',f.api);
 const start=api=>startTerminalPayment(f.pool,f.scope,'https://staging.example',api||f.api);
 const set=async d=>f.query('UPDATE appointments SET data=$1 WHERE id=$2',[JSON.stringify({name:'Synthetic',serviceIds:['s'],services:['Coaching'],price:100,...d}),f.bookingId]);
 await set({membershipCovered:true});await assert.rejects(start(),/No payment/);assert.equal(f.creates,0);
 await set({price:0});await assert.rejects(start(),/No payment/);assert.equal(f.creates,0);
 await set({});await assert.rejects(start(async(path,o)=>{const r=await f.api(path,o);return path==='payment_intents'?{...r,livemode:true}:r;}),/sandbox/);
 assert.equal((await f.query('SELECT count(*)::int AS n FROM booking_payments')).rows[0].n,0);assert.equal((await f.query('SELECT count(*)::int AS n FROM booking_terminal_attempts')).rows[0].n,0);
});

test('Terminal rejects non-active v2 merchant capabilities even when legacy account flags are ready',async t=>{
 const f=await fixture(t);await saveTerminalLocation(f.db,'u1','tml_one',f.api);
 for(const status of ['pending','restricted','rejected','unsupported']){
  const api=async(path,o)=>path.startsWith('core/accounts/')?{id:'acct_one',configuration:{merchant:{capabilities:{card_payments:{status}}}}}:f.api(path,o);
  await assert.rejects(startTerminalPayment(f.pool,f.scope,'https://staging.example',api),/card payments must be active/);
  await assert.rejects(nativeConnectionToken(f.db,f.scope,api),/card payments must be active/);
 }
 assert.equal(f.creates,0);assert.equal((await f.query('SELECT count(*)::int AS n FROM booking_payments')).rows[0].n,0);
});

test('phone setup and native return links use the guarded universal owner route',async()=>{
 const [setup,native,owner]=await Promise.all(['app/onsite/setup/page.tsx','native/selahflow-pay/App.tsx','app/studio/[slug]/page.tsx'].map(f=>readFile(new URL('../'+f,import.meta.url),'utf8')));
 assert.match(setup,/href="\/studio\/owner"/);assert.match(native,/https:\/\/selahflow\.onrender\.com\/studio\/owner/);assert.match(native,/grant\.origin\+'\/studio\/owner'/);
 assert.doesNotMatch(setup,/href="\/owner"/);assert.doesNotMatch(native,/['"]\/owner['"]/);assert.match(owner,/actualSlug!==slug/);assert.match(owner,/redirect\('\/login'\)/);
});
