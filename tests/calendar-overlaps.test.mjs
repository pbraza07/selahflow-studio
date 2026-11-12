import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {JSDOM} from 'jsdom';
import ts from 'typescript';
import * as layout from '../server/calendar-layout.mjs';
const require=createRequire(import.meta.url);
const clock=n=>`${Math.floor(n/60)}:${String(n%60).padStart(2,'0')}`;
async function component(){
 const source=ts.transpileModule(await readFile(new URL('../app/components/owner-day-calendar.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 const module={exports:{}};
 new Function('require','module','exports',source)(id=>id.endsWith('calendar-layout.mjs')?layout:id.endsWith('lib/defaults')?{timeLabel:clock}:require(id),module,module.exports);
 return module.exports.default;
}
function assertNoHiddenEvents(events){
 const result=layout.layoutCalendarEvents(events);
 assert.equal(result.length,events.length);
 assert.equal(new Set(result.map(e=>e.key)).size,events.length);
 for(const a of result)for(const b of result)if(a.key!==b.key&&a.start<b.visualEnd&&b.start<a.visualEnd)assert.notEqual(a.lane,b.lane,`${a.key} overlaps ${b.key}`);
 return result;
}
test('six simultaneous private bookings, staggered bookings and session rosters never cover each other',()=>{
 const events=Array.from({length:6},(_,i)=>({key:'client-'+i,start:1080,duration:60}));
 events.push({key:'group-roster',start:1080,duration:90},{key:'later',start:1110,duration:60},{key:'next',start:1200,duration:60});
 const result=assertNoHiddenEvents(events);
 assert.equal(result[0].lanes,8);
 assert.equal(result.find(e=>e.key==='next').lanes,1);
 assert.deepEqual(layout.layoutCalendarEvents([...events].reverse()),result,'Stable positions do not depend on API order');
});
test('touching bookings reuse columns but short visible cards cannot obscure their neighbors',()=>{
 const events=[{key:'a',start:540,duration:60},{key:'b',start:600,duration:60},{key:'c',start:660,duration:15},{key:'d',start:675,duration:15}];
 const result=assertNoHiddenEvents(events);
 assert.equal(result[0].lanes,1);assert.equal(result[1].lanes,1);assert.equal(result[2].lanes,2);
 assert.deepEqual(layout.calendarTimeRange(9,18,[{start:420,duration:90},{start:1170,duration:90}]),{start:420,end:1260});
 assert.deepEqual(layout.calendarTimeRange(0,24,[]),{start:0,end:1440});
});
test('actual calendar keeps each published-session attendee, filters canceled/other-day bookings and opens the selected detail',async()=>{
 const Calendar=await component();
 const appointments=Array.from({length:6},(_,i)=>({id:String(i),date:'2026-11-10',start:1080,duration:60,staff:'coach',name:'Client '+i,services:['Private session'],status:'Confirmed',sessionId:'published'}));
 const props={config:{open:9,close:18,staff:[{id:'coach',name:'Coach',color:'blue',initials:'C'}],services:[{id:'private',name:'Private session',duration:60}]},appointments:[...appointments,{...appointments[0],id:'cancelled',status:'Cancelled'},{...appointments[0],id:'tomorrow',date:'2026-11-11'},{...appointments[0],id:'former',staff:'removed',name:'Former staff client'}],sessions:[{id:'published',date:'2026-11-10',start:1080,staff:'coach',service:'private',capacity:6}],date:'2026-11-10',staffFilter:'all',serviceAccent:()=>undefined,sessionLeft:()=>0,onAppointment(){},onSession(){},onPlan(){}};
 const html=renderToStaticMarkup(React.createElement(Calendar,props));
 assert.equal((html.match(/data-calendar-event="booking-/g)||[]).length,7);
 assert.equal((html.match(/data-calendar-event="session-/g)||[]).length,1);
 assert.match(html,/Former team member/);assert.doesNotMatch(html,/booking-cancelled|booking-tomorrow/);
 const filtered=renderToStaticMarkup(React.createElement(Calendar,{...props,staffFilter:'coach'}));
 assert.doesNotMatch(filtered,/Former staff client/);
 const dom=new JSDOM('<div id="root"></div>',{url:'https://example.test'});
 const old={window:globalThis.window,document:globalThis.document,IS_REACT_ACT_ENVIRONMENT:globalThis.IS_REACT_ACT_ENVIRONMENT};
 globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=typeof React.act==='function';
 const perform=async fn=>{if(typeof React.act==='function')await React.act(fn);else flushSync(fn);};
 const root=createRoot(document.getElementById('root'));let selected=null;
 try{
  await perform(()=>root.render(React.createElement(Calendar,{...props,onAppointment:a=>selected=a.id,onSession:s=>selected=s.id})));
  assert.equal(document.querySelectorAll('.cal-column > [data-calendar-event^="booking-"]').length,1,'Only the unmatched former-staff appointment stays outside');
  assert.equal(document.querySelectorAll('[data-calendar-session="session-published"] [data-calendar-event^="booking-"]').length,6);
  assert.equal(document.querySelectorAll('button button').length,0,'Client buttons must not be nested inside a roster button');
  for(let i=0;i<6;i++){await perform(()=>document.querySelector(`[data-calendar-event="booking-${i}"]`).click());assert.equal(selected,String(i),'Client click must not bubble into the roster action');}
  await perform(()=>document.querySelector('[data-calendar-event="session-published"]').click());assert.equal(selected,'published');
 }finally{await perform(()=>root.unmount());Object.assign(globalThis,old);dom.window.close();}
});

test('session grouping keeps unlinked and rescheduled bookings visible and separates recurring occurrences',async()=>{
 const Calendar=await component();
 const date='2026-11-12';
 const base={date,start:1020,duration:60,staff:'coach',name:'Test Client',status:'Confirmed',services:['Group']};
 const props={config:{open:9,close:18,staff:[{id:'coach',name:'Coach'}],services:[{id:'group',name:'Group',duration:60}]},date,staffFilter:'all',serviceAccent:()=>undefined,sessionLeft:()=>4,onAppointment(){},onSession(){},onPlan(){},sessions:[{id:'series__20261112',date,start:1020,staff:'coach',service:'group',capacity:8},{id:'empty',date,start:1080,staff:'coach',service:'group',capacity:8}],appointments:[{...base,id:'linked',sessionId:'series__20261112'},{...base,id:'no-show',status:'No-show',sessionId:'series__20261112'},{...base,id:'unlinked'},{...base,id:'other-occurrence',sessionId:'series__20261119'},{...base,id:'moved',start:1050,sessionId:'series__20261112'}]};
 const dom=new JSDOM(renderToStaticMarkup(React.createElement(Calendar,props)));
 const doc=dom.window.document;
 assert.equal(doc.querySelectorAll('[data-calendar-session="session-series__20261112"] .sf-session-client').length,2);
 for(const id of ['unlinked','other-occurrence','moved'])assert.ok(doc.querySelector(`.cal-column > [data-calendar-event="booking-${id}"]`));
 assert.match(doc.querySelector('[data-calendar-session="session-empty"]').textContent,/No clients booked yet/);
 dom.window.close();
});
