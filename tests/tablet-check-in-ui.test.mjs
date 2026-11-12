import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {JSDOM} from 'jsdom';
import ts from 'typescript';
import * as themes from '../server/themes.mjs';
import * as waivers from '../server/waiver-content.mjs';
import {saveCustomerBookingNotifications} from '../lib/browser-customer-booking.mjs';
process.env.NODE_ENV='test';
const React=await import('react'),{act}=React,require=createRequire(import.meta.url);
function component(name){const exported={},source=ts.transpileModule(readFileSync(new URL('../app/components/'+name+'.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;new Function('require','exports',source)(id=>id.endsWith('themes.mjs')?themes:id.endsWith('waiver-content.mjs')?waivers:id==='next/navigation'?{usePathname:()=>'/check-in/test-club'}:id==='./participation-waiver'?{WaiverDocument:()=>null}:id==='./kiosk-return-guard'?{clearKioskClientStorage(){}}:id.endsWith('.module.css')?{__esModule:true,default:new Proxy({},{get:(_,key)=>key})}:require(id),exported);return exported;}
async function fixture(products=[]){const dom=new JSDOM('<div id="app"></div>',{url:'https://example.test/check-in/test-club',pretendToBeVisual:true}),keys=['window','document','navigator','Event','fetch','localStorage','sessionStorage','IS_REACT_ACT_ENVIRONMENT','MutationObserver','getComputedStyle'],old=Object.fromEntries(keys.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 for(const [key,value] of Object.entries({window:dom.window,document:dom.window.document,navigator:dom.window.navigator,Event:dom.window.Event,localStorage:dom.window.localStorage,sessionStorage:dom.window.sessionStorage,MutationObserver:dom.window.MutationObserver,getComputedStyle:dom.window.getComputedStyle.bind(dom.window),IS_REACT_ACT_ENVIRONMENT:true}))Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});
 const calls=[];globalThis.fetch=async(url,options={})=>{if(options.method==='POST'){const input=JSON.parse(options.body);calls.push(input);return Response.json(input.action==='lookup'?{grant:'test',appointments:[{id:'a1',name:'Jane Doe',services:['Small group'],start:600,duration:60,status:'Confirmed',canCheckIn:true}]}:{ok:true,message:'Checked in! One membership session was used.'});}return Response.json(url.startsWith('/api/products')?{products}:{ready:true});};
 const {createRoot}=await import('react-dom/client'),root=createRoot(document.querySelector('#app'));await act(async()=>root.render(React.createElement(component('tablet-check-in').default,{business:{name:'Test Club',slug:'test-club',primary:'#831100',background:'#ffffff'}})));
 const button=text=>[...document.querySelectorAll('button')].find(b=>b.textContent===text),click=async text=>{const b=button(text);assert.ok(b,text);await act(async()=>b.click());};
 return {root,dom,calls,click,button,cleanup:async()=>{await act(async()=>root.unmount());dom.window.close();for(const key of keys){if(old[key])Object.defineProperty(globalThis,key,old[key]);else delete globalThis[key];}}};
}
test('tablet welcome uses business palette, requested destinations and hides products for empty catalog',async()=>{
 for(const products of [[],[{id:'p1'}]]){const f=await fixture(products);try{
 assert.equal(document.querySelector('main').style.getPropertyValue('--sf-button'),'#831100');assert.ok(document.querySelector('a[href="/book/test-club"]'));assert.ok(document.querySelector('a[href="/membership/test-club"]'));assert.equal(!!document.querySelector('a[href="/shop/test-club"]'),products.length>0);
 assert.match(document.body.textContent,/Review waiver/);assert.match(document.body.textContent,/Check membership status/);
 }finally{await f.cleanup();}}
});
test('tablet check-in selects appointment, records attendance, and clears client details on return',async()=>{const f=await fixture();try{
 await act(async()=>[...document.querySelectorAll('button')].find(b=>b.textContent.includes('I’m here for my session')).click());await f.click('Phone number');
 const input=document.querySelector('input');await act(async()=>{Object.getOwnPropertyDescriptor(f.dom.window.HTMLInputElement.prototype,'value').set.call(input,'+1 (813) 555-0100');input.dispatchEvent(new f.dom.window.Event('input',{bubbles:true}));});
 await act(async()=>document.querySelector('form').dispatchEvent(new f.dom.window.Event('submit',{bubbles:true,cancelable:true})));assert.equal(f.calls[0].kind,'phone');assert.equal(f.calls[0].value,'+1 (813) 555-0100');assert.match(document.body.textContent,/Jane Doe/);
 await f.click('Check in');assert.equal(f.calls[1].id,'a1');assert.equal(f.calls[1].grant,'test');assert.match(document.body.textContent,/One membership session was used/);assert.doesNotMatch(document.body.textContent,/Jane Doe/);
 await act(async()=>window.dispatchEvent(new Event('sf-kiosk-home')));assert.doesNotMatch(document.body.textContent,/Jane Doe|One membership session was used/);
 }finally{await f.cleanup();}});
test('shared tablet never stores booking access or opts clients into device notifications; reset clears client storage',async()=>{const f=await fixture();try{
 document.cookie='sf_kiosk_slug=test-club; Path=/';localStorage.setItem('selahflow:customer-bookings','private');sessionStorage.setItem('product-order:test-club','order');localStorage.setItem('unrelated-preference','keep');
 assert.equal(await saveCustomerBookingNotifications({token:'test-token',id:'test-booking',subscription:{endpoint:'test'}}),false);assert.equal(f.calls.length,0);
 component('kiosk-return-guard').clearKioskClientStorage();assert.equal(localStorage.getItem('selahflow:customer-bookings'),null);assert.equal(sessionStorage.getItem('product-order:test-club'),null);assert.equal(localStorage.getItem('unrelated-preference'),'keep');
 }finally{await f.cleanup();}});

test('inactivity resets client storage and grants without navigating away from the tablet welcome screen',async()=>{const f=await fixture(),originalInterval=globalThis.setInterval,originalNow=Date.now;let tick,clock=originalNow(),resets=0;try{
 document.cookie='sf_kiosk_slug=test-club; Path=/';sessionStorage.setItem('product-order:test-club','private');Date.now=()=>clock;globalThis.setInterval=fn=>{tick=fn;return 123456;};window.addEventListener('sf-kiosk-home',()=>resets++);
 await act(async()=>f.root.render(React.createElement(component('kiosk-return-guard').default)));assert.ok(tick);clock+=90001;await act(async()=>tick());assert.equal(resets,1);assert.equal(sessionStorage.getItem('product-order:test-club'),null);assert.equal(f.calls.at(-1).action,'reset');assert.equal(window.location.pathname,'/check-in/test-club');
 }finally{globalThis.setInterval=originalInterval;Date.now=originalNow;await f.cleanup();}});
