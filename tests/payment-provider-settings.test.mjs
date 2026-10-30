import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {paymentProviderSettings,savePaymentProviderPreference} from '../server/payment-provider-settings.mjs';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';

async function setup(){const db=new PGlite();for(const f of(await readdir(new URL('../migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile(new URL('../migrations/'+f,import.meta.url),'utf8'));await db.exec("INSERT INTO users(id,email,password_hash) VALUES('u1','one@example.com','hash'),('u2','two@example.com','hash'),('u3','old@example.com','hash'); INSERT INTO businesses(id,owner_id,slug,name,status) VALUES('b1','u1','one','One','active'),('b2','u2','two','Two','active'),('b3','u3','old','Old','archived'); INSERT INTO merchant_accounts(business_id,external_account_id,charges_enabled,onboarding_complete) VALUES('b1','acct_one',true,true)");return{db,pool:{query:(s,v)=>db.query(s,v),connect:async()=>({query:(s,v)=>db.query(s,v),release(){}})}};}

test('provider choice persists per business, never activates Helcim or changes Stripe/commission/payment records',async t=>{
 const {db,pool}=await setup();t.after(()=>db.close());
 const before=await db.query('SELECT * FROM merchant_accounts');
 const saved=await savePaymentProviderPreference(pool,'u1',{provider:'helcim'});
 assert.equal(saved.preferredProvider,'helcim');assert.equal(saved.helcim.available,false);assert.equal(saved.helcim.status,'activation_requested');assert.ok(saved.helcim.requestedAt);assert.match(saved.helcim.notice,/not enabled/);
 assert.equal((await paymentProviderSettings(pool,'u2')).preferredProvider,'stripe');
 assert.deepEqual((await db.query('SELECT * FROM merchant_accounts')).rows,before.rows);
 assert.equal((await db.query('SELECT * FROM first_customer_commissions')).rows.length,0);
 assert.equal((await db.query('SELECT * FROM booking_payments')).rows.length,0);
 assert.equal((await db.query('SELECT * FROM customer_memberships')).rows.length,0);
 const again=await savePaymentProviderPreference(pool,'u1',{provider:'helcim'});assert.equal(String(again.helcim.requestedAt),String(saved.helcim.requestedAt));
 const stripe=await savePaymentProviderPreference(pool,'u1',{provider:'stripe'});assert.equal(stripe.helcim.requestedAt,null);assert.equal(stripe.preferredProvider,'stripe');
 await assert.rejects(savePaymentProviderPreference(pool,'u3',{provider:'helcim'}),/FORBIDDEN/);
 await assert.rejects(savePaymentProviderPreference(pool,'unknown',{provider:'helcim'}),/FORBIDDEN/);
 for(const input of [{provider:'paypal'},{provider:'helcim',businessId:'b2'},{provider:'helcim',active:true},{provider:'helcim',bookingEnabled:false},{provider:'helcim',ready:true},null])await assert.rejects(savePaymentProviderPreference(pool,'u1',input),/Choose/);
 assert.equal((await paymentProviderSettings(pool,'u1')).preferredProvider,'stripe');
 await savePaymentProviderPreference(pool,'u2',{provider:'helcim'});
 await db.query("UPDATE businesses SET status='archived' WHERE id='b2'");
 assert.equal((await db.query("SELECT preferred_provider FROM business_payment_preferences WHERE business_id='b2'")).rows[0].preferred_provider,'helcim');
 await db.query("UPDATE businesses SET status='active' WHERE id='b2'");
 assert.equal((await paymentProviderSettings(pool,'u2')).preferredProvider,'helcim');
 await db.query("DELETE FROM businesses WHERE id='b2'");
 assert.equal((await db.query("SELECT * FROM business_payment_preferences WHERE business_id='b2'")).rows.length,0);
 await db.query("DELETE FROM users WHERE id='u2'");
 assert.equal((await paymentProviderSettings(pool,'u1')).preferredProvider,'stripe');
});

test('provider API protects authentication, origin, size and supplied activation flags',async t=>{
 let calls=0;globalThis.__providerRoute={requireOwner:async r=>{if(r.headers.get('x-test-owner')!=='u1')throw Error('AUTH_REQUIRED');return 'u1';},getPool:()=>({}),validOrigin:r=>r.headers.get('origin')==='https://selahflow.test',paymentProviderSettings:async()=>({preferredProvider:'stripe'}),savePaymentProviderPreference:async(_db,owner,input)=>{assert.equal(owner,'u1');calls++;if(Object.keys(input).some(k=>k!=='provider'))throw Error('Choose a valid provider.');return {preferredProvider:input.provider};}};
 t.after(()=>delete globalThis.__providerRoute);
 let source=await readFile(new URL('../app/api/studio/payment-provider/route.ts',import.meta.url),'utf8');source=source.replace(/^import .*;$/gm,'');source='const {requireOwner,getPool,validOrigin,paymentProviderSettings,savePaymentProviderPreference}=globalThis.__providerRoute;\n'+source;
 const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
 const route=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
 const get=await route.GET(new Request('https://selahflow.test/api/studio/payment-provider'));assert.equal(get.status,401);assert.match(get.headers.get('cache-control'),/private, no-store/);
 const post=(body,headers={})=>route.POST(new Request('https://selahflow.test/api/studio/payment-provider',{method:'POST',headers:{origin:'https://selahflow.test','x-test-owner':'u1',...headers},body}));
 assert.equal((await post('{"provider":"helcim"}',{origin:'https://evil.test'})).status,403);assert.equal(calls,0);
 assert.equal((await post('{"provider":"helcim"}',{'x-test-owner':''})).status,401);assert.equal(calls,0);
 assert.equal((await post('x'.repeat(201))).status,400);assert.equal(calls,0);
 assert.equal((await post('{')).status,400);
 assert.equal((await post('{"provider":"helcim","active":true}')).status,400);
 const saved=await post('{"provider":"helcim"}');assert.equal(saved.status,200);assert.deepEqual(await saved.json(),{preferredProvider:'helcim'});
});

async function renderComponent(file,replace=''){
 const require=createRequire(import.meta.url);let source=await readFile(new URL('../app/components/'+file,import.meta.url),'utf8');
 let code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
 if(replace)code=replace(code);
 code=code.replace('"react/jsx-runtime"',JSON.stringify(pathToFileURL(require.resolve('react/jsx-runtime')).href));
 return (await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'))).default;
}

test('comparison clearly explains full Helcim cost, recurring fees and unavailable collection with official sources',async()=>{
 const Component=await renderComponent('payment-provider-comparison.tsx');const html=renderToStaticMarkup(React.createElement(Component));
 assert.match(html,/<caption>Business payment provider comparison/);assert.match(html,/scope="col"/);assert.match(html,/scope="row"/);assert.match(html,/tabindex="0"/);
 for(const text of ['0.50%','0.7%','0.4%','not the total fee','not a quoted rate','not enabled','activation request','0.8%','0.5%','Advantages','Tradeoffs'])assert.ok(html.includes(text),text);
 for(const domain of ['https://stripe.com/pricing','https://stripe.com/billing/pricing','https://stripe.com/connect/pricing','https://legal.helcim.com/us/fee-disclosures/'])assert.ok(html.includes(domain));
});

test('Helcim selection renders pending activation separately from the active Stripe provider',async()=>{
 const status={preferredProvider:'helcim',activeProvider:'stripe',helcim:{status:'activation_requested',available:false,requestedAt:'2026-10-29',notice:'Helcim payment collection is not enabled in SelahFlow yet.'}};
 const Component=await renderComponent('owner-payment-setup.tsx',code=>code.replace(/import OwnerTerminalSetup[^\n]+;/,'const OwnerTerminalSetup=()=>null;').replace(/import OwnerStripePayments[^\n]+;/,'const OwnerStripePayments=()=>null;').replace(/import PaymentProviderComparison[^\n]+;/,'const PaymentProviderComparison=()=>null;').replace(/import \{ useCallback, useEffect, useState \} from 'react';/,`let i=0;const useState=v=>[i++===0?${JSON.stringify(status)}:i===2?'helcim':v,()=>{}];const useEffect=()=>{};const useCallback=f=>f;`));
 const html=renderToStaticMarkup(React.createElement(Component));
 for(const text of ['Payment setup','Current online provider','Stripe — verified connection','Helcim payment collection is not enabled','Save Helcim choice','Activation requested','does not link your account','does not move subscriptions'])assert.ok(html.includes(text),text);
 assert.match(html,/<input[^>]*checked=""[^>]*value="helcim"/);assert.match(html,/https:\/\/www.helcim.com\//);
 assert.doesNotMatch(html,/Helcim connected|Helcim — verified|Helcim ready/);
});
