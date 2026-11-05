import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {JSDOM} from 'jsdom';
import ts from 'typescript';
process.env.NODE_ENV='test';
const {default:React,act}=await import('react');
const {createRoot}=await import('react-dom/client');
const require=createRequire(import.meta.url);
async function fixture({permission='default',ios=false,standalone=false}={}){
 const dom=new JSDOM('<div id="app"></div>',{url:'https://example.test',pretendToBeVisual:true});
 const names=['window','document','navigator','Notification','localStorage','fetch','IS_REACT_ACT_ENVIRONMENT'],prior=Object.fromEntries(names.map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]));
 let active=false,sub=null;const calls=[];
 const subscription={endpoint:'https://web.push.apple.com/my-device',toJSON:()=>({endpoint:'https://web.push.apple.com/my-device',keys:{p256dh:'public',auth:'auth'}})};
 const registration={pushManager:{getSubscription:async()=>sub}};
 Object.defineProperty(dom.window.navigator,'userAgent',{value:ios?'iPhone':'Test browser'});
 dom.window.matchMedia=()=>({matches:standalone});
 dom.window.PushManager=function(){};
 const notification={permission,requestPermission:async()=>{calls.push('permission');notification.permission='granted';return 'granted';}};dom.window.Notification=notification;
 Object.defineProperty(dom.window.navigator,'serviceWorker',{value:{getRegistration:async()=>registration,register:async()=>{calls.push('register');return registration;},ready:Promise.resolve(registration)}});
 const fetcher=async(url,options)=>{
  if(url==='/api/push/customer-key'){calls.push('config');return {ok:true,json:async()=>({publicKey:'fixture'})};}
  assert.equal(options.headers.Authorization,'Bearer '+'a'.repeat(64));const body=JSON.parse(options.body);calls.push(body);
  if(body.action==='subscribe')active=true;if(body.action==='unsubscribe')active=false;
  return {ok:true,json:async()=>({subscribed:active})};
 };
 for(const [name,value] of Object.entries({window:dom.window,document:dom.window.document,navigator:dom.window.navigator,Notification:notification,localStorage:dom.window.localStorage,fetch:fetcher,IS_REACT_ACT_ENVIRONMENT:true}))Object.defineProperty(globalThis,name,{value,writable:true,configurable:true});
 const exports={},code=ts.transpileModule(readFileSync(new URL('../app/components/customer-booking-push.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 new Function('require','exports',code)(id=>id.endsWith('browser-push.mjs')?{ensurePushSubscription:async()=>{calls.push('subscribe-browser');sub=subscription;return sub;}}:require(id),exports);
 const root=createRoot(document.querySelector('#app'));await act(async()=>root.render(React.createElement(exports.default,{id:'booking1',token:'a'.repeat(64)})));
 return {calls,notification,button:()=>document.querySelector('button'),click:async()=>act(async()=>document.querySelector('button').click()),cleanup:async()=>{await act(async()=>root.unmount());dom.window.close();for(const name of names){if(prior[name])Object.defineProperty(globalThis,name,prior[name]);else delete globalThis[name];}}};
}
test('client opts in by direct tap, preserves private local access, and disables only this booking on this device',async()=>{
 const f=await fixture();try{
  assert.equal(f.button().disabled,false);assert.match(f.button().textContent,/Enable booking notifications/);assert.equal(document.querySelector('a').getAttribute('href'),'/customer/booking?id=booking1');assert.ok(!document.body.innerHTML.includes('a'.repeat(64)));
  f.calls.length=0;await f.click();assert.equal(f.calls[0],'permission','permission stays in user gesture before network');assert.match(f.button().textContent,/Disable on this device/);assert.equal(JSON.parse(localStorage.getItem('selahflow:customer-bookings')).booking1,'a'.repeat(64));assert.match(document.querySelector('[role=status]').textContent,/enabled/);
  await f.click();assert.deepEqual(f.calls.at(-1),{action:'unsubscribe',endpoint:'https://web.push.apple.com/my-device'});assert.match(f.button().textContent,/Enable booking notifications/);
 }finally{await f.cleanup();}
});
test('blocked permission and uninstalled iPhone show actionable guidance without requesting permission',async()=>{
 for(const options of [{permission:'denied'},{ios:true}]){
  const f=await fixture(options);try{assert.equal(f.button().disabled,true);assert.match(document.body.textContent,options.ios?/Home Screen.*to book and enable notifications/:/Notifications are blocked/);assert.ok(!f.calls.includes('permission'));}finally{await f.cleanup();}
 }
});
