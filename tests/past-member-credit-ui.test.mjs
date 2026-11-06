import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {JSDOM} from 'jsdom';
import ts from 'typescript';
process.env.NODE_ENV='test';
const React=await import('react'),{act}=React,require=createRequire(import.meta.url),exports={};
const source=ts.transpileModule(readFileSync(new URL('../app/components/past-member-credit.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
new Function('require','exports',source)(id=>id==='./membership-modal'?{default:({children})=>React.createElement('section',null,children)}:require(id),exports);
test('past-credit dialog loads scoped visits and requires explicit current-credit confirmation; errors preserve selection and retries do not double submit',async()=>{
 const dom=new JSDOM('<div id="app"></div>',{url:'https://example.test',pretendToBeVisual:true});
 const globals=['window','document','navigator','Event','fetch','IS_REACT_ACT_ENVIRONMENT'],old=Object.fromEntries(globals.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 for(const [k,v] of Object.entries({window:dom.window,document:dom.window.document,navigator:dom.window.navigator,Event:dom.window.Event,IS_REACT_ACT_ENVIRONMENT:true}))Object.defineProperty(globalThis,k,{value:v,configurable:true,writable:true});
 let saved=0,fail=true,resolve;const calls=[];
 globalThis.fetch=async(url,o)=>{const body=JSON.parse(o.body);calls.push(body);if(body.action==='pastMemberVisits')return Response.json({visits:[{id:'visit',date:'2020-01-01',start:600,services:['Training'],status:'Confirmed'}]});if(fail)return Response.json({error:'Existing checkout needs review.'},{status:409});await new Promise(r=>{resolve=r;});return Response.json({ok:true});};
 const {createRoot}=await import('react-dom/client'),root=createRoot(document.getElementById('app'));
 try{
  await act(async()=>root.render(React.createElement(exports.default,{member:{id:'member',customer_name:'Example Person',member_number:'EP010190'},onClose(){},onSaved(){saved++;}})));
  assert.deepEqual(calls[0],{action:'pastMemberVisits',id:'member'});
  assert.match(document.body.textContent,/current available balance/);
  const form=document.querySelector('form'),submit=()=>form.querySelector('button[type=submit]');assert.equal(submit().disabled,true);
  await act(async()=>{const select=form.querySelector('select');select.value='visit';select.dispatchEvent(new Event('change',{bubbles:true}));});
  await act(async()=>{const field=form.querySelector('textarea');Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set.call(field,'Late entry authorized');field.dispatchEvent(new Event('input',{bubbles:true}));form.querySelector('input[type=checkbox]').click();});
  await act(async()=>submit().click());assert.match(form.querySelector('[role=alert]').textContent,/checkout/);assert.equal(form.querySelector('select').value,'visit');
  fail=false;await act(async()=>submit().click());assert.equal(submit().disabled,true);
  await act(async()=>form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));assert.equal(calls.length,3);
  assert.deepEqual(calls.at(-1),{action:'applyPastMemberCredit',id:'member',appointmentId:'visit',reason:'Late entry authorized',attendance:'Checked in'});
  await act(async()=>resolve());assert.equal(saved,1);
 }finally{await act(async()=>root.unmount());dom.window.close();for(const k of globals){if(old[k])Object.defineProperty(globalThis,k,old[k]);else delete globalThis[k];}}
});
