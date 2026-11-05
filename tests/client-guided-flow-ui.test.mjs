import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
import ts from 'typescript';
import {JSDOM} from 'jsdom';
process.env.NODE_ENV='test';
const React=await import('react'),{act}=React,require=createRequire(import.meta.url);
function load(file){
 const source=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,exported={};
 new Function('require','exports',source)(id=>{
  if(id.includes('/components/')){
   if(id.endsWith('/registration-fields'))return {__esModule:true,default:({values,onValue})=>React.createElement('label',null,'First name',React.createElement('input',{required:true,value:values.firstName||'',onChange:e=>onValue('firstName',e.target.value)}))};
   if(id.endsWith('/service-booking-actions'))return load(resolve(dirname(file),id+'.tsx'));
   return {__esModule:true,default:()=>null,makeBookingPayment:()=>{throw Error('Payment must not start during navigation');}};
  }
  if(id.startsWith('.')){const path=resolve(dirname(file),id);if(id.endsWith('.mjs'))return require(path);return load(path+'.ts');}
  return require(id);
 },exported);return exported;
}
const root=fileURLToPath(new URL('../',import.meta.url));
const Booking=load(resolve(root,'app/book/page.tsx')).default,Membership=load(resolve(root,'app/membership/[slug]/page.tsx')).default;
async function fixture(kind,{available=true,defer=false}={}){
 const dom=new JSDOM('<div id="app"></div>',{url:'https://example.test/'+(kind==='booking'?'book':'membership')+'/example',pretendToBeVisual:true});
 const names=['window','document','navigator','Event','fetch','IS_REACT_ACT_ENVIRONMENT'],old=Object.fromEntries(names.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 for(const [k,v]of Object.entries({window:dom.window,document:dom.window.document,navigator:dom.window.navigator,Event:dom.window.Event,IS_REACT_ACT_ENVIRONMENT:true}))Object.defineProperty(globalThis,k,{value:v,configurable:true,writable:true});
 Object.defineProperty(document,'visibilityState',{value:'visible',configurable:true});
 const scrolled=[];dom.window.HTMLElement.prototype.scrollIntoView=function(options){scrolled.push({element:this,options});};window.matchMedia=()=>({matches:true});
 const state={available,defer,release:null,fail:false,writeError:false,holdWrite:false,releaseWrite:null},calls=[];
 const config={slug:'example',name:'Example',open:8,close:18,policy:'Terms',services:[{id:'a',name:'Training',price:20,duration:30,paymentOptions:{online:true,onsite:true}},{id:'b',name:'Coaching',price:20,duration:30,paymentOptions:{online:true,onsite:true}}],staff:[{id:'coach',name:'Coach',role:'Trainer',services:['a','b'],bookingVisible:true}],theme:'sage'};
 globalThis.fetch=async(url,options={})=>{
  const body=options.body?JSON.parse(options.body):{};calls.push({url,body});
  if(!options.method)return Response.json(kind==='booking'?{config}:{slug:'example',name:'Example',plans:[{id:'p',name:'Ten sessions',priceCents:10000,interval:'month',billingType:'package',usageSummary:'10 sessions',groupId:null}],groups:[],canPay:true,registrationConfig:{}});
  if(body.action==='session_calendar')return Response.json({days:[{date:'2030-05-10',sessions:[{id:'session',service:'a',staff:'coach',start:600,name:'Scheduled Training',staffName:'Coach',staffVisible:true,autoAssignStaff:true,capacity:4,remaining:2}]}]});
  if(body.action==='calendar')return Response.json({days:[]});
  if(body.action==='availability'){
   if(state.defer){state.defer=false;await new Promise(r=>state.release=r);}
   if(state.fail)return Response.json({error:'Unable to verify availability. Try another time.'},{status:400});
   return Response.json({slots:state.available?[600]:[],sessionAvailability:{600:{id:'session',remaining:state.available?2:0,capacity:4}}});
  }
  if(body.action==='requestMembership'){
   if(state.holdWrite)await new Promise(r=>state.releaseWrite=r);
   return state.writeError?Response.json({error:'Review your registration details.'},{status:400}):Response.json({memberNumber:'TE1001'});
  }
  throw Error('Unexpected write '+JSON.stringify(body));
 };
 const {createRoot}=await import('react-dom/client'),reactRoot=createRoot(document.querySelector('#app'));
 await act(async()=>reactRoot.render(React.createElement(kind==='booking'?Booking:Membership)));
 const click=async text=>{const button=[...document.querySelectorAll('button')].find(b=>b.textContent.includes(text));assert.ok(button,'Missing '+text);await act(async()=>button.click());};
 const change=async(el,value)=>{await act(async()=>{Object.getOwnPropertyDescriptor(dom.window[el.tagName==='SELECT'?'HTMLSelectElement':'HTMLInputElement'].prototype,'value').set.call(el,value);el.dispatchEvent(new Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}));});};
 return {state,calls,scrolled,click,change,cleanup:async()=>{await act(async()=>reactRoot.unmount());dom.window.close();for(const k of names){if(old[k])Object.defineProperty(globalThis,k,old[k]);else delete globalThis[k];}}};
}
test('offer selection advances to details, focuses the step and preserves entered values on Back',async()=>{
 const f=await fixture('membership');try{
  await f.click('Ten sessions');assert.equal(document.activeElement.getAttribute('aria-label'),'Membership or package step 2 of 2');
  assert.equal(f.scrolled.at(-1).options.behavior,'instant');
  const field=[...document.querySelectorAll('input')].find(e=>e.required&&e.type==='text');await f.change(field,'Alex');
  await f.click('Choose another plan');assert.equal(document.activeElement.getAttribute('aria-label'),'Membership or package step 1 of 2');
  await f.click('Ten sessions');assert.equal([...document.querySelectorAll('input')].find(e=>e.required&&e.type==='text').value,'Alex');
  assert.ok([...document.querySelectorAll('button')].find(b=>b.textContent==='Make Payment').disabled);
  assert.equal(f.calls.filter(c=>c.body.action).length,0,'Navigation must not purchase or register');
 }finally{await f.cleanup();}
});
test('multi-service selection remains on Services; choosing an available time advances and Back restores selection',async()=>{
 const f=await fixture('booking');try{
  await f.click('Training');await f.click('Coaching');assert.equal(document.querySelectorAll('.booking-service[aria-pressed=true]').length,2);
  await f.click('Continue to available times');await f.change(document.querySelector('select'),'coach');
  assert.equal(document.activeElement.getAttribute('aria-label'),'Choose an available time');
  const slot=document.querySelector('.slot-grid button');assert.ok(slot);await act(async()=>slot.click());
  assert.equal(document.activeElement.getAttribute('aria-label'),'Booking step 3 of 3');
  assert.ok(document.querySelector('#public-confirm'));await f.click('Back');assert.equal(document.activeElement.getAttribute('aria-label'),'Booking step 2 of 3');
  await f.click('Edit services');assert.equal(document.activeElement.getAttribute('aria-label'),'Booking step 1 of 3');
  assert.equal(document.querySelectorAll('.booking-service[aria-pressed=true]').length,2);assert.equal(f.calls.some(c=>c.body.action==='book'),false);
 }finally{await f.cleanup();}
});
test('scheduled session waits for availability, then advances without making a booking',async()=>{
 const f=await fixture('booking',{defer:true});try{
  await f.click('Training');await f.click('Continue to available times');await f.click('Scheduled Training');
  assert.equal(document.querySelector('#public-confirm'),null);assert.equal([...document.querySelectorAll('button')].find(b=>b.textContent.includes('Scheduled Training')).disabled,true);
  await act(async()=>f.state.release());assert.equal(document.activeElement.getAttribute('aria-label'),'Booking step 3 of 3');
  assert.equal(f.calls.some(c=>c.body.action==='book'),false);
 }finally{await f.cleanup();}
});
for(const failure of ['full','network'])test('scheduled session '+failure+' failure keeps client on time selection and focuses recovery',async()=>{
 const f=await fixture('booking',{available:failure!=='full'});try{
  f.state.fail=failure==='network';await f.click('Training');await f.click('Continue to available times');await f.click('Scheduled Training');
  assert.equal(document.querySelector('#public-confirm'),null);assert.equal(document.activeElement.getAttribute('role'),'alert');
  assert.match(document.activeElement.textContent,failure==='full'?/no longer available/:/Unable to verify/);
  assert.equal(f.calls.some(c=>c.body.action==='book'),false);
 }finally{await f.cleanup();}
});

test('registration errors focus feedback; retry submits once and focuses the pending-payment result',async()=>{
 const f=await fixture('membership');try{
  await f.click('Ten sessions');
  await f.change([...document.querySelectorAll('input')].find(e=>e.required&&e.type==='text'),'Alex');
  await act(async()=>document.querySelector('input[type=checkbox]').click());
  f.state.writeError=true;await f.click('Register without payment');
  assert.equal(document.activeElement.getAttribute('role'),'alert');assert.match(document.activeElement.textContent,/Review your registration/);
  f.state.writeError=false;f.state.holdWrite=true;await f.click('Register without payment');
  const submitted=f.calls.filter(c=>c.body.action==='requestMembership').length;
  assert.equal([...document.querySelectorAll('button[type=submit]')].every(b=>b.disabled),true);
  await act(async()=>document.querySelector('button[value=request]').click());
  assert.equal(f.calls.filter(c=>c.body.action==='requestMembership').length,submitted);
  await act(async()=>f.state.releaseWrite());
  assert.equal(document.activeElement.getAttribute('aria-label'),'Registration result');
  assert.match(document.activeElement.textContent,/Payment is still pending/);
 }finally{await f.cleanup();}
});
