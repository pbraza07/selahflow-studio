import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import sharp from 'sharp';
import ts from 'typescript';
import {deleteOwnerClient} from '../server/owner-client-deletion.mjs';
import {validateProduct,compressProductImage,saveProduct,catalogAllowance,PRODUCT_TERMS,PRODUCT_TERMS_TEXT} from '../server/product-catalog.mjs';
import {checkSubscriptionLimits} from '../server/plan-entitlements.mjs';
import {saveProductShop,verifyProductTax} from '../server/product-tax.mjs';
import {productClient,quoteProductOrder,submitProductOrder,confirmProductCash,applyProductPayment,productCart} from '../server/product-orders.mjs';
import {cashBillingInfo,CASH_BILLING_TERMS_VERSION,CASH_BILLING_TERMS} from '../server/cash-commission-billing.mjs';
async function fixture(t){
 const old={...process.env};Object.assign(process.env,{APP_ENV:'staging',STRIPE_SECRET_KEY:'sk_test_fixture',STRIPE_CONNECT_WEBHOOK_SECRET:'whsec_fixture',STRIPE_PLATFORM_WEBHOOK_SECRET:'whsec_fixture'});
 const pg=new PGlite();t.after(async()=>{await pg.close();for(const key of Object.keys(process.env))if(!(key in old))delete process.env[key];Object.assign(process.env,old);});
 for(const file of(await readdir(new URL('../migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort())await pg.exec(await readFile(new URL('../migrations/'+file,import.meta.url),'utf8'));
 const query=async(sql,values)=>{if(sql.includes('pg_advisory_xact_lock'))return {rows:[],rowCount:0};const r=await pg.query(sql,values);return {...r,rowCount:r.rows.length||r.affectedRows||0};};
 const db={query,release(){}},tx=async fn=>{await query('BEGIN');try{const result=await fn();await query('COMMIT');return result;}catch(e){await query('ROLLBACK');throw e;}};
 await pg.exec("INSERT INTO users(id,email,password_hash) VALUES('owner','owner@example.test','x'),('other','other@example.test','x');INSERT INTO businesses(id,owner_id,slug,name,status) VALUES('business','owner','business','Business','active'),('other','other','other','Other','active');INSERT INTO merchant_accounts(business_id,external_account_id,charges_enabled,onboarding_complete) VALUES('business','acct_test',true,true);INSERT INTO settings(owner,data) VALUES('owner','{\"services\":[]}');");
 const business={id:'business',owner_id:'owner',slug:'business',name:'Business'},other={id:'other',owner_id:'other',slug:'other',name:'Other'};
 const address={line1:'123 Test St',line2:'',city:'Test City',state:'FL',postal_code:'33101',country:'US'};
 const calls=[],sessions=new Map(),idempotent=new Map(),idempotentInputs=new Map();let registration=true,taxCollecting=true;
 const api=async(path,o={})=>{calls.push({path,...o});if(o.idempotencyKey&&idempotent.has(o.idempotencyKey)){assert.deepEqual(o.params,idempotentInputs.get(o.idempotencyKey));return idempotent.get(o.idempotencyKey);}let result;
  if(path==='accounts/acct_test')result={id:'acct_test',charges_enabled:true,details_submitted:true};
  else if(path==='tax/settings')result={status:'active'};
  else if(path.startsWith('tax/registrations?'))result={data:registration?[{status:'active',country:'US',country_options:{us:{state:'FL'}}}]:[]};
  else if(path==='tax/locations')result={id:'taxloc_test',livemode:false};
  else if(path==='tax/calculations'){
   const amounts=Object.entries(o.params).filter(([k])=>/^line_items\[\d+\]\[amount\]$/.test(k)).map(([,v])=>v),subtotal=amounts.reduce((n,v)=>n+v,0),tax=Math.round(subtotal*.07);
   assert.equal(o.params['line_items[0][performance_location]'],'taxloc_test');
   result={id:'taxcalc_'+calls.length,livemode:false,amount_total:subtotal+tax,tax_amount_exclusive:tax,expires_at:Math.floor(Date.now()/1000)+86400,tax_breakdown:[{taxability_reason:taxCollecting?'standard_rated':'not_collecting'}]};
  }else if(path==='products'){assert.equal(o.params['tax_details[performance_location]'],'taxloc_test');result={id:'prod_'+calls.length};}
  else if(path==='checkout/sessions'){
   assert.equal(o.params['automatic_tax[enabled]'],true);assert.equal(o.params['automatic_tax[liability][type]'],'self');assert.match(o.params.integration_identifier,/^selahflow_products_[a-p]{8}$/);assert.ok(!Object.keys(o.params).some(k=>k.startsWith('payment_method_types')));
   result={id:'cs_'+calls.length,livemode:false,url:'https://checkout.stripe.com/c/test',status:'open',payment_status:'unpaid',metadata:{commission_claim_id:o.params['metadata[commission_claim_id]'],selahflow_product_order:o.params['metadata[selahflow_product_order]']},fee:o.params['payment_intent_data[application_fee_amount]']};sessions.set(result.id,result);
  }else if(path.startsWith('checkout/sessions/'))result=sessions.get(path.split('/').at(-1));
  else if(path.startsWith('payment_intents/')){const s=[...sessions.values()].find(s=>s.payment_intent===path.split('/')[1].split('?')[0]);result={id:s.payment_intent,livemode:false,status:'succeeded',currency:'usd',amount_received:s.amount_total,application_fee_amount:s.fee,latest_charge:{application_fee:'fee_test',amount_refunded:0}};}
  else if(path==='tax/transactions/create_from_calculation')result={id:'tax_test',livemode:false};
  else throw Error('Unexpected Stripe call '+path);
  if(o.idempotencyKey){idempotent.set(o.idempotencyKey,result);idempotentInputs.set(o.idempotencyKey,o.params);}return result;
 };
 const setup=()=>tx(()=>saveProductShop(db,business,{address,accepted:true,businessTaxLiability:true},api));
 const add=(extra={})=>tx(()=>saveProduct(db,business,{action:'save',name:'Yoga mat',description:'Test fixture',priceCents:2000,taxCode:'txcd_99999999',...extra}));
 const cashAuthorization=async()=>{const id=randomUUID();await query('INSERT INTO commission_billing_consents(id,business_id,owner_id,terms_version,signature_name,snapshot,activated_at) VALUES($1,$2,$3,$4,$5,$6,now())',[id,business.id,business.owner_id,CASH_BILLING_TERMS_VERSION,'Test Owner',CASH_BILLING_TERMS]);await query('INSERT INTO commission_billing_profiles(business_id,stripe_customer_id,stripe_payment_method_id,active_consent_id,authorized_at) VALUES($1,$2,$3,$4,now())',[business.id,'cus_test','pm_test',id]);};
 return {pg,db,tx,business,other,address,api,calls,sessions,setup,add,cashAuthorization,setRegistration:v=>registration=v,setCollecting:v=>taxCollecting=v};
}
test('product images are decoded, resized and bounded; catalog slots combine services/products including overrides',async t=>{
 const png=await sharp({create:{width:1800,height:1000,channels:3,background:'#459884'}}).png().toBuffer(),compressed=await compressProductImage(png),meta=await sharp(compressed).metadata();assert.equal(meta.format,'webp');assert.ok(meta.width<=1000&&compressed.length<=250000);assert.equal(meta.exif,undefined);
 await assert.rejects(compressProductImage(Buffer.from('<svg>'+('x'.repeat(100))+'</svg>')));assert.throws(()=>validateProduct({name:'X',priceCents:1,taxCode:'txcd_99999999'}),/price/);assert.throws(()=>productCart([{id:randomUUID(),qty:0}]),/quantities/);
 const f=await fixture(t),services=Array.from({length:9},(_,i)=>({id:'service-'+i}));await f.db.query('UPDATE settings SET data=$1 WHERE owner=$2',[JSON.stringify({services}),'owner']);
 const p=await f.add();assert.deepEqual(await catalogAllowance(f.db,f.business),{limit:10,services:9,products:1,used:10});await assert.rejects(f.add(),/package allows 10/);
 assert.throws(()=>checkSubscriptionLimits({plan_code:'free',status:'active'},{services},{services:[...services,{id:'tenth'}]},1),/allows up to 10/);
 await assert.rejects(f.tx(()=>saveProduct(f.db,f.other,{action:'archive',id:p.id})),/this business/);
 await f.tx(()=>saveProduct(f.db,f.business,{action:'archive',id:p.id}));await f.add({name:'Bottle'});assert.equal((await catalogAllowance(f.db,f.business)).products,1);
});
test('tax setup requires explicit product consent and registrations; checkout matches one client and server prices',async t=>{
 const f=await fixture(t);await assert.rejects(f.tx(()=>saveProductShop(f.db,f.business,{address:f.address,accepted:false,businessTaxLiability:true},f.api)),/Confirm/);f.setRegistration(false);await assert.rejects(f.setup(),/No active/);assert.equal((await f.db.query('SELECT * FROM product_shop_settings')).rows.length,0);f.setRegistration(true);await f.tx(()=>saveProductShop(f.db,f.business,{address:{...f.address,country:'United States',state:'Florida'},accepted:true,businessTaxLiability:true},f.api));
 const shop=(await f.db.query('SELECT * FROM product_shop_settings')).rows[0];assert.equal(shop.address.country,'US');assert.equal(shop.address.state,'FL');assert.equal(f.calls.find(c=>c.path==='tax/locations').params['address[state]'],'FL');assert.equal(shop.terms_version,PRODUCT_TERMS);assert.equal(shop.terms_snapshot,PRODUCT_TERMS_TEXT);
 const p=await f.add(),key=randomUUID(),input={key,cart:[{id:p.id,qty:2,priceCents:1}],name:'Test Buyer',email:'buyer@example.test',paymentMethod:'cash',address:f.address};
 await assert.rejects(f.tx(()=>quoteProductOrder(f.db,f.business,{...input,email:''},f.api)),/phone number, email/);
 f.setCollecting(false);await assert.rejects(f.tx(()=>quoteProductOrder(f.db,f.business,input,f.api)),/not collecting/);f.setCollecting(true);
 const order=await f.tx(()=>quoteProductOrder(f.db,f.business,input,f.api));assert.equal(order.subtotalCents,4000);assert.equal(order.taxCents,280);assert.equal(order.totalCents,4280);assert.ok(!('memberNumber' in order)&&!('customer_name' in order));
 const repeated=await f.tx(()=>quoteProductOrder(f.db,f.business,input,f.api));assert.equal(order.id,repeated.id);assert.equal((await f.db.query('SELECT * FROM business_client_profiles')).rows.length,1);
 const client=(await f.db.query('SELECT member_number FROM business_client_profiles')).rows[0];await assert.rejects(f.tx(()=>productClient(f.db,f.other,{name:'Test Buyer',memberNumber:client.member_number})),/could not uniquely match/);
 const same=await f.tx(()=>productClient(f.db,f.business,{name:'Test Buyer',memberNumber:client.member_number}));assert.equal(same.memberNumber,client.member_number);
 await assert.rejects(f.tx(()=>submitProductOrder(f.db,f.business,{key,expectedTotal:1},'https://example.test',f.api)),/Review the total/);
 await assert.rejects(f.tx(()=>confirmProductCash(f.db,f.business,{id:order.id,received:true},f.api)),/unpaid cash/);
});
test('cash/Zelle first product purchase accrues exact 10% once, with separate authorization and retained client history',async t=>{
 const f=await fixture(t);await f.setup();const p=await f.add();
 const input={key:randomUUID(),cart:[{id:p.id,qty:1}],name:'Test Buyer',phone:'+13055550123',paymentMethod:'zelle',address:f.address};
 const order=await f.tx(()=>quoteProductOrder(f.db,f.business,input,f.api));await assert.rejects(f.tx(()=>submitProductOrder(f.db,f.business,{key:input.key,expectedTotal:2140},'https://example.test',f.api)),/billing setup/);await f.cashAuthorization();await f.tx(()=>submitProductOrder(f.db,f.business,{key:input.key,expectedTotal:2140},'https://example.test',f.api));
 assert.equal((await f.db.query('SELECT status FROM product_orders WHERE id=$1',[order.id])).rows[0].status,'pending');
 await assert.rejects(f.tx(()=>confirmProductCash(f.db,f.business,{id:order.id,received:false},f.api)),/Confirm/);assert.equal((await f.db.query('SELECT * FROM first_customer_commissions')).rows.length,0);
 await f.tx(()=>confirmProductCash(f.db,f.business,{id:order.id,received:true},f.api));await f.tx(()=>confirmProductCash(f.db,f.business,{id:order.id,received:true},f.api));
 const claims=(await f.db.query('SELECT * FROM first_customer_commissions')).rows;assert.equal(claims.length,1);assert.equal(claims[0].kind,'product');assert.equal(claims[0].fee_cents,200);assert.equal(claims[0].eligible_cents,2000);assert.equal(claims[0].gross_cents,2140);assert.equal(claims[0].status,'accrued');assert.equal((await cashBillingInfo(f.db,'business')).unbilledProductCents,200);
 const sale=JSON.parse((await f.db.query("SELECT data FROM events WHERE kind='cash_sale'")).rows[0].data);assert.equal(sale.lines[0].name,'Yoga mat');assert.equal(sale.payment,'Zelle');assert.ok(sale.memberNumber);assert.equal(sale.tax,1.4);
 const second={...input,key:randomUUID(),paymentMethod:'cash'},next=await f.tx(()=>quoteProductOrder(f.db,f.business,second,f.api));await f.tx(()=>submitProductOrder(f.db,f.business,{key:second.key,expectedTotal:2140},'https://example.test',f.api));await f.tx(()=>confirmProductCash(f.db,f.business,{id:next.id,received:true},f.api));assert.equal((await f.db.query('SELECT * FROM first_customer_commissions')).rows.length,1);assert.equal((await f.db.query('SELECT * FROM product_orders WHERE paid_at IS NOT NULL')).rows.length,2);
 const profile=(await f.db.query('SELECT * FROM business_client_profiles WHERE owner=$1',['owner'])).rows[0];
 await f.tx(()=>deleteOwnerClient(f.db,{owner:'owner',businessId:'business',clientId:profile.id,client:{...profile,memberNumber:profile.member_number,history:[]},confirmPhrase:'DELETE CLIENT',api:f.api}));
 const retained=(await f.db.query('SELECT * FROM product_orders')).rows;assert.equal(retained.length,2);assert.ok(retained.every(o=>o.customer_name==='Deleted client'&&o.member_number===''&&Object.keys(o.customer_address).length===0&&o.paid_at&&o.tax_transaction_id));assert.equal((await f.db.query('SELECT * FROM client_financial_retention')).rows.length,2);assert.equal((await f.db.query('SELECT fee_cents FROM first_customer_commissions')).rows[0].fee_cents,200);
});
test('Stripe quotes reserve once; pending asynchronous payments do not fulfill and verified payment is idempotent',async t=>{
 const f=await fixture(t);await f.setup();const p=await f.add();const input={key:randomUUID(),cart:[{id:p.id,qty:1}],name:'Card Buyer',email:'card@example.test',paymentMethod:'stripe',address:f.address};
 const order=await f.tx(()=>quoteProductOrder(f.db,f.business,input,f.api));
 await assert.rejects(f.tx(async()=>{await submitProductOrder(f.db,f.business,{key:input.key,expectedTotal:2140},'https://example.test',f.api);throw Error('Simulated local commit interruption');}),/interruption/);
 const paid=await f.tx(()=>submitProductOrder(f.db,f.business,{key:input.key,expectedTotal:2140},'https://example.test',f.api));assert.match(paid.checkoutUrl,/checkout.stripe.com/);
 await f.tx(()=>submitProductOrder(f.db,f.business,{key:input.key,expectedTotal:2140},'https://example.test',f.api));assert.equal(f.calls.filter(c=>c.path==='checkout/sessions').length,2);assert.equal(f.sessions.size,1);
 const otherInput={...input,key:randomUUID()};await f.tx(()=>quoteProductOrder(f.db,f.business,otherInput,f.api));await assert.rejects(f.tx(()=>submitProductOrder(f.db,f.business,{key:otherInput.key,expectedTotal:2140},'https://example.test',f.api)),/Another first-time/);
 const session=[...f.sessions.values()][0];assert.equal(session.fee,200);assert.equal(await f.tx(()=>applyProductPayment(f.db,'business','acct_test',session,f.api)),false);
 Object.assign(session,{payment_status:'paid',currency:'usd',amount_subtotal:2000,amount_total:2140,total_details:{amount_tax:140},automatic_tax:{status:'complete'},payment_intent:'pi_test'});
 await assert.rejects(f.tx(()=>applyProductPayment(f.db,'other','acct_test',session,f.api)),/reconciliation/);
 await assert.rejects(f.tx(()=>applyProductPayment(f.db,'business','acct_test',{...session,amount_total:2139},f.api)),/total or tax/);
 await f.tx(()=>applyProductPayment(f.db,'business','acct_test',session,f.api));await f.tx(()=>applyProductPayment(f.db,'business','acct_test',session,f.api));
 assert.equal((await f.db.query("SELECT * FROM events WHERE kind='cash_sale'")).rows.length,1);assert.equal((await f.db.query('SELECT status FROM first_customer_commissions')).rows[0].status,'paid');
 const next=await f.tx(()=>submitProductOrder(f.db,f.business,{key:otherInput.key,expectedTotal:2140},'https://example.test',f.api));assert.ok(next.checkoutUrl);assert.equal([...f.sessions.values()].at(-1).fee,undefined);
});
test('owner product API requires authentication, origin and tenant scope, and support cannot accept business authorization',async t=>{
 const f=await fixture(t);globalThis.__productPool={...f.db,connect:async()=>f.db};globalThis.__productOwner=null;globalThis.__productActor='owner';t.after(()=>{delete globalThis.__productPool;delete globalThis.__productOwner;delete globalThis.__productActor;});
 let source=ts.transpileModule(await readFile(new URL('../app/api/studio/products/route.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
 source=source.replace(/import \{ requireOwner \}[^\n]+;/,"const requireOwner=async()=>{if(!globalThis.__productOwner)throw Error('AUTH_REQUIRED');return globalThis.__productOwner;};").replace(/import \{ getPool \}[^\n]+;/,'const getPool=()=>globalThis.__productPool;').replace(/import \{ supportActor \}[^\n]+;/,'const supportActor=async()=>({id:globalThis.__productActor});').replace(/(['"])\.\.\/\.\.\/\.\.\/\.\.\/server\/([^'"]+)\1/g,(_,quote,file)=>JSON.stringify(new URL('../server/'+file,import.meta.url).href));
 const route=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64')),origin=new URL(process.env.APP_URL||process.env.RENDER_EXTERNAL_URL||'https://example.test').origin;
 assert.equal((await route.GET(new Request(origin+'/api/studio/products'))).status,401);globalThis.__productOwner='owner';assert.equal((await route.POST(new Request(origin+'/api/studio/products',{method:'POST',headers:{Origin:'https://attacker.test'},body:'{}'}))).status,403);
 const post=body=>route.POST(new Request(origin+'/api/studio/products',{method:'POST',headers:{Origin:origin},body:JSON.stringify(body)}));
 const created=await post({action:'save',name:'Product',description:'',priceCents:1000,taxCode:'txcd_99999999',businessId:'other'});assert.equal(created.status,200);const {id}=await created.json();assert.equal((await f.db.query('SELECT business_id FROM business_products WHERE id=$1',[id])).rows[0].business_id,'business');
 globalThis.__productOwner='other';assert.equal((await post({action:'archive',id})).status,400);globalThis.__productOwner='owner';globalThis.__productActor='platform-admin';const denied=await post({action:'saveShop',accepted:true,businessTaxLiability:true,address:f.address});assert.match((await denied.json()).error,/signed-in business owner/);
 const response=await route.GET(new Request(origin+'/api/studio/products'));assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/no-store/);assert.equal((await response.json()).products.length,1);
});
