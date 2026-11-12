import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {JSDOM} from 'jsdom';
import ts from 'typescript';
process.env.NODE_ENV='test';
const React=await import('react'),{act}=React,require=createRequire(import.meta.url);
function component(name){const exported={},source=ts.transpileModule(readFileSync(new URL('../app/components/'+name+'.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;new Function('require','exports',source)(id=>id.endsWith('.module.css')?{__esModule:true,default:new Proxy({},{get:(_,key)=>key})}:require(id),exported);return exported.default;}
const product={id:'11111111-1111-4111-8111-111111111111',name:'Yoga mat',description:'A useful mat',price_cents:2000,tax_code:'txcd_99999999',has_image:true,updated_at:'2030-01-01',archived:false};
const address={line1:'123 Test St',city:'Test City',state:'FL',postal_code:'33101',country:'US'};
async function fixture(name,props,payload){const dom=new JSDOM('<div id="app"></div>',{url:'https://example.test/shop/example',pretendToBeVisual:true}),keys=['window','document','navigator','Event','fetch','sessionStorage','IS_REACT_ACT_ENVIRONMENT'],old=Object.fromEntries(keys.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 for(const [key,value] of Object.entries({window:dom.window,document:dom.window.document,navigator:dom.window.navigator,Event:dom.window.Event,sessionStorage:dom.window.sessionStorage,IS_REACT_ACT_ENVIRONMENT:true}))Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});
 dom.window.HTMLElement.prototype.scrollIntoView=()=>{};dom.window.HTMLElement.prototype.scrollBy=()=>{};
 const calls=[],order={id:'22222222-2222-4222-8222-222222222222',status:'pending',lines:[{id:product.id,name:product.name,qty:1,priceCents:2000}],subtotalCents:2000,taxCents:140,totalCents:2140,paymentMethod:'cash'};
 globalThis.fetch=async(url,options={})=>{if(options.method==='POST'){const input=JSON.parse(options.body);calls.push(input);return Response.json({...order,submitted:input.action==='submit'});}return Response.json(payload);};
 const {createRoot}=await import('react-dom/client'),root=createRoot(document.querySelector('#app'));await act(async()=>root.render(React.createElement(component(name),props)));
 const button=text=>[...document.querySelectorAll('button')].find(b=>b.textContent.includes(text));
 const click=async text=>{const b=button(text);assert.ok(b,text);await act(async()=>b.click());};
 const change=async(label,value)=>{const el=[...document.querySelectorAll('label')].find(l=>l.textContent.startsWith(label))?.querySelector('input,select');assert.ok(el,label);await act(async()=>{const setter=Object.getOwnPropertyDescriptor(el.tagName==='SELECT'?dom.window.HTMLSelectElement.prototype:dom.window.HTMLInputElement.prototype,'value').set;setter.call(el,value);el.dispatchEvent(new dom.window.Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}));});};
 return {calls,button,click,change,cleanup:async()=>{await act(async()=>root.unmount());dom.window.close();for(const key of keys){if(old[key])Object.defineProperty(globalThis,key,old[key]);else delete globalThis[key];}}};
}
test('product checkout requires client contact, reviews tax, and keeps on-site order pending until owner confirms receipt',async()=>{
 const f=await fixture('product-shop',{slug:'example'},{name:'Example',products:[product],pickupAddress:address});try{
 assert.ok(document.querySelector('[aria-label="Next products"]'));await f.click('Add to cart');assert.equal(f.button('Review checkout').disabled,true);
 await f.change('First and last name','Test Buyer');await f.change('Email','buyer@example.test');await f.change('Billing street address',address.line1);await f.change('City',address.city);await f.change('State / region',address.state);await f.change('Postal code',address.postal_code);await f.change('Payment method','cash');assert.equal(f.button('Review checkout').disabled,false);
 await f.click('Review checkout');assert.equal(f.calls[0].action,'quote');assert.equal(f.calls[0].email,'buyer@example.test');assert.deepEqual(f.calls[0].cart,[{id:product.id,qty:1}]);assert.match(document.body.textContent,/Local tax \$1.40/);assert.match(document.body.textContent,/Total \$21.40/);assert.equal(f.calls.length,1);
 await f.click('Place order');assert.deepEqual(Object.keys(f.calls[1]).sort(),['action','business','expectedTotal','key']);assert.equal(f.calls[1].expectedTotal,2140);assert.match(document.body.textContent,/awaiting payment at the business/);assert.doesNotMatch(document.body.textContent,/Payment confirmed\./);
 }finally{await f.cleanup();}
});
test('owner product catalog shares service allowance, shows compressed-picture controls and distinct product authorization',async()=>{
 let count;const f=await fixture('owner-products',{serviceCount:9,onCount:n=>count=n},{products:[product],allowance:{products:1,limit:10},orders:[],slug:'example',terms:'Separate product commission authorization',shop:null});try{assert.equal(count,1);assert.equal(f.button('Add product').disabled,true);assert.match(document.body.textContent,/10 of 10 slots used/);assert.match(document.body.textContent,/do not use client membership sessions/);await f.click('Edit');assert.match(document.body.textContent,/at most 250 KB/);assert.equal(f.button('Verify & save').disabled,true);assert.ok(document.querySelector('a[href="/shop/example"]'));}finally{await f.cleanup();}
});
