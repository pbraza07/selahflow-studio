import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {JSDOM} from 'jsdom';
import ts from 'typescript';
process.env.NODE_ENV='test';
const React=await import('react'),{act}=React,require=createRequire(import.meta.url);
const source=ts.transpileModule(readFileSync(new URL('../app/components/owner-coupons.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
const exported={};new Function('require','exports',source)(require,exported);
test('owner can select lifetime preset, submit it, see it after reload and disable new redemptions',async()=>{
 const dom=new JSDOM('<div id="app"></div>',{url:'https://example.test',pretendToBeVisual:true});
 const globals=['window','document','navigator','Event','fetch','IS_REACT_ACT_ENVIRONMENT'],old=Object.fromEntries(globals.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 for(const [k,v] of Object.entries({window:dom.window,document:dom.window.document,navigator:dom.window.navigator,Event:dom.window.Event,IS_REACT_ACT_ENVIRONMENT:true}))Object.defineProperty(globalThis,k,{value:v,configurable:true,writable:true});
 const rows=[],posts=[];globalThis.fetch=async(url,opts={})=>{if(opts.method==='POST'){const p=JSON.parse(opts.body);posts.push(p);if(p.action==='saveCoupon')rows.push({id:'coupon',code:'FREEFOREVER',kind:'percent',value:100,duration:'forever',expires_at:null,active:true});else rows[0].active=p.active;return Response.json({ok:true});}return Response.json({coupons:rows});};
 const {createRoot}=await import('react-dom/client'),root=createRoot(document.querySelector('#app'));
 try{
  await act(async()=>root.render(React.createElement(exported.default)));
  await act(async()=>document.querySelector('input[type=checkbox]').click());
  assert.equal(document.querySelector('fieldset').disabled,true);
  await act(async()=>document.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
  assert.equal(posts[0].freeLifetime,true);assert.equal(posts[0].action,'saveCoupon');
  assert.match(document.querySelector('tbody').textContent,/Free lifetime/);
  await act(async()=>document.querySelector('tbody button').click());assert.equal(posts[1].active,false);assert.equal(document.querySelector('tbody button').textContent,'Enable');
 }finally{await act(async()=>root.unmount());dom.window.close();for(const k of globals){if(old[k])Object.defineProperty(globalThis,k,old[k]);else delete globalThis[k];}}
});
