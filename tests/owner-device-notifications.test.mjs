import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import {JSDOM} from 'jsdom';
import ts from 'typescript';
process.env.NODE_ENV='test';
const React=await import('react'),{act}=React,require=createRequire(import.meta.url);
const repo=new URL('../',import.meta.url).pathname;
function loader(){
 const cache=new Map();
 function load(file){
  if(cache.has(file))return cache.get(file);
  if(file.endsWith('.mjs'))return require(file);
  if(file.endsWith('.css'))return {__esModule:true,default:new Proxy({},{get:(_,key)=>String(key)})};
  const exports={};cache.set(file,exports);
  const source=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
  new Function('require','exports',source)(id=>{
   if(!id.startsWith('.'))return require(id);
   let target=path.resolve(path.dirname(file),id);
   if(!path.extname(target))for(const ext of ['.tsx','.ts'])if(existsSync(target+ext)){target+=ext;break;}
   return load(target);
  },exports);return exports;
 }
 return load;
}
async function fixture({ios=false,permission='default'}={}){
 const dom=new JSDOM('<div id="app"></div>',{url:'https://example.test/studio/example',pretendToBeVisual:true});
 const globals=['window','document','navigator','Notification','Event','fetch','IS_REACT_ACT_ENVIRONMENT'],old=Object.fromEntries(globals.map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 const calls=[],state={requests:0,saved:false,subscription:null};
 const sub={endpoint:'https://web.push.apple.com/fixture',options:{},toJSON:()=>({endpoint:'https://web.push.apple.com/fixture',keys:{p256dh:'fixture',auth:'fixture'}}),unsubscribe:async()=>{throw Error('Must not remove other business subscriptions');}};
 const registration={pushManager:{getSubscription:async()=>state.subscription,subscribe:async()=>{state.subscription=sub;return sub;}}};
 const notification={permission,requestPermission:async()=>{state.requests++;notification.permission='granted';return 'granted';}};
 const navigator={userAgent:ios?'Mozilla/5.0 Macintosh':'Fixture Browser',platform:ios?'MacIntel':'Linux',maxTouchPoints:ios?5:0,serviceWorker:{getRegistration:async()=>registration,register:async()=>registration,ready:Promise.resolve(registration)}};
 for(const [key,value] of Object.entries({window:dom.window,document:dom.window.document,navigator,Notification:notification,Event:dom.window.Event,IS_REACT_ACT_ENVIRONMENT:true}))Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});
 window.Notification=notification;window.PushManager=function(){};window.matchMedia=()=>({matches:false});
 window.HTMLDialogElement.prototype.showModal=function(){this.open=true;this.querySelector('button')?.focus();};window.HTMLDialogElement.prototype.close=function(){this.open=false;};
 globalThis.fetch=async(url,options={})=>{calls.push({url,method:options.method||'GET',permission:notification.permission});if(options.method==='POST'){const body=JSON.parse(options.body);if(body.action==='subscribe')state.saved=true;if(body.action==='unsubscribe'){assert.equal(body.endpoint,sub.endpoint);state.saved=false;}return Response.json({ok:true});}return Response.json({configured:true,publicKey:Buffer.alloc(65,1).toString('base64url'),subscribedDevices:state.saved?1:0,subscribedEndpoints:state.saved?[sub.endpoint]:[],businessName:'Fixture business'});};
 const Component=loader()(repo+'app/components/owner-device-notifications.tsx').default,{createRoot}=await import('react-dom/client'),root=createRoot(document.querySelector('#app'));
 await act(async()=>root.render(React.createElement(Component)));
 const button=label=>[...document.querySelectorAll('button')].find(node=>node.textContent.trim()===label);
 return {state,calls,notification,button,click:async node=>{assert.ok(node);await act(async()=>node.click());},cleanup:async()=>{await act(async()=>root.unmount());dom.window.close();for(const key of globals){if(old[key])Object.defineProperty(globalThis,key,old[key]);else delete globalThis[key];}}};
}
test('owner toolbar opens accessible device settings, asks permission on explicit enable, and disables only this business',async()=>{
 const f=await fixture();
 try{
  const trigger=f.button('Enable notifications');trigger.focus();assert.equal(f.state.requests,0);
  await f.click(trigger);const dialog=document.querySelector('dialog');assert.equal(dialog.open,true);assert.equal(trigger.getAttribute('aria-haspopup'),'dialog');assert.ok(document.getElementById(dialog.getAttribute('aria-labelledby')));assert.equal(document.body.style.overflow,'hidden');
  assert.match(dialog.textContent,/session, membership and package payment alerts/);assert.equal(f.state.requests,0,'Opening settings does not prompt for permission');
  await f.click(f.button('Enable notifications on this device'));assert.equal(f.state.requests,1);assert.equal(f.state.saved,true);assert.ok(f.button('Notifications on'));assert.equal(f.calls.find(c=>c.method==='POST').permission,'granted');
  await f.click(f.button('Disable on this device'));assert.equal(f.state.saved,false);assert.ok(f.state.subscription,'Shared browser subscription remains available');assert.ok(f.button('Enable notifications'));
  await act(async()=>dialog.dispatchEvent(new window.Event('cancel',{cancelable:true})));assert.equal(dialog.open,false);assert.equal(document.body.style.overflow,'');assert.equal(document.activeElement,trigger);
 }finally{await f.cleanup();}
});
test('denied device permission provides recovery instructions without registering a device',async()=>{
 const f=await fixture({permission:'denied'});
 try{await f.click(f.button('Enable notifications'));await f.click(f.button('Enable notifications on this device'));assert.equal(f.state.requests,0);assert.equal(f.state.saved,false);assert.equal(f.calls.some(c=>c.method==='POST'),false);assert.match(document.querySelector('[role=status]').textContent,/device\/browser notification settings/);}finally{await f.cleanup();}
});
test('iPad desktop user agent receives Home Screen guidance and cannot enable from a normal browser tab',async()=>{
 const f=await fixture({ios:true});
 try{await f.click(f.button('Enable notifications'));assert.match(document.querySelector('dialog').textContent,/iPhone \/ iPad.*Share → Add to Home Screen/);assert.equal(f.button('Enable notifications on this device').disabled,true);assert.equal(f.state.requests,0);}finally{await f.cleanup();}
});
