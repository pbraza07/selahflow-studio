import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {saveCustomerBookingNotifications} from '../lib/browser-customer-booking.mjs';

test('booking opt-in preserves private access before subscribing and checkout can continue without anonymous subscription',async()=>{
 const dom=new JSDOM('',{url:'https://example.test'}),names=['localStorage','fetch','Notification'];
 const old=Object.fromEntries(names.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 const token='a'.repeat(64),subscription={endpoint:'https://web.push.apple.com/test',keys:{p256dh:'public',auth:'auth'}},calls=[];
 try{
  Object.defineProperty(globalThis,'localStorage',{value:dom.window.localStorage,configurable:true});
  globalThis.Notification={permission:'granted'};
  globalThis.fetch=async(url,options)=>{
   assert.equal(JSON.parse(localStorage.getItem('selahflow:customer-bookings')).booking1,token,'Token saved before sending subscription');
   calls.push({url,options});return Response.json({subscribed:true});
  };
  assert.equal(await saveCustomerBookingNotifications({token,id:'booking1',subscription:null}),false);assert.equal(calls.length,0);
  assert.equal(await saveCustomerBookingNotifications({token:'',id:'booking1',subscription}),false);assert.equal(calls.length,0);
  assert.equal(await saveCustomerBookingNotifications({token,id:'booking1',subscription}),true);assert.equal(calls.length,1);
  assert.equal(calls[0].url,'/api/customer-booking');assert.equal(calls[0].options.headers.Authorization,'Bearer '+token);
  assert.deepEqual(JSON.parse(calls[0].options.body),{action:'subscribe',subscription});assert.ok(!calls[0].url.includes(token));
  Notification.permission='denied';await assert.rejects(saveCustomerBookingNotifications({token,id:'booking1',subscription}),/booking is saved/);assert.equal(calls.length,1);
  Notification.permission='granted';globalThis.fetch=async()=>Response.json({error:'Unavailable'},{status:503});
  await assert.rejects(saveCustomerBookingNotifications({token,id:'booking1',subscription}),/Enable booking notifications/);
  assert.equal(localStorage.getItem('selahflow:latest-booking'),'booking1','Failure does not discard access to the successful booking');
 }finally{dom.window.close();for(const key of names){if(old[key])Object.defineProperty(globalThis,key,old[key]);else delete globalThis[key];}}
});
